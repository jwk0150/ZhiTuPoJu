# -*- coding: utf-8 -*-
"""知识库检索路由 —— 统一 RAG 检索入口（Phase 02）。

POST /api/knowledge/search
  输入: {"query": "...", "filters": {"city": "...", "education": "...",
        "experience": "...", "salary_min": 10000, "salary_max": 30000,
        "industry": "...", "job_category": "..."}, "top_k": 10}
  输出: {"code":0, "message":"success", "data": {"query": "...", "status": "OK|INSUFFICIENT_EVIDENCE|EMPTY_QUERY", "results": [SearchHit...]}}
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.knowledge.service import KnowledgeService

router = APIRouter(tags=["knowledge"])


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(..., description="检索语句")
    filters: dict[str, Any] = Field(default_factory=dict, description="结构化过滤条件")
    top_k: int = Field(10, ge=1, le=50, description="返回岗位数")


@router.post("/search")
def knowledge_search(payload: KnowledgeSearchRequest):
    svc = KnowledgeService()
    result = svc.search(payload.query, filters=payload.filters or {}, top_k=payload.top_k)
    return {"code": 0, "message": "success", "data": result}
