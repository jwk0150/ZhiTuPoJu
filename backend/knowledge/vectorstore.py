# -*- coding: utf-8 -*-
"""VectorStore 抽象 —— 业务代码只依赖本接口。

实现：
- CubeVectorStore : 基于 PostgreSQL cube 扩展（免安装兜底，当前默认启用）
- PgVectorStore   : 基于 pgvector（未来安装后一键切换）

切换方式：config.VECTOR_STORE = "cube" | "pgvector"，
         KnowledgeService 通过工厂函数 get_vectorstore() 创建。
"""
from __future__ import annotations

import psycopg2
from abc import ABC, abstractmethod
from typing import Any, Iterable

from backend.config import config


class VectorStore(ABC):
    """最小向量存储接口（以 chunk_id 为键）。"""

    name: str = "base"

    @abstractmethod
    def upsert_many(self, items: Iterable[tuple[int, list[float]]]) -> int:
        """批量写入/更新 chunk 的 embedding。返回成功条数。"""

    @abstractmethod
    def query(
        self,
        embedding: list[float],
        top_k: int = 10,
        chunk_ids: list[int] | None = None,
    ) -> list[tuple[int, float]]:
        """按余弦相似度召回，返回 [(chunk_id, score)]，score∈[0,1] 越大越相似。"""

    @abstractmethod
    def count(self) -> int:
        """已有向量的 chunk 数量。"""


# ============================================================
# cube 实现（默认）
# ============================================================
class CubeVectorStore(VectorStore):
    """基于 PostgreSQL cube 扩展。

    存归一化单位向量（512 维 ≤ cube 的 2048 上限），
    ORDER BY embedding <-> 目标（欧氏距离升序）即余弦相似度降序：
        余弦相似度 = 1 - (L2²)/2   （单位向量）
    """

    name = "cube"

    def __init__(self, conn_info: dict | None = None) -> None:
        self._conn_info = conn_info or {
            "host": config.PG_HOST,
            "port": config.PG_PORT,
            "user": config.PG_USER,
            "password": config.PG_PASSWORD,
            "dbname": config.PG_DB,
        }

    def _connect(self):
        return psycopg2.connect(**self._conn_info)

    @staticmethod
    def _fmt(embedding: list[float]) -> str:
        # cube 文本格式：(0.1,0.2,...)，统一 6 位小数
        return "(" + ",".join(f"{v:.6f}" for v in embedding) + ")"

    def upsert_many(self, items: Iterable[tuple[int, list[float]]]) -> int:
        items = list(items)
        if not items:
            return 0
        count = 0
        with self._connect() as conn:
            with conn.cursor() as cur:
                for chunk_id, embedding in items:
                    cur.execute(
                        "UPDATE document_chunks SET embedding = %s::cube "
                        "WHERE chunk_id = %s",
                        (self._fmt(embedding), chunk_id),
                    )
                    count += cur.rowcount
            conn.commit()
        return count

    def query(
        self,
        embedding: list[float],
        top_k: int = 10,
        chunk_ids: list[int] | None = None,
    ) -> list[tuple[int, float]]:
        vec = self._fmt(embedding)
        sql = (
            "SELECT chunk_id, "
            "       1 - (embedding <-> %s::cube) * (embedding <-> %s::cube) / 2 AS score "
            "FROM document_chunks "
            "WHERE embedding IS NOT NULL"
        )
        params = [vec, vec]
        if chunk_ids:
            sql += " AND chunk_id = ANY(%s)"
            params.append(chunk_ids)
        sql += " ORDER BY embedding <-> %s::cube ASC LIMIT %s"
        params.append(vec)
        params.append(top_k)
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
        # score 可能略超 [0,1]，clamp 后返回
        return [(int(r[0]), round(min(1.0, max(0.0, float(r[1]))), 4)) for r in rows]

    def count(self) -> int:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM document_chunks WHERE embedding IS NOT NULL")
                return int(cur.fetchone()[0])


# ============================================================
# pgvector 实现（未来安装后切换）
# ============================================================
class PgVectorStore(VectorStore):
    """基于 pgvector（vector 类型 + <=> 余弦算子）。启用前提：已安装 pgvector 扩展。"""

    name = "pgvector"

    def __init__(self, conn_info: dict | None = None) -> None:
        self._conn_info = conn_info or {
            "host": config.PG_HOST,
            "port": config.PG_PORT,
            "user": config.PG_USER,
            "password": config.PG_PASSWORD,
            "dbname": config.PG_DB,
        }

    def _connect(self):
        return psycopg2.connect(**self._conn_info)

    def upsert_many(self, items: Iterable[tuple[int, list[float]]]) -> int:
        items = list(items)
        if not items:
            return 0
        count = 0
        with self._connect() as conn:
            with conn.cursor() as cur:
                for chunk_id, embedding in items:
                    cur.execute(
                        "UPDATE document_chunks SET embedding = %s::vector "
                        "WHERE chunk_id = %s",
                        (embedding, chunk_id),
                    )
                    count += cur.rowcount
            conn.commit()
        return count

    def query(
        self,
        embedding: list[float],
        top_k: int = 10,
        chunk_ids: list[int] | None = None,
    ) -> list[tuple[int, float]]:
        sql = (
            "SELECT chunk_id, 1 - (embedding <=> %s::vector) AS score "
            "FROM document_chunks WHERE embedding IS NOT NULL"
        )
        params = [embedding]
        if chunk_ids:
            sql += " AND chunk_id = ANY(%s)"
            params.append(chunk_ids)
        sql += " ORDER BY embedding <=> %s::vector ASC LIMIT %s"
        params.append(embedding)
        params.append(top_k)
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
        return [(int(r[0]), round(min(1.0, max(0.0, float(r[1]))), 4)) for r in rows]

    def count(self) -> int:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM document_chunks WHERE embedding IS NOT NULL")
                return int(cur.fetchone()[0])


