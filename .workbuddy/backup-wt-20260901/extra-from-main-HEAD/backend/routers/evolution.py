# -*- coding: utf-8 -*-
"""能力动态演化 路由 (#4)

按 TEAM_GUIDE：本文件为本责任模块唯一对外接口。
所有数据计算统一委托给 backend.evolution_agent，DB 优先 + Mock 兜底。
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from backend import data
from backend.evolution_agent import evolution_agent

router = APIRouter(tags=["evolution"])


# ============================================================
# /api/evolution/profiles  — 左侧 10 个岗位的摘要列表
# ============================================================
@router.get("/profiles")
def list_profiles() -> dict[str, Any]:
    """返回前端 10 个岗位的演化摘要（数组格式，兼容前端 initEvolution）。"""
    items = []
    for title_def in evolution_agent._FRONTEND_TITLES:  # noqa: SLF001
        full = evolution_agent.analyze_job_evolution(title_def["job_id"])
        items.append({
            "job_id": full.get("job_id"),
            "job_title": full.get("job_title"),
            "cat": full.get("cat"),
            "jdCount": full.get("jdCount", 0),
            "added_count": len(full.get("added", [])),
            "removed_count": len(full.get("removed", [])),
            "modified_count": len(full.get("modified", [])),
            "risk_level": full.get("risk_level", "中"),
            "data_source": full.get("data_source", "mock"),
            "hot_top3": full.get("hotSkills", [])[:3],
        })
    return data.ok(items)


@router.get("/landscape-profiles")
def list_landscape_profiles(
    month_start: int = Query(1, ge=1, le=12, description="起始月份(1~12，按月分桶)"),
    month_end: int = Query(12, ge=1, le=12, description="截止月份(1~12，按月分桶)"),
) -> dict[str, Any]:
    """首屏进入演化页面的一次性接口：返回所有关注岗位的完整演化画像。"""
    titles = [t["job_id"] for t in evolution_agent._FRONTEND_TITLES]  # noqa: SLF001
    profiles = evolution_agent.compute_landscape_profiles(
        titles, month_start=month_start, month_end=month_end
    )
    if not profiles:
        return _fail("暂无演化数据", code=1)
    return data.ok(profiles)


@router.get("/jobs/{job_id}")
def get_job_evolution(
    job_id: str,
    month_start: int = Query(1, ge=1, le=12, description="起始月份(1~12，按月分桶)"),
    month_end: int = Query(12, ge=1, le=12, description="截止月份(1~12，按月分桶)"),
) -> dict[str, Any]:
    """根据岗位 ID 返回完整演化画像（DB 优先 + Mock 兜底）。"""
    result = evolution_agent.analyze_job_evolution(job_id, month_start=month_start, month_end=month_end)
    if not result or result.get("jdCount", 0) == 0 and result.get("data_source") == "mock":
        return _fail(f"岗位 {job_id} 暂无演化数据", code=1)
    return data.ok(result)


@router.get("/jobs/{job_id}/analysis")
def get_job_analysis(
    job_id: str,
    month_start: int = Query(1, ge=1, le=12, description="起始月份(1~12，按月分桶)"),
    month_end: int = Query(12, ge=1, le=12, description="截止月份(1~12，按月分桶)"),
) -> dict[str, Any]:
    """返回该岗位演化分析结论（风险等级 + 自然语言建议）。"""
    full = evolution_agent.analyze_job_evolution(job_id, month_start=month_start, month_end=month_end)
    if not full:
        return _fail(f"岗位 {job_id} 暂无分析结果", code=1)

    if isinstance(job_id, str) and (full.get("data_source") == "mock" or not full.get("data_source")):
        legacy = evolution_agent.analyze_job_evolution(_legacy_profile(job_id))
        return data.ok(legacy)

    return data.ok({
        "job_id": full.get("job_id"),
        "job_title": full.get("job_title"),
        "risk_level": full.get("risk_level", "中"),
        "conclusion": full.get("summary") or full.get("conclusion", ""),
        "new_requirements": full.get("added", []),
        "declining_skills": full.get("removed", []),
        "strengthened_skills": full.get("modified", []),
        "data_source": full.get("data_source"),
    })


@router.get("/jobs/{job_id}/forecast")
def get_job_forecast(job_id: str) -> dict[str, Any]:
    """返回未来 3 月需求指数外推。"""
    full = evolution_agent.analyze_job_evolution(job_id)
    if not full:
        return _fail(f"岗位 {job_id} 暂无预测数据", code=1)
    return data.ok({
        "job_id": full.get("job_id"),
        "forecast": full.get("forecast", []),
        "trendMust": full.get("trendMust", []),
        "trendNice": full.get("trendNice", []),
        "data_source": full.get("data_source"),
    })


@router.get("/jobs/{job_id}/hot-skills")
def get_job_hot_skills(job_id: str) -> dict[str, Any]:
    """返回 TOP10 技能热度（柱状图数据）。"""
    full = evolution_agent.analyze_job_evolution(job_id)
    if not full:
        return _fail(f"岗位 {job_id} 暂无热度数据", code=1)
    return data.ok({
        "job_id": full.get("job_id"),
        "skills": full.get("hotSkills", []),
        "values": full.get("hotValues", []),
        "data_source": full.get("data_source"),
    })


@router.get("/jobs/{job_id}/db-stats")
def get_job_db_stats(job_id: str) -> dict[str, Any]:
    """返回 DB 真实样本数 / 各来源分布 / 词典覆盖率（答辩演示用）。"""
    stats = evolution_agent.get_db_stats_for_title(job_id)
    if not stats:
        return _fail("DB 不可用", code=2)
    return data.ok(stats)


@router.get("/jobs/{job_id}/migration")
def get_job_migration(job_id: str) -> dict[str, Any]:
    """预测哪些技能会扩散进入该岗位 (migration_in) 和哪些会被淘汰 (migration_out)。"""
    result = evolution_agent.analyze_migration(job_id)
    if not result:
        return _fail("该岗位暂无跨岗位迁移数据", code=1)
    return data.ok(result)


@router.get("/jobs/{job_id}/adjacent")
def get_job_adjacent(job_id: str) -> dict[str, Any]:
    """返回与该岗位技能向量最相似的 3 个相邻岗位。"""
    result = evolution_agent.analyze_migration(job_id)
    if not result:
        return _fail("该岗位暂无邻接数据", code=1)
    return data.ok({
        "job_id": job_id,
        "adjacent_jobs": result.get("adjacent_jobs", []),
        "data_source": result.get("data_source"),
    })


@router.get("/landscape")
def get_landscape() -> dict[str, Any]:
    """返回 10 岗位 × 全部词典技能的频率矩阵 + 全局热门 TOP 30。"""
    result = evolution_agent.get_skill_landscape()
    if not result:
        return _fail("DB 不可用", code=2)
    return data.ok(result)


@router.get("/skills")
def search_skills(
    keyword: str = Query(default="", description="技能关键词"),
    job_id: str = Query(default="", description="限定岗位"),
    change_type: str = Query(
        default="",
        description="added | removed | modified",
    ),
) -> dict[str, Any]:
    """跨岗位技能检索（前端可按标签过滤）。"""
    target = job_id or next(
        (t["job_id"] for t in evolution_agent._FRONTEND_TITLES),  # noqa: SLF001
        None,
    )
    if not target:
        return _fail("无可用岗位", code=1)

    full = evolution_agent.analyze_job_evolution(target)
    if not full:
        return _fail("查询失败", code=1)

    candidates = []
    if change_type == "added":
        candidates = full.get("added", [])
    elif change_type == "removed":
        candidates = full.get("removed", [])
    elif change_type == "modified":
        candidates = full.get("modified", [])
    else:
        candidates = (
            full.get("added", []) +
            full.get("removed", []) +
            full.get("modified", [])
        )

    kw = (keyword or "").strip().lower()
    if kw:
        candidates = [c for c in candidates if kw in (c.get("name") or "").lower()]

    return data.ok({
        "job_id": full.get("job_id"),
        "change_type": change_type or "all",
        "total": len(candidates),
        "items": candidates,
        "data_source": full.get("data_source"),
    })


def _legacy_profile(job_id: str) -> dict:
    for p in data.EVOLUTION_PROFILES:
        if p.get("job_id") == job_id:
            return p
    return {
        "job_id": job_id,
        "job_title": job_id,
        "cat": "通用",
        "jdCount": 0,
        "added": [],
        "removed": [],
        "modified": [],
        "hotSkills": [],
        "hotValues": [],
        "trendMust": [10] * 12,
        "trendNice": [5] * 12,
        "forecast": [],
        "summary": "",
        "period": "",
    }


def _fail(message: str, code: int = 1) -> dict:
    return {"code": code, "message": message, "data": None}
