"""导出本地 PG 库为 JSONL.gz 包（v2）—— 5 个采集人各自运行。

v2 特性（严格）：
  1. 图片/视频 URL 下载到包旁 media/ 目录，JSON 内写相对路径，可随包导入
  2. 主数据 master_id 统一格式 YYYYMM#####（例 20260900001），从表用同一 master_id 关联
  3. 额外输出 job_unified 宽表，便于单表整合导入
  4. 全程 UTF-8，ensure_ascii=False，中文不乱码

文件格式（gzip JSONL，UTF-8）：
  第 1 行 _meta
  job_postings / job_posting_details / job_unified 行（均含 master_id）

用法：
  python -m crawler.exchange.export --site zhilian
  python -m crawler.export --site zhilian   # 等价 shim
"""

from __future__ import annotations

import argparse
import gzip
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

from crawler.exchange.common import (
    DETAIL_EXPORT_COLS,
    POSTING_EXPORT_COLS,
    MasterIdGenerator,
    build_meta_header,
    build_unified_record,
    dumps_json_line,
    localize_record_media,
)


def _open_out(path: Path):
    return gzip.open(path, "wt", encoding="utf-8", compresslevel=6)


def _json_safe(rec: dict) -> dict:
    out = dict(rec)
    if "extra" in out and out["extra"] is not None and not isinstance(out["extra"], dict):
        out["extra"] = Jsonb(out["extra"])
    return out


def export(
    site: str,
    dsn: str,
    output: Path,
    since: str | None,
    postings_tbl: str,
    details_tbl: str,
    *,
    download_media: bool = True,
) -> dict:
    counts: dict[str, int] = {
        "job_postings": 0,
        "job_posting_details": 0,
        "job_unified": 0,
        "media_downloaded": 0,
        "media_kept_remote": 0,
    }
    media_dir = output.parent / f"{output.stem}_media"
    rel_prefix = f"{output.stem}_media"

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT count(*) FROM {postings_tbl} WHERE source_name = %s",
                (site,),
            )
            existing = cur.fetchone()[0]
            if existing == 0 and since is None:
                print(f"⚠ 库里没有 source_name='{site}' 的数据，仍继续导出（将得到空包）")

            posting_sql = f"SELECT * FROM {postings_tbl} WHERE source_name = %s"
            posting_params: tuple = (site,)
            if since:
                posting_sql += " AND crawl_time >= %s"
                posting_params = (site, since)
            cur.execute(posting_sql, posting_params)
            posting_cols = [d[0] for d in cur.description]
            posting_rows = [dict(zip(posting_cols, row)) for row in cur.fetchall()]

            detail_sql = (
                f"SELECT d.*, p.source_id AS job_id_source FROM {details_tbl} d "
                f"JOIN {postings_tbl} p ON p.id = d.job_id WHERE p.source_name = %s"
            )
            detail_params: tuple = (site,)
            if since:
                detail_sql += " AND p.crawl_time >= %s"
                detail_params = (site, since)
            cur.execute(detail_sql, detail_params)
            detail_cols = [d[0] for d in cur.description]
            details_by_sid: dict[str, dict] = {}
            for row in cur.fetchall():
                drec = dict(zip(detail_cols, row))
                sid = drec.get("job_id_source") or drec.get("source_id")
                if sid is not None:
                    details_by_sid[str(sid)] = drec

            output.parent.mkdir(parents=True, exist_ok=True)
            id_gen = MasterIdGenerator()

            with _open_out(output) as w:
                header = build_meta_header(
                    source=site,
                    since=since,
                    db_count_pre=existing,
                    media_rel_prefix=rel_prefix,
                    counts={},
                )
                w.write(dumps_json_line(header))

                for posting in posting_rows:
                    posting = _json_safe(posting)
                    master_id = id_gen.next_id()
                    sid = str(posting.get("source_id") or "")
                    detail = details_by_sid.get(sid)

                    posting_out = {k: posting.get(k) for k in POSTING_EXPORT_COLS if k in posting}
                    posting_out.update({
                        "_table": "job_postings",
                        "master_id": master_id,
                        "_link": {
                            "master_id": master_id,
                            "child_table": "job_posting_details",
                            "foreign_key": "master_id",
                        },
                        "_db_id": posting.get("id"),
                    })
                    for k in ("source_name", "source_id", "source_id_hash"):
                        if k in posting:
                            posting_out[k] = posting[k]
                    posting_out["source_name"] = site

                    detail_out = None
                    if detail:
                        detail = _json_safe(detail)
                        detail_out = {k: detail.get(k) for k in DETAIL_EXPORT_COLS if k in detail}
                        detail_out.update({
                            "_table": "job_posting_details",
                            "master_id": master_id,
                            "job_id_source": sid,
                            "_link": {
                                "master_id": master_id,
                                "parent_table": "job_postings",
                                "foreign_key": "master_id",
                            },
                            "_db_detail_id": detail.get("detail_id"),
                            "_db_job_id": detail.get("job_id"),
                        })

                    unified = build_unified_record(master_id, posting_out, detail_out)

                    if download_media:
                        unified = localize_record_media(
                            unified,
                            master_id=master_id,
                            media_dir=media_dir,
                            rel_prefix=rel_prefix,
                        )
                        ms = unified.pop("_media_stats", {})
                        counts["media_downloaded"] += ms.get("downloaded", 0)
                        counts["media_kept_remote"] += ms.get("kept_remote", 0)
                        if detail_out is not None:
                            for fld in ("company_logo", "publisher_avatar", "extra"):
                                if fld in unified:
                                    detail_out[fld] = unified[fld]

                    w.write(dumps_json_line(posting_out))
                    counts["job_postings"] += 1

                    if detail_out:
                        w.write(dumps_json_line(detail_out))
                        counts["job_posting_details"] += 1

                    w.write(dumps_json_line(unified))
                    counts["job_unified"] += 1

    header["counts"] = counts
    counts["_meta"] = header
    counts["_existing"] = existing
    counts["_media_dir"] = str(media_dir)
    return counts


