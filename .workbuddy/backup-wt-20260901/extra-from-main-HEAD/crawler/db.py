"""DB 落库层 —— 把 JobItem 写入 job_postings + job_posting_details。

策略：
  * job_postings   : ON CONFLICT (source_name, source_id_hash) DO UPDATE
                     （触发器自动补 fingerprint / completeness）
  * job_posting_details: 拿总表返回的 id 作 job_id，
                     ON CONFLICT (job_id) DO UPDATE
一条岗位一个短事务，单条失败不影响整批。
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg.types.json import Jsonb

from crawler.config import DB
from crawler.models import JobItem


@contextmanager
def connect() -> Iterator[psycopg.Connection]:
    conn = psycopg.connect(DB.dsn)
    try:
        yield conn
    finally:
        conn.close()


_POSTING_COLS = JobItem.POSTING_FIELDS
_DETAIL_COLS = JobItem.DETAIL_FIELDS


def _posting_upsert_sql() -> str:
    cols = ", ".join(_POSTING_COLS)
    placeholders = ", ".join(f"%({c})s" for c in _POSTING_COLS)
    updates = ", ".join(
        f"{c}=EXCLUDED.{c}" for c in _POSTING_COLS
        if c not in ("source_name", "source_id_hash")
    )
    return (
        f"INSERT INTO {DB.postings_table} ({cols}) VALUES ({placeholders}) "
        f"ON CONFLICT (source_name, source_id_hash) DO UPDATE SET {updates} "
        f"RETURNING id"
    )


def _detail_upsert_sql() -> str:
    cols = ("job_id",) + _DETAIL_COLS
    col_list = ", ".join(cols)
    placeholders = ", ".join(f"%({c})s" for c in cols)
    updates = ", ".join(f"{c}=EXCLUDED.{c}" for c in _DETAIL_COLS)
    return (
        f"INSERT INTO {DB.details_table} ({col_list}) VALUES ({placeholders}) "
        f"ON CONFLICT (job_id) DO UPDATE SET {updates}"
    )


_POSTING_SQL = _posting_upsert_sql()
_DETAIL_SQL = _detail_upsert_sql()

# JSONB / list 字段需要适配 psycopg 类型
_JSONB_FIELDS = {"extra"}
_ARRAY_FIELDS = {"job_labels", "skills", "benefits", "keywords"}


def _coerce_posting(d: dict) -> dict:
    """总表全是标量列：dict/list 一律降级为 None，防止适配报错。"""
    return {k: (None if isinstance(v, (dict, list)) else v) for k, v in d.items()}


def _adapt_detail(d: dict) -> dict:
    out: dict = {}
    for k, v in d.items():
        if k in _JSONB_FIELDS:
            out[k] = Jsonb(v or {})
        elif k in _ARRAY_FIELDS:
            out[k] = v if isinstance(v, list) else ([] if v is None else [v])
        elif isinstance(v, (dict, list)):
            out[k] = None  # 标量列兜底降级
        else:
            out[k] = v
    return out


def save_item(conn: psycopg.Connection, item: JobItem) -> int | None:
    """写入单条岗位，返回 job_postings.id；失败返回 None（已回滚）。"""
    try:
        with conn.cursor() as cur:
            row = cur.execute(_POSTING_SQL, _coerce_posting(item.posting_dict())).fetchone()
            job_id = row[0]
            detail = _adapt_detail(item.detail_dict())
            detail["job_id"] = job_id
            cur.execute(_DETAIL_SQL, detail)
        conn.commit()
        return job_id
    except Exception:
        conn.rollback()
        raise


def save_batch(items: list[JobItem]) -> dict:
    """批量落库，返回 {saved, failed}。"""
    saved, failed = 0, 0
    with connect() as conn:
        for it in items:
            try:
                save_item(conn, it)
                saved += 1
            except Exception as e:  # noqa: BLE001
                failed += 1
                print(f"  ! 落库失败 {it.source_id}: {e}")
    return {"saved": saved, "failed": failed}
