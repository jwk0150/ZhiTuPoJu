"""业务服务：从数据库聚合数据生成接口响应"""
import hashlib
import json
import random
import asyncpg
from datetime import datetime, date, timedelta
from typing import Optional, Dict, List, Any
from backend.mappings import (
    CITY_TO_PROVINCE,
    PROVINCE_CENTERS,
    PROVINCE_CODE,
    categorize_job,
    parse_city_to_province,
    JOB_CATEGORY_RULES,
)


def _build_filter_where(
    industry: Optional[str] = None,
    job: Optional[str] = None,
    education: Optional[str] = None,
    experience: Optional[str] = None,
) -> tuple:
    """返回 (where_clause, params) 用于 job_title/education/experience 过滤"""
    clauses = []
    params = []

    if industry:
        clauses.append(f"(lower(job_title) ILIKE ${len(params)+1} OR lower(COALESCE(industry_tags,'')) ILIKE ${len(params)+1})")
        params.append(f"%{industry}%")
    if job:
        clauses.append(f"lower(job_title) ILIKE ${len(params)+1}")
        params.append(f"%{job}%")
    if education and education not in ("不限", ""):
        edu_map = {"大专": "大专", "本科": "本科", "硕士": "硕士", "博士": "博士"}
        edu_val = edu_map.get(education, education)
        clauses.append(f"(education ILIKE ${len(params)+1} OR qualification ILIKE ${len(params)+1})")
        params.append(f"%{edu_val}%")
    if experience and experience not in ("不限", ""):
        exp_map = {"应届生": "应届", "1-3年": "1-3年", "3-5年": "3-5年", "5-10年": "5-10年", "10年以上": "10年"}
        exp_val = exp_map.get(experience, experience)
        clauses.append(f"(experience ILIKE ${len(params)+1} OR work_experience ILIKE ${len(params)+1})")
        params.append(f"%{exp_val}%")

    where_str = " AND ".join(clauses) if clauses else "1=1"
    return where_str, params


async def fetch_provinces_summary(
    conn: asyncpg.Connection,
    region: Optional[str] = None,
    industry: Optional[str] = None,
    job: Optional[str] = None,
    education: Optional[str] = None,
    experience: Optional[str] = None,
) -> dict:
    """全国省份聚合数据：每个省份的岗位总数、热门指数、增长率（已含行业/岗位/学历/经验筛选）"""
    filter_where, filter_params = _build_filter_where(
        industry=industry, job=job, education=education, experience=experience,
    )

    # region 筛选：仅保留指定省份的城市数据
    region_cities = None
    if region:
        region_cities = [c for c, p in CITY_TO_PROVINCE.items() if p == region]

    # 1) 按省份聚合岗位数（先解析 city→province）
    city_sql = f"""
        SELECT
          city,
          count(*)::int AS cnt,
          avg((salary_min + salary_max) / 2.0) AS avg_salary,
          count(DISTINCT job_title)::int AS distinct_titles
        FROM the_total_table
        WHERE city IS NOT NULL AND city <> '' AND ({filter_where})
        GROUP BY city
    """
    rows = await conn.fetch(city_sql, *filter_params)
    # 聚合到省份（region 指定时仅保留该省）
    province_map: dict[str, dict] = {}
    for r in rows:
        prov = parse_city_to_province(r["city"])
        if not prov:
            continue
        if region and prov != region:
            continue
        if prov not in province_map:
            province_map[prov] = {
                "jobCount": 0,
                "cityCount": 0,
                "salarySum": 0.0,
                "salaryN": 0,
                "distinctTitles": set(),
            }
        m = province_map[prov]
        m["jobCount"] += r["cnt"]
        m["cityCount"] += 1
        if r["avg_salary"] is not None:
            m["salarySum"] += float(r["avg_salary"]) * r["cnt"]
            m["salaryN"] += r["cnt"]
        # distinct titles 不在这里算，单独查
    # 2) distinct titles（带过滤）
    distinct_sql = f"""
        SELECT city, job_title
        FROM the_total_table
        WHERE city IS NOT NULL AND city <> '' AND ({filter_where})
    """
    distinct_rows = await conn.fetch(distinct_sql, *filter_params)
    title_set_by_prov: dict[str, set] = {}
    for r in distinct_rows:
        prov = parse_city_to_province(r["city"])
        if not prov:
            continue
        if region and prov != region:
            continue
        title_set_by_prov.setdefault(prov, set()).add(r["job_title"])
    for prov, s in title_set_by_prov.items():
        province_map[prov]["distinctTitles"] = len(s)

    # 3) 总数据统计（带过滤）
    total_sql = f"SELECT count(*) FROM the_total_table WHERE ({filter_where})"
    total = await conn.fetchval(total_sql, *filter_params) or 0
    distinct_sql_tot = f"SELECT count(DISTINCT job_title) FROM the_total_table WHERE ({filter_where})"
    distinct_jobs = await conn.fetchval(distinct_sql_tot, *filter_params) or 0
    upd_sql = f"SELECT max(crawl_time)::text FROM the_total_table WHERE ({filter_where})"
    update_time = await conn.fetchval(upd_sql, *filter_params) or ""

    # 4) 构建省份列表（34 省全补齐，没数据的给 0）
    max_jobcount = max((m["jobCount"] for m in province_map.values()), default=1)
    provinces = []
    # 遍历 PROVINCE_CODE 全部 34 省，保证无遗漏
    for prov_name, prov_code in PROVINCE_CODE.items():
        m = province_map.get(prov_name, {
            "jobCount": 0, "cityCount": 0, "salarySum": 0.0, "salaryN": 0, "distinctTitles": 0
        })
        # 热门指数：有数据走归一化（28-99），没数据给低值 8
        if m["jobCount"] > 0:
            ratio = m["jobCount"] / max_jobcount
            hot_index = round(ratio * 70 + 28, 1)
            demand_trend = round(ratio * 30 + m["distinctTitles"] * 0.4 + 3, 1)
        else:
            hot_index = 8.0
            demand_trend = 2.0
        avg_sal = m["salarySum"] / m["salaryN"] if m["salaryN"] > 0 else 0
        provinces.append({
            "id": prov_code,
            "name": prov_name,
            "center": PROVINCE_CENTERS.get(prov_name, [104, 36]),
            "jobCount": m["jobCount"],
            "hotIndex": min(99.9, hot_index),
            "demandTrend": min(99.9, demand_trend),
            "avgSalary": round(avg_sal, 0),
            "distinctTitles": m["distinctTitles"],
            "cityCount": m["cityCount"],
        })
    provinces.sort(key=lambda x: -x["jobCount"])

    # 5) 筛选下拉框可选项
    regions = list(PROVINCE_CODE.keys())

    # 行业方向：从 industry_tags 字段提取
    ind_rows = await conn.fetch("SELECT DISTINCT industry_tags FROM the_total_table WHERE industry_tags IS NOT NULL AND industry_tags != ''")
    industries_set = set()
    for r in ind_rows:
        for tag in (r['industry_tags'] or '').split(','):
            tag = tag.strip()
            if tag:
                industries_set.add(tag)
    industries = sorted(industries_set) if industries_set else ['互联网', '人工智能', '金融', '制造', '医疗', '教育']

    # 岗位方向：distinct job titles (取top200)
    jobs_rows = await conn.fetch("SELECT DISTINCT job_title FROM the_total_table WHERE job_title IS NOT NULL AND job_title != '' ORDER BY job_title LIMIT 200")
    jobs = [r['job_title'] for r in jobs_rows]

    return {
        "updateTime": update_time,
        "totalJobs": int(total),
        "distinctJobs": int(distinct_jobs),
        "provinces": provinces,
        "regions": regions,
        "industries": industries,
        "jobs": jobs,
    }


async def fetch_province_detail(
    conn: asyncpg.Connection,
    province_id: str,
    industry: Optional[str] = None,
    job: Optional[str] = None,
    education: Optional[str] = None,
    experience: Optional[str] = None,
) -> Optional[dict]:
    """省份详情：岗位TOP列表 + 7日趋势"""
    # 反查省名：支持数字编码（如"360000"）和中文省名（如"江西"）
    prov_name = next((n for n, c in PROVINCE_CODE.items() if c == province_id), None)
    if not prov_name:
        # 可能是中文省名
        if province_id in PROVINCE_CODE:
            prov_name = province_id
    if not prov_name:
        # 省名简称 → 全称（如"江西"→"江西"）
        for n in PROVINCE_CODE:
            if n == province_id or n == province_id + '省' or n == province_id + '市':
                prov_name = n
                break
    if not prov_name:
        return None
    # 该省所有城市
    prov_cities = [c for c, p in CITY_TO_PROVINCE.items() if p == prov_name]
    if not prov_cities:
        return None

    # 构建过滤条件
    filter_where, extra_params = _build_filter_where(
        industry=industry, job=job, education=education, experience=experience,
    )

    # 1) TOP 岗位（按出现次数）
    c_holders = ",".join([f"${i+1}" for i in range(len(prov_cities))])
    where_shifted = filter_where
    for i in range(len(extra_params), 0, -1):
        where_shifted = where_shifted.replace(f"${i}", f"${i + len(prov_cities)}")
    all_params = prov_cities + extra_params

    title_rows = await conn.fetch(f"""
        SELECT job_title, count(*)::int AS cnt,
               avg((salary_min + salary_max)/2.0) AS avg_sal
        FROM the_total_table
        WHERE city = ANY(ARRAY[{c_holders}])
          AND job_title IS NOT NULL AND job_title <> ''
          AND ({where_shifted})
        GROUP BY job_title
        ORDER BY cnt DESC
        LIMIT 20
    """, *all_params)
    top_jobs = []
    for i, r in enumerate(title_rows):
        _, caps = _infer_capabilities(r["job_title"])
        top_jobs.append({
            "id": i + 1,
            "name": r["job_title"],
            "count": r["cnt"],
            "hot": 0.0,  # 先占位，下面统一基于最大 count 计算
            "avgSalary": round(float(r["avg_sal"]), 0) if r["avg_sal"] else 0,
            "category": categorize_job(r["job_title"]),
            "skills": caps[:8],
        })
    # 基于 max(count) 统一计算 hot
    if top_jobs:
        max_cnt = top_jobs[0]["count"]
        for j in top_jobs:
            j["hot"] = round(j["count"] / max_cnt * 85 + 15, 1)

    # 2) 按日趋势（带过滤）
    trend_rows = await conn.fetch(f"""
        SELECT crawl_time::date AS d,
               count(*)::int AS cnt
        FROM the_total_table
        WHERE city = ANY(ARRAY[{c_holders}])
          AND crawl_time IS NOT NULL
          AND ({where_shifted})
        GROUP BY d
        ORDER BY d
    """, *all_params)
    # 补齐最近 7 天
    latest_row = await conn.fetchval(f"""
        SELECT max(crawl_time)::date FROM the_total_table
        WHERE city = ANY(ARRAY[{c_holders}]) AND crawl_time IS NOT NULL AND ({where_shifted})
    """, *all_params)
    end_date = latest_row if latest_row else date.today()
    trend_map = {r["d"]: r["cnt"] for r in trend_rows}
    raw = []
    for i in range(6, -1, -1):
        d = end_date - timedelta(days=i)
        c = trend_map.get(d, 0)
        raw.append((d, c))
    max_cnt = max((c for _, c in raw), default=1) or 1
    trend7d = []
    for d, c in raw:
        trend7d.append({
            "date": f"{d.month}/{d.day}",
            "jobCount": c,
            "hotIndex": round(c / max_cnt * 80 + 20, 1) if max_cnt else 20.0,
            "demand": round(c / max_cnt * 60 + 5, 1) if max_cnt else 5.0,
        })

    # 3) 统计
    province_total = sum(j["count"] for j in top_jobs)
    avg_salaries = [j["avgSalary"] for j in top_jobs if j["avgSalary"] > 0]
    avg_salary = sum(avg_salaries) / len(avg_salaries) if avg_salaries else 0

    return {
        "provinceId": province_id,
        "provinceName": prov_name,
        "totalJobs": province_total,
        "avgSalary": round(avg_salary, 0),
        "topJobs": top_jobs,
        "trend7d": trend7d,
        "hotIndex": top_jobs[0]["hot"] if top_jobs else 0,
        "demandTrend": 15.0,
    }


