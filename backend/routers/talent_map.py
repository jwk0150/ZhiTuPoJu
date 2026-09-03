"""数字人才地图路由 —— 中国省份岗位热力图 + 省份详情 + 岗位图谱 + 市级下钻"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from backend.db_async import get_pool
from backend.services import (
    fetch_provinces_summary,
    fetch_province_detail,
    fetch_job_graph,
    fetch_cities_summary,
    fetch_city_detail,
    fetch_filter_options,
    fetch_city_tech_graph,
    fetch_tech_detail,
    fetch_city_jobs_full,
    fetch_city_preview,
    fetch_job_tech_graph,
    update_job_tech_graph,
)

router = APIRouter()


def ok(data):
    return {"code": 0, "message": "success", "data": data}


@router.get("/filters")
async def get_filter_options():
    """获取筛选下拉框全部可选项（独立于省份查询，确保始终可用）"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        data = await fetch_filter_options(conn)
    return ok(data)


@router.get("/provinces")
async def get_provinces(
    region: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    job: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    experience: Optional[str] = Query(None),
):
    """全国省份数据（支持5维组合筛选）"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        data = await fetch_provinces_summary(
            conn,
            region=region,
            industry=industry,
            job=job,
            education=education,
            experience=experience,
        )
    return ok(data)


@router.get("/province/{province_id}")
async def get_province_detail_endpoint(
    province_id: str,
    industry: Optional[str] = Query(None),
    job: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    experience: Optional[str] = Query(None),
):
    """省份详情：岗位 + 趋势"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        data = await fetch_province_detail(
            conn, province_id,
            industry=industry, job=job, education=education, experience=experience,
        )
    if not data:
        raise HTTPException(status_code=404, detail=f"省份 {province_id} 不存在")
    return ok(data)


@router.get("/cities/{province_id}")
async def get_cities_summary_endpoint(
    province_id: str,
    industry: Optional[str] = Query(None),
    job: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    experience: Optional[str] = Query(None),
):
    """市级下钻数据"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        data = await fetch_cities_summary(
            conn, province_id,
            industry=industry, job=job, education=education, experience=experience,
        )
    if not data:
        raise HTTPException(status_code=404, detail=f"省份 {province_id} 不存在或无城市数据")
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


@router.get("/city/{province_name}/{city_name}")
async def get_city_detail_endpoint(
    province_name: str,
    city_name: str,
    industry: Optional[str] = Query(None),
    job: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    experience: Optional[str] = Query(None),
):
    """城市详情：岗位TOP + 统计"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        data = await fetch_city_detail(
            conn, province_name, city_name,
            industry=industry, job=job, education=education, experience=experience,
        )
    if not data:
        raise HTTPException(status_code=404, detail=f"城市 {city_name} 不存在")
    return ok(data)


@router.get("/city-tech-graph/{city_name}")
async def get_city_tech_graph(
    city_name: str,
    industry: Optional[str] = Query(None),
    job: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    experience: Optional[str] = Query(None),
    job_title: Optional[str] = Query(None),
):
    """城市级技术知识图谱（中心岗位+辐射技术节点）"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        data = await fetch_city_tech_graph(
            conn, city_name,
            industry=industry, job=job, education=education, experience=experience,
            job_title=job_title,
        )
    if not data:
        raise HTTPException(status_code=404, detail=f"城市 {city_name} 无岗位数据")
    return ok(data)


@router.get("/job-tech-graph/")
async def get_job_tech_graph(
    job_title: str = Query(..., description="岗位名称，例如 数据分析师"),
    industry: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    experience: Optional[str] = Query(None),
):
    """岗位级技术知识图谱（中心岗位→技术分类→技术 / 岗位级别→技术）。

    数据完全来自该岗位真实 skills 字段，不混入城市级聚合，供岗位技术图谱/
    技术栈/级别三个视图复用。
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        data = await fetch_job_tech_graph(
            conn, job_title,
            industry=industry, education=education, experience=experience,
        )
    if not data:
        raise HTTPException(status_code=404, detail=f"岗位 {job_title} 无数据")
    return ok(data)


@router.get("/tech-detail/{tech_name}")
async def get_tech_detail(
    tech_name: str,
    city_name: Optional[str] = Query(None),
):
    """技术详细分析"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        data = await fetch_tech_detail(conn, tech_name, city_name=city_name)
    return ok(data)


@router.get("/city-jobs/{city_name}")
async def get_city_jobs_full_endpoint(city_name: str):
    """获取城市完整岗位数据（不足则 AI 补充到 20 个）"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        data = await fetch_city_jobs_full(conn, city_name, ensure_min=20)
    return ok(data)


@router.get("/city-preview/{province_name}/{city_name}")
async def get_city_preview_endpoint(province_name: str, city_name: str):
    """城市悬停预览：岗位总数 + 平均薪资 + 热门岗位TOP5 + 热门技术TOP5 + 行业/学历占比"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        data = await fetch_city_preview(conn, province_name, city_name)
    if not data:
        raise HTTPException(status_code=404, detail=f"城市 {city_name} 无数据")
    return ok(data)


@router.post("/update-tech-graph")
async def update_tech_graph(payload: dict):
    """更新岗位技术图谱（挑战杯演示）：

    从 map_data_table 提取该岗位真实技术池 + 通用补充池，
    按轮次确定性重新选择一批技术并写入 new_skill_table，
    返回更新后的图谱数据（结构与 /map/job-tech-graph 一致）。
    """
    job_title = (payload.get("job_title") or "").strip()
    try:
        round_no = int(payload.get("round") or 1)
    except (TypeError, ValueError):
        round_no = 1
    if not job_title:
        raise HTTPException(status_code=400, detail="job_title 不能为空")
    pool = await get_pool()
    async with pool.acquire() as conn:
        data = await update_job_tech_graph(conn, job_title, round_no)
    if not data:
        raise HTTPException(status_code=404, detail=f"岗位 {job_title} 无数据")
    return ok(data)
