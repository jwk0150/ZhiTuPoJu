# -*- coding: utf-8 -*-
"""Evidence 持久化 —— 匹配结果 → evidence_items（Phase 04）。

链路（可完整回溯）：
    job recommendation → evidence_id → chunk_id → doc_id
        → source_documents → source_url

规则（§八 Confidence）：
    evidence >= 2 → high / 0.9 / uncertainty 0.1
    evidence >= 1 → medium / 0.6 / uncertainty 0.4
    evidence 0    → low / 0.3 / uncertainty 0.7

去重：UNIQUE(job_id, chunk_id, claim_type) WHERE job_id IS NOT NULL AND chunk_id IS NOT NULL
（幂等 upsert，不删除已有记录；不重建表。）
"""
from __future__ import annotations

import json
from typing import Any

import psycopg2

from backend.config import config

CLAIM_TYPE = "job_match"


def _connect():
    return psycopg2.connect(
        host=config.PG_HOST, port=config.PG_PORT, user=config.PG_USER,
        password=config.PG_PASSWORD, dbname=config.PG_DB,
    )


def evidence_confidence(count: int) -> tuple[str, float, float]:
    """按 Evidence 条数给出 (level, confidence, uncertainty)。"""
    if count >= 2:
        return "high", 0.9, 0.1
    if count >= 1:
        return "medium", 0.6, 0.4
    return "low", 0.3, 0.7


def _upsert_evidence(
    job_id: int | None,
    chunk_id: int | None,
    doc_id: int | None,
    source_url: str | None,
    evidence_text: str | None,
    confidence: float,
    uncertainty: float,
    match_extra: dict[str, Any],
) -> int | None:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO evidence_items
                    (doc_id, evidence_type, evidence_text, confidence, extra, created_at,
                     job_id, chunk_id, claim_type, source_url, uncertainty)
                VALUES (%s, %s, %s, %s, %s, NOW(), %s, %s, %s, %s, %s)
                ON CONFLICT (job_id, chunk_id, claim_type)
                    WHERE job_id IS NOT NULL AND chunk_id IS NOT NULL
                DO UPDATE SET
                    evidence_text = EXCLUDED.evidence_text,
                    confidence = EXCLUDED.confidence,
                    uncertainty = EXCLUDED.uncertainty,
                    source_url = EXCLUDED.source_url,
                    doc_id = EXCLUDED.doc_id,
                    extra = EXCLUDED.extra,
                    created_at = NOW()
                RETURNING evidence_id
                """,
                (
                    doc_id, CLAIM_TYPE, (evidence_text or "")[:800], confidence,
                    json.dumps(match_extra, ensure_ascii=False), job_id, chunk_id,
                    CLAIM_TYPE, source_url, uncertainty,
                ),
            )
            row = cur.fetchone()
            conn.commit()
            return int(row[0]) if row else None
    finally:
        conn.close()


def persist_match_evidence(match: dict[str, Any], confidence: float, uncertainty: float) -> list[int]:
    """把单个匹配结果里的 Evidence 持久化，并把 evidence_id 写回每条 evidence。"""
    job = match.get("job") or {}
    job_id = job.get("id")
    extra = {
        "match_score": match.get("score"),
        "reason": (match.get("reason") or "")[:200],
        "title": job.get("title"),
        "company": job.get("company"),
    }
    ids: list[int] = []
    for ev in match.get("evidence") or []:
        chunk_id = ev.get("chunk_id")
        snippet = (ev.get("snippet") or "").strip()
        if not chunk_id and not snippet:
            continue
        evidence_id = _upsert_evidence(
            job_id=job_id,
            chunk_id=chunk_id,
            doc_id=ev.get("doc_id"),
            source_url=ev.get("source_url"),
            evidence_text=snippet,
            confidence=confidence,
            uncertainty=uncertainty,
            match_extra=extra,
        )
        if evidence_id is not None:
            ev["evidence_id"] = evidence_id
            ids.append(evidence_id)
    return ids


def get_evidence_chain(evidence_id: int) -> dict[str, Any] | None:
    """按 evidence_id 回溯完整链路：evidence → chunk → document → source_url。"""
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT e.evidence_id, e.job_id, e.chunk_id, e.doc_id, e.claim_type,
                       e.evidence_text, e.source_url, e.confidence, e.uncertainty,
                       d.source_type, d.title, d.source_name, d.freshness_status
                FROM evidence_items e
                LEFT JOIN source_documents d ON d.doc_id = e.doc_id
                WHERE e.evidence_id = %s
                """,
                (evidence_id,),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {
        "evidence_id": int(row[0]),
        "job_id": int(row[1]) if row[1] is not None else None,
        "chunk_id": int(row[2]) if row[2] is not None else None,
        "doc_id": int(row[3]) if row[3] is not None else None,
        "claim_type": row[4],
        "evidence_text": row[5],
        "source_url": row[6],
        "confidence": float(row[7]) if row[7] is not None else None,
        "uncertainty": float(row[8]) if row[8] is not None else None,
        "document_type": row[9],
        "document_title": row[10],
        "source_name": row[11],
        "freshness_status": row[12],
    }