async def fetch_job_graph(conn: asyncpg.Connection, job_id: str) -> dict:
    """岗位知识图谱：根据 job_id（格式 job-N）找对应岗位，返回能力/技能/工具结构

    数据来源：
    - 技能/工具：从 job_title 关键词 + education/experience 推断
    - 路径：固定 5 阶段学习路径
    """
    # job_id 格式: job-N (N 是 top_jobs 序号，从 1 开始)
    # 也支持直接传 job_title
    title = job_id
    if job_id.startswith("job-"):
        try:
            idx = int(job_id.replace("job-", "")) - 1
            # 先查一次省份详情拿 top_jobs
            # 这里简化：直接从 job_id 取一个固定模板
            title = _idx_to_title(idx)
        except ValueError:
            title = job_id

    # 节点定义
    center_id = "job-center"
    nodes = [
        {"id": center_id, "label": title, "type": "job"},
    ]
    edges = []
    cap_id = f"cap-{center_id}"

    # 根据标题智能推断能力/技能
    caps, skills = _infer_capabilities(title)
    nodes.append({"id": cap_id, "label": "岗位能力", "type": "capability"})
    edges.append({"source": center_id, "target": cap_id, "relation": "需要"})

    for c_name in caps:
        c_nid = "cap-" + c_name
        nodes.append({"id": c_nid, "label": c_name, "type": "capability"})
        edges.append({"source": cap_id, "target": c_nid, "relation": "包含"})

    for s in skills:
        s_id = "sk-" + s
        nodes.append({"id": s_id, "label": s, "type": "skill"})
        # 接到第一个 cap 或中心
        edges.append({"source": cap_id, "target": s_id, "relation": "需要"})

    # 工具节点（固定 3 个）
    tools = ["Docker", "Git", "Linux"]
    for t in tools:
        t_id = "tool-" + t
        nodes.append({"id": t_id, "label": t, "type": "tool"})
        edges.append({"source": cap_id, "target": t_id, "relation": "使用"})

    # 学习路径
    paths = [
        ("path-1", "基础入门"),
        ("path-2", "核心技能"),
        ("path-3", "项目实战"),
        ("path-4", "进阶提升"),
        ("path-5", "高级应用"),
    ]
    for pid, plabel in paths:
        nodes.append({"id": pid, "label": plabel, "type": "path"})
    # 路径串联
    for i in range(len(paths) - 1):
        edges.append({"source": paths[i][0], "target": paths[i + 1][0], "relation": "下一步"})
    # 路径→能力
    edges.append({"source": paths[1][0], "target": cap_id, "relation": "通往"})
    edges.append({"source": paths[2][0], "target": nodes[2]["id"], "relation": "通往"})

    # 节点类型样式
    node_type_config = {
        "job": {"color": "#00d4ff", "size": 52, "label": "岗位"},
        "capability": {"color": "#8b5cf6", "size": 38, "label": "能力"},
        "skill": {"color": "#a855f7", "size": 28, "label": "技能"},
        "tool": {"color": "#3b82f6", "size": 24, "label": "工具"},
        "path": {"color": "#10dc84", "size": 22, "label": "学习路径"},
    }
    for n in nodes:
        cfg = node_type_config.get(n["type"], {})
        n.update(cfg)

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "nodeCount": len(nodes),
            "edgeCount": len(edges),
            "typeCount": 5,
            "centerNode": title,
        },
    }


async def fetch_cities_summary(
    conn: asyncpg.Connection,
    province_name: str,
    industry: Optional[str] = None,
    job: Optional[str] = None,
    education: Optional[str] = None,
    experience: Optional[str] = None,
) -> list:
    """某省下各城市岗位汇总"""
    cities_list = [c for c, p in CITY_TO_PROVINCE.items() if p == province_name]
    if not cities_list:
        return []

    filter_where, filter_params = _build_filter_where(
        industry=industry, job=job, education=education, experience=experience,
    )

    # 同时匹配 "南昌" 与 "南昌市" 两种存储格式（split_part 兼容 "南昌·区县"）
    match_names = []
    for c in cities_list:
        match_names.append(c)
        if not c.endswith("市"):
            match_names.append(c + "市")

    pholders = ",".join([f"${i+1}" for i in range(len(match_names))])
    # 偏移 filter_params 的占位符
    where_shifted = filter_where
    offset = len(match_names)
    for i in range(len(filter_params), 0, -1):
        where_shifted = where_shifted.replace(f"${i}", f"${i + offset}")

    all_params = match_names + filter_params

    sql = f"""
    SELECT city, count(*)::int AS job_count,
           avg((salary_min + salary_max) / 2.0)::int AS avg_salary,
           count(DISTINCT job_title)::int AS distinct_titles
    FROM the_total_table
    WHERE split_part(city, '·', 1) = ANY(ARRAY[{pholders}]) AND ({where_shifted})
    GROUP BY city
    ORDER BY job_count DESC
    """
    try:
        rows = await conn.fetch(sql, *all_params)
    except Exception:
        return []

    result = []
    for r in rows:
        city = r["city"]
        total = r["job_count"]
        avg_sal = r["avg_salary"] or 0
        result.append({
            "name": city,
            "province": province_name,
            "jobCount": total,
            "avgSalary": avg_sal,
            "distinctTitles": r.get("distinct_titles", 0),
        })
    seen = {r["name"] for r in result}
    for c in cities_list:
        if c not in seen:
            result.append({
                "name": c,
                "province": province_name,
                "jobCount": 0,
                "avgSalary": 0,
                "distinctTitles": 0,
            })
    result.sort(key=lambda x: x["jobCount"], reverse=True)
    return result


def _norm_city_for_query(city_name: str) -> str:
    """规范化城市名用于 SQL 查询：兼容 '南昌市'/'南昌'/'南昌·区县'/'南昌市·区县' 等存储格式"""
    if not city_name:
        return ""
    return city_name.strip().split("·")[0].rstrip("市")


def _stable_seed(text: str) -> int:
    """确定性随机种子（用于城市稳定排序，刷新不变）"""
    return int(hashlib.md5(text.encode("utf-8")).hexdigest(), 16) % (2 ** 32)


try:
    from backend.job_pool import JOB_TITLE_SET as _PANORAMA_JOB_SET
    from backend.job_pool import JOB_POOL as _JOB_POOL
    from backend.job_pool import city_job_demand_count as _city_job_demand_count
except Exception:  # pragma: no cover
    _PANORAMA_JOB_SET = set()
    _JOB_POOL = []

    def _city_job_demand_count(city_short: str, title: str, real_cnt: int = 0,
                               hot: float = 0.5, profile_weight: float = None,
                               is_panorama: bool = True) -> int:
        return max(20, real_cnt)


_PANORAMA_LOWER = {t.lower() for t in _PANORAMA_JOB_SET}


def _is_panorama_title(title: str) -> bool:
    """岗位是否属于"新一代信息技术全景"标准岗位池（大小写/空白不敏感）

    爬取数据中的岗位名可能与池中名称存在大小写差异（如 python开发工程师 /
    Python开发工程师），统一小写后匹配，避免真实热门岗位被误判为杂岗而降权。
    """
    return (title or "").lower() in _PANORAMA_LOWER


_PROFILE_WEIGHT_CACHE: Dict[str, dict] = {}


def _city_profile_weights(city_short: str) -> dict:
    """城市画像权重（岗位→权重，由城市产业方向 + citySeed 稳定生成），带缓存"""
    if city_short not in _PROFILE_WEIGHT_CACHE:
        try:
            from backend.city_profile import build_city_profile
            _PROFILE_WEIGHT_CACHE[city_short] = build_city_profile(city_short, 0, 0)["title_weights"]
        except Exception:
            _PROFILE_WEIGHT_CACHE[city_short] = {}
    return _PROFILE_WEIGHT_CACHE[city_short]


def _city_job_demand(city_short: str, title: str, real_cnt: int = 0) -> int:
    """城市岗位展示需求数量（≥20，真实优先，AI 按城市规模/热度/画像稳定补充）"""
    hot = 0.5
    for p in _JOB_POOL:
        if p["title"] == title:
            hot = p.get("hot", 0.5)
            break
    weights = _city_profile_weights(city_short)
    profile_weight = weights.get(title)
    if profile_weight is None:
        t_low = (title or "").lower()
        for k, v in weights.items():
            if k.lower() == t_low:
                profile_weight = v
                break
    return _city_job_demand_count(city_short, title, real_cnt=real_cnt, hot=hot,
                                  profile_weight=profile_weight,
                                  is_panorama=_is_panorama_title(title))


def _city_order_score(city_short: str, title: str, cnt: int, max_cnt: int) -> float:
    """城市岗位稳定排序权重 = 需求热度×0.45 + 城市稳定随机权重×0.55

    - 城市随机权重基于 city_short + job_title 的哈希，稳定不变 → 每次进入城市排序一致
    - 随机权重占比更高（0.55）→ 不同城市即使岗位相同、数量接近，排序也明显不同
    - 热门岗位（cnt 高）仍大概率靠前（0.45）
    - "新一代信息技术全景"岗位额外保留热度（真实数据中非全景岗位轻微降权，保证数字人才岗位优先展示）
    """
    rng = random.Random(_stable_seed(city_short + "|" + title))
    hot = cnt / max_cnt if max_cnt else 0.0
    if not _is_panorama_title(title):
        hot *= 0.7
    return -(hot * 0.45 + rng.random() * 0.55)


def _city_match_sql(param: str = "1") -> str:
    """构造兼容多种城市名存储格式的 WHERE 片段（参数为规范化短名，如 '南昌'/'朝阳'/'浦东'）。

    - 普通地级市以 `split_part(city, '·', 1)` 存储（如 `南昌` / `南昌市`）
    - 直辖市/自治州下辖区县以 `省·区县` 存储（如 `北京·朝阳区`、`上海·浦东新区`），
      通过第二段匹配区级短名（`朝阳` → `朝阳区`、`浦东` → `浦东新区`）
    """
    return (
        f"(split_part(city, '·', 1) = ${param} OR split_part(city, '·', 1) = ${param} || '市'"
        f" OR split_part(city, '·', 2) = ${param} OR split_part(city, '·', 2) = ${param} || '市'"
        f" OR split_part(city, '·', 2) = ${param} || '新区'"
        f" OR split_part(city, '·', 2) = ${param} || '区'"
        f" OR split_part(city, '·', 2) = ${param} || '县')"
    )


async def _ensure_city_min_jobs(conn: asyncpg.Connection, city_short: str, min_jobs: int = 20) -> int:
    """城市岗位不足时：AI 生成并【写入数据库】后返回新增条数（0 表示无需补充或失败）。

    延迟导入 seed_city_jobs，避免与其顶部 `from backend.services import ...` 形成循环导入。
    """
    if not city_short:
        return 0
    try:
        try:
            import seed_city_jobs  # 从 backend 目录启动 uvicorn 时
        except ImportError:
            from backend import seed_city_jobs  # 从项目根启动 uvicorn 时
        return await seed_city_jobs.ensure_city_min_jobs(conn, city_short, min_jobs)
    except Exception as exc:
        print(f"[WARN] 城市岗位自动补充失败 {city_short}: {exc}")
        return 0


