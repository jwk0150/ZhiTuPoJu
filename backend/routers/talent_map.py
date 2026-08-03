"""数字人才地图路由 —— 中国省份岗位热力图 + 省份详情 + 岗位图谱"""
from fastapi import APIRouter, HTTPException, Query

from backend.db_async import get_pool
from backend.services import (
    fetch_provinces_summary,
    fetch_province_detail,
    fetch_job_graph,
)

router = APIRouter()


def ok(data):
    return {"code": 0, "message": "success", "data": data}


@router.get("/provinces")
async def get_provinces():
    """全国省份数据"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        data = await fetch_provinces_summary(conn)
    return ok(data)


@router.get("/province/{province_id}")
async def get_province_detail_endpoint(province_id: str):
    """省份详情：岗位 + 趋势"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        data = await fetch_province_detail(conn, province_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"省份 {province_id} 不存在")
    return ok(data)


@router.get("/job/{job_id}")
async def get_job_graph_endpoint(job_id: str):
    """岗位知识图谱"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        data = await fetch_job_graph(conn, job_id)
    return ok(data)


@router.get("/search")
async def search_graph(keyword: str = Query(...)):
    """图谱搜索：基于 job_title 模糊匹配"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT job_title, count(*)::int AS cnt
            FROM the_total_table
            WHERE job_title ILIKE $1
            GROUP BY job_title ORDER BY cnt DESC LIMIT 20
        """, f"%{keyword}%")
    return ok({
        "keyword": keyword,
        "results": [{"name": r["job_title"], "count": r["cnt"]} for r in rows],
    })