def main() -> None:
    ap = argparse.ArgumentParser(description="导出本地 PG 库为 JSONL.gz 包（v2 主数据 ID + 统一表）")
    ap.add_argument("--site", required=True,
                    help="source_name 标签（zhilian/boss/lagou/liepin/51job）")
    ap.add_argument("--dsn", default=None, help="psycopg DSN（默认 crawler.config.DB）")
    ap.add_argument("--output", default=None,
                    help="输出路径（默认 ./exports/{site}_crawl_{date}.jsonl.gz）")
    ap.add_argument("--since", default=None, help="增量：crawl_time >= YYYY-MM-DD")
    ap.add_argument("--no-media", action="store_true", help="不下载媒体，保留原始 URL")
    args = ap.parse_args()

    from crawler.config import DB
    dsn = args.dsn or DB.dsn
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out = Path(args.output) if args.output else Path(f"exports/{args.site}_crawl_{today}.jsonl.gz")

    print(f"→ 导出 site={args.site}  schema=v2  encoding=utf-8")
    print(f"→ 输出 {out}  模式={'增量 since='+args.since if args.since else '全量'}")
    res = export(
        args.site, dsn, out, args.since,
        DB.postings_table, DB.details_table,
        download_media=not args.no_media,
    )
    print("\n=== 导出完成 ===")
    for k, v in res.items():
        if k == "_meta":
            continue
        print(f"  {k}: {v}")
    print(f"\n文件大小: {out.stat().st_size/1024:.1f} KB")
    if res.get("_media_dir"):
        md = Path(res["_media_dir"])
        if md.is_dir():
            n = sum(1 for _ in md.iterdir() if _.is_file())
            print(f"媒体目录: {md}  ({n} 个文件)")


if __name__ == "__main__":
    sys.exit(main())
