# -*- coding: utf-8 -*-
"""趋势分析 — FastAPI Router
提供：仪表盘数据、岗位兴衰分析、AI 新兴岗位推演、AI 洞察
"""
from __future__ import annotations

from fastapi import APIRouter

from backend import trends_service

router = APIRouter(tags=["trends"])


# ============================================================
# 1. 综合仪表盘
# ============================================================


@router.get("/dashboard")
def get_dashboard():
    """获取趋势分析仪表盘全量数据（替代 window.TREND）"""
    data = trends_service.get_dashboard_data()
    return {"code": 0, "message": "success", "data": data}


# ============================================================
# 2. 岗位兴衰分析
# ============================================================


@router.get("/job-lifecycle")
def get_job_lifecycle():
    """分析各岗位生命周期阶段：rising / stable / declining / emerging"""
    data = trends_service.get_job_lifecycle_analysis()
    return {"code": 0, "message": "success", "data": data}


# ============================================================
# 3. AI 新兴岗位推演
# ============================================================


@router.get("/emerging-jobs")
def get_emerging_jobs():
    """AI + DB 驱动的实时新兴岗位推演"""
    data = trends_service.get_emerging_jobs_analysis()
    return {"code": 0, "message": "success", "data": data}


# ============================================================
# 4. AI 洞察
# ============================================================


@router.get("/ai-insight")
def get_ai_insight():
    """DeepSeek 生成的自然语言趋势分析洞察"""
    # 获取 dashboard 和 lifecycle 数据作为 context
    dashboard = trends_service.get_dashboard_data()
    lifecycle = trends_service.get_job_lifecycle_analysis()
    data = trends_service.get_ai_insight(dashboard, lifecycle)
    return {"code": 0, "message": "success", "data": data}