def format_embedding(embedding: list[float], store: str = "array"):
    """把向量格式化为对应存储可用的值。

    - array   : 返回 list 本身（psycopg2 原生适配为 double precision[]）
    - cube    : "(0.1,0.2,...)"（cube 输入格式；注意本机 cube 上限 100 维）
    - pgvector: "[0.1,0.2,...]"（vector 输入格式）
    """
    store = (store or "array").strip().lower()
    if store in ("array", ""):
        return embedding
    body = ",".join(f"{v:.6f}" for v in embedding)
    if store in ("pgvector", "vector"):
        return f"[{body}]"
    return f"({body})"


# ============================================================
# double precision[] 实现（当前默认，免安装兜底）
# ============================================================
class ArrayVectorStore(VectorStore):
    """基于 document_chunks.embedding double precision[] + numpy 精确余弦。

    适用规模：本阶段 10~50 条验证；全量 13.8k 岗位（约 4 万 chunk）下
    numpy 暴力检索单次 <100ms，内存约 160MB，可作为 pgvector 就绪前的过渡。
    """

    name = "array"

    def __init__(self, conn_info: dict | None = None) -> None:
        self._conn_info = conn_info or {
            "host": config.PG_HOST,
            "port": config.PG_PORT,
            "user": config.PG_USER,
            "password": config.PG_PASSWORD,
            "dbname": config.PG_DB,
        }

    def _connect(self):
        return psycopg2.connect(**self._conn_info)

    def upsert_many(self, items: Iterable[tuple[int, list[float]]]) -> int:
        items = list(items)
        if not items:
            return 0
        count = 0
        with self._connect() as conn:
            with conn.cursor() as cur:
                for chunk_id, embedding in items:
                    cur.execute(
                        "UPDATE document_chunks SET embedding = %s WHERE chunk_id = %s",
                        (embedding, chunk_id),
                    )
                    count += cur.rowcount
            conn.commit()
        return count

    def _load_vectors(self, chunk_ids: list[int] | None) -> tuple[list[int], list[list[float]]]:
        sql = "SELECT chunk_id, embedding FROM document_chunks WHERE embedding IS NOT NULL"
        params: list[Any] = []
        if chunk_ids:
            sql += " AND chunk_id = ANY(%s)"
            params.append(chunk_ids)
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
        ids = [int(r[0]) for r in rows]
        vecs = [list(r[1]) for r in rows]
        return ids, vecs

    def query(
        self,
        embedding: list[float],
        top_k: int = 10,
        chunk_ids: list[int] | None = None,
    ) -> list[tuple[int, float]]:
        import numpy as np

        ids, vecs = self._load_vectors(chunk_ids)
        if not ids:
            return []
        matrix = np.asarray(vecs, dtype=np.float64)  # (N, dim)
        q = np.asarray(embedding, dtype=np.float64)
        # 余弦 = 归一化后点积（向量已归一化，这里再保险一次）
        scores = matrix @ q
        # 越界保护（浮点误差）
        scores = np.clip(scores, -1.0, 1.0)
        order = np.argsort(-scores)[:top_k]
        # 对外契约 score∈[0,1]；负值（无关文本）统一截断为 0
        return [(ids[i], round(max(0.0, float(scores[i])), 4)) for i in order]

    def count(self) -> int:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM document_chunks WHERE embedding IS NOT NULL")
                return int(cur.fetchone()[0])


def get_vectorstore(store: str | None = None) -> VectorStore:
    """工厂：按配置创建 VectorStore 实例。

    默认 array（double precision[] + numpy，免安装）；
    pgvector 安装后可通过 config.VECTOR_STORE=pgvector 切换。
    """
    store = (store or config.VECTOR_STORE or "array").strip().lower()
    if store in ("pgvector", "vector"):
        return PgVectorStore()
    if store in ("cube",):
        return CubeVectorStore()
    if store in ("array", ""):
        return ArrayVectorStore()
    raise ValueError(f"未知的 VectorStore 实现: {store}")
