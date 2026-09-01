# -*- coding: utf-8 -*-
"""执图顾问 HTTP 接口 —— 与 DiscoveryAgent 扫描路由隔离。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend import data
from backend.llm import zhitu_agent
from backend.routers import discovery as discovery_mod

router = APIRouter()


class ChatTurn(BaseModel):
    role: str
    content: str


class AgentChatRequest(BaseModel):
    message: str = ""
    channel: str = Field(default="suggest", description="suggest | qa")
    history: list[ChatTurn] = []
    discoveries: list[dict[str, Any]] = []
    forecasts: list[dict[str, Any]] = []
    summary: str = ""


@router.post("/chat")
def agent_chat(payload: AgentChatRequest):
    cached = getattr(discovery_mod, "_CACHED", {}) or {}
    discoveries = cached.get("discoveries") or payload.discoveries or []
    forecasts = cached.get("forecasts") or payload.forecasts or []
    # QA 无扫描缓存时，可用演示种子，避免空答；suggest 仍优先真实扫描
    if payload.channel == "qa" and not discoveries and not forecasts:
        discoveries = list(data.NEW_JOBS)
    summary = cached.get("summary") or payload.summary or ""
    history = [{"role": t.role, "content": t.content} for t in (payload.history or [])]
    result = zhitu_agent.chat(
        message=payload.message or "",
        channel=payload.channel or "suggest",
        history=history,
        discoveries=discoveries,
        forecasts=forecasts,
        summary=summary,
    )
    return data.ok({
        "reply": result.get("reply"),
        "recommendations": result.get("recommendations") or [],
        "mode": result.get("mode") or "heuristic",
        "model": {
            "llm": result.get("llm") or "none",
            "channel": result.get("channel") or payload.channel,
            "mode": result.get("mode") or "heuristic",
            "error": result.get("error"),
            "intents": result.get("intents") or [],
            "backed_by": "DeepSeek" if (result.get("llm") and result.get("llm") != "none") else "执图顾问兜底",
            "cache_hits": {
                "discoveries": len(discoveries),
                "forecasts": len(forecasts),
                "from_scan_cache": bool(cached.get("discoveries")),
            },
        },
    })
