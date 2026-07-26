"""新岗位发现（Discovery）智能体 + HTTP 接口。

说明
====
按 backend/TEAM_GUIDE.md 约定：
  * 仅修改本文件，其他文件不动；
  * 返回统一格式 {"code":0,"message":"success","data":...}；
  * 第一阶段不接真实 RAG / LLM，先让前端能拿到可信数据。

DiscoveryAgent —— 把"原始岗位片段"分析成"新岗位候选"
================================================
输入：原始岗位 dict（最小要有 title + 多个 skill 标签）
输出：补齐前端需要的字段：
      title / category / confidence / growth_rate /
      core_skills / preferred_skills / definition /
      typical_scenarios / evidence_sources /
      responsibilities / trend / quality / status

启发式实现要点（Phase 1，可被 Phase 2 的 LLM 替代）
----------------------------------------------------
  * confidence           ← evidence_count × 0.4 + source_diversity × 0.3 + skill_match × 0.3
  * growth_rate          ← trend 末月 / 首月 × 100 - 100（百分比）
  * core_skills          ← 业务核心技能关键词命中（如 RAG/LangChain/FastAPI 等）
  * definition           ← 规则模板 + title 拼接（无 LLM 安全）
  * evidence_sources     ← 直接从 mock 拿（Phase 2 替换为多源检索）
  * responsibilities     ← 按类别模板拼

接口（保持向后兼容 + 新增 2 个 AI 化端点）
============================================
  GET    /api/discovery/jobs                            list（filter: keyword/status/sort/category/min_confidence）
  GET    /api/discovery/jobs/{job_id}                   detail
  POST   /api/discovery/jobs/{job_id}/status            update status
  POST   /api/discovery/analyze          【新增】       analyze raw job → enriched
  POST   /api/discovery/jobs/{job_id}/reanalyze  【新增】 重新跑分析流水线，刷新字段
  GET    /api/discovery/stats                            全局指标聚合
"""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel

from backend import data


router = APIRouter()


