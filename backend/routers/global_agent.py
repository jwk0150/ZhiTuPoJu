# -*- coding: utf-8 -*-
"""Global Agent 路由 —— Phase 1：仅提供受保护的上下文读取端点。

本文件是 Global Agent 的统一入口占位：
- 当前只有一个只读端点 POST /api/global-agent/context（必须携带 Bearer Token）。
- Orchestrator / Chat / Task / SSE 等端点留待后续阶段扩展。

安全约定：
- 所有端点一律依赖 get_current_user，以 Token 解析出的 username 为准。
- 前端传入的 user_id 一律不作为权限依据（ContextRequest 中不接收 user_id）。
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.agent.context import ContextBuilder
from backend.agent.orchestrator import run_agent
from backend.routers.auth import get_current_user

router = APIRouter(tags=["global-agent"])


class ContextRequest(BaseModel):
    """前端页面上下文（可选）。注意：不接收 user_id，杜绝越权。"""

    page: Optional[str] = None
    tab: Optional[str] = None
    resume_id: Optional[int] = None
    job_id: Optional[int] = None
    conversation: list[dict[str, Any]] = []


class AgentChatRequest(BaseModel):
    """Global Agent 对话请求。

    user_id 禁止由前端决定；用户身份一律来自 JWT（get_current_user）。
    """

    message: str = ""
    page: Optional[str] = None
    tab: Optional[str] = None
    resume_id: Optional[int] = None
    job_id: Optional[int] = None
    conversation: list[dict[str, Any]] = []


@router.post("/context")
def get_agent_context(
    payload: ContextRequest,
    user: dict = Depends(get_current_user),
) -> dict:
    """返回当前用户的统一 AI 上下文（只读）。

    鉴权：Authorization: Bearer <token>（get_current_user 依赖）。
    """
    bundle = ContextBuilder.build(
        user,
        page=payload.page,
        tab=payload.tab,
        resume_id=payload.resume_id,
        job_id=payload.job_id,
        conversation=payload.conversation or [],
    )
    return {"code": 0, "message": "success", "data": bundle}


@router.post("/chat")
def agent_chat(
    payload: AgentChatRequest,
    user: dict = Depends(get_current_user),
) -> dict:
    """Global Agent 主对话端点（Phase 2，普通 JSON 返回，非流式）。

    鉴权：Authorization: Bearer <token>。
    流程：ContextBuilder → IntentClassifier → Tool Registry → 真实 Service
          → DeepSeek 解释 → 结构化 Response。
    """
    result = run_agent(
        user,
        message=payload.message or "",
        page=payload.page,
        tab=payload.tab,
        resume_id=payload.resume_id,
        job_id=payload.job_id,
        conversation=payload.conversation or [],
    )
    return {"code": 0, "message": "success", "data": result}
