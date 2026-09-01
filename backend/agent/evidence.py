# -*- coding: utf-8 -*-
"""Global Agent Evidence Normalize Layer（Phase 3）。

职责：
- 把不同 Tool / Service 返回的原始数据统一成 Global Agent 标准 Evidence。
- 不负责写数据库（持久化仍走 knowledge.evidence）。
- 无法从现有数据获得的字段一律置 None，不编造。

标准结构见 normalize_evidence()；各来源构造器：
  from_knowledge_hit  : KnowledgeService SearchHit → knowledge_chunk
  from_job_match      : match.analyze 原始 evidence → job_match
  from_tool_result    : Tool 执行结果 → tool_result（保留 data_source / is_demo）
"""
from __future__ import annotations

import json
from typing import Any, Optional

from backend.knowledge.evidence import evidence_confidence


def confidence_for_count(count: int) -> tuple[str, float, float]:
    """复用 knowledge.evidence.evidence_confidence（>=2 high / >=1 medium / 0 low）。"""
    return evidence_confidence(count)


def normalize_evidence(raw: dict) -> dict:
    """任意来源证据 → 标准结构。缺字段置 None。"""
    chain = raw.get("chain")
    if not isinstance(chain, dict):
        chain = None
    content = (raw.get("content") or "")
    return {
        "evidence_id": raw.get("evidence_id"),
        "type": raw.get("type") or "tool_result",
        "claim_type": raw.get("claim_type"),
        "source_id": raw.get("source_id"),
        "source_name": raw.get("source_name"),
        "title": raw.get("title"),
        "content": content[:400] or None,
        "location": raw.get("location"),
        "source_url": raw.get("source_url"),
        "timestamp": raw.get("timestamp"),
        "relevance": raw.get("relevance"),
        "confidence": raw.get("confidence"),
        "uncertainty": raw.get("uncertainty"),
        "chain": chain,
        "data_source": raw.get("data_source") or "db",
        "is_demo": bool(raw.get("is_demo")),
    }


def from_knowledge_hit(hit: dict) -> dict:
    """SearchHit → knowledge_chunk 证据。

    evidence_id 使用 chunk_id（稳定可溯源），chain 保留 chunk→doc→source_url。
    """
    chunk_id = hit.get("chunk_id")
    doc_id = hit.get("doc_id")
    return normalize_evidence({
        "evidence_id": str(chunk_id) if chunk_id is not None else None,
        "type": "knowledge_chunk",
        "claim_type": "rag",
        "source_id": str(doc_id) if doc_id is not None else None,
        "source_name": hit.get("source_name"),
        "title": hit.get("title"),
        "content": (hit.get("snippet") or ""),
        "location": None,
        "source_url": hit.get("source_url"),
        "timestamp": hit.get("publish_time") or hit.get("crawl_time"),
        "relevance": hit.get("final_score"),
        "confidence": "medium",
        "uncertainty": None,
        "chain": {
            "evidence_id": str(chunk_id) if chunk_id is not None else None,
            "chunk_id": chunk_id,
            "doc_id": doc_id,
            "document_title": hit.get("title"),
            "source_name": hit.get("source_name"),
            "source_url": hit.get("source_url"),
        },
        "data_source": "db",
        "is_demo": False,
    })


def from_job_match(ev: dict) -> dict:
    """match.analyze 返回的原始证据条目 → 标准结构。"""
    return normalize_evidence({
        "evidence_id": ev.get("evidence_id"),
        "type": "job_match",
        "claim_type": "job_match",
        "source_id": str(ev.get("source_id")) if ev.get("source_id") is not None else None,
        "source_name": ev.get("source_name"),
        "title": ev.get("title"),
        "content": ev.get("content"),
        "location": ev.get("location"),
        "source_url": ev.get("source_url"),
        "timestamp": ev.get("timestamp"),
        "relevance": ev.get("relevance"),
        "chain": ev.get("chain"),
        "data_source": "db",
        "is_demo": False,
    })


def from_tool_result(tool: str, data: Any, *, data_source: str = "db", is_demo: bool = False) -> dict:
    """Tool 执行结果 → tool_result 证据（保留 data_source / is_demo）。"""
    content = None
    if data is not None:
        try:
            content = json.dumps(data, ensure_ascii=False, default=str)
        except Exception:
            content = str(data)
    return normalize_evidence({
        "evidence_id": None,
        "type": "tool_result",
        "claim_type": tool,
        "source_id": tool,
        "source_name": f"Tool:{tool}",
        "title": tool,
        "content": content,
        "location": None,
        "source_url": None,
        "timestamp": None,
        "relevance": None,
        "chain": None,
        "data_source": data_source,
        "is_demo": is_demo,
    })