# ---------------------------------------------------------------------------
# DiscoveryAgent —— 启发式分析器（Phase 2 可替换为 LLM 客户端）
# ---------------------------------------------------------------------------
class DiscoveryAgent:
    """新岗位发现 Agent。Phase 1 启发式 / Phase 2 接 RAG+LLM。"""

    # 业务核心技能词典（命中加成 confidence；缺这些的岗位不视为"新岗位"）
    BIZ_SKILLS: tuple[str, ...] = (
        "Python", "RAG", "LangChain", "Function Calling", "多智能体协作",
        "向量数据库", "Prompt工程", "FastAPI", "PyTorch", "Transformer",
        "Spring Boot", "Kubernetes", "Ray", "LLM微调", "向量检索",
        "LLM", "LLMOps", "Agent", "AI Agent", "大模型", "Diffusion",
        "强化学习", "机器学习", "深度学习", "Spark", "Flink", "Dask",
        "分布式", "微服务", "云原生", "Service Mesh", "MLOps",
    )

    # 类别判定词典（按技能命中归类）
    CATEGORY_RULES: dict[str, tuple[str, ...]] = {
        "人工智能": ("Python", "RAG", "LangChain", "LLM", "Agent", "大模型",
                     "PyTorch", "Transformer", "Diffusion", "强化学习", "深度学习"),
        "大数据": ("Spark", "Flink", "Dask", "Ray", "Kafka", "Hadoop", "Hive"),
        "云原生": ("Kubernetes", "Docker", "Service Mesh", "微服务", "云原生", "Istio"),
        "互联网/电商": ("电商", "推荐系统", "广告", "用户增长", "A/B"),
    }

    # 岗位类别 → 职责模板（Phase 1 占位，Phase 2 由 LLM 生成更自然）
    RESPONSIBILITY_TEMPLATES: dict[str, list[str]] = {
        "AI Agent工程师": [
            "设计智能体任务规划流程", "接入外部工具和业务系统",
            "构建RAG知识检索链路", "优化多轮对话和任务执行效果",
        ],
        "RAG工程师": [
            "文档解析", "向量检索", "检索链路评估", "答案质量优化",
        ],
        "默认": ["参与需求拆解", "完成功能开发", "配合上线与运维"],
    }

    SCENARIO_TEMPLATES: dict[str, list[str]] = {
        "AI Agent工程师": ["智能客服", "企业知识库", "自动化办公", "招聘问答助手"],
        "RAG工程师": ["知识库问答", "政策检索", "报告分析"],
        "默认": ["企业内场景"],
    }

    DEFINITION_TEMPLATES: dict[str, str] = {
        "AI Agent工程师": (
            "负责基于大模型构建智能体应用，完成任务规划、工具调用、"
            "知识检索和多智能体协作流程设计。"
        ),
        "RAG工程师": "负责企业知识库、文档检索、向量召回和生成答案评估。",
        "默认": "负责本岗位职责范围内的方案设计、开发与落地。",
    }

    # ------------------------------------------------------------------
    # 主流程：analyze(raw) → 完整 enriched dict
    # ------------------------------------------------------------------
    def analyze(self, raw: dict[str, Any]) -> dict[str, Any]:
        """分析一个原始岗位，返回前端可直接渲染的 dict。"""
        title = (raw.get("title") or "").strip()
        if not title:
            return self._reject("title 缺失")

        skills = list(dict.fromkeys(raw.get("skills") or []))   # 去重保序
        evidence = list(raw.get("evidence_sources") or [])
        trend = list(raw.get("trend") or [])

        biz_hits = [s for s in skills if s in self.BIZ_SKILLS]
        if not biz_hits and not evidence:
            return self._reject("既无业务核心技能，也无证据来源，置信度过低")

        category = self._infer_category(title, skills)
        confidence = self._compute_confidence(
            n_skills=len(skills),
            n_biz=len(biz_hits),
            n_evidence=len(evidence),
            n_sources=len({(e.get("source_name"), e.get("source_type")) for e in evidence}),
        )
        growth_rate = self._compute_growth_rate(trend)

        return {
            "id": raw.get("id") or f"new_{int(datetime.now(timezone.utc).timestamp())}",
            "title": title,
            "category": category,
            "confidence": round(confidence, 1),
            "growth_rate": round(growth_rate, 1),
            "status": raw.get("status") or "pending",
            "discovered_at": raw.get("discovered_at") or self._now_iso(),
            "core_skills": biz_hits or skills[:5],
            "preferred_skills": [s for s in skills if s not in self.BIZ_SKILLS][:5],
            "definition": raw.get("definition") or self._pick(self.DEFINITION_TEMPLATES, title, category),
            "typical_scenarios": raw.get("typical_scenarios") or self._pick(self.SCENARIO_TEMPLATES, title, category),
            "evidence_sources": evidence,
            "responsibilities": raw.get("responsibilities") or self._pick(self.RESPONSIBILITY_TEMPLATES, title, category),
            "trend": trend,
            "quality": raw.get("quality") or self._estimate_quality(
                n_evidence=len(evidence), n_sources=len({(e.get("source_name"), e.get("source_type")) for e in evidence})
            ),
        }

    # ------------------------------------------------------------------
    # 全局聚合
    # ------------------------------------------------------------------
    def stats(self, jobs: list[dict]) -> dict[str, Any]:
        """对一组已发现的岗位做整体指标聚合。"""
        if not jobs:
            return {"total": 0, "by_status": {}, "by_category": {}, "avg_confidence": 0}

        by_status = Counter(j.get("status") or "pending" for j in jobs)
        by_category = Counter(j.get("category") or "未分类" for j in jobs)
        confidences = [j.get("confidence") or 0 for j in jobs]
        growth = [j.get("growth_rate") or 0 for j in jobs]

        return {
            "total": len(jobs),
            "by_status": dict(by_status),
            "by_category": dict(by_category),
            "avg_confidence": round(sum(confidences) / len(confidences), 1),
            "avg_growth_rate": round(sum(growth) / len(growth), 1),
            "high_confidence_count": sum(1 for c in confidences if c >= 90),
            "pending_count": by_status.get("pending", 0),
            "adopted_count": by_status.get("adopted", 0),
        }

    # ------------------------------------------------------------------
    # 内部：启发式计算
    # ------------------------------------------------------------------
    def _infer_category(self, title: str, skills: list[str]) -> str:
        best, best_n = "未分类", 0
        for cat, kws in self.CATEGORY_RULES.items():
            n = sum(1 for s in skills if s in kws)
            if n > best_n:
                best, best_n = cat, n
        return best if best_n > 0 else "未分类"

    def _compute_confidence(self, n_skills: int, n_biz: int, n_evidence: int, n_sources: int) -> float:
        # 三个维度：证据量（×0.4）、来源多样性（×0.3）、业务契合度（×0.3）
        ev = min(n_evidence, 20) / 20 * 100                # 20 条以上封顶
        src = min(n_sources, 5) / 5 * 100                  # 5 个不同来源封顶
        fit = min(n_biz, 5) / 5 * 100 + min(n_skills, 8) / 8 * 20 - 20
        fit = max(0.0, min(100.0, fit))
        score = ev * 0.4 + src * 0.3 + fit * 0.3
        return max(0.0, min(100.0, score))

    def _compute_growth_rate(self, trend: list[dict]) -> float:
        """trend 是 [{month, count}, ...]，按时间顺序，返回末月 vs 首月 百分比。"""
        if not trend or len(trend) < 2:
            return 0.0
        first = trend[0].get("count", 0) or 0
        last = trend[-1].get("count", 0) or 0
        if first <= 0:
            return 0.0 if last <= 0 else 999.0
        return (last - first) / first * 100.0

    def _estimate_quality(self, n_evidence: int, n_sources: int) -> dict[str, Any]:
        return {
            "evidence_count": n_evidence,
            "source_count": max(n_sources, 1),
            "duplicate_rate": round(max(0.0, 15.0 - n_sources * 2.5), 1),
            "freshness_score": 95 if n_evidence > 0 else 0,
        }

    def _pick(self, table: dict[str, Any], title: str, category: str) -> Any:
        if title in table:
            return table[title]
        if category in table:
            return table[category]
        return table["默认"]

    def _reject(self, reason: str) -> dict[str, Any]:
        return {"rejected": True, "reason": reason}

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


