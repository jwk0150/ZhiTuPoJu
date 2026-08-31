# -*- coding: utf-8 -*-
"""KnowledgeService —— 通用 RAG 检索（Phase 02）。

能力：
- ingest()             : 增量入库真实岗位
- stats()              : 文档/chunk/向量统计
- semantic_search()    : 向量检索（Embedding + VectorStore）
- keyword_search()     : 关键词检索（PG Full Text + pg_trgm + ILIKE）
- hybrid_search()      : SQL Filter + Keyword + Semantic 融合
- search()             : 统一入口（推荐；返回 SearchHit 列表）
- evidence_for_chunk() : chunk → Document → source_url 溯源

SearchHit 字段（统一契约，Agent/上层不自行拼装）：
  job_id, doc_id, chunk_id, title, company, city, salary, education,
  experience, snippet, final_score, source_name, source_url, publish_time,
  crawl_time, evidence_id, chunks[]

未实现（后续阶段）：Reranker / RAG Answer / Agent。
"""
from __future__ import annotations

import json
from typing import Any

import psycopg2

from backend.config import config
from backend.knowledge.embedding import EmbeddingService
from backend.knowledge.ingestion import ingest_jobs
from backend.knowledge.vectorstore import get_vectorstore


def _connect():
    return psycopg2.connect(
        host=config.PG_HOST, port=config.PG_PORT, user=config.PG_USER,
        password=config.PG_PASSWORD, dbname=config.PG_DB,
    )


# ============================================================
# 通用小工具
# ============================================================
def _fmt_salary(smin: int | None, smax: int | None) -> str | None:
    """薪资 → "15K-25K" 展示格式。"""
    lo = int(smin) if smin else 0
    hi = int(smax) if smax else 0
    if lo and hi:
        return f"{lo // 1000}-{hi // 1000}K"
    if hi:
        return f"{hi // 1000}K"
    if lo:
        return f"{lo // 1000}K"
    return None


def _build_filter_sql(filters: dict[str, Any] | None) -> tuple[str, list[Any]]:
    """把结构化过滤条件转成 job_postings/job_posting_details 上的 WHERE。

    条件：city / education / experience / salary_min / salary_max /
          industry / job_category
    全部使用 PostgreSQL 精确/模糊匹配，不依赖 Embedding。
    返回 (where_sql, params)；无过滤时返回 ("", [])。
    """
    filters = filters or {}
    clauses: list[str] = []
    params: list[Any] = []

    city = (filters.get("city") or "").strip()
    if city:
        clauses.append("jp.city ILIKE %s")
        params.append(f"%{city}%")

    education = (filters.get("education") or "").strip()
    if education:
        clauses.append("jp.education ILIKE %s")
        params.append(f"%{education}%")

    experience = (filters.get("experience") or "").strip()
    if experience:
        clauses.append("jp.experience ILIKE %s")
        params.append(f"%{experience}%")

    salary_min = filters.get("salary_min")
    if salary_min:
        clauses.append("jp.salary_max >= %s")
        params.append(int(salary_min))

    salary_max = filters.get("salary_max")
    if salary_max:
        clauses.append("jp.salary_min <= %s")
        params.append(int(salary_max))

    industry = (filters.get("industry") or "").strip()
    if industry:
        clauses.append("jpd.company_industry ILIKE %s")
        params.append(f"%{industry}%")

    job_category = (filters.get("job_category") or "").strip()
    if job_category:
        clauses.append("jpd.job_category_l1 ILIKE %s")
        params.append(f"%{job_category}%")

    if not clauses:
        return "", []
    return " AND ".join(clauses), params


def _resolve_job_ids(filters: dict[str, Any] | None) -> list[int] | None:
    """按结构化条件解析出候选 job_id 集合；无过滤返回 None（不限）。"""
    where, params = _build_filter_sql(filters)
    if not where:
        return None
    sql = f"""
        SELECT DISTINCT jp.id
        FROM job_postings jp
        LEFT JOIN job_posting_details jpd ON jpd.job_id = jp.id
        WHERE jp.status = 0 AND ({where})
    """
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return [int(r[0]) for r in cur.fetchall()]


def _chunk_ids_by_jobs(job_ids: list[int]) -> list[int]:
    if not job_ids:
        return []
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT chunk_id FROM document_chunks WHERE job_id = ANY(%s)",
                (job_ids,),
            )
            return [int(r[0]) for r in cur.fetchall()]


