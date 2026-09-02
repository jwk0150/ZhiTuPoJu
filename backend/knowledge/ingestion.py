# -*- coding: utf-8 -*-
"""增量 Ingestion —— Job → Document → Chunk → Embedding → VectorStore。

幂等性：
- Document 身份：UNIQUE(source_type, job_id) WHERE job_id IS NOT NULL
  （Phase 02 修复：不同 Job 正文相同也各自独立 Document；text_hash 仅作内容版本）
- Chunk 判重  ：UNIQUE(doc_id, chunk_index)
- 同一 Job 文本变化：text_hash 变化 → 更新同一 Document 并重建 Chunk；
  旧版本 Document 标记 stale（不删除，保留 provenance）
- 任何一步可重跑，不会产生重复数据

本阶段入口：
    python -m backend.knowledge.ingestion --limit 50
"""
from __future__ import annotations

import argparse
import sys
from typing import Any

import psycopg2

from backend.config import config
from backend.knowledge.cleaner import clean_job
from backend.knowledge.chunker import build_chunks
from backend.knowledge.embedding import EmbeddingService
from backend.knowledge.vectorstore import format_embedding, get_vectorstore


def _connect():
    return psycopg2.connect(
        host=config.PG_HOST, port=config.PG_PORT, user=config.PG_USER,
        password=config.PG_PASSWORD, dbname=config.PG_DB,
    )


def fetch_jobs(job_ids: list[int] | None = None, limit: int = 50) -> list[dict[str, Any]]:
    """读取真实岗位（总表 + 细节表 join）。"""
    sql = """
        SELECT jp.id, jp.source_name, jp.source_id, jp.job_title, jp.company_name,
               jp.city, jp.district, jp.salary_min, jp.salary_max, jp.salary_unit,
               jp.experience, jp.education, jp.job_type, jp.publish_time, jp.crawl_time,
               jp.status, jpd.company_industry, jpd.company_size, jpd.company_nature,
               jpd.job_description, jpd.job_requirement, jpd.job_highlights,
               jpd.job_labels, jpd.skills, jpd.keywords, jpd.salary_description,
               jpd.job_category_l1, jpd.job_category_l2, jpd.source_url
        FROM job_postings jp
        LEFT JOIN job_posting_details jpd ON jpd.job_id = jp.id
        WHERE jp.status = 0
    """
    params: list[Any] = []
    if job_ids:
        sql += " AND jp.id = ANY(%s)"
        params.append(job_ids)
    sql += " ORDER BY jp.crawl_time DESC LIMIT %s"
    params.append(limit)
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]


def _upsert_document(cur, doc: dict) -> tuple[int, bool]:
    """写入/更新 source_documents。返回 (doc_id, inserted)。

    版本化模型：
    - 同一 job 已有 fresh 文档且文本变化 → 旧文档标记 stale（保留历史版本）
    - 文本未变 → ON CONFLICT 原地更新（幂等）
    - 新 job → 插入新 fresh 文档
    唯一索引谓词：WHERE job_id IS NOT NULL AND freshness_status <> 'stale'
    """
    import json

    extra = json.dumps(doc.get("extra") or {}, ensure_ascii=False)

    # 1) 文本变化时把旧 fresh 版本标记 stale（不删除，保留 provenance）
    cur.execute(
        """
        UPDATE source_documents SET freshness_status = 'stale'
        WHERE source_type = %s AND job_id = %s
          AND freshness_status = 'fresh' AND text_hash <> %s
        """,
        (doc["source_type"], doc["job_id"], doc["text_hash"]),
    )

    # 2) 插入/更新 fresh 文档
    cur.execute(
        """
        INSERT INTO source_documents
            (source_type, source_name, source_url, title, author, publisher,
             published_at, collected_at, content_type, format, raw_text, text_hash,
             freshness_status, quality_score, extra, document_type, job_id,
             company_name, city, data_version)
        VALUES (%s,%s,%s,%s,NULL,NULL,%s,NOW(),'text/plain','TEXT',%s,%s,
                'fresh',0,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (source_type, job_id)
            WHERE job_id IS NOT NULL AND freshness_status <> 'stale'
        DO UPDATE SET
            source_url = EXCLUDED.source_url,
            published_at = EXCLUDED.published_at,
            collected_at = NOW(),
            extra = EXCLUDED.extra,
            document_type = EXCLUDED.document_type,
            raw_text = EXCLUDED.raw_text,
            text_hash = EXCLUDED.text_hash,
            company_name = EXCLUDED.company_name,
            city = EXCLUDED.city,
            data_version = EXCLUDED.data_version
        RETURNING doc_id, (xmax = 0) AS inserted
        """,
        (
            doc["source_type"], doc["source_name"], doc["source_url"], doc["title"],
            doc["published_at"], doc["raw_text"], doc["text_hash"],
            extra, doc["source_type"], doc["job_id"],
            doc["company_name"], doc["city"], doc["data_version"],
        ),
    )
    row = cur.fetchone()
    return int(row[0]), bool(row[1])


