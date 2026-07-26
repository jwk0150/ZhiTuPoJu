"""导出本地 PG 库为 JSONL.gz 包 —— 5 个采集人各自运行。

文件格式（每行一条记录的 JSONL，外层 gzip）：
  第 1 行 _meta 包头：{"_meta":true,"source":"zhilian","exported_at":"...","count":N}
  第 2..M 行 job_postings 行：{"_table":"job_postings", ...字段...}
  第 M+1.. 行 job_posting_details 行：{"_table":"job_posting_details", ...字段...}

特点：
  * 每条都带 source_name（与你源库一致），import 时校验一致性
  * 增量导出：--since YYYY-MM-DD 仅导 crawl_time >= since
  * 可指定任意 DSN —— 你可以远程连你本地 PG 导出，与汇总方零网络耦合

用法：
  # 全量
  python -m crawler.export --site zhilian

  # 增量（自某天）
  python -m crawler.export --site zhilian --since 2026-07-20

  # 远程 DSN 导出
  python -m crawler.export --site boss --dsn "host=10.0.0.5 port=5432 user=crawler ..."
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb


def _open_out(path: Path):
    return gzip.open(path, "wt", encoding="utf-8", compresslevel=6)


def _dump_table(cur, table: str, source_name: str, since: str | None,
                writer, count_holder: dict, postings_tbl: str, details_tbl: str):
    # details 没有 source_id 列，需要 JOIN 拿到 source_id 用于回灌时映射
    if table == "job_posting_details":
        sql = (f"SELECT d.*, p.source_id AS job_id_source FROM {details_tbl} d "
               f"JOIN {postings_tbl} p ON p.id = d.job_id WHERE p.source_name = %s")
        params: tuple = (source_name,)
        if since:
            sql += " AND p.crawl_time >= %s"
            params = (source_name, since)
    else:
        sql = f"SELECT * FROM {postings_tbl} WHERE source_name = %s"
        params = (source_name,)
        if since:
            sql += " AND crawl_time >= %s"
            params = (source_name, since)
    cur.execute(sql, params)

    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    for row in rows:
        rec = dict(zip(cols, row))
        # JSONB 字段：psycopg 已经给 dict；保险起见显式走 Jsonb 转一次
        if "extra" in rec and rec["extra"] is not None and not isinstance(rec["extra"], dict):
            rec["extra"] = Jsonb(rec["extra"])
        rec["_table"] = table
        # 强写 source_name（防错）
        if table == "job_postings" and "source_name" in rec:
            rec["source_name"] = source_name
        writer.write(json.dumps(rec, ensure_ascii=False, default=str))
        writer.write("\n")
        count_holder[table] = count_holder.get(table, 0) + 1


def export(site: str, dsn: str, output: Path, since: str | None,
            postings_tbl: str, details_tbl: str) -> dict:
    counts: dict = {}
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            # 校验：库里必须存在与 site 同名的 source
            cur.execute(
                f"SELECT count(*) FROM {postings_tbl} WHERE source_name = %s",
                (site,),
            )
            existing = cur.fetchone()[0]
            if existing == 0 and since is None:
                print(f"⚠ 库里没有 source_name='{site}' 的数据，仍继续导出（将得到空包）")

            output.parent.mkdir(parents=True, exist_ok=True)
            with _open_out(output) as w:
                # 包头
                header = {
                    "_meta": True,
                    "source": site,
                    "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
                    "since": since,
                    "db_count_pre": existing,
                }
                w.write(json.dumps(header, ensure_ascii=False) + "\n")

                _dump_table(cur, "job_postings", site, since, w, counts, postings_tbl, details_tbl)
                _dump_table(cur, "job_posting_details", site, since, w, counts, postings_tbl, details_tbl)

    counts["_meta"] = header
    counts["_existing"] = existing
    return counts


def main() -> None:
    ap = argparse.ArgumentParser(description="导出本地 PG 库为 JSONL.gz 包")
    ap.add_argument("--site", required=True,
                    help="source_name 标签，必须与库内一致（如 zhilian/boss/lagou/liepin/51job）")
    ap.add_argument("--dsn", default=None,
                    help="psycopg DSN 字符串（默认读 crawler.config.DB）")
    ap.add_argument("--output", default=None,
                    help="输出路径（默认 ./exports/{site}_crawl_{date}.jsonl.gz）")
    ap.add_argument("--since", default=None,
                    help="增量模式：仅导出 crawl_time >= YYYY-MM-DD")
    args = ap.parse_args()

    from crawler.config import DB
    dsn = args.dsn or DB.dsn
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out = Path(args.output) if args.output else Path(f"exports/{args.site}_crawl_{today}.jsonl.gz")

    print(f"→ 导出 site={args.site}  dsn={dsn.split('password=')[0].rstrip(',')}...")
    print(f"→ 输出 {out}  模式={'增量 since='+args.since if args.since else '全量'}")
    res = export(args.site, dsn, out, args.since, DB.postings_table, DB.details_table)
    print("\n=== 导出完成 ===")
    for k, v in res.items():
        print(f"  {k}: {v}")
    print(f"\n文件大小: {out.stat().st_size/1024:.1f} KB")


if __name__ == "__main__":
    sys.exit(main())