_CHUNK_ROW_SQL = """
    SELECT c.chunk_id, c.doc_id, c.job_id, c.chunk_text,
           d.title, d.company_name, d.city, d.source_name, d.source_url,
           d.published_at, jp.crawl_time,
           jp.education, jp.experience, jp.salary_min, jp.salary_max
    FROM document_chunks c
    JOIN source_documents d ON d.doc_id = c.doc_id
    LEFT JOIN job_postings jp ON jp.id = c.job_id
"""


def _fetch_chunk_rows(chunk_ids: list[int]) -> dict[int, dict[str, Any]]:
    if not chunk_ids:
        return {}
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(_CHUNK_ROW_SQL + " WHERE c.chunk_id = ANY(%s)", (chunk_ids,))
            rows = cur.fetchall()
    out: dict[int, dict[str, Any]] = {}
    for r in rows:
        out[int(r[0])] = {
            "chunk_id": int(r[0]),
            "doc_id": int(r[1]) if r[1] is not None else None,
            "job_id": int(r[2]) if r[2] is not None else None,
            "chunk_text": r[3],
            "title": r[4],
            "company": r[5],
            "city": r[6],
            "source_name": r[7],
            "source_url": r[8],
            "publish_time": str(r[9]) if r[9] else None,
            "crawl_time": str(r[10]) if r[10] else None,
            "education": r[11],
            "experience": r[12],
            "salary_min": r[13],
            "salary_max": r[14],
        }
    return out


def _build_search_hit(
    row: dict[str, Any],
    score: float,
    chunks: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "job_id": row["job_id"],
        "doc_id": row["doc_id"],
        "chunk_id": row["chunk_id"],
        "title": row["title"],
        "company": row["company"],
        "city": row["city"],
        "salary": _fmt_salary(row["salary_min"], row["salary_max"]),
        "education": row["education"],
        "experience": row["experience"],
        "snippet": row["chunk_text"],
        "final_score": round(float(score), 4),
        "source_name": row["source_name"],
        "source_url": row["source_url"],
        "publish_time": row["publish_time"],
        "crawl_time": row["crawl_time"],
        "evidence_id": None,  # 本阶段证据表为空；Evidence 落地阶段接入
        "chunks": chunks,     # 命中该 job 的多个 chunk（供后续 Evidence）
    }


