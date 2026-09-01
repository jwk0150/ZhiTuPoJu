# -*- coding: utf-8 -*-
"""数据库数据查询路由 —— 从 PostgreSQL 读取真实 JD 数据"""
from fastapi import APIRouter, Query

from backend.data import (
    get_db_stats,
    get_real_city_stats,
    get_real_job_detail,
    get_real_jobs,
    get_real_salary_stats,
    ok,
)

router = APIRouter()


@router.get("/stats")
def api_db_stats():
    """获取数据库整体统计"""
    stats = get_db_stats()
    if stats is None:
        return ok({
            "db_available": False,
            "message": "Database not connected, using mock data",
        })
    stats["db_available"] = True
    return ok(stats)


@router.get("/jobs")
def api_real_jobs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    keyword: str = Query(None),
):
    """获取真实岗位列表 (分页+搜索)"""
    jobs, total = get_real_jobs(limit=limit, offset=offset, keyword=keyword)
    return ok({
        "jobs": jobs,
        "total": total,
        "limit": limit,
        "offset": offset,
    })


@router.get("/jobs/{job_id}")
def api_job_detail(job_id: int):
    """获取单个岗位详情"""
    detail = get_real_job_detail(job_id)
    if detail is None:
        return {"code": 404, "message": "Job not found", "data": None}
    return ok(detail)


@router.get("/city-stats")
def api_city_stats():
    """按城市统计岗位数量"""
    stats = get_real_city_stats()
    return ok(stats)


@router.get("/salary-stats")
def api_salary_stats():
    """薪资分布统计"""
    stats = get_real_salary_stats()
    return ok(stats)
