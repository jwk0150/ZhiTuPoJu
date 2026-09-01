# -*- coding: utf-8 -*-
"""EvidenceValidator —— 确定性验证器（Phase 3）。

原则：不调用第二个 LLM 判断第一个 LLM（禁止 LLM→LLM→LLM）。
只做确定性代码校验：
  V1 事实性结论必须关联至少一条证据
  V2 引用的 evidence_id 必须真实存在于当前 Evidence Set
  V3 证据内容不能为空
  V4 confidence 复用 knowledge.evidence.evidence_confidence
  V5 Demo/Mock 数据必须产生 warning
  V6 RAG 空结果由调用方（ResearchAgent）拦截，不生成确定性答案
"""
from __future__ import annotations

from typing import Any

from backend.knowledge.evidence import evidence_confidence


def validate_response(response: dict, evidence: list[dict]) -> dict:
    """校验生成结果与证据集合的绑定关系。

    response: {"claims": [{"text": "...", "evidence_ids": [...]}]}
    evidence: 统一 Evidence 列表（agent.evidence 规范结构）。
    返回 {"passed", "unknown_claims", "warnings", "confidence"}。
    """
    evidence_ids = {
        str(e.get("evidence_id"))
        for e in evidence
        if e.get("evidence_id") is not None
    }
    warnings: list[str] = []
    unknown_claims: list[dict] = []
    passed = True

    claims = (response or {}).get("claims") or []
    for claim in claims:
        if not isinstance(claim, dict):
            continue
        ids = [str(i) for i in (claim.get("evidence_ids") or [])]
        text = str(claim.get("text") or "")
        if not ids:
            passed = False
            unknown_claims.append({
                "text": text, "unknown_evidence_ids": [], "reason": "缺少证据引用",
            })
            continue
        bad = [i for i in ids if i not in evidence_ids]
        if bad:
            passed = False
            unknown_claims.append({
                "text": text, "unknown_evidence_ids": bad, "reason": "引用不存在的证据",
            })

    # V3 空内容证据
    empty = [e.get("evidence_id") for e in evidence if not (e.get("content") or "").strip()]
    if empty:
        warnings.append(f"存在 {len(empty)} 条内容为空的证据")

    # V4 confidence
    level, _, _ = evidence_confidence(len(evidence))

    # V5 Demo/Mock
    demo = [e for e in evidence if e.get("is_demo")]
    if demo:
        warnings.append("该结果来自演示/预测数据，不代表真实市场数据。")

    return {
        "passed": passed,
        "unknown_claims": unknown_claims,
        "warnings": warnings,
        "confidence": level,
    }