class KnowledgeService:
    def __init__(
        self,
        embedding_service: EmbeddingService | None = None,
        vectorstore: Any | None = None,
    ) -> None:
        self.embedding = embedding_service or EmbeddingService()
        self.vectorstore = vectorstore or get_vectorstore()

    # ------------------------------------------------------------
    # 入库 / 统计
    # ------------------------------------------------------------
    def ingest(self, job_ids: list[int] | None = None, limit: int = 50) -> dict[str, Any]:
        return ingest_jobs(
            job_ids=job_ids,
            limit=limit,
            embedding_service=self.embedding,
            store=self.vectorstore,
        )

    def stats(self) -> dict[str, Any]:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT source_type, count(*) FROM source_documents GROUP BY 1 ORDER BY 2 DESC")
                docs = [{"document_type": r[0], "count": r[1]} for r in cur.fetchall()]
                cur.execute("SELECT count(*), count(embedding) FROM document_chunks")
                chunks_total, chunks_with_embed = cur.fetchone()
                cur.execute(
                    "SELECT freshness_status, count(*) FROM source_documents GROUP BY 1"
                )
                freshness = {r[0]: r[1] for r in cur.fetchall()}
        return {
            "documents": docs,
            "chunks_total": chunks_total,
            "chunks_with_embedding": chunks_with_embed,
            "vectors": self.vectorstore.count(),
            "freshness": freshness,
            "embedding_model": self.embedding.model_name,
            "embedding_version": self.embedding.embedding_version,
            "embedding_dimension": self.embedding.dimension,
            "vectorstore": self.vectorstore.name,
        }

    # ------------------------------------------------------------
    # 语义检索
    # ------------------------------------------------------------
    def semantic_search(
        self, query: str, top_k: int = 10, filters: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """向量检索：返回 chunk 级结果 [{..., "vec_score": x}]。

        当 EmbeddingService 不可用（sentence-transformers 未安装等）时，
        返回空列表，让 hybrid_search 退化为纯 keyword 检索，避免上层 500。
        """
        if not (query or "").strip():
            return []
        try:
            q_vec = self.embedding.embed_query(query)
        except (ImportError, ModuleNotFoundError, RuntimeError) as exc:
            import logging

            logging.warning(
                "semantic_search: 向量腿不可用，已降级为 keyword-only（%s）", exc
            )
            return []
        chunk_ids = None
        if filters:
            job_ids = _resolve_job_ids(filters)
            if job_ids == []:
                return []
            chunk_ids = _chunk_ids_by_jobs(job_ids) or None
        hits = self.vectorstore.query(q_vec, top_k=top_k, chunk_ids=chunk_ids)
        if not hits:
            return []
        rows = _fetch_chunk_rows([h[0] for h in hits])
        out = []
        for chunk_id, score in hits:
            row = rows.get(chunk_id)
            if not row:
                continue
            out.append({**row, "vec_score": float(score)})
        return out

    # ------------------------------------------------------------
    # 关键词检索
    # ------------------------------------------------------------
    def keyword_search(
        self, query: str, top_k: int = 10, filters: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """关键词检索：PG fulltext + pg_trgm + ILIKE。返回 chunk 级结果。"""
        q = (query or "").strip()
        if not q:
            return []
        where_jobs, job_params = _build_filter_sql(filters)
        sql = f"""
            SELECT c.chunk_id, c.doc_id, c.job_id, c.chunk_text,
                   d.title, d.company_name, d.city, d.source_name, d.source_url,
                   d.published_at, jp.crawl_time,
                   jp.education, jp.experience, jp.salary_min, jp.salary_max,
                   CASE
                     WHEN d.title ILIKE %s OR d.company_name ILIKE %s THEN 1.0
                     WHEN c.chunk_text ILIKE %s
                          THEN GREATEST(0.6, similarity(c.chunk_text, %s))
                     WHEN to_tsvector('simple', c.chunk_text)
                          @@ plainto_tsquery('simple', %s) THEN 0.5
                     ELSE 0 END AS kscore
            FROM document_chunks c
            JOIN source_documents d ON d.doc_id = c.doc_id
            LEFT JOIN job_postings jp ON jp.id = c.job_id
            WHERE c.document_type = 'recruitment'
              AND d.freshness_status IS DISTINCT FROM 'stale'
              AND (d.title ILIKE %s OR d.company_name ILIKE %s
                   OR c.chunk_text ILIKE %s
                   OR to_tsvector('simple', c.chunk_text)
                      @@ plainto_tsquery('simple', %s))
        """
        params: list[Any] = [q] * 9  # CASE 5 个 + WHERE 4 个
        if where_jobs:
            # 复用 _resolve_job_ids 解析候选 job 集合，避免子查询别名问题
            job_ids = _resolve_job_ids(filters)
            if not job_ids:
                return []
            sql += " AND c.job_id = ANY(%s)"
            params.append(job_ids)
        sql += " ORDER BY kscore DESC, c.chunk_id ASC LIMIT %s"
        params.append(top_k)
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        out = []
        for r in rows:
            out.append({
                "chunk_id": int(r["chunk_id"]),
                "doc_id": int(r["doc_id"]) if r["doc_id"] is not None else None,
                "job_id": int(r["job_id"]) if r["job_id"] is not None else None,
                "chunk_text": r["chunk_text"],
                "title": r["title"],
                "company": r["company_name"],
                "city": r["city"],
                "source_name": r["source_name"],
                "source_url": r["source_url"],
                "publish_time": str(r["published_at"]) if r["published_at"] else None,
                "crawl_time": str(r["crawl_time"]) if r["crawl_time"] else None,
                "education": r["education"],
                "experience": r["experience"],
                "salary_min": r["salary_min"],
                "salary_max": r["salary_max"],
                "kw_score": float(r["kscore"]),
            })
        return out

    # ------------------------------------------------------------
    # Hybrid 检索
    # ------------------------------------------------------------
    def hybrid_search(
        self,
        query: str,
        top_k: int = 10,
        filters: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """SQL Filter + Keyword + Semantic 融合，返回按 job 去重的 SearchHit。

        融合：final = vector×0.5 + keyword×0.3 + metadata×0.0
        metadata 腿当前为 0：结构化过滤已在 SQL 阶段完成（满足条件的 job 才进入
        候选集），再算 metadata 相似度无区分度，保持代码简单（权重可配置）。
        """
        q = (query or "").strip()
        if not q:
            return {"status": "EMPTY_QUERY", "results": []}

        pool = max(top_k, 5) * 2
        vec_results = self.semantic_search(q, top_k=pool, filters=filters)
        kw_results = self.keyword_search(q, top_k=pool, filters=filters)

        # 合并两条腿的分数
        score_map: dict[int, dict[str, Any]] = {}
        for r in vec_results:
            score_map.setdefault(r["chunk_id"], {"vec": 0.0, "kw": 0.0})["vec"] = r["vec_score"]
        for r in kw_results:
            score_map.setdefault(r["chunk_id"], {"vec": 0.0, "kw": 0.0})["kw"] = r["kw_score"]

        if not score_map:
            return {"status": "INSUFFICIENT_EVIDENCE", "results": []}

        # 取两条腿的并集 chunk 完整信息
        union_ids = list(score_map.keys())
        rows = _fetch_chunk_rows(union_ids)

        w_v = config.HYBRID_WEIGHT_VECTOR
        w_k = config.HYBRID_WEIGHT_KEYWORD
        w_m = config.HYBRID_WEIGHT_METADATA

        # 按 job 分组：保留最高分，保留全部命中 chunk（供 Evidence）
        jobs: dict[int, dict[str, Any]] = {}
        for chunk_id, scores in score_map.items():
            row = rows.get(chunk_id)
            if not row or row["job_id"] is None:
                continue
            final = w_v * scores["vec"] + w_k * scores["kw"] + w_m * 1.0
            job_id = row["job_id"]
            job = jobs.get(job_id)
            if job is None or final > job["score"]:
                jobs[job_id] = {
                    "row": row,
                    "score": final,
                    "chunks": [
                        {
                            "chunk_id": chunk_id,
                            "snippet": row["chunk_text"],
                            "score": round(final, 4),
                        }
                    ],
                }
            else:
                job["chunks"].append({
                    "chunk_id": chunk_id,
                    "snippet": row["chunk_text"],
                    "score": round(final, 4),
                })

        ranked = sorted(jobs.values(), key=lambda x: x["score"], reverse=True)[:top_k]
        if not ranked or ranked[0]["score"] < config.HYBRID_MIN_SCORE:
            return {"status": "INSUFFICIENT_EVIDENCE", "results": []}

        results = [_build_search_hit(x["row"], x["score"], x["chunks"]) for x in ranked]
        return {"status": "OK", "results": results}

    # ------------------------------------------------------------
    # 统一入口
    # ------------------------------------------------------------
    def search(
        self,
        query: str,
        filters: dict[str, Any] | None = None,
        top_k: int = 10,
    ) -> dict[str, Any]:
        return self.hybrid_search(query, top_k=top_k, filters=filters)

    # ------------------------------------------------------------
    # Provenance：chunk → Document → source_url
    # ------------------------------------------------------------
    def evidence_for_chunk(self, chunk_id: int) -> dict[str, Any] | None:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT c.chunk_id, c.chunk_index, c.chunk_text, c.text_hash,
                           d.doc_id, d.source_type, d.source_name, d.title,
                           d.source_url, d.published_at, d.collected_at, d.freshness_status,
                           d.extra, d.job_id
                    FROM document_chunks c
                    LEFT JOIN source_documents d ON d.doc_id = c.doc_id
                    WHERE c.chunk_id = %s
                    """,
                    (chunk_id,),
                )
                row = cur.fetchone()
        if not row:
            return None
        return {
            "chunk_id": int(row[0]),
            "chunk_index": row[1],
            "chunk_text": row[2],
            "chunk_text_hash": row[3],
            "doc_id": int(row[4]) if row[4] is not None else None,
            "document_type": row[5],
            "source_name": row[6],
            "title": row[7],
            "source_url": row[8],
            "published_at": str(row[9]) if row[9] else None,
            "collected_at": str(row[10]) if row[10] else None,
            "freshness_status": row[11],
            "extra": row[12] if isinstance(row[12], dict) else json.loads(row[12] or "{}"),
            "job_id": int(row[13]) if row[13] is not None else None,
        }