# 模块级 Agent 单例（无 LLM；Phase 2 可注入）
AGENT = DiscoveryAgent()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class StatusUpdate(BaseModel):
    status: str


class RawJobAnalyze(BaseModel):
    """调用 /analyze 的 raw input —— 最小要有 title + skills/evidence 之一。"""
    id: str | None = None
    title: str
    category: str | None = None
    skills: list[str] = []
    evidence_sources: list[dict[str, Any]] = []
    trend: list[dict[str, Any]] = []
    status: str | None = None
    discovered_at: str | None = None
    definition: str | None = None
    typical_scenarios: list[str] | None = None
    responsibilities: list[str] | None = None
    quality: dict[str, Any] | None = None


def _normalize(job: dict[str, Any]) -> dict[str, Any]:
    """确保取出来的岗位有前端约定的字段；不重跑分析（已 mock 数据），仅补缺字段。"""
    out = dict(job)
    out.setdefault("confidence", 0)
    out.setdefault("growth_rate", 0)
    out.setdefault("core_skills", [])
    out.setdefault("evidence_sources", [])
    out.setdefault("discovered_at", AGENT._now_iso())      # noqa: SLF001（模块内受控）
    return out


# ---------------------------------------------------------------------------
# 路由 —— 兼容原 4 个端点 + 新增 analyze / reanalyze / stats
# ---------------------------------------------------------------------------
@router.get("/jobs")
def get_discovery_jobs(
    status: str = Query(default="all", pattern="^(all|pending|adopted|rejected)$"),
    keyword: str = Query(default=""),
    sort: str = Query(default="confidence", pattern="^(confidence|growth|date|title)$"),
    category: str = Query(default=""),
    min_confidence: float = Query(default=0, ge=0, le=100),
):
    """列表：支持 status / keyword / sort / category / min_confidence 过滤。"""
    jobs = [_normalize(j) for j in data.NEW_JOBS]

    if status != "all":
        jobs = [j for j in jobs if j.get("status") == status]

    if category.strip():
        jobs = [j for j in jobs if j.get("category") == category.strip()]

    jobs = [j for j in jobs if (j.get("confidence") or 0) >= min_confidence]

    keyword = keyword.strip().lower()
    if keyword:
        jobs = [
            j for j in jobs
            if keyword in (j.get("title") or "").lower()
            or keyword in (j.get("category") or "").lower()
            or any(keyword in (s or "").lower() for s in j.get("core_skills", []))
        ]

    if sort == "growth":
        jobs.sort(key=lambda j: j.get("growth_rate", 0), reverse=True)
    elif sort == "date":
        jobs.sort(key=lambda j: j.get("discovered_at", ""), reverse=True)
    elif sort == "title":
        jobs.sort(key=lambda j: j.get("title", ""))
    else:
        jobs.sort(key=lambda j: j.get("confidence", 0), reverse=True)

    return data.ok(jobs)


