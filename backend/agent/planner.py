# -*- coding: utf-8 -*-
"""Planner —— 确定性任务规划（Phase 4）。

- 不执行 Tool，只根据 Intent 生成结构化 Plan（步骤来自 Tool Registry）。
- 禁止生成 / 保存 CoT、internal_reasoning；只允许 reasoning_summary（由真实执行产生）。
- 优先级：简单任务 → 固定 Pipeline；危险步骤（WRITE/DELETE）→ 标 requires_confirmation。

validate_plan 规则：
  1. Tool 必须存在于 TOOL_REGISTRY，否则步骤标 blocked。
  2. permission ∈ {WRITE, DELETE} → requires_confirmation=True（不直接执行）。
"""
from __future__ import annotations

from typing import Optional

from backend.agent.tools import TOOL_REGISTRY, get_tool

# 确定性 Pipeline：intent → 工具序列（与 Orchestrator 的真实执行链保持一致）
INTENT_PLANS: dict[str, list[str]] = {
    "job_match_prep": ["context.get_current", "job.recall", "match.analyze",
                       "match.skill_gap", "match.learning_path"],
    "job_match": ["context.get_current", "job.recall", "match.analyze"],
    "skill_gap": ["context.get_current", "job.recall", "match.analyze", "match.skill_gap"],
    "what_if": ["context.get_current", "job.recall", "match.what_if"],
    "resume_analyze": ["context.get_current", "resume.get_text", "resume.analyze"],
    "resume_optimize": ["context.get_current", "resume.get_text", "resume.optimize"],
    "job_search": ["context.get_current", "job.search"],
    "career_evolution": ["context.get_current", "career.evolution"],
    "career_forecast": ["context.get_current", "career.forecast"],
    "job_discovery": ["context.get_current", "discovery.scan"],
    "knowledge": ["context.get_current", "knowledge.ask"],
    "profile": ["context.get_current"],
    "navigation": ["context.get_current"],
}


def plan_for_intent(intent: str, message: str = "") -> list[dict]:
    """生成确定性执行计划（工具序列来自 Tool Registry）。"""
    tool_names = INTENT_PLANS.get(intent, ["context.get_current"])
    plan: list[dict] = []
    for index, name in enumerate(tool_names):
        tool = TOOL_REGISTRY.get(name)
        permission = tool["permission"] if tool else "UNKNOWN"
        plan.append({
            "step_index": index,
            "tool": name,
            "permission": permission,
            "requires_confirmation": permission in ("WRITE", "DELETE"),
            "confirmation_message": (
                f"即将执行写操作 {name}，是否继续？" if permission in ("WRITE", "DELETE") else None
            ),
        })
    return plan


def validate_plan(plan: Optional[list[dict]]) -> list[dict]:
    """校验计划：不存在 Tool → blocked；WRITE/DELETE → waiting_confirmation。

    返回带校验状态（pending/blocked/waiting_confirmation）的步骤列表。
    """
    out: list[dict] = []
    for step in plan or []:
        tool_name = step.get("tool")
        tool = get_tool(tool_name)
        validated = dict(step)
        if not tool:
            validated["status"] = "blocked"
            validated["error"] = "工具不存在"
            validated["requires_confirmation"] = False
        elif tool["permission"] in ("WRITE", "DELETE"):
            validated["status"] = "waiting_confirmation"
            validated["requires_confirmation"] = True
            validated["permission"] = tool["permission"]
            validated["confirmation_message"] = (
                validated.get("confirmation_message")
                or f"即将执行写操作 {tool_name}，是否继续？"
            )
        else:
            validated["permission"] = tool["permission"]
            # 非写操作不再要求确认：当前工具库无 WRITE/DELETE，确认卡不会弹。
            # HITL 仅对未来的真实写工具保留（executor 仍硬拦截 WRITE/DELETE，不留后门）。
            validated["requires_confirmation"] = False
            validated["status"] = "pending"
        out.append(validated)
    return out
