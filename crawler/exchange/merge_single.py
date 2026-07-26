"""merge_single.py —— 单文件版导入工具，发给汇总方即可。

不依赖 crawler 包，仅需：
  pip install "psycopg[binary]"

用法（命令行参数全部含默认值，最简用法一行）：
  python merge_single.py --input zhilian_roundtrip.jsonl.gz

  或完全自定义连接：
  python merge_single.py \
      --input a.jsonl.gz b.jsonl.gz \
      --dsn "host=127.0.0.1 port=3309 user=postgres password=123456 dbname=zhilian_crawl_db"

特性：
  * 零依赖：仅 psycopg
  * 幂等：同 (source_name, source_id_hash) 已存在则 UPDATE，否则 INSERT
  * 触发器自动：fingerprint / completeness / updated_at 由 PG 触发器重算
  * dry-run 模式：仅校验包头、不写库
  * 多包串行：一次命令吃多个 .jsonl.gz
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import sys
from pathlib import Path
from typing import Iterable

try:
    import psycopg
except ImportError:
    print("需要 psycopg：请先运行  pip install \"psycopg[binary]\"", file=sys.stderr)
    raise

# 默认目标表名(若 DSN 中数据库为 zhilian_crawl_db 则用 zhilian_ 前缀)
DEFAULT_PREFIX = os.getenv("PG_PREFIX", "zhilian")
POSTINGS_TABLE = os.getenv("PG_POSTINGS_TABLE", f"{DEFAULT_PREFIX}_job_postings")
DETAILS_TABLE = os.getenv("PG_DETAILS_TABLE", f"{DEFAULT_PREFIX}_job_posting_details")


# ---------- 包读取 ----------
def _iter_records(path: Path) -> Iterable[dict]:
    opener = gzip.open if str(path).endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def _validate_meta(path: Path) -> dict:
    head = next(_iter_records(path))
    if not head.get("_meta"):
        raise ValueError(f"{path}: 首行不是 _meta 包头，格式错")
    print(f"  • {path.name}  source={head.get('source')}  "
          f"exported_at={head.get('exported_at')}  "
          f"since={head.get('since')}  db_count_pre={head.get('db_count_pre')}")
    return head


# ---------- upsert SQL ----------
# 总表可更新列
_POSTING_UPDATABLE = (
    "job_title", "company_name", "city", "district",
    "salary_min", "salary_max", "salary_unit",
    "experience", "education", "job_type",
    "publish_time", "status",
)
_INSERT_POSTING = (
    f"INSERT INTO {POSTINGS_TABLE} (source_name, source_id, source_id_hash, "
    + ", ".join(_POSTING_UPDATABLE) + ") VALUES ("
    + ", ".join(f"%({c})s" for c in ("source_name", "source_id", "source_id_hash") + _POSTING_UPDATABLE)
    + ") ON CONFLICT (source_name, source_id_hash) DO UPDATE SET "
    + ", ".join(f"{c}=EXCLUDED.{c}" for c in _POSTING_UPDATABLE)
    + " RETURNING id"
)

# 细节表全部可更新列（不含 source_id / job_id）
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
_INSERT_DETAIL = (
    f"INSERT INTO {DETAILS_TABLE} (job_id, "
    + ", ".join(_DETAIL_UPDATABLE) + ") VALUES (%s, "
    + ", ".join(f"%({c})s" for c in _DETAIL_UPDATABLE)
    + ") ON CONFLICT (job_id) DO UPDATE SET "
    + ", ".join(f"{c}=EXCLUDED.{c}" for c in _DETAIL_UPDATABLE)
)


def _import_one(conn: psycopg.Connection, path: Path, stats: dict) -> None:
    """处理单个 .jsonl.gz 包，累加到 stats。"""
    _validate_meta(path)
    postings: list[dict] = []
    details_by_sid: dict[str, dict] = {}
    for rec in _iter_records(path):
        t = rec.pop("_table", None)
        if t == "job_postings":
            postings.append(rec)
        elif t == "job_posting_details":
            sid = rec.pop("job_id_source", None) or rec.get("source_id")
            if sid is not None:
                details_by_sid[str(sid)] = rec

    sid_to_jid: dict[str, int] = {}
    with conn.cursor() as cur:
        for p in postings:
            if not p.get("source_name") or not p.get("source_id_hash"):
                stats["skipped"] += 1
                continue
            try:
                row = cur.execute(_INSERT_POSTING, p).fetchone()
                if row:
                    sid_to_jid[str(p["source_id"])] = row[0]
                    stats["postings_upserted"] += 1
            except Exception as e:
                conn.rollback()
                stats["skipped"] += 1
                print(f"    ! skip posting {p.get('source_id')}: {e}")
                cur = conn.cursor()

        for sid, jid in sid_to_jid.items():
            d = details_by_sid.get(sid)
            if not d:
                continue
            try:
                cur.execute(_INSERT_DETAIL, (jid, d))
                stats["details_upserted"] += 1
            except Exception as e:
                conn.rollback()
                print(f"    ! skip detail {sid}: {e}")
                cur = conn.cursor()
        conn.commit()


def main() -> int:
    ap = argparse.ArgumentParser(
        description="单文件版 merge：导入 .jsonl.gz 包到 PG 库（零依赖）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("--input", required=True, nargs="+",
                    help="一个或多个 .jsonl.gz 路径")
    ap.add_argument("--dsn", default="host=127.0.0.1 port=3309 user=postgres "
                                       "password=123456 dbname=zhilian_crawl_db",
                    help="psycopg DSN 字符串")
    ap.add_argument("--dry-run", action="store_true",
                    help="仅校验包头、不写库")
    args = ap.parse_args()

    paths = [Path(p) for p in args.input]
    print(f"→ 目标库: {args.dsn.split('password=')[0].rstrip(',')}...")

    if args.dry_run:
        for p in paths:
            _validate_meta(p)
        print(f"\n(dry-run) 校验通过 {len(paths)} 个包，未写库。")
        return 0

    stats = {"postings_upserted": 0, "details_upserted": 0, "skipped": 0}
    with psycopg.connect(args.dsn) as conn:
        for p in paths:
            print(f"\n→ 导入 {p}")
            _import_one(conn, p, stats)

    print("\n=== 汇总 ===")
    print(f"  postings upserted: {stats['postings_upserted']}")
    print(f"  details  upserted: {stats['details_upserted']}")
    print(f"  skipped:           {stats['skipped']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())