@router.get("/jobs/{job_id}")
def get_discovery_job_detail(job_id: str):
    for job in data.NEW_JOBS:
        if job["id"] == job_id:
            return data.ok(_normalize(job))
    return {"code": 1, "message": "job not found", "data": None}


@router.post("/jobs/{job_id}/status")
def update_discovery_job_status(job_id: str, payload: StatusUpdate):
    if payload.status not in {"pending", "adopted", "rejected"}:
        return {"code": 1, "message": "invalid status (must be pending|adopted|rejected)", "data": None}
    for job in data.NEW_JOBS:
        if job["id"] == job_id:
            job["status"] = payload.status
            return data.ok({"id": job_id, "status": payload.status, "updated_at": AGENT._now_iso()})  # noqa: SLF001
    return {"code": 1, "message": "job not found", "data": None}


@router.post("/analyze")
def analyze_raw_job(payload: RawJobAnalyze):
    """Agent 主入口 —— 接收一个原始岗位 dict，跑 analyze 流水线，返回 enriched。

    Phase 1 用启发式；Phase 2 把 AGENT 替换为带 LLM 客户端的版本即可，
    接口签名不变。
    """
    raw = payload.model_dump()
    enriched = AGENT.analyze(raw)
    if enriched.get("rejected"):
        return {"code": 1, "message": enriched["reason"], "data": None}
    return data.ok(enriched)


@router.post("/jobs/{job_id}/reanalyze")
def reanalyze_job(job_id: str):
    """对已有 mock 岗位重新跑分析流水线（用于定时刷新或运营点手动触发）。"""
    target = None
    for job in data.NEW_JOBS:
        if job["id"] == job_id:
            target = job
            break
    if not target:
        return {"code": 1, "message": "job not found", "data": None}

    enriched = AGENT.analyze(dict(target))
    if enriched.get("rejected"):
        return {"code": 1, "message": enriched["reason"], "data": None}
    # 回填（不破坏 raw 字段，只补缺失）
    for k, v in enriched.items():
        target.setdefault(k, v)
    return data.ok(_normalize(target))


@router.get("/stats")
def get_discovery_stats():
    """全局聚合指标 —— 给前端看板用。"""
    return data.ok(AGENT.stats([_normalize(j) for j in data.NEW_JOBS]))
