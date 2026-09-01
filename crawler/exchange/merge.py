"""导入 JSONL.gz 包到主 PG 库（v2 兼容）。

支持：
  * v2 master_id + job_unified 宽表（优先）
  * v1 仅 job_postings + job_posting_details
  * 相对路径媒体（相对 jsonl.gz 所在目录解析）

用法：
  python -m crawler.exchange.merge --input exports/zhilian_*.jsonl.gz
  python -m crawler.merge --input exports/zhilian_*.jsonl.gz
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
from pathlib import Path
from typing import Iterable

import psycopg

from crawler.exchange.common import (
    resolve_media_paths,
    split_unified_record,
    validate_master_id,
)

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


def _iter_records(path: Path) -> Iterable[dict]:
    opener = gzip.open if str(path).endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def _validate_meta(path: Path, expected_site: str | None) -> dict:
    head = next(_iter_records(path))
    if not head.get("_meta"):
        raise ValueError(f"{path}: 首行不是 _meta 包头，格式错")
    src = head.get("source")
    if expected_site and src != expected_site:
        raise ValueError(f"{path}: 包 source={src} 与期望 {expected_site} 不一致")
    enc = head.get("encoding", "utf-8")
    if enc.lower() != "utf-8":
        raise ValueError(f"{path}: 仅支持 utf-8 编码包，当前 {enc}")
    print(f"  • {path.name}  source={src}  schema={head.get('schema_version', 1)}  "
          f"exported_at={head.get('exported_at')}  since={head.get('since')}  "
          f"db_count_pre={head.get('db_count_pre')}")
    return head


def _build_posting_insert(tbl: str) -> str:
    cols = ("source_name", "source_id", "source_id_hash") + _POSTING_UPDATABLE
    col_list = ", ".join(cols)
    placeholders = ", ".join(f"%({c})s" for c in cols)
    updates = ", ".join(f"{c}=EXCLUDED.{c}" for c in _POSTING_UPDATABLE)
    return (
        f"INSERT INTO {tbl} ({col_list}) VALUES ({placeholders}) "
        f"ON CONFLICT (source_name, source_id_hash) DO UPDATE SET {updates} RETURNING id"
    )


def _build_detail_insert(tbl: str) -> str:
    col_list = ", ".join(_DETAIL_UPDATABLE)
    placeholders = ", ".join(f"%({c})s" for c in _DETAIL_UPDATABLE)
    updates = ", ".join(f"{c}=EXCLUDED.{c}" for c in _DETAIL_UPDATABLE)
    return (
        f"INSERT INTO {tbl} (job_id, {col_list}) VALUES (%s, {placeholders}) "
        f"ON CONFLICT (job_id) DO UPDATE SET {updates}"
    )


def _clean_posting(rec: dict) -> dict:
    return {k: rec[k] for k in ("source_name", "source_id", "source_id_hash") + _POSTING_UPDATABLE if k in rec}


def _clean_detail(rec: dict) -> dict:
    return {k: rec[k] for k in _DETAIL_UPDATABLE if k in rec}


def _load_package(path: Path) -> tuple[dict, list[dict], list[dict], list[dict]]:
    meta = _validate_meta(path, expected_site=None)
    package_dir = path.parent
    unified: list[dict] = []
    postings: list[dict] = []
    details: list[dict] = []

    for rec in _iter_records(path):
        table = rec.get("_table")
        if table == "job_unified":
            rec = resolve_media_paths(rec, package_dir)
            unified.append(rec)
        elif table == "job_postings":
            postings.append(rec)
        elif table == "job_posting_details":
            rec = resolve_media_paths(rec, package_dir)
            details.append(rec)
    return meta, unified, postings, details


def merge_file(
    conn: psycopg.Connection,
    path: Path,
    mode: str,
    batch: int,
    postings_tbl: str,
    details_tbl: str,
) -> dict:
    meta, unified_rows, postings_rows, details_rows = _load_package(path)
    posting_sql = _build_posting_insert(postings_tbl)
    detail_sql = _build_detail_insert(details_tbl)

    stats = {
        "postings_upserted": 0,
        "details_upserted": 0,
        "unified_upserted": 0,
        "skipped": 0,
        "master_id_mismatch": 0,
    }

    # v2：优先 job_unified 宽表
    if unified_rows:
        sid_to_jid: dict[str, int] = {}
        with conn.cursor() as cur:
            for u in unified_rows:
                mid = u.get("master_id")
                if mid and not validate_master_id(str(mid)):
                    stats["skipped"] += 1
                    continue
                posting, detail = split_unified_record(u)
                if not posting.get("source_name") or not posting.get("source_id_hash"):
                    stats["skipped"] += 1
                    continue
                try:
                    row = cur.execute(posting_sql, posting).fetchone()
                    if not row:
                        stats["skipped"] += 1
                        continue
                    jid = row[0]
                    sid = str(posting.get("source_id") or "")
                    sid_to_jid[sid] = jid
                    stats["postings_upserted"] += 1
                    if detail:
                        cur.execute(detail_sql, (jid, detail))
                        stats["details_upserted"] += 1
                    stats["unified_upserted"] += 1
                except Exception as e:
                    conn.rollback()
                    stats["skipped"] += 1
                    print(f"    ! skip unified {mid}: {e}")
                    cur = conn.cursor()
            conn.commit()
        return stats

    # v1 / 分表：postings + details，支持 master_id 校验
    details_by_mid: dict[str, dict] = {}
    details_by_sid: dict[str, dict] = {}
    for d in details_rows:
        mid = str(d.get("master_id") or "")
        sid = str(d.pop("job_id_source", None) or d.get("source_id") or "")
        if mid:
            details_by_mid[mid] = d
        if sid:
            details_by_sid[sid] = d

    sid_to_jid: dict[str, int] = {}
    with conn.cursor() as cur:
        for p in postings_rows:
            if not p.get("source_name") or not p.get("source_id_hash"):
                stats["skipped"] += 1
                continue
            mid = str(p.get("master_id") or "")
            sid = str(p.get("source_id") or "")
            try:
                row = cur.execute(posting_sql, _clean_posting(p)).fetchone()
                if row:
                    sid_to_jid[sid] = row[0]
                    stats["postings_upserted"] += 1
            except Exception as e:
                conn.rollback()
                stats["skipped"] += 1
                print(f"    ! skip posting {sid}: {e}")
                cur = conn.cursor()
                continue

            d = details_by_sid.get(sid) or (details_by_mid.get(mid) if mid else None)
            if not d:
                continue
            d_mid = str(d.get("master_id") or "")
            if mid and d_mid and mid != d_mid:
                stats["master_id_mismatch"] += 1
                print(f"    ! master_id mismatch posting={mid} detail={d_mid} sid={sid}")
                continue
            try:
                cur.execute(detail_sql, (sid_to_jid[sid], _clean_detail(d)))
                stats["details_upserted"] += 1
            except Exception as e:
                conn.rollback()
                print(f"    ! skip detail {sid}: {e}")
                cur = conn.cursor()
        conn.commit()

    return stats


def main() -> None:
    ap = argparse.ArgumentParser(description="导入 JSONL.gz 导出包到主 PG 库（v2）")
    ap.add_argument("--input", required=True, nargs="+", help="一个或多个 .jsonl.gz")
    ap.add_argument("--mode", choices=["upsert", "preserve"], default="upsert")
    ap.add_argument("--dry-run", action="store_true", help="仅校验包头")
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

    total = {"postings_upserted": 0, "details_upserted": 0, "unified_upserted": 0,
             "skipped": 0, "master_id_mismatch": 0}
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