def _upsert_chunk(cur, doc: dict, chunk: dict, doc_id: int, index: int,
                  embedding, cast_type: str = "array") -> int:
    """写入/更新 document_chunks，返回 chunk_id。

    embedding 为已格式化的值：array→list，cube→"(...)"，pgvector→"[...]"。
    """
    if cast_type in ("pgvector", "vector"):
        cast_sql = "::vector"
    elif cast_type == "cube":
        cast_sql = "::cube"
    else:  # array（默认）
        cast_sql = ""
    cur.execute(
        f"""
        INSERT INTO document_chunks
            (doc_id, chunk_index, chunk_text, token_estimate, text_hash, embedding,
             job_id, document_type, city, source_name, publish_time, crawl_time)
        VALUES (%s,%s,%s,%s,%s,%s{cast_sql},%s,%s,%s,%s,%s,%s)
        ON CONFLICT (doc_id, chunk_index) DO UPDATE SET
            chunk_text = EXCLUDED.chunk_text,
            token_estimate = EXCLUDED.token_estimate,
            text_hash = EXCLUDED.text_hash,
            embedding = EXCLUDED.embedding,
            job_id = EXCLUDED.job_id,
            city = EXCLUDED.city,
            publish_time = EXCLUDED.publish_time,
            crawl_time = EXCLUDED.crawl_time
        RETURNING chunk_id
        """,
        (
            doc_id, index, chunk["chunk_text"], chunk["token_estimate"],
            chunk["text_hash"], embedding, doc["job_id"], doc["source_type"],
            doc["city"], doc["source_name"], doc["published_at"], doc["crawl_time"],
        ),
    )
    return int(cur.fetchone()[0])


def _mark_old_docs_stale(cur, doc: dict, current_doc_id: int) -> int:
    """同一 job 的旧版本 Document 标记 stale（不删除，保留 provenance）。

    Phase 02：Document 身份为 (source_type, job_id)，同一 job 只保留一个 fresh
    文档；无论文本是否变化，其他同 job 文档一律标记 stale。
    """
    cur.execute(
        """
        UPDATE source_documents SET freshness_status = 'stale'
        WHERE source_type = %s AND job_id = %s
          AND doc_id <> %s
          AND freshness_status <> 'stale'
        """,
        (doc["source_type"], doc["job_id"], current_doc_id),
    )
    return cur.rowcount


def ingest_jobs(
    job_ids: list[int] | None = None,
    limit: int = 50,
    embedding_service: EmbeddingService | None = None,
    store: Any | None = None,
) -> dict[str, Any]:
    """对真实岗位执行完整入库链路。返回统计。"""
    embedder = embedding_service or EmbeddingService()
    vectorstore = store or get_vectorstore()

    jobs = fetch_jobs(job_ids=job_ids, limit=limit)
    stats = {
        "jobs_read": len(jobs),
        "documents_inserted": 0,
        "documents_updated": 0,
        "chunks_written": 0,
        "stale_marked": 0,
        "errors": [],
    }

    cast_type = vectorstore.name
    # autocommit：单条 job 失败只影响自身，不毒化整批事务（幂等设计下可安全重跑）
    conn = _connect()
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            for job in jobs:
                try:
                    doc = clean_job(job)
                    if not doc["raw_text"]:
                        continue
                    doc_id, inserted = _upsert_document(cur, doc)
                    if inserted:
                        stats["documents_inserted"] += 1
                    else:
                        stats["documents_updated"] += 1

                    # 旧文本版本标记 stale
                    stats["stale_marked"] += _mark_old_docs_stale(cur, doc, doc_id)

                    chunks = build_chunks(doc)
                    if chunks:
                        texts = [c["chunk_text"] for c in chunks]
                        embeddings = embedder.embed(texts)
                        for index, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                            formatted = format_embedding(emb, store=cast_type)
                            _upsert_chunk(cur, doc, chunk, doc_id, index, formatted, cast_type)
                            stats["chunks_written"] += 1
                except Exception as exc:  # 单条失败不阻断整批
                    stats["errors"].append(
                        f"job_id={job.get('id')} error={type(exc).__name__}: {exc}"
                    )
    finally:
        conn.close()

    stats["vector_count"] = vectorstore.count()
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="RAG 招聘数据增量入库（Phase 01）")
    parser.add_argument("--limit", type=int, default=50, help="处理条数（默认 50）")
    parser.add_argument("--job-ids", type=int, nargs="*", help="指定 job_id 集合")
    args = parser.parse_args()

    stats = ingest_jobs(job_ids=args.job_ids, limit=args.limit)
    print("ingest result:", stats)
    if stats["errors"]:
        print("errors:", stats["errors"][:10], file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