async def fetch_city_detail(
    conn: asyncpg.Connection,
    province_name: str,
    city_name: str,
    industry: Optional[str] = None,
    job: Optional[str] = None,
    education: Optional[str] = None,
    experience: Optional[str] = None,
) -> Optional[dict]:
    """城市详情：岗位TOP列表 + 趋势 + 统计"""
    # 规范化城市名（"南昌市"→"南昌"），兼容数据库中的多种存储格式
    city_short = _norm_city_for_query(city_name)
    city_match = _city_match_sql("1")
    filter_where, filter_params = _build_filter_where(
        industry=industry, job=job, education=education, experience=experience,
    )
    if filter_where:
        where_shifted = filter_where
        city_params = [city_short]
        for i in range(len(filter_params), 0, -1):
            where_shifted = where_shifted.replace(f"${i}", f"${i + 1}")
        all_params = city_params + filter_params
        extra_where = f" AND ({where_shifted})"
    else:
        all_params = [city_short]
        extra_where = ""

    # TOP岗位 / 统计（封装为内部函数，供岗位不足自动补充后重新查询）
    async def _query_once():
        title_rows = await conn.fetch(f"""
            SELECT job_title, count(*)::int AS cnt,
                   avg((salary_min + salary_max)/2.0) AS avg_sal
            FROM the_total_table
            WHERE {city_match} AND job_title IS NOT NULL AND job_title <> ''{extra_where}
            GROUP BY job_title
        """, *all_params)
        # 展示需求数量：真实数据优先，不足时按城市规模/岗位热度/城市画像稳定补充（每个岗位类型 ≥ 20）
        demand_map = {r["job_title"]: _city_job_demand(city_short, r["job_title"], r["cnt"]) for r in title_rows}
        # 稳定排序：需求热度×0.45 + 城市稳定随机权重×0.55（不同城市排序不同，刷新不变）
        max_demand = max(demand_map.values(), default=0)
        title_rows.sort(key=lambda r: _city_order_score(city_short, r["job_title"], demand_map[r["job_title"]], max_demand))
        title_rows = title_rows[:20]
        # 每个岗位类型的常见学历/经验要求（真实数据聚合，供岗位卡片"基本信息"展示）
        ee_rows = await conn.fetch(f"""
            SELECT job_title,
                   COALESCE(NULLIF(TRIM(mode() WITHIN GROUP (ORDER BY COALESCE(NULLIF(TRIM(education), ''), '不限'))), ''), '不限') AS edu,
                   COALESCE(NULLIF(TRIM(mode() WITHIN GROUP (ORDER BY COALESCE(NULLIF(TRIM(experience), ''), '不限'))), ''), '不限') AS exp
            FROM the_total_table
            WHERE {city_match} AND job_title IS NOT NULL AND job_title <> ''{extra_where}
            GROUP BY job_title
        """, *all_params)
        ee_map = {r["job_title"]: (r["edu"], r["exp"]) for r in ee_rows}
        top_jobs = []
        for i, r in enumerate(title_rows):
            avg_s = float(r["avg_sal"]) if r["avg_sal"] else 0
            _, caps = _infer_capabilities(r["job_title"])
            ee = ee_map.get(r["job_title"], ("不限", "不限"))
            top_jobs.append({
                "id": i + 1, "name": r["job_title"], "count": demand_map[r["job_title"]],
                "avgSalary": round(avg_s, 0), "category": categorize_job(r["job_title"]),
                "skills": caps[:8],
                "education": ee[0] or "不限",
                "experience": ee[1] or "不限",
            })
        if top_jobs:
            max_cnt = top_jobs[0]["count"]
            for j in top_jobs:
                j["hot"] = round(j["count"] / max_cnt * 85 + 15, 1)

        # 岗位总数 = 该城市数据库真实记录总数（不因 TOP20 截断而低估）
        total_jobs = await conn.fetchval(
            f"SELECT count(*) FROM the_total_table WHERE {city_match}",
            city_short,
        ) or 0
        avg_salaries = [j["avgSalary"] for j in top_jobs if j["avgSalary"] > 0]
        avg_salary = sum(avg_salaries) / len(avg_salaries) if avg_salaries else 0

        # 学历分布
        edu_rows = await conn.fetch(f"""
            SELECT education, count(*)::int AS cnt FROM the_total_table
            WHERE {city_match} AND education IS NOT NULL AND education != ''
            GROUP BY education ORDER BY cnt DESC LIMIT 10
        """, city_short)
        education_dist = [{"name": r["education"], "count": r["cnt"]} for r in edu_rows]

        # 经验分布
        exp_rows = await conn.fetch(f"""
            SELECT experience, count(*)::int AS cnt FROM the_total_table
            WHERE {city_match} AND experience IS NOT NULL AND experience != ''
            GROUP BY experience ORDER BY cnt DESC LIMIT 10
        """, city_short)
        experience_dist = [{"name": r["experience"], "count": r["cnt"]} for r in exp_rows]

        # 技能标签（从job_title关键词提取）
        skill_tags = set()
        for j in top_jobs:
            for cap in _infer_capabilities(j["name"])[1]:
                skill_tags.add(cap)
        skills = sorted(skill_tags)[:10]

        return {
            "provinceName": province_name, "cityName": city_name,
            "totalJobs": total_jobs, "avgSalary": round(avg_salary, 0),
            "topJobs": top_jobs, "educationDist": education_dist,
            "experienceDist": experience_dist, "skills": skills,
        }

    detail = await _query_once()

    # 岗位类型 <20 或记录总数 <20：按城市规模 AI 扩充并【写入数据库】，然后重新查询（真实进入数据层）
    if len(detail["topJobs"]) < 20 or detail["totalJobs"] < 20:
        added = await _ensure_city_min_jobs(conn, city_short, 20)
        if added > 0:
            detail = await _query_once()

    return detail


def _idx_to_title(idx: int) -> str:
    """把 1-based 序号映射回常见岗位名"""
    titles = [
        "软件工程师", "前端开发工程师", "Java开发工程师", "算法工程师", "数据分析师",
        "AI算法工程师", "全栈开发工程师", "Python开发工程师", "嵌入式软件工程师", "后端开发工程师",
    ]
    return titles[idx] if 0 <= idx < len(titles) else "软件工程师"


def _infer_capabilities(title: str) -> tuple[list[str], list[str]]:
    """根据岗位标题推断能力维度 + 技能"""
    title_l = title.lower()
    if "前端" in title or "vue" in title_l or "react" in title_l:
        return (["前端基础", "框架开发", "工程化", "性能优化"], ["HTML/CSS", "JavaScript", "Vue", "TypeScript", "Webpack", "Vite"])
    if "java" in title_l:
        return (["Java核心", "框架开发", "数据库", "微服务"], ["Java", "Spring Boot", "MySQL", "Redis", "Kafka", "JVM"])
    if "python" in title_l or "数据" in title:
        return (["统计分析", "数据可视化", "业务建模"], ["Python", "Pandas", "SQL", "Spark", "BI"])
    if "ai" in title_l or "算法" in title or "llm" in title_l or "大模型" in title:
        return (["机器学习", "深度学习", "模型部署"], ["Python", "PyTorch", "TensorFlow", "Transformer", "LLM"])
    if "全栈" in title:
        return (["前端开发", "后端开发", "数据库", "部署"], ["Vue", "Node.js", "MySQL", "Docker"])
    if "嵌入式" in title:
        return (["C语言", "嵌入式系统", "硬件接口", "RTOS"], ["C", "C++", "STM32", "Linux", "驱动"])
    if "测试" in title:
        return (["功能测试", "自动化测试", "性能测试", "缺陷管理"], ["Selenium", "JMeter", "Python", "Postman", "Jira"])
    if "运维" in title or "devops" in title_l:
        return (["系统运维", "容器化", "CI/CD", "监控"], ["Linux", "Docker", "Kubernetes", "Jenkins", "Prometheus"])
    if "硬件" in title:
        return (["电路设计", "PCB", "嵌入式硬件", "信号完整性"], ["Altium", "Cadence", "Verilog", "示波器"])
    if "产品" in title:
        return (["产品规划", "用户研究", "数据分析"], ["Axure", "PRD", "SQL", "用户访谈"])
    if "质量" in title or "qa" in title_l:
        return (["质量体系", "过程审计", "供应商管理"], ["ISO 9001", "FMEA", "SPC", "8D报告"])
    # 默认通用
    return (["专业技能", "沟通协作", "问题解决"], ["办公软件", "专业知识", "团队协作", "项目管理"])


# ============== 筛选选项 ==============

async def fetch_filter_options(conn: asyncpg.Connection) -> Dict[str, Any]:
    """获取筛选下拉框全部可选项（不依赖当前筛选条件）"""
    # 地区：来自 PROVINCE_CODE 映射表
    regions = list(PROVINCE_CODE.keys())

    # 行业方向：从 industry_tags 字段提取
    ind_rows = await conn.fetch(
        "SELECT DISTINCT industry_tags FROM the_total_table "
        "WHERE industry_tags IS NOT NULL AND industry_tags != ''"
    )
    industries_set: set = set()
    for r in ind_rows:
        for tag in (r['industry_tags'] or '').split(','):
            tag = tag.strip()
            if tag:
                industries_set.add(tag)
    industries = sorted(industries_set) if industries_set else ['互联网', '人工智能', '金融', '制造', '医疗', '教育']

    # 岗位方向：distinct job titles（取 top200）
    jobs_rows = await conn.fetch(
        "SELECT DISTINCT job_title FROM the_total_table "
        "WHERE job_title IS NOT NULL AND job_title != '' "
        "ORDER BY job_title LIMIT 200"
    )
    jobs = [r['job_title'] for r in jobs_rows]

    return {"regions": regions, "industries": industries, "jobs": jobs}


# ============== 数据上传/更新管理 ==============

# 内存中临时存储上传预览数据（key = session_id）
_upload_sessions: Dict[str, List[Dict[str, Any]]] = {}


def store_upload_session(session_id: str, records: List[Dict[str, Any]]) -> None:
    """暂存上传解析后的数据"""
    _upload_sessions[session_id] = records
    # 清理旧的 session（保留最近 10 个）
    if len(_upload_sessions) > 10:
        oldest = list(_upload_sessions.keys())[0]
        del _upload_sessions[oldest]


def get_upload_session(session_id: str) -> Optional[List[Dict[str, Any]]]:
    """获取暂存的上传数据"""
    return _upload_sessions.get(session_id)


def clear_upload_session(session_id: str) -> None:
    """清理上传暂存"""
    _upload_sessions.pop(session_id, None)


