# -*- coding: utf-8 -*-
"""ResearchAgent —— 薄 RAG 问答 Agent（Phase 3）。

只做编排，不实现检索/向量/SQL/chunking/ingestion：
  query
    ↓ KnowledgeService.search（hybrid；向量腿不可用时自动 keyword-only 降级）
    ↓ 低质量过滤（RAG_MIN_RELEVANCE，基于真实 final_score）
    ↓ Evidence 规范化（agent.evidence.from_knowledge_hit）
    ↓ Grounded Generation（仅证据入 Prompt，输出 answer + claims）
    ↓ EvidenceValidator 确定性校验（失败重试 1 次，再失败降级）
    ↓ answer + evidence + confidence + warnings + retrieval_mode
"""
from __future__ import annotations

import json
from typing import Any, Optional

from backend.agent import evidence as ev_mod
from backend.agent import validator as val_mod
from backend.config import config
from backend.knowledge.service import KnowledgeService
from backend.llm import deepseek as ds

_SYSTEM = (
    "你是「执图破局」的知识问答助手。\n"
    "你只能基于提供的 EVIDENCE 回答。\n"
    "规则：\n"
    "1. 证据不足时 answer 必须写「当前证据不足，无法可靠判断」。\n"
    "2. 禁止补充数据库不存在的信息、禁止根据常识猜测具体事实、禁止修改数字/岗位名/公司名/来源。\n"
    "3. 禁止把预测/Demo 数据说成真实数据。\n"
    "4. 每个事实性结论必须引用证据的 evidence_id。\n"
    "严格输出 JSON：{\"answer\":\"...\",\"claims\":[{\"text\":\"...\",\"evidence_ids\":[\"...\"]}]}\n"
    "claims 的 evidence_ids 只能来自 EVIDENCE 中存在的 evidence_id；无对应证据的结论不要写。"
)


def _grounded_generate(query: str, evidence: list[dict]) -> tuple[str, list[dict]]:
    """仅把相关证据放入 Prompt 生成 answer + claims。返回 (answer, claims)。"""
    payload = [
        {"evidence_id": e.get("evidence_id"), "source_name": e.get("source_name"),
         "title": e.get("title"), "content": e.get("content")}
        for e in evidence
        if e.get("evidence_id") is not None
    ]
    user = f"问题：{query}\n\nEVIDENCE（唯一事实来源）：\n" + json.dumps(payload, ensure_ascii=False, default=str)
    content, meta = ds.chat_completions(
        [{"role": "system", "content": _SYSTEM}, {"role": "user", "content": user}],
        temperature=0.2,
        timeout=60.0,
    )
    if not content:
        return "", []
    try:
        parsed = ds._extract_json(content)
    except Exception:
        return "", []
    answer = str(parsed.get("answer") or "")
    claims = [c for c in (parsed.get("claims") or []) if isinstance(c, dict)]
    return answer, claims


def _empty(status: str, answer: str, warnings: list[str], retrieval_mode: str,
           evidence: Optional[list[dict]] = None) -> dict:
    return {
        "status": status,
        "answer": answer,
        "evidence": evidence or [],
        "confidence": "low",
        "warnings": warnings,
        "claims": [],
        "validation": {"passed": True, "unknown_claims": [], "warnings": []},
        "retrieval_mode": retrieval_mode,
    }


class ResearchAgent:
    def ask(self, query: str, filters: Optional[dict] = None, top_k: int = 10) -> dict:
        svc = KnowledgeService()
        retrieval_mode = "hybrid" if svc.embedding.is_ready() else "keyword_only"
        warnings: list[str] = []
        if retrieval_mode == "keyword_only":
            warnings.append("当前向量检索不可用，已降级为关键词检索。")

        res = svc.search(query, filters=filters or {}, top_k=top_k)
        status = res.get("status") or "INSUFFICIENT_EVIDENCE"
        results = res.get("results") or []

        if status != "OK" or not results:
            return _empty(
                "insufficient_evidence",
                "当前知识库没有检索到足够证据，无法可靠回答该问题。",
                warnings + ["知识库未检索到足够相关内容（INSUFFICIENT_EVIDENCE）"],
                retrieval_mode,
            )

        threshold = float(config.RAG_MIN_RELEVANCE)
        hits = [h for h in results if (h.get("final_score") or 0) >= threshold]
        if not hits:
            return _empty(
                "insufficient_evidence",
                "当前知识库检索到的内容相关度不足，无法可靠回答该问题。",
                warnings + [f"检索结果相关度过低（低于阈值 {threshold}）"],
                retrieval_mode,
            )

        evidence = [ev_mod.from_knowledge_hit(h) for h in hits]
        level, _, _ = ev_mod.confidence_for_count(len(evidence))

        # Grounded Generation + 确定性校验（最多 1 次受限重试）
        answer, claims = _grounded_generate(query, evidence)
        validation = val_mod.validate_response({"claims": claims}, evidence)
        if not validation["passed"] and claims:
            answer, claims = _grounded_generate(query, evidence)
            validation = val_mod.validate_response({"claims": claims}, evidence)

        if not answer or not validation["passed"]:
            return _empty(
                "insufficient_evidence",
                "当前证据不足以支持完整回答。",
                warnings + ["部分生成内容无法与检索证据建立可靠对应关系。"],
                retrieval_mode,
                evidence,
            )

        return {
            "status": "ok",
            "answer": answer,
            "evidence": evidence,
            "confidence": level,
            "warnings": warnings + validation["warnings"],
            "claims": claims,
            "validation": validation,
            "retrieval_mode": retrieval_mode,
        }
