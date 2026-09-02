"""merge_single.py —— 单文件版导入工具（v2 兼容），发给汇总方即可。

依赖：pip install "psycopg[binary]"

v2 支持：
  * master_id（YYYYMM#####）关联主从表
  * job_unified 宽表单表导入
  * 相对路径媒体（相对 .jsonl.gz 所在目录）
  * UTF-8 中文不乱码

用法：
  python merge_single.py --input zhilian_roundtrip.jsonl.gz
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import sys
from pathlib import Path
from typing import Iterable

try:
    import psycopg
except ImportError:
    print('需要 psycopg：请先运行  pip install "psycopg[binary]"', file=sys.stderr)
    raise

DEFAULT_PREFIX = os.getenv("PG_PREFIX", "zhilian")
POSTINGS_TABLE = os.getenv("PG_POSTINGS_TABLE", f"{DEFAULT_PREFIX}_job_postings")
DETAILS_TABLE = os.getenv("PG_DETAILS_TABLE", f"{DEFAULT_PREFIX}_job_posting_details")
MASTER_ID_RE = re.compile(r"^\d{11}$")

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
_POSTING_KEYS = ("source_name", "source_id", "source_id_hash") + _POSTING_UPDATABLE

_INSERT_POSTING = (
    f"INSERT INTO {POSTINGS_TABLE} (source_name, source_id, source_id_hash, "
    + ", ".join(_POSTING_UPDATABLE) + ") VALUES ("
    + ", ".join(f"%({c})s" for c in _POSTING_KEYS)
    + ") ON CONFLICT (source_name, source_id_hash) DO UPDATE SET "
    + ", ".join(f"{c}=EXCLUDED.{c}" for c in _POSTING_UPDATABLE)
    + " RETURNING id"
)
_INSERT_DETAIL = (
    f"INSERT INTO {DETAILS_TABLE} (job_id, "
    + ", ".join(_DETAIL_UPDATABLE) + ") VALUES (%s, "
    + ", ".join(f"%({c})s" for c in _DETAIL_UPDATABLE)
    + ") ON CONFLICT (job_id) DO UPDATE SET "
    + ", ".join(f"{c}=EXCLUDED.{c}" for c in _DETAIL_UPDATABLE)
)


def _iter_records(path: Path) -> Iterable[dict]:
    opener = gzip.open if str(path).endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def _validate_meta(path: Path) -> dict:
    head = next(_iter_records(path))
    if not head.get("_meta"):
        raise ValueError(f"{path}: 首行不是 _meta 包头")
    if head.get("encoding", "utf-8").lower() != "utf-8":
        raise ValueError(f"{path}: 仅支持 utf-8 编码")
    print(f"  • {path.name}  source={head.get('source')}  schema={head.get('schema_version', 1)}  "
          f"exported_at={head.get('exported_at')}")
    return head


def _resolve_media(rec: dict, package_dir: Path) -> dict:
    out = dict(rec)
    for fld in ("company_logo", "publisher_avatar"):
        val = out.get(fld)
        if isinstance(val, str) and not val.startswith("http"):
            p = (package_dir / val).resolve()
            if p.is_file():
                out[fld] = str(p)
    extra = out.get("extra")
    if isinstance(extra, dict):
        ex = dict(extra)
        for k, v in ex.items():
            if isinstance(v, str) and not v.startswith("http"):
                p = (package_dir / v).resolve()
                if p.is_file():
                    ex[k] = str(p)
        out["extra"] = ex
    return out


def _pick(rec: dict, keys: tuple[str, ...]) -> dict:
    return {k: rec[k] for k in keys if k in rec}


def _import_one(conn: psycopg.Connection, path: Path, stats: dict) -> None:
    _validate_meta(path)
    package_dir = path.parent
    unified: list[dict] = []
    postings: list[dict] = []
    details_by_sid: dict[str, dict] = {}

    for rec in _iter_records(path):
        t = rec.get("_table")
        if t == "job_unified":
            unified.append(_resolve_media(rec, package_dir))
        elif t == "job_postings":
            postings.append(rec)
        elif t == "job_posting_details":
            sid = str(rec.pop("job_id_source", None) or rec.get("source_id") or "")
            if sid:
                details_by_sid[sid] = _resolve_media(rec, package_dir)

    with conn.cursor() as cur:
        if unified:
            for u in unified:
                mid = u.get("master_id")
                if mid and not MASTER_ID_RE.match(str(mid)):
                    stats["skipped"] += 1
                    continue
                posting = _pick(u, _POSTING_KEYS)
                detail = _pick(u, _DETAIL_UPDATABLE)
                if not posting.get("source_name") or not posting.get("source_id_hash"):
                    stats["skipped"] += 1
                    continue
                try:
                    row = cur.execute(_INSERT_POSTING, posting).fetchone()
                    if not row:
                        stats["skipped"] += 1
                        continue
                    if detail:
                        cur.execute(_INSERT_DETAIL, (row[0], detail))
                        stats["details_upserted"] += 1
                    stats["postings_upserted"] += 1
                    stats["unified_upserted"] += 1
                except Exception as e:
                    conn.rollback()
                    stats["skipped"] += 1
                    print(f"    ! skip unified {mid}: {e}")
                    cur = conn.cursor()
            conn.commit()
            return

        for p in postings:
            if not p.get("source_name") or not p.get("source_id_hash"):
                stats["skipped"] += 1
                continue
            sid = str(p.get("source_id") or "")
            try:
                row = cur.execute(_INSERT_POSTING, _pick(p, _POSTING_KEYS)).fetchone()
                if not row:
                    stats["skipped"] += 1
                    continue
                stats["postings_upserted"] += 1
                d = details_by_sid.get(sid)
                if d:
                    cur.execute(_INSERT_DETAIL, (row[0], _pick(d, _DETAIL_UPDATABLE)))
                    stats["details_upserted"] += 1
            except Exception as e:
                conn.rollback()
                stats["skipped"] += 1
                print(f"    ! skip posting {sid}: {e}")
                cur = conn.cursor()
        conn.commit()


def main() -> int:
    ap = argparse.ArgumentParser(description="单文件 merge（v2 master_id + unified）")
    ap.add_argument("--input", required=True, nargs="+")
    ap.add_argument("--dsn", default="host=127.0.0.1 port=3309 user=postgres password=123456 dbname=zhilian_crawl_db")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    paths = [Path(p) for p in args.input]
    if args.dry_run:
        for p in paths:
            _validate_meta(p)
        print(f"\n(dry-run) 校验通过 {len(paths)} 个包")
        return 0

    stats = {"postings_upserted": 0, "details_upserted": 0, "unified_upserted": 0, "skipped": 0}
    with psycopg.connect(args.dsn) as conn:
        for p in paths:
            print(f"\n→ 导入 {p}")
            _import_one(conn, p, stats)

    print("\n=== 汇总 ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