async def preview_upload(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    将上传数据与现有数据库对比，返回预览统计
    """
    from db import get_existing_keys, get_data_stats

    # 获取现有数据
    existing_keys = await get_existing_keys()
    existing_set = set()
    for r in existing_keys:
        key = (r['province'], r['city'], r['job'])
        existing_set.add(key)

    # 对比统计
    upload_set = set()
    for r in records:
        key = (r.get('province', ''), r.get('city', ''), r.get('job', ''))
        upload_set.add(key)

    new_keys = upload_set - existing_set
    modify_keys = upload_set & existing_set
    # 删除数：数据库中有但上传文件中没有的（此处暂不作处理，显示为 0）
    delete_count = 0

    new_records = []
    modify_records = []
    for r in records:
        key = (r.get('province', ''), r.get('city', ''), r.get('job', ''))
        if key in new_keys:
            new_records.append(r)
        elif key in modify_keys:
            modify_records.append(r)

    # 统计新技能、新分类、新省份
    existing_stats = await get_data_stats()
    existing_provinces_set = set()
    for r in existing_keys:
        existing_provinces_set.add(r['province'])

    new_provinces = set()
    new_skills = set()
    for r in records:
        p = r.get('province', '')
        if p and p not in existing_provinces_set:
            new_provinces.add(p)
        skills_str = r.get('skills', '')
        if skills_str:
            for s in skills_str.split(','):
                s = s.strip()
                if s:
                    new_skills.add(s)

    return {
        'new_records': len(new_records),
        'modify_records': len(modify_records),
        'delete_records': delete_count,
        'new_provinces': len(new_provinces),
        'new_skills': len(new_skills),
        'total_rows': len(records),
        'new_records_list': new_records,
        'modify_records_list': modify_records,
    }


async def apply_update(session_id: str, updater: str = 'admin') -> Dict[str, Any]:
    """
    确认并执行数据更新
    """
    from db import upsert_data_batch, get_data_stats, get_current_version, record_version

    records = get_upload_session(session_id)
    if not records:
        raise ValueError("上传会话已过期，请重新上传文件")

    preview = await preview_upload(records)
    new_count = preview['new_records']
    modify_count = preview['modify_records']

    # 执行 UPSERT（所有记录）
    total_upserted = await upsert_data_batch(records)

    # 记录版本
    current_ver = await get_current_version()
    old_ver = current_ver.get('version', 'v1.0')
    # 生成新版本号: v1.0 → v1.1, v2.3 → v2.4 etc
    parts = old_ver.lstrip('v').split('.')
    if len(parts) == 2:
        new_ver = f"v{parts[0]}.{int(parts[1]) + 1}"
    else:
        new_ver = f"v{old_ver}-1"

    stats = await get_data_stats()
    await record_version(
        version=new_ver,
        updater=updater,
        new_count=new_count,
        modify_count=modify_count,
        delete_count=0,
        total_count=stats['total_jobs'],
        note=f"手动上传更新，共 {len(records)} 条记录"
    )

    # 清理临时数据
    clear_upload_session(session_id)

    return {
        'success': True,
        'version': new_ver,
        'upserted': total_upserted,
        'new_count': new_count,
        'modify_count': modify_count,
        'stats': stats,
    }


# ============== 技术知识库（用于脑图技术详情） ==============

TECH_KNOWLEDGE_BASE: Dict[str, Dict[str, Any]] = {
    "Java": {
        "intro": "Java 是一种广泛应用于企业级开发的高级编程语言，以“一次编写，到处运行”的跨平台特性著称。拥有丰富的生态系统和成熟的框架体系。",
        "uses": ["后端服务开发", "企业级应用", "大数据处理", "Android 开发", "微服务架构"],
        "scenarios": "后端开发中，Java 是构建复杂业务逻辑和微服务架构的首选语言，常用于高并发、高可用的大型系统。",
        "knowledgePoints": ["Java 基础语法", "面向对象编程", "集合框架", "多线程与并发", "JVM 原理与调优", "IO/NIO", "异常处理", "泛型与注解"],
        "learningPath": ["Java SE 基础", "面向对象设计", "多线程并发", "JVM 调优", "Spring 框架"],
        "relatedTech": ["Spring Boot", "MySQL", "Redis", "Kafka", "Docker", "Maven"]
    },
    "Spring Boot": {
        "intro": "Spring Boot 是 Spring 生态的核心框架，通过自动配置和起步依赖大幅简化了 Spring 应用的搭建和开发过程。",
        "uses": ["微服务开发", "REST API 构建", "企业级应用", "数据访问层开发", "定时任务"],
        "scenarios": "Spring Boot 是 Java 后端开发的标准框架，几乎所有 Java 后端岗位都会要求掌握，用于快速构建生产级应用。",
        "knowledgePoints": ["自动配置原理", "起步依赖管理", "RESTful API", "数据校验", "异常处理", "拦截器/过滤器", "定时任务", "AOP 编程"],
        "learningPath": ["Spring 基础", "Spring Boot 入门", "RESTful API", "数据访问", "微服务实践"],
        "relatedTech": ["Java", "MySQL", "Redis", "Spring Cloud", "Docker", "Maven"]
    },
    "MySQL": {
        "intro": "MySQL 是最流行的关系型数据库之一，以高性能、易部署和开源免费的特点被广泛应用于各类项目。",
        "uses": ["数据持久化存储", "事务管理", "复杂查询", "数据报表", "读写分离"],
        "scenarios": "后端开发中，MySQL 是数据存储的标配方案，几乎所有业务系统都需要与 MySQL 交互进行数据管理。",
        "knowledgePoints": ["SQL 语法", "索引优化", "事务与锁", "存储引擎", "SQL 调优", "主从复制", "分库分表", "备份恢复"],
        "learningPath": ["SQL 基础", "表设计与索引", "事务与锁", "SQL 调优", "高可用架构"],
        "relatedTech": ["Redis", "Spring Boot", "Java", "MyBatis", "JDBC", "Elasticsearch"]
    },
    "Redis": {
        "intro": "Redis 是基于内存的高性能键值数据库，支持丰富的数据类型，常用于缓存、分布式锁、消息队列等场景。",
        "uses": ["缓存加速", "分布式锁", "Session 存储", "消息队列", "排行榜", "计数器"],
        "scenarios": "Java 后端开发中通常使用 Redis 缓解数据库访问压力，实现热点数据缓存、分布式锁和消息队列等功能。",
        "knowledgePoints": ["五种基本类型", "持久化 RDB/AOF", "缓存淘汰策略", "主从复制", "哨兵模式", "集群方案", "分布式锁", "Pipeline"],
        "learningPath": ["数据类型与命令", "缓存设计", "持久化方案", "集群部署", "分布式锁实践"],
        "relatedTech": ["MySQL", "Spring Boot", "Java", "Kafka", "Docker", "Nginx"]
    },
    "Docker": {
        "intro": "Docker 是容器化技术的事实标准，通过容器封装实现应用的环境隔离、快速部署和版本管理。",
        "uses": ["应用容器化部署", "开发环境统一", "微服务编排", "CI/CD 流水线", "应用隔离"],
        "scenarios": "DevOps 和微服务架构中，Docker 是必备技能，用于标准化部署流程、简化环境配置和提高交付效率。",
        "knowledgePoints": ["镜像构建", "Dockerfile 编写", "容器生命周期", "网络通信", "数据卷", "Docker Compose", "镜像仓库", "资源限制"],
        "learningPath": ["容器基础概念", "Docker 安装使用", "Dockerfile 实践", "Docker Compose", "CI/CD 集成"],
        "relatedTech": ["Kubernetes", "Jenkins", "Nginx", "Linux", "Git"]
    },
    "Vue": {
        "intro": "Vue.js 是渐进式 JavaScript 前端框架，以简洁的 API、响应式数据绑定和组件化开发模式深受开发者喜爱。",
        "uses": ["SPA 单页应用", "组件化开发", "后台管理系统", "移动端 H5", "数据大屏"],
        "scenarios": "前端开发中，Vue 是热门的框架选择，用于构建交互丰富、数据驱动的 Web 应用界面。",
        "knowledgePoints": ["Vue 生命周期", "响应式原理", "组件通信", "Vue Router", "Vuex/Pinia", "Vite 构建", "TS 支持", "SSR"],
        "learningPath": ["Vue 基础语法", "组件化开发", "路由与状态", "工程化构建", "SSR 进阶"],
        "relatedTech": ["JavaScript", "TypeScript", "HTML/CSS", "Webpack", "Node.js", "React"]
    },
    "React": {
        "intro": "React 是 Meta 推出的 JavaScript UI 框架，以虚拟 DOM、函数式组件和强大的生态体系成为前端开发主流选择。",
        "uses": ["Web 应用开发", "移动端 App (RN)", "数据仪表盘", "电商平台", "社交应用"],
        "scenarios": "React 在前端开发中与 Vue 并列为两大主流框架，中大型项目和高性能场景下使用广泛。",
        "knowledgePoints": ["JSX 语法", "Hooks", "虚拟 DOM", "状态管理", "React Router", "性能优化", "SSR", "测试"],
        "learningPath": ["React 基础 + JSX", "Hooks 深入", "路由与状态", "性能优化", "Next.js"],
        "relatedTech": ["JavaScript", "TypeScript", "Redux", "Webpack", "Node.js", "Vue"]
    },
    "JavaScript": {
        "intro": "JavaScript 是 Web 开发的核心语言，运行在浏览器和服务器端（Node.js），是前端开发必不可少的基础技能。",
        "uses": ["网页交互逻辑", "异步请求", "DOM 操作", "Node.js 后端", "小程序开发"],
        "scenarios": "前端开发的基础语言，所有前端框架（Vue/React）和 Web 交互都建立在对 JavaScript 的深入理解之上。",
        "knowledgePoints": ["ES6+ 语法", "闭包与作用域", "异步编程", "原型链", "事件循环", "模块化", "Promise", "Web API"],
        "learningPath": ["JS 基础语法", "ES6+ 特性", "异步编程", "模块化", "框架学习"],
        "relatedTech": ["TypeScript", "Vue", "React", "Node.js", "HTML/CSS", "Webpack"]
    },
    "Python": {
        "intro": "Python 是简洁高效的通用编程语言，在数据分析、AI 开发和自动化运维等领域应用广泛。",
        "uses": ["数据分析", "机器学习", "Web 开发", "自动化脚本", "爬虫开发", "科学计算"],
        "scenarios": "数据分析师和 AI 工程师的核心编程语言，也用于自动化运维和快速原型开发。",
        "knowledgePoints": ["基础语法", "常用库 (os/sys/re)", "面向对象", "虚拟环境", "pip 管理", "装饰器", "生成器", "异步编程"],
        "learningPath": ["Python 基础", "常用标准库", "第三方库入门", "项目实战", "领域深入"],
        "relatedTech": ["Pandas", "PyTorch", "TensorFlow", "SQL", "Django", "NumPy"]
    },
    "PyTorch": {
        "intro": "PyTorch 是 Meta 开发的开源深度学习框架，以动态计算图和 Pythonic 风格成为 AI 研究和开发的首选框架。",
        "uses": ["深度学习训练", "模型推理", "计算机视觉", "NLP 自然语言处理", "强化学习"],
        "scenarios": "AI 算法岗的核心技能，几乎所有深度学习模型的训练和部署都涉及 PyTorch。",
        "knowledgePoints": ["Tensor 操作", "自动求导", "神经网络构建", "损失函数", "优化器", "GPU 训练", "模型导出", "DataLoader"],
        "learningPath": ["PyTorch 基础", "神经网络入门", "CV/NLP 方向", "模型优化", "部署实践"],
        "relatedTech": ["Python", "TensorFlow", "CUDA", "NumPy", "Pandas", "Transformer"]
    },
    "TensorFlow": {
        "intro": "TensorFlow 是 Google 推出的端到端机器学习平台，支持从研究到生产的完整 ML 工作流。",
        "uses": ["深度学习训练", "模型部署", "移动端推理", "企业级 ML", "AutoML"],
        "scenarios": "AI/ML 工程师的重要框架，在工业界模型部署和移动端推理场景中应用广泛。",
        "knowledgePoints": ["计算图", "Keras API", "Estimator", "TF Serving", "TF Lite", "分布式训练", "TFX 流水线"],
        "learningPath": ["TensorFlow 基础", "Keras 快速开发", "模型训练", "部署 (Serving)", "进阶优化"],
        "relatedTech": ["Python", "PyTorch", "CUDA", "NumPy", "Docker", "Keras"]
    },
    "Pandas": {
        "intro": "Pandas 是 Python 最核心的数据分析库，提供强大的数据结构和数据处理能力，是数据科学的基础工具。",
        "uses": ["数据清洗", "数据转换", "统计分析", "数据可视化", "文件读写"],
        "scenarios": "数据分析师每日工作中使用 Pandas 处理 CSV/Excel/SQL 数据，进行清洗、聚合和初步分析。",
        "knowledgePoints": ["DataFrame/Series", "数据读取", "数据筛选", "分组聚合", "透视表", "合并连接", "时间序列", "缺失值处理"],
        "learningPath": ["Pandas 基础操作", "数据清洗", "分组聚合", "时间序列", "大数据处理优化"],
        "relatedTech": ["Python", "NumPy", "Matplotlib", "SQL", "Jupyter", "Scikit-learn"]
    },
    "NumPy": {
        "intro": "NumPy 是 Python 科学计算的基础库，提供高效的多维数组运算和数学函数，是数据分析和 ML 算法的底层支撑。",
        "uses": ["数组运算", "线性代数", "傅里叶变换", "随机数生成", "图像处理"],
        "scenarios": "NumPy 是数据分析、AI 算法的基础依赖，几乎所有数值计算场景都离不开 NumPy 数组。",
        "knowledgePoints": ["ndarray 创建", "数组切片", "广播机制", "通用函数", "线性代数", "随机抽样", "文件 I/O"],
        "learningPath": ["ndarray 基础", "数组运算", "线性代数", "高级索引", "与 Pandas 结合"],
        "relatedTech": ["Python", "Pandas", "PyTorch", "Matplotlib", "Scikit-learn"]
    },
    "Git": {
        "intro": "Git 是业界标准的分布式版本控制系统，用于代码的版本管理、团队协作和持续集成。",
        "uses": ["代码版本管理", "分支协同开发", "代码审查", "发布回滚", "CI/CD 集成"],
        "scenarios": "无论前后端开发，Git 都是每日必备工具，用于代码提交、分支管理和团队协作。",
        "knowledgePoints": ["工作区/暂存区/仓库", "分支管理", "合并冲突解决", "rebase", "reset/revert", "tag 标签", "submodule", "Git Flow"],
        "learningPath": ["Git 基础命令", "分支与合并", "团队协作流程", "高级操作", "CI/CD 集成"],
        "relatedTech": ["GitHub/GitLab", "Jenkins", "Docker", "CI/CD"]
    },
    "Linux": {
        "intro": "Linux 是服务器端操作系统的事实标准，大多数后端应用和云服务都运行在 Linux 环境下。",
        "uses": ["服务器管理", "应用部署", "Shell 脚本", "服务配置", "性能监控"],
        "scenarios": "后端开发和运维岗位的日常工作中，需要在 Linux 服务器上进行应用部署、日志排查和性能调优。",
        "knowledgePoints": ["常用命令", "文件权限", "进程管理", "Shell 脚本", "网络配置", "systemd", "日志管理", "用户管理"],
        "learningPath": ["Linux 基础命令", "Shell 脚本", "服务管理", "网络与安全", "性能调优"],
        "relatedTech": ["Docker", "Nginx", "MySQL", "Kubernetes", "Git", "Shell"]
    },
    "Kubernetes": {
        "intro": "Kubernetes (K8s) 是容器编排领域的标准平台，用于自动化容器的部署、扩展和管理。",
        "uses": ["容器编排管理", "服务自动扩缩", "滚动更新", "服务发现", "存储编排"],
        "scenarios": "DevOps 和云原生架构中，Kubernetes 是实现大规模微服务管理和容器编排的核心技术。",
        "knowledgePoints": ["Pod/Deployment", "Service", "Ingress", "ConfigMap", "PVC", "Helm", "监控", "故障排查"],
        "learningPath": ["容器基础", "K8s 核心概念", "部署与管理", "Helm 包管理", "生产化运维"],
        "relatedTech": ["Docker", "Linux", "Jenkins", "Prometheus", "Nginx", "Istio"]
    },
    "TypeScript": {
        "intro": "TypeScript 是 JavaScript 的类型超集，提供静态类型检查和面向对象编程能力，提升大型前端项目的可维护性。",
        "uses": ["大型前端项目", "类型安全开发", "代码重构", "IDE 智能提示", "企业级应用"],
        "scenarios": "现代前端开发中 TypeScript 逐渐成为标配，特别是大型项目和团队协作中几乎不可或缺。",
        "knowledgePoints": ["基础类型", "接口与泛型", "枚举", "类型推断", "模块化", "装饰器", "工具类型"],
        "learningPath": ["TS 基础类型", "接口与泛型", "高级类型", "与框架集成", "企业实践"],
        "relatedTech": ["JavaScript", "Vue", "React", "Node.js", "Webpack"]
    },
    "HTML/CSS": {
        "intro": "HTML 和 CSS 是 Web 开发的基石，分别负责页面结构和样式表现，是前端开发最基础的技能。",
        "uses": ["页面结构搭建", "响应式布局", "动画效果", "组件样式", "跨端适配"],
        "scenarios": "所有前端开发岗位的基础要求，页面布局、样式设计、响应式适配都依赖 HTML/CSS 能力。",
        "knowledgePoints": ["HTML5 语义化", "CSS 选择器", "Flexbox/Grid", "响应式设计", "CSS 动画", "预处理器", "BFC", "层叠上下文"],
        "learningPath": ["HTML 基础", "CSS 布局", "响应式设计", "CSS 动画", "工程化 (Sass)"],
        "relatedTech": ["JavaScript", "Vue", "React", "TypeScript", "Webpack"]
    },
    "Node.js": {
        "intro": "Node.js 是基于 Chrome V8 引擎的 JavaScript 运行时，让 JavaScript 能够运行在服务器端。",
        "uses": ["API 服务开发", "全栈开发", "构建工具", "CLI 工具", "中间层 BFF"],
        "scenarios": "全栈开发和构建工具链中，Node.js 让前端开发者也能用 JavaScript 完成服务端开发。",
        "knowledgePoints": ["事件循环", "模块系统", "Express/Koa", "异步编程", "Stream", "进程管理", "包管理"],
        "learningPath": ["Node 基础", "Express/Koa", "数据库连接", "REST API", "部署上线"],
        "relatedTech": ["JavaScript", "Express", "MySQL", "Docker", "NPM"]
    },
    "Kafka": {
        "intro": "Kafka 是分布式消息队列系统，以高吞吐量、低延迟和持久化特性广泛应用于大数据和微服务场景。",
        "uses": ["消息解耦", "日志收集", "流处理", "事件驱动", "数据管道"],
        "scenarios": "微服务架构和大数据场景中，Kafka 用于实现系统间异步解耦和实时数据流处理。",
        "knowledgePoints": ["生产者/消费者", "分区机制", "消费组", "offset 管理", "流处理", "集群", "性能调优"],
        "learningPath": ["消息队列基础", "Kafka 核心概念", "生产消费实战", "集群部署", "流处理"],
        "relatedTech": ["Java", "Spring Boot", "Redis", "ZooKeeper", "Docker"]
    },
    "Spring Cloud": {
        "intro": "Spring Cloud 是基于 Spring Boot 的微服务解决方案，提供服务发现、配置管理、熔断降级等微服务治理能力。",
        "uses": ["服务注册发现", "配置中心", "负载均衡", "断路保护", "API 网关"],
        "scenarios": "企业级微服务架构中，Spring Cloud 是 Java 技术栈的首选方案，用于构建分布式系统。",
        "knowledgePoints": ["Nacos/Eureka", "Gateway", "Feign", "Sentinel", "Config", "Bus", "Sleuth"],
        "learningPath": ["微服务基础概念", "Spring Cloud 组件", "服务治理", "生产实践", "容器化部署"],
        "relatedTech": ["Spring Boot", "Java", "Docker", "Kubernetes", "MySQL", "Redis"]
    },
    "Nginx": {
        "intro": "Nginx 是高性能的 HTTP/反向代理服务器，以低资源占用和高并发能力成为 Web 服务部署的标配。",
        "uses": ["反向代理", "负载均衡", "静态资源服务", "HTTPS 配置", "WebSocket 代理"],
        "scenarios": "部署架构中，Nginx 作为入口网关处理请求转发、负载均衡和静态资源加速。",
        "knowledgePoints": ["反向代理配置", "负载均衡策略", "HTTPS 证书", "动静分离", "缓存", "限流", "日志"],
        "learningPath": ["Nginx 安装配置", "反向代理", "负载均衡", "HTTPS", "高级调优"],
        "relatedTech": ["Linux", "Docker", "Jenkins", "Kubernetes", "Web 服务器"]
    },
    "Jenkins": {
        "intro": "Jenkins 是主流的开源 CI/CD 工具，用于自动化构建、测试和部署工作流。",
        "uses": ["自动化构建", "自动测试", "自动部署", "定时任务", "代码审查集成"],
        "scenarios": "DevOps 实践中，Jenkins 是实现持续集成和持续交付的核心工具，提高软件交付效率。",
        "knowledgePoints": ["Pipeline", "插件管理", "触发策略", "凭据管理", "Blue Ocean", "脚本式/声明式"],
        "learningPath": ["Jenkins 安装", "Freestyle 任务", "Pipeline 编写", "多分支", "完整 CI/CD"],
        "relatedTech": ["Docker", "Git", "Linux", "Kubernetes", "GitLab"]
    },
    "MyBatis": {
        "intro": "MyBatis 是 Java 生态主流的持久层框架，通过 XML 或注解实现 SQL 与 Java 对象的灵活映射。",
        "uses": ["数据库访问", "SQL 映射", "动态 SQL", "ORM 操作", "分页查询"],
        "scenarios": "Java 后端开发中，MyBatis 是使用最广泛的 ORM 框架，用于简化数据库操作。",
        "knowledgePoints": ["映射配置", "动态 SQL", "缓存机制", "插件开发", "分页 (PageHelper)", "结果映射"],
        "learningPath": ["MyBatis 基本配置", "SQL 映射", "动态 SQL", "缓存调优", "源码理解"],
        "relatedTech": ["Java", "Spring Boot", "MySQL", "Redis", "JDBC"]
    },
    "Elasticsearch": {
        "intro": "Elasticsearch 是基于 Lucene 的分布式搜索和分析引擎，提供全文检索和实时数据分析能力。",
        "uses": ["全文搜索", "日志分析", "数据可视化", "推荐引擎", "时序数据"],
        "scenarios": "电商搜索、日志系统和数据看板中，Elasticsearch 提供毫秒级的数据检索能力。",
        "knowledgePoints": ["倒排索引", "分词器", "聚合分析", "集群管理", "性能调优", "ELK 技术栈"],
        "learningPath": ["ES 基础概念", "CRUD 操作", "搜索与聚合", "集群管理", "ELK 实践"],
        "relatedTech": ["Logstash", "Kibana", "MySQL", "Kafka", "Docker"]
    },
    "Scikit-learn": {
        "intro": "Scikit-learn 是 Python 最流行的机器学习库，提供分类、回归、聚类等经典算法和模型评估工具。",
        "uses": ["分类预测", "回归分析", "聚类", "降维", "模型选择", "特征工程"],
        "scenarios": "数据分析和机器学习入门阶段，Scikit-learn 是掌握 ML 基础算法和建模流程的首选工具。",
        "knowledgePoints": ["监督学习", "无监督学习", "交叉验证", "特征工程", "Pipeline", "超参数调优"],
        "learningPath": ["基础算法理解", "Scikit-learn 实践", "模型评估", "特征工程", "项目实战"],
        "relatedTech": ["Python", "Pandas", "NumPy", "Matplotlib", "Jupyter"]
    },
    "SQL": {
        "intro": "SQL 是关系数据库的标准查询语言，用于数据的增删改查和复杂统计分析。",
        "uses": ["数据查询", "报表统计", "数据清洗", "ETL 处理", "数据库管理"],
        "scenarios": "数据分析师的核心技能，几乎所有的数据提取、加工和分析都依赖 SQL 来完成。",
        "knowledgePoints": ["SELECT 查询", "JOIN 连接", "子查询", "窗口函数", "索引使用", "事务", "存储过程"],
        "learningPath": ["SQL 基础语法", "聚合与分组", "窗口函数", "索引优化", "复杂报表"],
        "relatedTech": ["MySQL", "Pandas", "Python", "PostgreSQL", "数据仓库"]
    },
    "Webpack": {
        "intro": "Webpack 是前端模块打包工具，将各种资源（JS/CSS/图片）打包成浏览器可用的静态文件。",
        "uses": ["模块打包", "资源优化", "代码分割", "HMR 热更新", "构建优化"],
        "scenarios": "前端工程化的核心工具，几乎所有前端项目都依赖 Webpack/Vite 进行构建和开发服务。",
        "knowledgePoints": ["Entry/Output", "Loaders", "Plugins", "代码分割", "Tree Shaking", "Dev Server", "性能优化"],
        "learningPath": ["Webpack 核心概念", "Loaders & Plugins", "性能优化", "配置实战", "源码分析"],
        "relatedTech": ["Vite", "JavaScript", "TypeScript", "Vue", "React", "Babel"]
    },
    "C++": {
        "intro": "C++ 是高性能通用编程语言，广泛用于系统软件、游戏引擎、嵌入式和高频交易等场景。",
        "uses": ["系统开发", "游戏引擎", "嵌入式系统", "高频交易", "AI 推理"],
        "scenarios": "嵌入式开发、游戏开发和性能敏感型系统中，C++ 是核心编程语言。",
        "knowledgePoints": ["指针与内存", "STL 标准库", "面向对象", "模板与泛型", "多线程", "智能指针", "C++11/17/20"],
        "learningPath": ["C++ 基础", "OOP 编程", "STL 深入", "内存管理", "并发编程"],
        "relatedTech": ["C", "Linux", "算法", "数据结构", "嵌入式"]
    },
}


# ============== 岗位→技术 映射表（用于脑图分类） ==============

JOB_TECH_MAPPING: Dict[str, list] = {
    "java": ["Java", "Spring Boot", "MySQL", "Redis", "Spring Cloud", "MyBatis", "Kafka", "Docker", "Git", "Linux", "JVM", "Maven"],
    "python": ["Python", "Pandas", "NumPy", "SQL", "Django", "Flask", "Git", "Docker", "Linux"],
    "前端": ["HTML/CSS", "JavaScript", "Vue", "React", "TypeScript", "Webpack", "Git", "Node.js", "Nginx"],
    "vue": ["HTML/CSS", "JavaScript", "Vue", "TypeScript", "Webpack", "Vite", "Git", "Node.js"],
    "react": ["HTML/CSS", "JavaScript", "React", "TypeScript", "Redux", "Webpack", "Git", "Node.js"],
    "android": ["Java", "Kotlin", "Android SDK", "Git", "SQLite", "Retrofit", "Glide"],
    "ios": ["Swift", "Objective-C", "UIKit", "SwiftUI", "Core Data", "Git", "Xcode"],
    "ai": ["Python", "PyTorch", "TensorFlow", "Scikit-learn", "NumPy", "Pandas", "SQL", "CUDA"],
    "算法": ["Python", "PyTorch", "TensorFlow", "Scikit-learn", "NumPy", "Pandas", "深度学习", "机器学习"],
    "数据": ["Python", "Pandas", "NumPy", "SQL", "Matplotlib", "Scikit-learn", "Jupyter", "Spark"],
    "测试": ["Python", "Selenium", "JMeter", "Postman", "Jenkins", "Linux", "Git", "Jira"],
    "运维": ["Linux", "Docker", "Kubernetes", "Jenkins", "Nginx", "Prometheus", "Ansible", "Shell"],
    "嵌入式": ["C", "C++", "STM32", "Linux", "RTOS", "Altium", "Keil", "SPI/I2C"],
    "全栈": ["HTML/CSS", "JavaScript", "Vue", "Node.js", "MySQL", "Redis", "Docker", "Git"],
    "go": ["Go", "Docker", "Kubernetes", "MySQL", "Redis", "gRPC", "Linux", "Git"],
    "c++": ["C++", "STL", "Linux", "算法", "数据结构", "Git", "多线程"],
    "c#": ["C#", ".NET", "ASP.NET", "SQL Server", "Git", "Docker"],
    "php": ["PHP", "Laravel", "MySQL", "Redis", "Nginx", "Git", "Docker"],
    "node": ["JavaScript", "Node.js", "Express", "MySQL", "Redis", "Docker", "Git"],
    "产品": ["Axure", "PRD", "SQL", "数据分析", "用户研究", "项目管理"],
    "质量": ["ISO 9001", "FMEA", "SPC", "8D报告", "质量管理", "过程审计"],
    "硬件": ["Altium", "Cadence", "Verilog", "PCB", "电路设计", "信号完整性", "示波器"],
    "网络": ["TCP/IP", "路由器", "交换机", "防火墙", "Wireshark", "网络安全", "Linux"],
    "安全": ["网络安全", "漏洞扫描", "渗透测试", "Wireshark", "防火墙", "加密算法", "Linux"],
}


def _infer_full_technologies(job_titles: list[dict]) -> Dict[str, int]:
    """根据城市岗位列表推断技术需求及其频率权重"""
    tech_counter: Dict[str, int] = {}
    for jt in job_titles:
        name = jt.get("name", "")
        name_l = name.lower()
        matched = False
        for key, techs in JOB_TECH_MAPPING.items():
            if key in name_l:
                for t in techs:
                    tech_counter[t] = tech_counter.get(t, 0) + jt.get("count", 1)
                matched = True
        if not matched and name:
            # 通用兜底
            for t in ["Python", "SQL", "Git", "Linux"]:
                tech_counter[t] = tech_counter.get(t, 0) + jt.get("count", 1)
    return tech_counter


def _categorize_tech(tech: str) -> str:
    """将技术归类到类别"""
    lang = {"Java", "Python", "JavaScript", "C", "C++", "Go", "Kotlin", "Swift", "PHP", "C#", "Shell"}
    framework = {"Spring Boot", "Spring Cloud", "Vue", "React", "Django", "Flask", "MyBatis", ".NET", "Laravel", "Express", "ASP.NET", "Redux"}
    data = {"MySQL", "Redis", "SQL", "SQLite", "SQL Server", "PostgreSQL", "MongoDB", "Kafka", "Elasticsearch", "Spark", "Pandas", "NumPy"}
    devops = {"Docker", "Kubernetes", "Jenkins", "Nginx", "Git", "Linux", "Ansible", "Prometheus", "Webpack", "Vite", "Maven", "Jira"}
    ai_ml = {"PyTorch", "TensorFlow", "Scikit-learn", "Matplotlib", "Jupyter", "CUDA", "深度学习", "机器学习", "Transformer", "LLM"}
    frontend = {"HTML/CSS", "TypeScript", "Sass", "PostCSS", "Axure", "Babel"}
    embedded = {"STM32", "RTOS", "Altium", "Keil", "Cadence", "Verilog", "PCB", "SPI/I2C", "硬件接口"}
    
    if tech in lang: return "编程语言"
    if tech in framework: return "框架与开发"
    if tech in data: return "数据存储与处理"
    if tech in devops: return "工程化与运维"
    if tech in ai_ml: return "AI与算法"
    if tech in frontend: return "前端技术"
    if tech in embedded: return "嵌入式/硬件"
    return "核心技能"


def _generate_fallback_jobs(city_name: str) -> List[dict]:
    """当城市无真实岗位数据时，基于【城市岗位画像】生成合理的兜底岗位列表。

    与 seed_city_jobs.build_diverse_jobs 使用同一画像引擎（city_profile）：
    - 城市专属核心/次核心/特色产业 → 岗位池
    - 分层采样（核心40% + 次核心35% + 特色15% + 其他10%）
    - 城市专属权重 + 稳定 seed → 城城不同、同城稳定
    """
    city_short = _norm_city_for_query(city_name)
    try:
        from backend.city_profile import build_city_profile, pick_diverse_titles
        profile = build_city_profile(city_name, 0, 0)
        rng = random.Random(profile["seed"] + 101)
        picked = pick_diverse_titles(profile, set(), 20, rng)
        weights = profile["title_weights"]
        # 按城市专属权重倒序给出 count（热度感）：数量由城市画像稳定计算，每个岗位 ≥ 20
        picked_sorted = sorted(picked, key=lambda t: -weights.get(t, 0.5))
        return [{"name": t, "count": _city_job_demand(city_short, t, 0)}
                for t in picked_sorted]
    except Exception:
        # 画像引擎异常时的保守兜底（极少发生）：同样按城市画像稳定计算数量
        base_jobs = [
            "Java开发工程师", "前端开发工程师", "数据分析师",
            "软件测试工程师", "产品经理", "运维工程师",
        ]
        return [{"name": t, "count": _city_job_demand(city_short, t, 0)}
                for t in base_jobs]


async def fetch_city_tech_graph(
    conn: asyncpg.Connection,
    city_name: str,
    industry: Optional[str] = None,
    job: Optional[str] = None,
    education: Optional[str] = None,
    experience: Optional[str] = None,
    job_title: Optional[str] = None,
) -> Optional[dict]:
    """构建城市级技术知识图谱（中心岗位→辐射技术节点）"""
    
    # 1. 查询城市所有岗位（规范化城市名，兼容 "南昌" / "南昌市" / "南昌·区县" 等存储格式）
    city_short = _norm_city_for_query(city_name)
    city_match = _city_match_sql("1")
    filter_where, filter_params = _build_filter_where(
        industry=industry, job=job, education=education, experience=experience,
    )
    extra_where = ""
    all_params = [city_short]
    if filter_where:
        where_shifted = filter_where
        for i in range(len(filter_params), 0, -1):
            where_shifted = where_shifted.replace(f"${i}", f"${i + 1}")
        all_params.extend(filter_params)
        extra_where = f" AND ({where_shifted})"
    
    job_rows = await conn.fetch(f"""
        SELECT job_title, count(*)::int AS cnt
        FROM the_total_table
        WHERE {city_match} AND job_title IS NOT NULL AND job_title <> ''{extra_where}
        GROUP BY job_title ORDER BY cnt DESC LIMIT 40
    """, *all_params)
    
    total_jobs = sum(r["cnt"] for r in job_rows)
    is_fallback = False
    
    if total_jobs == 0:
        # 无真实数据 → AI 兜底生成
        is_fallback = True
        total_jobs = 20
        jobs_list = _generate_fallback_jobs(city_name)
    else:
        jobs_list = [{"name": r["job_title"], "count": r["cnt"]} for r in job_rows]
    
    # 1.5 如果真实岗位不足20个，用 AI 补充
    real_unique = len(jobs_list)
    if real_unique < 20:
        supplement_data = await fetch_city_jobs_full(conn, city_name, ensure_min=20)
        if supplement_data.get("isSupplemented"):
            jobs_list = []
            seen_names = set()
            for j in supplement_data["jobs"]:
                name = j["name"]
                if name not in seen_names:
                    jobs_list.append({"name": name, "count": j.get("count", 1)})
                    seen_names.add(name)
    
    # 2. 推断技术需求与频率
    tech_freq = _infer_full_technologies(jobs_list)
    
    # 3. 按类别分组
    tech_by_category: Dict[str, list] = {}
    for tech, freq in tech_freq.items():
        cat = _categorize_tech(tech)
        if cat not in tech_by_category:
            tech_by_category[cat] = []
        tech_by_category[cat].append({"name": tech, "frequency": freq})
    
    # 4. 每个类别内按频率排序，取 TOP
    for cat in tech_by_category:
        tech_by_category[cat].sort(key=lambda x: -x["frequency"])
        tech_by_category[cat] = tech_by_category[cat][:12]
    
    # 5. 构建树形结构：根节点 + 类别 + 技术
    max_freq = max(tech_freq.values()) if tech_freq else 1
    
    categories = []
    for cat_name, techs in tech_by_category.items():
        cat_tech_nodes = []
        for t in techs:
            ratio = t["frequency"] / max_freq
            size = max(14, int(14 + ratio * 28))
            cat_tech_nodes.append({
                "name": t["name"],
                "type": "technology",
                "frequency": t["frequency"],
                "size": size,
                "ratio": round(ratio, 2),
            })
        categories.append({
            "name": cat_name,
            "type": "category",
            "technologies": cat_tech_nodes,
        })
    
    # 按类别中技术数量排序
    categories.sort(key=lambda c: -sum(t["frequency"] for t in c["technologies"]))
    
    # 6. 确定中心岗位：优先使用传入的 job_title，其次使用筛选的 job，最后取频率最高岗位
    center_job = None
    if job_title:
        center_job = job_title
    elif job:
        center_job = job
    elif jobs_list:
        center_job = max(jobs_list, key=lambda j: j["count"])["name"]
    
    return {
        "cityName": city_name,
        "centerJob": center_job or city_name,
        "totalJobs": total_jobs,
        "uniqueTitles": len(jobs_list),
        "realJobCount": real_unique if not is_fallback else 0,
        "isSupplemented": real_unique < 20,
        "isFallback": is_fallback,
        "jobs": jobs_list,
        "categories": categories,
        "maxFrequency": max_freq,
    }


# 前端节点配色使用的技术分类（与 frontend/js/pages/map.js 中 TECH_CATEGORY_COLORS 对齐）
# 关键词 → 分类名（用于把 skills 真实字段中的技术归类到统一的图谱分类）
JOB_TECH_CATEGORY_MAP: Dict[str, str] = {
    # 编程语言
    "java": "编程语言", "python": "编程语言", "javascript": "编程语言", "js": "编程语言",
    "c++": "编程语言", "c": "编程语言", "c#": "编程语言", "go": "编程语言",
    "kotlin": "编程语言", "swift": "编程语言", "php": "编程语言", "shell": "编程语言",
    "typescript": "编程语言", "ts": "编程语言", "scala": "编程语言", "rust": "编程语言",
    "matlab": "编程语言", "r语言": "编程语言", "r": "编程语言", "ruby": "编程语言",
    # 框架与开发
    "spring boot": "框架与开发", "spring": "框架与开发", "springcloud": "框架与开发",
    "spring cloud": "框架与开发", "vue": "框架与开发", "react": "框架与开发",
    "django": "框架与开发", "flask": "框架与开发", "mybatis": "框架与开发",
    ".net": "框架与开发", "laravel": "框架与开发", "express": "框架与开发",
    "asp.net": "框架与开发", "redux": "框架与开发", "node.js": "框架与开发",
    "nodejs": "框架与开发", "uniapp": "框架与开发", "uni-app": "框架与开发",
    # 数据存储与处理
    "mysql": "数据存储与处理", "redis": "数据存储与处理", "sql": "数据存储与处理",
    "sqlite": "数据存储与处理", "sql server": "数据存储与处理",
    "postgresql": "数据存储与处理", "mongodb": "数据存储与处理", "kafka": "数据存储与处理",
    "elasticsearch": "数据存储与处理", "spark": "数据存储与处理", "pandas": "数据存储与处理",
    "numpy": "数据存储与处理", "hadoop": "数据存储与处理", "hive": "数据存储与处理",
    "clickhouse": "数据存储与处理", "flink": "数据存储与处理", "rabbitmq": "数据存储与处理",
    # 工程化与运维
    "docker": "工程化与运维", "kubernetes": "工程化与运维", "jenkins": "工程化与运维",
    "nginx": "工程化与运维", "git": "工程化与运维", "linux": "工程化与运维",
    "ansible": "工程化与运维", "prometheus": "工程化与运维", "webpack": "工程化与运维",
    "vite": "工程化与运维", "maven": "工程化与运维", "jira": "工程化与运维",
    "ci/cd": "工程化与运维", "cicd": "工程化与运维", "k8s": "工程化与运维",
    "grafana": "工程化与运维", "tomcat": "工程化与运维",
    # AI与算法
    "pytorch": "AI与算法", "tensorflow": "AI与算法", "scikit-learn": "AI与算法",
    "matplotlib": "AI与算法", "jupyter": "AI与算法", "cuda": "AI与算法",
    "深度学习": "AI与算法", "机器学习": "AI与算法", "transformer": "AI与算法",
    "llm": "AI与算法", "大模型": "AI与算法", "opencv": "AI与算法",
    "nlp": "AI与算法", "计算机视觉": "AI与算法",
    # 前端技术
    "html/css": "前端技术", "html": "前端技术", "css": "前端技术", "sass": "前端技术",
    "postcss": "前端技术", "axure": "前端技术", "babel": "前端技术",
    "echarts": "前端技术", "element ui": "前端技术", "ant design": "前端技术",
    # 架构设计
    "微服务": "架构设计", "分布式": "架构设计", "架构设计": "架构设计",
    "高并发": "架构设计", "消息队列": "架构设计", "mq": "架构设计",
    # 后端技术
    "后端开发": "后端技术", "restful": "后端技术", "api": "后端技术",
    # 数据处理
    "数据清洗": "数据处理", "etl": "数据处理", "数据可视化": "数据处理",
    "bi": "数据处理", "tableau": "数据处理", "power bi": "数据处理",
    # 测试技术
    "jmeter": "测试技术", "selenium": "测试技术", "自动化测试": "测试技术",
    "性能测试": "测试技术", "单元测试": "测试技术",
    # 嵌入式/硬件
    "stm32": "嵌入式/硬件", "rtos": "嵌入式/硬件", "altium": "嵌入式/硬件",
    "keil": "嵌入式/硬件", "cadence": "嵌入式/硬件", "verilog": "嵌入式/硬件",
    "pcb": "嵌入式/硬件", "plc": "嵌入式/硬件", "spi/i2c": "嵌入式/硬件",
    "硬件接口": "嵌入式/硬件", "嵌入式": "嵌入式/硬件",
}

# 经验要求 → 岗位级别（基于数据库 experience 字段真实取值）
EXPERIENCE_LEVEL_MAP: Dict[str, str] = {
    # 初级
    "不限": "初级", "无需经验": "初级", "在校生应届生": "初级", "1年": "初级",
    "1年及以上": "初级", "1年以下": "初级", "应届生": "初级", "经验不限": "初级",
    # 中级
    "2年": "中级", "1-3年": "中级", "2年及以上": "中级", "3年及以上": "中级",
    "3-5年": "中级", "3年以上": "中级", "2-3年": "中级", "1-3年经验": "中级",
    # 高级
    "5年及以上": "高级", "5-10年": "高级", "8年及以上": "高级", "10年及以上": "高级",
    "5年以上": "高级", "高级": "高级", "10年以上": "高级", "8年以上": "高级",
}


def _classify_job_tech(tech: str) -> str:
    """将单个技术归类到前端统一分类（与 TECH_CATEGORY_COLORS 的 key 对齐）"""
    t = tech.strip().lower()
    if not t:
        return "核心技能"
    # 精确匹配优先
    if t in JOB_TECH_CATEGORY_MAP:
        return JOB_TECH_CATEGORY_MAP[t]
    # 包含匹配（处理 "spring boot" vs "springboot" 等变体）
    for key, cat in JOB_TECH_CATEGORY_MAP.items():
        if key in t or t in key:
            return cat
    return "核心技能"


async def fetch_job_tech_graph(
    conn: asyncpg.Connection,
    job_title: str,
    industry: Optional[str] = None,
    education: Optional[str] = None,
    experience: Optional[str] = None,
) -> Optional[dict]:
    """构建岗位级技术知识图谱真实数据（中心岗位→技术分类→技术 / 岗位级别→技术）。

    数据完全来自 the_total_table 的 skills（结构化技能字段）与 experience 字段，
    不做城市级聚合，避免混入其他岗位/城市的技术数据。
    """
    # 1. 取该岗位全部真实记录（含 skills、experience）
    filter_where, filter_params = _build_filter_where(
        industry=industry, job=job_title, education=education, experience=experience,
    )
    # job_title 作为精确岗位名筛选（走 job 维度，services 中 job 对应 job_title）
    extra_where = ""
    all_params = []
    if filter_where:
        where_shifted = filter_where
        for i in range(len(filter_params), 0, -1):
            where_shifted = where_shifted.replace(f"${i}", f"${i + len(all_params)}")
        extra_where = f" AND ({where_shifted})"
        all_params.extend(filter_params)

    rows = await conn.fetch(f"""
        SELECT skills, experience
        FROM the_total_table
        WHERE skills IS NOT NULL AND skills <> ''{extra_where}
    """, *all_params)

    if not rows:
        # 该岗位无真实技能数据
        return {
            "jobTitle": job_title,
            "centerJob": job_title,
            "skillCount": 0,
            "categories": [],
            "levels": [],
            "maxFrequency": 1,
            "isFallback": True,
        }

    # 2. 聚合该岗位 skills（去重，统计出现频次）
    from collections import Counter
    tech_counter: Dict[str, int] = Counter()
    # 级别维度：级别 → 技术频次
    level_counter: Dict[str, Counter] = {"初级": Counter(), "中级": Counter(), "高级": Counter()}
    for r in rows:
        skills_raw = r["skills"] or ""
        exp = (r["experience"] or "").strip()
        level = EXPERIENCE_LEVEL_MAP.get(exp, "中级")  # 未识别的经验归中级
        for raw in skills_raw.split(","):
            name = raw.strip()
            if not name:
                continue
            tech_counter[name] += 1
            level_counter[level][name] += 1

    if not tech_counter:
        return {
            "jobTitle": job_title,
            "centerJob": job_title,
            "skillCount": 0,
            "categories": [],
            "levels": [],
            "maxFrequency": 1,
            "isFallback": True,
        }

    # 3. 按前端统一分类聚合（技术栈视图）
    tech_by_category: Dict[str, list] = {}
    for tech, freq in tech_counter.items():
        cat = _classify_job_tech(tech)
        tech_by_category.setdefault(cat, []).append({"name": tech, "frequency": freq})

    for cat in tech_by_category:
        tech_by_category[cat].sort(key=lambda x: -x["frequency"])
        tech_by_category[cat] = tech_by_category[cat][:12]

    max_freq = max(tech_counter.values())
    categories = []
    for cat_name, techs in tech_by_category.items():
        cat_tech_nodes = []
        for t in techs:
            ratio = t["frequency"] / max_freq if max_freq else 0
            size = max(14, int(14 + ratio * 28))
            cat_tech_nodes.append({
                "name": t["name"],
                "type": "technology",
                "frequency": t["frequency"],
                "size": size,
                "ratio": round(ratio, 2),
            })
        categories.append({
            "name": cat_name,
            "type": "category",
            "technologies": cat_tech_nodes,
        })
    # 按类别中技术数量排序
    categories.sort(key=lambda c: -sum(t["frequency"] for t in c["technologies"]))

    # 4. 级别维度（级别视图）
    levels = []
    for lv in ["初级", "中级", "高级"]:
        lv_techs = level_counter[lv]
        if not lv_techs:
            continue
        lv_nodes = []
        for name, freq in lv_techs.most_common(15):
            ratio = freq / max_freq if max_freq else 0
            size = max(14, int(14 + ratio * 28))
            lv_nodes.append({
                "name": name,
                "type": "technology",
                "frequency": freq,
                "size": size,
                "ratio": round(ratio, 2),
            })
        levels.append({
            "name": lv,
            "type": "level",
            "technologies": lv_nodes,
        })
    levels.sort(key=lambda x: ["初级", "中级", "高级"].index(x["name"]))

    return {
        "jobTitle": job_title,
        "centerJob": job_title,
        "skillCount": sum(tech_counter.values()),
        "uniqueSkills": len(tech_counter),
        "categories": categories,
        "levels": levels,
        "maxFrequency": max_freq,
        "isFallback": False,
    }


# ========== 更新图谱（挑战杯演示）：动态重选技术并写入 new_skill_table ==========

# 通用补充技术池（演示用，与前端兜底池对齐）
_UPDATE_TECH_POOL = [
    "Python", "Java", "JavaScript", "TypeScript", "Go", "C", "C++", "C#", "PHP", "Ruby",
    "Swift", "Kotlin", "Rust", "SQL", "Scala", "Shell",
    "Django", "Flask", "Spring Boot", "Spring Cloud", "MyBatis", "Hibernate", "FastAPI",
    "Express", "Laravel", "Node.js", "Netty", "Dubbo", "gRPC", "WebSocket", "JWT", "Celery",
    "MySQL", "PostgreSQL", "MongoDB", "Redis", "Oracle", "SQLite", "Elasticsearch",
    "HBase", "ClickHouse", "Hive", "Doris", "Redis Cluster",
    "Docker", "Kubernetes", "K8s", "Git", "GitLab CI", "Jenkins", "Nginx", "Linux",
    "Ansible", "Helm", "Prometheus", "Grafana", "Docker Compose", "ZooKeeper", "Terraform",
    "TensorFlow", "PyTorch", "Keras", "Scikit-learn", "Pandas", "NumPy", "OpenCV",
    "XGBoost", "LightGBM", "LangChain", "PaddlePaddle",
    "Spark", "Hadoop", "Kafka", "Flink", "Airflow", "DataX", "Flume", "ETL", "OLAP", "Presto",
    "Vue", "React", "Angular", "Next.js", "Vite", "Webpack", "HTML5", "CSS3", "ECharts", "Uni-app",
    "微服务", "分布式架构", "消息队列", "高并发", "负载均衡", "云原生",
    "数据结构与算法", "操作系统", "计算机网络", "数据库原理", "设计模式", "并发编程",
    "Selenium", "JMeter", "Postman", "Jest", "Cypress", "Playwright", "Pytest",
]


async def update_job_tech_graph(
    conn: asyncpg.Connection,
    job_title: str,
    round_no: int = 1,
) -> Optional[dict]:
    """动态更新岗位技术图谱（挑战杯演示）：

    1) 从 the_total_table（视图，指向 the_total_table_copy1）提取该岗位真实技术池；
    2) 与通用补充池合并；
    3) 按"轮次"确定性策略重新选择一批技术（数量随轮次明显变化、核心技术保留、边缘技术轮换）；
    4) 将本次结果写入 new_skill_table（同一数据库，数据版本 = 轮次）；
    5) 返回与 fetch_job_tech_graph 相同结构的 categories + levels。
    """
    from collections import Counter

    # 0. 确保 new_skill_table 存在（与 the_total_table_copy1 同一数据库/schema）
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS public.new_skill_table (
            id BIGSERIAL PRIMARY KEY,
            tech_name VARCHAR(200) NOT NULL,
            category VARCHAR(100) NOT NULL DEFAULT '其他',
            job_title VARCHAR(200) NOT NULL,
            weight INTEGER NOT NULL DEFAULT 50,
            is_visible BOOLEAN NOT NULL DEFAULT TRUE,
            data_version INTEGER NOT NULL DEFAULT 1,
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
    """)

    # 1. 该岗位真实技术池（来自 the_total_table_copy1 的数据）
    rows = await conn.fetch("""
        SELECT skills FROM the_total_table
        WHERE skills IS NOT NULL AND skills <> '' AND job_title = $1
        LIMIT 3000
    """, job_title)
    counter: Counter = Counter()
    for r in rows:
        for raw in (r["skills"] or "").split(","):
            name = raw.strip()
            if name:
                counter[name] += 1
    existing = [{"name": n, "cat": _classify_job_tech(n), "freq": f}
                for n, f in counter.most_common(200)]
    # 无真实数据时退化为通用池
    if not existing:
        existing = [{"name": t, "cat": _classify_job_tech(t), "freq": 1}
                    for t in _UPDATE_TECH_POOL]

    # 2. 合并通用池（去重）
    used = {e["name"] for e in existing}
    pool = list(existing)
    for t in _UPDATE_TECH_POOL:
        if t not in used:
            used.add(t)
            pool.append({"name": t, "cat": _classify_job_tech(t), "freq": 1})

    # 3. 确定性轮次选择：数量随轮次变化（18~37），相邻轮次明显不同
    count = 18 + ((round_no * 7) % 20)
    count = min(count, len(pool))
    # 核心技术（高频 TOP8 保留，保证每轮都有岗位核心技术）
    core_count = min(8, max(3, len(existing) * 4 // 10))
    core = [{"name": e["name"], "cat": e["cat"]} for e in existing[:core_count]]
    core_used = {c["name"] for c in core}
    rest = [p for p in pool if p["name"] not in core_used]

    # 确定性洗牌（同一轮次结果稳定，不同轮次结果变化）
    seed = round_no * 99991 + 7
    s = seed
    shuffled = list(rest)
    for i in range(len(shuffled) - 1, 0, -1):
        s = (s * 1103515245 + 12345) % 2147483648
        j = s % (i + 1)
        shuffled[i], shuffled[j] = shuffled[j], shuffled[i]

    picked = list(core)
    for p in shuffled:
        if len(picked) >= count:
            break
        picked.append({"name": p["name"], "cat": p["cat"]})
    k = 0
    while len(picked) < count and rest:
        picked.append({"name": rest[k % len(rest)]["name"], "cat": rest[k % len(rest)]["cat"]})
        k += 1
    picked = picked[:count]

    # 4. 写入 new_skill_table（覆盖该岗位上一版本）
    await conn.execute(
        "DELETE FROM public.new_skill_table WHERE job_title = $1", job_title
    )
    for i, p in enumerate(picked):
        weight = 92 - min(72, i * 78 // max(1, len(picked)))
        await conn.execute(
            """INSERT INTO public.new_skill_table
               (tech_name, category, job_title, weight, is_visible, data_version)
               VALUES ($1, $2, $3, $4, TRUE, $5)""",
            p["name"], p["cat"], job_title, weight, round_no,
        )

    # 5. 构建返回数据（结构同 fetch_job_tech_graph）
    cat_map: Dict[str, list] = {}
    for i, p in enumerate(picked):
        weight = 92 - min(72, i * 78 // max(1, len(picked)))
        cat_map.setdefault(p["cat"], []).append({
            "name": p["name"],
            "type": "technology",
            "frequency": weight,
            # size 与原图谱一致归一化到 14~42：平方映射让多数节点偏小、核心节点突出
            "size": max(14, min(42, 14 + int(28 * (weight / 92) ** 2))),
            "ratio": round(min(0.98, weight / 100), 2),
        })
    categories = [
        {"name": cat, "type": "category", "technologies": techs}
        for cat, techs in cat_map.items()
        if techs
    ]
    categories.sort(key=lambda c: -sum(t["frequency"] for t in c["technologies"]))

    # 级别视图：初级/中级/高级 均衡分配
    level_names = ["初级", "中级", "高级"]
    levels = []
    for li, lv in enumerate(level_names):
        start = len(picked) * li // 3
        end = len(picked) * (li + 1) // 3
        techs = []
        for j, p in enumerate(picked[start:end]):
            techs.append({
                "name": p["name"],
                "type": "technology",
                "frequency": 60 + ((j * 13 + li * 7) % 30),
                "size": 14 + ((j * 7 + li * 5) % 29),
                "ratio": round(min(0.95, 0.4 + ((j * 11 + li * 9) % 50) / 100), 2),
            })
        if techs:
            levels.append({"name": lv, "type": "level", "technologies": techs})

    return {
        "jobTitle": job_title,
        "centerJob": job_title,
        "skillCount": sum(t["frequency"] for c in categories for t in c["technologies"]),
        "uniqueSkills": len(picked),
        "categories": categories,
        "levels": levels,
        "maxFrequency": max((t["frequency"] for c in categories for t in c["technologies"]), default=1),
        "dataVersion": round_no,
        "sourceTable": "new_skill_table",
    }


async def fetch_tech_detail(
    conn: asyncpg.Connection,
    tech_name: str,
    city_name: Optional[str] = None,
) -> dict:
    """获取技术详细分析（结合知识库 + 数据库统计）"""
    
    # 1. 技术知识库
    tech_info = TECH_KNOWLEDGE_BASE.get(tech_name)
    if not tech_info:
        # 动态生成
        tech_info = {
            "intro": f"{tech_name} 是行业内常用的技术/工具，在岗位需求中具有一定出现频率。",
            "uses": ["相关领域开发", "项目实践", "团队协作"],
            "scenarios": f"在相关岗位中，{tech_name} 被用于提升开发效率和系统性能。",
            "knowledgePoints": ["基础概念", "核心用法", "进阶实践", "调优/优化"],
            "learningPath": ["基础入门", "核心掌握", "项目实践", "深入进阶"],
            "relatedTech": [],
        }
    
    # 2. 数据库统计（如果指定了城市）
    job_count = 0
    job_ratio = 0
    related_cities = []
    related_jobs = []
    
    if city_name:
        # 该城市中使用此技术的岗位数量（基于标题匹配）
        matched_count = 0
        for key, techs in JOB_TECH_MAPPING.items():
            rows = await conn.fetch("""
                SELECT count(*)::int AS cnt FROM the_total_table
                WHERE city = $1 AND job_title ILIKE '%' || $2 || '%'
            """, city_name, key)
            if rows and rows[0]["cnt"] > 0:
                # 检查该映射是否包含目标技术
                if tech_name in techs or any(t.lower() in tech_name.lower() for t in techs):
                    matched_count += rows[0]["cnt"]
        
        # 总岗位数
        total_row = await conn.fetchrow(
            "SELECT count(*)::int AS cnt FROM the_total_table WHERE city = $1", city_name)
        total_cnt = total_row["cnt"] if total_row else 1
        job_count = matched_count
        job_ratio = round(matched_count / total_cnt * 100, 1) if total_cnt > 0 else 0
        
        # 相关城市
        city_rows = await conn.fetch("""
            SELECT city, count(*)::int AS cnt FROM the_total_table
            WHERE job_title IS NOT NULL AND job_title <> ''
            GROUP BY city ORDER BY cnt DESC LIMIT 10
        """)
        for r in city_rows:
            if r["city"] != city_name:
                related_cities.append(r["city"])
        related_cities = related_cities[:5]
        
        # 相关岗位
        job_rows = await conn.fetch("""
            SELECT job_title, count(*)::int AS cnt FROM the_total_table
            WHERE city = $1 AND job_title IS NOT NULL AND job_title <> ''
            GROUP BY job_title ORDER BY cnt DESC LIMIT 15
        """, city_name)
        related_jobs = [{"name": r["job_title"], "count": r["cnt"]} for r in job_rows if r["cnt"] > 1]
        related_jobs = related_jobs[:8]
    
    hot_level = min(5, max(1, int(job_ratio / 20) + 1)) if job_ratio > 0 else 3
    
    return {
        "name": tech_name,
        "intro": tech_info["intro"],
        "uses": tech_info["uses"],
        "scenarios": tech_info["scenarios"],
        "knowledgePoints": tech_info["knowledgePoints"],
        "learningPath": tech_info["learningPath"],
        "relatedTech": tech_info.get("relatedTech", []),
        "hotLevel": hot_level,
        "stats": {
            "jobCount": job_count,
            "jobRatio": f"{job_ratio}%",
            "relatedCities": related_cities,
            "relatedJobs": related_jobs,
        } if city_name else None,
    }


async def fetch_city_jobs_full(
    conn: asyncpg.Connection,
    city_name: str,
    ensure_min: int = 20,
) -> dict:
    """
    获取城市完整岗位数据；数量/类型不足时按城市规模 AI 补充并【写入数据库】后重新查询。
    所有数据均来自数据库（不再内存拼接假数据）。
    返回：{ "cityName": "...", "totalJobs": 记录数, "jobs": [...], "isSupplemented": bool, "supplementedCount": N }
    """
    city_short = _norm_city_for_query(city_name)
    city_match = _city_match_sql("1")

    async def _query():
        rows = await conn.fetch(f"""
            SELECT job_title, count(*)::int AS cnt,
                   avg((salary_min + salary_max)/2.0)::float AS avg_sal,
                   string_agg(DISTINCT industry_tags, ',') AS industries,
                   bool_or(source_name <> 'ai_seed') AS is_real
            FROM the_total_table
            WHERE {city_match} AND job_title IS NOT NULL AND job_title <> ''
            GROUP BY job_title
        """, city_short)
        # 展示需求数量：真实数据优先，不足时按城市规模/岗位热度/城市画像稳定补充（每个岗位类型 ≥ 20）
        demand_map = {r["job_title"]: _city_job_demand(city_short, r["job_title"], r["cnt"]) for r in rows}
        # 稳定排序：需求热度×0.45 + 城市稳定随机权重×0.55（不同城市排序不同，刷新不变）
        max_demand = max(demand_map.values(), default=0)
        rows.sort(key=lambda r: _city_order_score(city_short, r["job_title"], demand_map[r["job_title"]], max_demand))
        rows = rows[:100]
        total = await conn.fetchval(
            f"SELECT count(*) FROM the_total_table WHERE {city_match}", city_short
        ) or 0
        jobs = []
        industry_set = set()
        for r in rows:
            jobs.append({"name": r["job_title"], "count": demand_map[r["job_title"]],
                         "avgSalary": round(r["avg_sal"] or 0, 0),
                         "isReal": bool(r["is_real"])})
            if r["industries"]:
                for tag in r["industries"].split(","):
                    tag = tag.strip()
                    if tag and len(tag) < 30:
                        industry_set.add(tag)
        return total, jobs, list(industry_set)[:8]

    total_jobs, real_jobs, industries_list = await _query()
    added = 0
    if len(real_jobs) < ensure_min or total_jobs < ensure_min:
        added = await _ensure_city_min_jobs(conn, city_short, ensure_min)
        if added > 0:
            total_jobs, real_jobs, industries_list = await _query()

    return {
        "cityName": city_name,
        "totalJobs": total_jobs,
        "realJobCount": len(real_jobs),
        "jobs": real_jobs,
        "industries": industries_list,
        "isSupplemented": added > 0,
        "supplementedCount": added,
    }


async def fetch_city_preview(
    conn: asyncpg.Connection,
    province_name: str,
    city_name: str,
) -> dict:
    """城市悬停预览（市级地图右侧面板）：
    岗位总数 + 平均薪资 + 热门岗位TOP5 + 热门技术TOP5 + 行业占比 + 学历占比。
    岗位类型/记录不足时按城市规模自动补充并【写入数据库】后重新查询。
    """
    city_short = _norm_city_for_query(city_name)
    city_match = _city_match_sql("1")

    async def _query():
        title_rows = await conn.fetch(f"""
            SELECT job_title, count(*)::int AS cnt,
                   avg((salary_min + salary_max)/2.0)::float AS avg_sal
            FROM the_total_table
            WHERE {city_match} AND job_title IS NOT NULL AND job_title <> ''
            GROUP BY job_title
        """, city_short)
        total_jobs = await conn.fetchval(
            f"SELECT count(*) FROM the_total_table WHERE {city_match}", city_short
        ) or 0
        # 展示需求数量：真实数据优先，不足时按城市规模/岗位热度/城市画像稳定补充（每个岗位类型 ≥ 20）
        demand_map = {r["job_title"]: _city_job_demand(city_short, r["job_title"], r["cnt"]) for r in title_rows}
        # 稳定排序：需求热度×0.45 + 城市稳定随机权重×0.55（不同城市排序不同，刷新不变）
        max_demand = max(demand_map.values(), default=0)
        title_rows.sort(key=lambda r: _city_order_score(city_short, r["job_title"], demand_map[r["job_title"]], max_demand))
        return title_rows, total_jobs, demand_map

    title_rows, total_jobs, demand_map = await _query()
    added = 0
    if len(title_rows) < 5 or total_jobs < 20:
        added = await _ensure_city_min_jobs(conn, city_short, 20)
        if added > 0:
            title_rows, total_jobs, demand_map = await _query()

    # 热门岗位 TOP5（稳定排序后的前 5 个岗位类型）
    hot_jobs = [{
        "name": r["job_title"], "count": demand_map[r["job_title"]],
        "avgSalary": round(r["avg_sal"] or 0, 0),
    } for r in title_rows[:5]]

    # 平均薪资：TOP20 有效薪资均值（与 fetch_city_detail 口径一致）
    avg_sal_rows = [r["avg_sal"] for r in title_rows[:20] if r["avg_sal"]]
    avg_salary = round(sum(avg_sal_rows) / len(avg_sal_rows), 0) if avg_sal_rows else 0

    # 热门技术 TOP5：从 TOP15 岗位类型推断技术技能并按出现频次排序（过滤通用能力词）
    generic_skills = {"办公软件", "专业知识", "团队协作", "项目管理", "专业技能", "沟通协作", "问题解决", "数据处理"}
    skill_count: dict = {}
    for r in title_rows[:15]:
        for cap in _infer_capabilities(r["job_title"])[1]:
            if cap in generic_skills:
                continue
            skill_count[cap] = skill_count.get(cap, 0) + 1
    hot_skills = [s for s, _ in sorted(skill_count.items(), key=lambda x: (-x[1], x[0]))][:5]

    # 学历占比
    edu_rows = await conn.fetch(f"""
        SELECT education, count(*)::int AS cnt FROM the_total_table
        WHERE {city_match} AND education IS NOT NULL AND education != ''
        GROUP BY education ORDER BY cnt DESC LIMIT 6
    """, city_short)
    edu_total = sum(r["cnt"] for r in edu_rows) or 1
    education_dist = [{
        "name": r["education"], "count": r["cnt"],
        "pct": round(r["cnt"] * 100.0 / edu_total, 1),
    } for r in edu_rows]

    # 行业占比：industry_tags 逗号分隔拆开累加
    ind_rows = await conn.fetch(f"""
        SELECT industry_tags, count(*)::int AS cnt FROM the_total_table
        WHERE {city_match} AND industry_tags IS NOT NULL AND industry_tags != ''
        GROUP BY industry_tags ORDER BY cnt DESC LIMIT 8
    """, city_short)
    ind_count: dict = {}
    for r in ind_rows:
        for tag in (r["industry_tags"] or "").split(","):
            tag = tag.strip()
            if tag and len(tag) < 30:
                ind_count[tag] = ind_count.get(tag, 0) + r["cnt"]
    ind_total = sum(ind_count.values()) or 1
    industry_dist = [{
        "name": k, "count": v,
        "pct": round(v * 100.0 / ind_total, 1),
    } for k, v in sorted(ind_count.items(), key=lambda x: -x[1])[:5]]

    return {
        "provinceName": province_name,
        "cityName": city_name,
        "totalJobs": total_jobs,
        "avgSalary": avg_salary,
        "hotJobs": hot_jobs,
        "hotSkills": hot_skills,
        "educationDist": education_dist,
        "industryDist": industry_dist,
        "isSupplemented": added > 0,
        "supplementedCount": added,
    }