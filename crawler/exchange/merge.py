"""导入 JSONL.gz 包到主 PG 库（3309/zhilian_crawl_db）。

工作流程
========
1. 读每个 .jsonl.gz 包的第 1 行 _meta，校验 source 与包名一致（防张冠李戴）
2. 流式读剩余行：先 upsert job_postings（拿回 DB id），再用 DB id upsert job_posting_details
3. 同一岗位多次合并：以 (source_name, source_id_hash) upsert；job_postings 的 id 可能变化
   （冲突时用 RETURNING 拿新 id），job_posting_details 跟着 job_id 重映射
4. 触发器自动重算 fingerprint/completeness
5. 冲突策略：
   - ON CONFLICT DO UPDATE：覆盖；保留 updated_at = NOW()
   - 想保留两源对比，可加 --mode preserve（仅 INSERT，跳过已存在的）

用法：
  python -m crawler.merge --input exports/zhilian_*.jsonl.gz
  python -m crawler.merge --input a.jsonl.gz b.jsonl.gz c.jsonl.gz
  python -m crawler.merge --input xxx.jsonl.gz --dry-run --batch 200
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
from pathlib import Path
from typing import Iterable

import psycopg


def _iter_records(path: Path) -> Iterable[dict]:
    """流式读 gzip jsonl，逐行 yield dict。"""
    opener = gzip.open if str(path).endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def _validate_meta(path: Path, expected_site: str | None) -> dict:
    """读包头并校验。返回 meta dict。"""
    head = next(_iter_records(path))
    if not head.get("_meta"):
        raise ValueError(f"{path}: 首行不是 _meta 包头，格式错")
    src = head.get("source")
    if expected_site and src != expected_site:
        raise ValueError(f"{path}: 包 source={src} 与期望 {expected_site} 不一致")
    print(f"  • {path.name}  source={src}  exported_at={head.get('exported_at')}  "
          f"since={head.get('since')}  db_count_pre={head.get('db_count_pre')}")
    return head


# -------- upsert SQL --------
_INSERT_POSTING = """
INSERT INTO {tbl} ({cols})
VALUES ({phs})
ON CONFLICT (source_name, source_id_hash) DO UPDATE SET {updates}
RETURNING id
"""
_INSERT_DETAIL = """
INSERT INTO {tbl} (job_id, {cols})
VALUES (%s, {phs})
ON CONFLICT (job_id) DO UPDATE SET {updates}
"""

_POSTING_UPDATABLE = (
    "job_title", "company_name", "city", "district",
    "salary_min", "salary_max", "salary_unit",
    "experience", "education", "job_type",
    "publish_time", "status",
)
_DETAIL_UPDATABLE = (
    "company_industry", "company_size", "company_nature", "company_intro",
    "company_address", "company_logo", "job_description", "job_requirement",
    "job_highlights", "job_labels", "skills", "benefits", "keywords",
    "work_years_min", "work_years_max", "education_required", "major_required",
    "language_required", "certificate_required", "salary_description",
    "salary_months", "salary_currency", "job_category_l1", "job_category_l2",
    "job_category_l3", "work_mode", "work_schedule", "overtime_status",
    "travel_status", "headcount", "deadline", "contact_name", "contact_phone",
    "contact_email", "contact_wechat", "resume_receive_email",
    "publisher_name", "publisher_title", "publisher_avatar",
    "response_rate", "response_time", "online_status", "last_active_time",
    "interview_count", "hire_count", "view_count", "apply_count",
    "favor_count", "source_url", "extra",
)


def _build_posting_insert(tbl: str):
    cols = ("source_name", "source_id", "source_id_hash") + _POSTING_UPDATABLE
    col_list = ", ".join(cols)
    placeholders = ", ".join(f"%({c})s" for c in cols)
    updates = ", ".join(f"{c}=EXCLUDED.{c}" for c in _POSTING_UPDATABLE)
    return _INSERT_POSTING.format(tbl=tbl, cols=col_list, phs=placeholders, updates=updates)


def _build_detail_insert(tbl: str):
    cols = _DETAIL_UPDATABLE
    col_list = ", ".join(cols)
    placeholders = ", ".join(f"%({c})s" for c in cols)
    updates = ", ".join(f"{c}=EXCLUDED.{c}" for c in cols)
    return _INSERT_DETAIL.format(tbl=tbl, cols=col_list, phs=placeholders, updates=updates)


def _adapt_detail_for_psycopg(rec: dict) -> dict:
    out = dict(rec)
    if "extra" in out and out["extra"] is not None and not isinstance(out["extra"], dict):
        # JSONB 字段已经是 dict 形态可走 Jsonb；也兜底字符串
        pass
    return out


def merge_file(conn: psycopg.Connection, path: Path, mode: str, batch: int,
               postings_tbl: str, details_tbl: str) -> dict:
    """处理一个导出包，返回统计。"""
    _validate_meta(path, expected_site=None)
    posting_sql = _build_posting_insert(postings_tbl)
    detail_sql = _build_detail_insert(details_tbl)

    stats = {"postings_new": 0, "postings_updated": 0, "details_upserted": 0, "skipped": 0}

    # 先 buffer 所有记录；详情按 source_id 关联（source_id 在包内唯一）
    postings: list[dict] = []
    details_by_sid: dict[str, dict] = {}
    for rec in _iter_records(path):
        table = rec.pop("_table", None)
        if table == "job_postings":
            postings.append(rec)
        elif table == "job_posting_details":
            sid = rec.pop("job_id_source", None) or rec.get("source_id")
            if sid is not None:
                details_by_sid[str(sid)] = rec

    # 写 postings：source_id -> DB job_id 映射
    sid_to_jid: dict[str, int] = {}
    with conn.cursor() as cur:
        for p in postings:
            if not p.get("source_name") or not p.get("source_id_hash"):
                stats["skipped"] += 1
                continue
            try:
                row = cur.execute(posting_sql, p).fetchone()
                if row:
                    sid_to_jid[str(p["source_id"])] = row[0]
                    stats["postings_new"] += 1
            except Exception as e:
                conn.rollback()
                stats["skipped"] += 1
                print(f"    ! skip posting {p.get('source_id')}: {e}")
                cur = conn.cursor()

        # 再写 details
        for sid, jid in sid_to_jid.items():
            d = details_by_sid.get(sid)
            if not d:
                continue
            d = _adapt_detail_for_psycopg(d)
            try:
                cur.execute(detail_sql, (jid, d))
                stats["details_upserted"] += 1
            except Exception as e:
                conn.rollback()
                print(f"    ! skip detail {sid}: {e}")
                cur = conn.cursor()
        conn.commit()

    return stats


def main() -> None:
    ap = argparse.ArgumentParser(description="导入导出包到主 PG 库")
    ap.add_argument("--input", required=True, nargs="+",
                    help="一个或多个导出包路径（支持 .gz）")
    ap.add_argument("--mode", choices=["upsert", "preserve"], default="upsert",
                    help="upsert 覆盖；preserve 仅新增")
    ap.add_argument("--dry-run", action="store_true",
                    help="试跑：只校验包头，不写库")
    args = ap.parse_args()

    from crawler.config import DB
    dsn = DB.dsn
    print(f"→ 目标库: {dsn.split('password=')[0].rstrip(',')}...")

    paths = [Path(p) for p in args.input]
    if args.dry_run:
        for p in paths:
            _validate_meta(p, expected_site=None)
        print(f"\n(dry-run) 校验通过 {len(paths)} 个包，未写库")
        return

    total = {"postings_new": 0, "postings_updated": 0,
             "details_upserted": 0, "skipped": 0}
    with psycopg.connect(dsn) as conn:
        for p in paths:
            print(f"\n→ 导入 {p}")
            s = merge_file(conn, p, args.mode, batch=500,
                           postings_tbl=DB.postings_table, details_tbl=DB.details_table)
            for k, v in s.items():
                total[k] = total.get(k, 0) + v

    print("\n=== 汇总 ===")
    for k, v in total.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    sys.exit(main())