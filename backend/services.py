"""业务服务：从数据库聚合数据生成接口响应"""
import json
import asyncpg
from datetime import datetime, date, timedelta
from typing import Optional, Dict, List, Any
from backend.mappings import (
    CITY_TO_PROVINCE,
    PROVINCE_CENTERS,
    PROVINCE_CODE,
    categorize_job,
    parse_city_to_province,
)


async def fetch_provinces_summary(conn: asyncpg.Connection) -> dict:
    """全国省份聚合数据：每个省份的岗位总数、热门指数、增长率"""
    # 1) 按省份聚合岗位数（先解析 city→province）
    rows = await conn.fetch("""
        SELECT
          city,
          count(*)::int AS cnt,
          avg((salary_min + salary_max) / 2.0) AS avg_salary,
          count(DISTINCT job_title)::int AS distinct_titles
        FROM job_postings
        WHERE city IS NOT NULL AND city <> ''
        GROUP BY city
    """)
    # 聚合到省份
    province_map: dict[str, dict] = {}
    for r in rows:
        prov = parse_city_to_province(r["city"])
        if not prov:
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
    # 2) distinct titles
    distinct_rows = await conn.fetch("""
        SELECT city, job_title
        FROM job_postings
        WHERE city IS NOT NULL AND city <> ''
    """)
    title_set_by_prov: dict[str, set] = {}
    for r in distinct_rows:
        prov = parse_city_to_province(r["city"])
        if not prov:
            continue
        title_set_by_prov.setdefault(prov, set()).add(r["job_title"])
    for prov, s in title_set_by_prov.items():
        province_map[prov]["distinctTitles"] = len(s)

    # 3) 总数据统计
    total = await conn.fetchval("SELECT count(*) FROM job_postings") or 0
    distinct_jobs = await conn.fetchval("""
        SELECT count(DISTINCT job_title) FROM job_postings
    """) or 0
    update_time = await conn.fetchval("SELECT max(crawl_time)::text FROM job_postings") or ""

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
    return {
        "updateTime": update_time,
        "totalJobs": int(total),
        "distinctJobs": int(distinct_jobs),
        "provinces": provinces,
    }


async def fetch_province_detail(conn: asyncpg.Connection, province_id: str) -> Optional[dict]:
    """省份详情：岗位TOP列表 + 7日趋势"""
    # 反查省名
    prov_name = next((n for n, c in PROVINCE_CODE.items() if c == province_id), None)
    if not prov_name:
        return None
    # 该省所有城市
    prov_cities = [c for c, p in CITY_TO_PROVINCE.items() if p == prov_name]
    if not prov_cities:
        return None

    # 1) TOP 岗位（按出现次数）
    title_rows = await conn.fetch(f"""
        SELECT job_title, count(*)::int AS cnt,
               avg((salary_min + salary_max)/2.0) AS avg_sal
        FROM job_postings
        WHERE city = ANY($1)
          AND job_title IS NOT NULL AND job_title <> ''
        GROUP BY job_title
        ORDER BY cnt DESC
        LIMIT 20
    """, prov_cities)
    top_jobs = []
    for i, r in enumerate(title_rows):
        top_jobs.append({
            "id": i + 1,
            "name": r["job_title"],
            "count": r["cnt"],
            "hot": 0.0,  # 先占位，下面统一基于最大 count 计算
            "avgSalary": round(float(r["avg_sal"]), 0) if r["avg_sal"] else 0,
            "category": categorize_job(r["job_title"]),
        })
    # 基于 max(count) 统一计算 hot
    if top_jobs:
        max_cnt = top_jobs[0]["count"]
        for j in top_jobs:
            j["hot"] = round(j["count"] / max_cnt * 85 + 15, 1)

    # 2) 按日趋势（基于 crawl_time::date）
    trend_rows = await conn.fetch(f"""
        SELECT crawl_time::date AS d,
               count(*)::int AS cnt
        FROM job_postings
        WHERE city = ANY($1)
          AND crawl_time IS NOT NULL
        GROUP BY d
        ORDER BY d
    """, prov_cities)
    # 补齐最近 7 天（数据时间范围可能不在 today，以 max(crawl_time) 为基准回溯 7 天）
    # 先查该省数据的 crawl_time 最大值
    latest_row = await conn.fetchval(f"""
        SELECT max(crawl_time)::date FROM job_postings
        WHERE city = ANY($1) AND crawl_time IS NOT NULL
    """, prov_cities)
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