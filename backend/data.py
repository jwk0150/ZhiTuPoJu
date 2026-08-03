from copy import deepcopy
from typing import Any, Optional

from sqlalchemy import desc, func

from backend.db import SessionLocal
from backend.db_models import JobPosting, JobPostingDetail, LiepinJob


def ok(data):
    return {"code": 0, "message": "success", "data": data}


# ============================================================
# 数据库查询函数 —— 优先从 PostgreSQL 读，失败则回退 Mock
# ============================================================

def _get_db():
    """获取数据库会话，失败返回 None"""
    try:
        return SessionLocal()
    except Exception:
        return None


def get_db_stats():
    """获取数据库真实统计"""
    db = _get_db()
    if not db:
        return None
    try:
        total_postings = db.query(func.count(JobPosting.id)).scalar() or 0
        total_details = db.query(func.count(JobPostingDetail.detail_id)).scalar() or 0
        # liepin_jobs 表可能不存在（如未导入数据），用 try/except + rollback 兜底
        try:
            total_liepin = db.query(func.count(LiepinJob.id)).scalar() or 0
        except Exception:
            db.rollback()
            total_liepin = 0

        sources = (
            db.query(JobPosting.source_name, func.count(JobPosting.id))
            .group_by(JobPosting.source_name)
            .all()
        )

        latest = db.query(func.max(JobPosting.crawl_time)).scalar()

        return {
            "total_postings": total_postings,
            "total_details": total_details,
            "total_liepin": total_liepin,
            "sources": [{"name": s, "count": c} for s, c in sources if s],
            "latest_crawl": str(latest) if latest else None,
        }
    finally:
        db.close()


def get_real_jobs(limit: int = 50, offset: int = 0, keyword: Optional[str] = None):
    """从数据库读取真实岗位列表"""
    db = _get_db()
    if not db:
        return [], 0
    try:
        q = db.query(JobPosting)
        if keyword:
            q = q.filter(
                (JobPosting.job_title.ilike(f"%{keyword}%"))
                | (JobPosting.company_name.ilike(f"%{keyword}%"))
            )
        total = q.count()
        rows = (
            q.order_by(desc(JobPosting.crawl_time))
            .offset(offset)
            .limit(limit)
            .all()
        )
        jobs = []
        for r in rows:
            jobs.append({
                "id": r.id,
                "job_title": r.job_title,
                "company_name": r.company_name,
                "city": r.city,
                "district": r.district,
                "salary_min": r.salary_min,
                "salary_max": r.salary_max,
                "salary_unit": r.salary_unit,
                "experience": r.experience,
                "education": r.education,
                "job_type": r.job_type,
                "source_name": r.source_name,
                "publish_time": str(r.publish_time) if r.publish_time else None,
                "crawl_time": str(r.crawl_time) if r.crawl_time else None,
            })
        return jobs, total
    finally:
        db.close()


def get_real_job_detail(job_id: int):
    """获取单个岗位的详细信息"""
    db = _get_db()
    if not db:
        return None
    try:
        posting = db.query(JobPosting).filter(JobPosting.id == job_id).first()
        if not posting:
            return None
        detail = (
            db.query(JobPostingDetail)
            .filter(JobPostingDetail.job_id == job_id)
            .first()
        )
        result: dict[str, Any] = {
            "id": posting.id,
            "job_title": posting.job_title,
            "company_name": posting.company_name,
            "city": posting.city,
            "district": posting.district,
            "salary_min": posting.salary_min,
            "salary_max": posting.salary_max,
            "salary_unit": posting.salary_unit,
            "experience": posting.experience,
            "education": posting.education,
            "job_type": posting.job_type,
            "source_name": posting.source_name,
            "publish_time": str(posting.publish_time) if posting.publish_time else None,
        }
        if detail:
            result["detail"] = {
                "detail_id": detail.detail_id,
                "company_industry": detail.company_industry,
                "company_size": detail.company_size,
                "company_nature": detail.company_nature,
                "company_intro": detail.company_intro,
                "job_description": detail.job_description,
                "job_requirement": detail.job_requirement,
                "job_highlights": detail.job_highlights,
                "job_labels": detail.job_labels,
                "skills": detail.skills,
                "benefits": detail.benefits,
                "keywords": detail.keywords,
                "work_mode": detail.work_mode,
                "salary_description": detail.salary_description,
                "source_url": detail.source_url,
            }
        return result
    finally:
        db.close()


def get_real_city_stats():
    """按城市统计岗位数量"""
    db = _get_db()
    if not db:
        return []
    try:
        rows = (
            db.query(JobPosting.city, func.count(JobPosting.id))
            .filter(JobPosting.city.isnot(None), JobPosting.city != "")
            .group_by(JobPosting.city)
            .order_by(desc(func.count(JobPosting.id)))
            .limit(20)
            .all()
        )
        return [{"city": c, "count": n} for c, n in rows]
    finally:
        db.close()


def get_real_salary_stats():
    """薪资分布统计"""
    db = _get_db()
    if not db:
        return {}
    try:
        avg_min = (
            db.query(func.avg(JobPosting.salary_min))
            .filter(JobPosting.salary_min > 0)
            .scalar()
        )
        avg_max = (
            db.query(func.avg(JobPosting.salary_max))
            .filter(JobPosting.salary_max > 0)
            .scalar()
        )

        brackets = [
            (0, 10000, "10K以下"),
            (10000, 20000, "10K-20K"),
            (20000, 30000, "20K-30K"),
            (30000, 50000, "30K-50K"),
            (50000, 999999, "50K以上"),
        ]
        distribution = []
        for lo, hi, label in brackets:
            cnt = (
                db.query(func.count(JobPosting.id))
                .filter(JobPosting.salary_max > lo, JobPosting.salary_max <= hi)
                .scalar()
            )
            distribution.append({"range": label, "count": cnt or 0})

        return {
            "avg_salary_min": round(avg_min) if avg_min else 0,
            "avg_salary_max": round(avg_max) if avg_max else 0,
            "distribution": distribution,
        }
    finally:
        db.close()


# ============================================================
# Mock 数据（DB 不可用时的回退数据）
# ============================================================

SKILLS = [
    "Python",
    "Java",
    "RAG",
    "LangChain",
    "Function Calling",
    "多智能体协作",
    "Prompt工程",
    "向量数据库",
    "FastAPI",
    "PyTorch",
    "Transformer",
    "Spring Boot",
    "MySQL",
    "Redis",
    "Kubernetes",
]


SOURCES = [
    {
        "id": "src_001",
        "name": "BOSS直聘",
        "type": "招聘平台",
        "format": "HTML",
        "status": "running",
        "today_count": 428,
        "success_rate": 96.4,
        "last_collected_at": "2026-07-26 18:30:00",
        "description": "互联网与AI岗位招聘数据",
    },
    {
        "id": "src_002",
        "name": "企业官网",
        "type": "企业官网",
        "format": "HTML/JSON",
        "status": "running",
        "today_count": 126,
        "success_rate": 92.1,
        "last_collected_at": "2026-07-26 18:20:00",
        "description": "企业招聘页、人才计划与技术博客",
    },
    {
        "id": "src_003",
        "name": "行业报告",
        "type": "行业报告",
        "format": "PDF",
        "status": "finished",
        "today_count": 18,
        "success_rate": 88.5,
        "last_collected_at": "2026-07-26 17:10:00",
        "description": "AI、大数据、数字经济行业报告",
    },
    {
        "id": "src_004",
        "name": "政策文件",
        "type": "政策文件",
        "format": "PDF/HTML",
        "status": "finished",
        "today_count": 9,
        "success_rate": 91.8,
        "last_collected_at": "2026-07-26 16:45:00",
        "description": "人工智能+、数字经济、职业技能相关政策",
    },
    {
        "id": "src_005",
        "name": "学术论文",
        "type": "学术论文",
        "format": "PDF/XML",
        "status": "running",
        "today_count": 32,
        "success_rate": 89.6,
        "last_collected_at": "2026-07-26 18:05:00",
        "description": "大模型、RAG、Agent相关论文元数据与摘要",
    },
]


JOBS = [
    {
        "id": "job_ai_agent",
        "title": "AI Agent工程师",
        "category": "人工智能",
        "company": "智造未来科技",
        "industry": "人工智能",
        "city": "北京",
        "salary": "30-60K",
        "required_skills": ["Python", "RAG", "LangChain", "Function Calling", "多智能体协作"],
        "preferred_skills": ["向量数据库", "Prompt工程", "FastAPI"],
        "post_date": "2026-07-20",
        "source": "BOSS直聘",
        "description": "负责智能体应用开发、多工具调用和多智能体协作流程设计。",
    },
    {
        "id": "job_llm_app",
        "title": "大模型应用工程师",
        "category": "人工智能",
        "company": "星河智能",
        "industry": "人工智能",
        "city": "上海",
        "salary": "28-55K",
        "required_skills": ["Python", "RAG", "Prompt工程", "FastAPI", "向量数据库"],
        "preferred_skills": ["LangChain", "Function Calling"],
        "post_date": "2026-07-18",
        "source": "企业官网",
        "description": "负责企业级大模型应用、知识库问答和业务系统集成。",
    },
    {
        "id": "job_rag",
        "title": "RAG工程师",
        "category": "人工智能",
        "company": "云启数据",
        "industry": "大数据",
        "city": "杭州",
        "salary": "25-50K",
        "required_skills": ["Python", "RAG", "向量数据库", "Prompt工程"],
        "preferred_skills": ["LangChain", "FastAPI"],
        "post_date": "2026-07-16",
        "source": "行业报告",
        "description": "负责检索增强生成链路、文档解析、向量检索和答案评估。",
    },
    {
        "id": "job_ai_algorithm",
        "title": "AI算法工程师",
        "category": "人工智能",
        "company": "深蓝算法",
        "industry": "人工智能",
        "city": "深圳",
        "salary": "30-70K",
        "required_skills": ["Python", "PyTorch", "Transformer", "RAG"],
        "preferred_skills": ["多智能体协作", "Prompt工程"],
        "post_date": "2026-07-13",
        "source": "BOSS直聘",
        "description": "负责模型训练、算法优化和大模型应用落地。",
    },
    {
        "id": "job_java_backend",
        "title": "Java后端工程师",
        "category": "后端开发",
        "company": "启明星云",
        "industry": "互联网",
        "city": "广州",
        "salary": "18-35K",
        "required_skills": ["Java", "Spring Boot", "MySQL", "Redis"],
        "preferred_skills": ["Kubernetes", "RAG"],
        "post_date": "2026-07-10",
        "source": "企业官网",
        "description": "负责后端服务开发、数据库设计和云原生系统维护。",
    },
]


NEW_JOBS = [
    {
        "id": "new_001",
        "title": "AI Agent工程师",
        "category": "人工智能",
        "confidence": 96,
        "growth_rate": 238,
        "status": "pending",
        "discovered_at": "2026-07-26 16:20:00",
        "core_skills": ["Python", "RAG", "LangChain", "Function Calling", "多智能体协作"],
        "preferred_skills": ["向量数据库", "Prompt工程", "FastAPI"],
        "definition": "负责基于大模型构建智能体应用，完成任务规划、工具调用、知识检索和多智能体协作流程设计。",
        "typical_scenarios": ["智能客服", "企业知识库", "自动化办公", "招聘问答助手"],
        "evidence_sources": [
            {
                "source_name": "BOSS直聘",
                "source_type": "招聘平台",
                "published_at": "2026-07-20",
                "snippet": "熟悉 LangChain、RAG、Agent 工具调用者优先",
            },
            {
                "source_name": "AI行业报告",
                "source_type": "行业报告",
                "published_at": "2026-06-15",
                "snippet": "智能体应用工程化能力成为企业大模型落地关键",
            },
        ],
        "responsibilities": [
            "设计智能体任务规划流程",
            "接入外部工具和业务系统",
            "构建RAG知识检索链路",
            "优化多轮对话和任务执行效果",
        ],
        "trend": [
            {"month": "2026-02", "count": 18},
            {"month": "2026-03", "count": 25},
            {"month": "2026-04", "count": 41},
            {"month": "2026-05", "count": 69},
            {"month": "2026-06", "count": 103},
            {"month": "2026-07", "count": 136},
        ],
        "quality": {
            "evidence_count": 18,
            "source_count": 4,
            "duplicate_rate": 6.2,
            "freshness_score": 95,
        },
    },
    {
        "id": "new_002",
        "title": "RAG工程师",
        "category": "人工智能",
        "confidence": 93,
        "growth_rate": 186,
        "status": "adopted",
        "discovered_at": "2026-07-25 11:40:00",
        "core_skills": ["Python", "RAG", "向量数据库", "Prompt工程"],
        "preferred_skills": ["LangChain", "FastAPI"],
        "definition": "负责企业知识库、文档检索、向量召回和生成答案评估。",
        "typical_scenarios": ["知识库问答", "政策检索", "报告分析"],
        "evidence_sources": [],
        "responsibilities": ["文档解析", "向量检索", "检索链路评估", "答案质量优化"],
        "trend": [
            {"month": "2026-02", "count": 22},
            {"month": "2026-03", "count": 31},
            {"month": "2026-04", "count": 46},
            {"month": "2026-05", "count": 72},
            {"month": "2026-06", "count": 91},
            {"month": "2026-07", "count": 118},
        ],
        "quality": {
            "evidence_count": 14,
            "source_count": 3,
            "duplicate_rate": 5.1,
            "freshness_score": 92,
        },
    },
]


CLEANING_SAMPLES = [
    {
        "raw_title": "高级AI Agent开发/大模型应用工程师",
        "normalized_title": "AI Agent工程师",
        "raw_salary": "30k-60k·15薪",
        "salary_min": 30000,
        "salary_max": 60000,
        "skills": ["Python", "RAG", "LangChain", "Function Calling"],
        "source": "BOSS直聘",
        "quality_score": 94,
        "duplicate_status": "unique",
        "freshness_status": "fresh",
    },
    {
        "raw_title": "Java开发工程师/后端研发",
        "normalized_title": "Java后端工程师",
        "raw_salary": "18-35K",
        "salary_min": 18000,
        "salary_max": 35000,
        "skills": ["Java", "Spring Boot", "MySQL", "Redis"],
        "source": "企业官网",
        "quality_score": 89,
        "duplicate_status": "merged",
        "freshness_status": "aging",
    },
]


GRAPH_NODES = [
    {
        "id": "job_ai_agent",
        "label": "AI Agent工程师",
        "type": "job",
        "size": 48,
        "properties": {"category": "人工智能", "level": "中高级", "hot_score": 96},
    },
    {
        "id": "job_llm_app",
        "label": "大模型应用工程师",
        "type": "job",
        "size": 44,
        "properties": {"category": "人工智能", "level": "中高级", "hot_score": 91},
    },
    {
        "id": "job_rag",
        "label": "RAG工程师",
        "type": "job",
        "size": 42,
        "properties": {"category": "人工智能", "level": "中级", "hot_score": 89},
    },
    {
        "id": "job_java_backend",
        "label": "Java后端工程师",
        "type": "job",
        "size": 38,
        "properties": {"category": "后端开发", "level": "中级", "hot_score": 76},
    },
    {"id": "skill_python", "label": "Python", "type": "skill", "size": 34, "properties": {"hot_score": 94}},
    {"id": "skill_rag", "label": "RAG", "type": "skill", "size": 36, "properties": {"hot_score": 92}},
    {"id": "skill_langchain", "label": "LangChain", "type": "skill", "size": 30, "properties": {"hot_score": 86}},
    {
        "id": "skill_function_calling",
        "label": "Function Calling",
        "type": "skill",
        "size": 30,
        "properties": {"hot_score": 84},
    },
    {"id": "skill_java", "label": "Java", "type": "skill", "size": 32, "properties": {"hot_score": 80}},
    {"id": "industry_ai", "label": "人工智能", "type": "industry", "size": 32, "properties": {"job_count": 326}},
    {"id": "industry_big_data", "label": "大数据", "type": "industry", "size": 28, "properties": {"job_count": 148}},
    {"id": "company_future", "label": "智造未来科技", "type": "company", "size": 26, "properties": {"city": "北京"}},
    {"id": "source_boss", "label": "BOSS直聘", "type": "source", "size": 24, "properties": {"type": "招聘平台"}},
]


GRAPH_EDGES = [
    {"source": "job_ai_agent", "target": "skill_python", "label": "需要", "type": "requires", "weight": 0.94},
    {"source": "job_ai_agent", "target": "skill_rag", "label": "需要", "type": "requires", "weight": 0.92},
    {"source": "job_ai_agent", "target": "skill_langchain", "label": "需要", "type": "requires", "weight": 0.88},
    {"source": "job_ai_agent", "target": "skill_function_calling", "label": "需要", "type": "requires", "weight": 0.86},
    {"source": "job_llm_app", "target": "skill_rag", "label": "需要", "type": "requires", "weight": 0.9},
    {"source": "job_rag", "target": "skill_rag", "label": "核心技能", "type": "requires", "weight": 0.96},
    {"source": "job_java_backend", "target": "skill_java", "label": "需要", "type": "requires", "weight": 0.91},
    {"source": "job_ai_agent", "target": "industry_ai", "label": "应用于", "type": "applies_to", "weight": 0.86},
    {"source": "job_rag", "target": "industry_big_data", "label": "应用于", "type": "applies_to", "weight": 0.78},
    {"source": "company_future", "target": "job_ai_agent", "label": "发布", "type": "posted", "weight": 0.8},
    {"source": "source_boss", "target": "job_ai_agent", "label": "来源", "type": "from_source", "weight": 0.7},
]


def graph_stats(nodes=None, edges=None):
    nodes = nodes or GRAPH_NODES
    edges = edges or GRAPH_EDGES
    return {
        "node_count": len(nodes),
        "edge_count": len(edges),
        "job_count": sum(1 for node in nodes if node["type"] == "job"),
        "skill_count": sum(1 for node in nodes if node["type"] == "skill"),
        "industry_count": sum(1 for node in nodes if node["type"] == "industry"),
    }


def get_graph_payload(nodes=None, edges=None):
    nodes = deepcopy(nodes or GRAPH_NODES)
    edges = deepcopy(edges or GRAPH_EDGES)
    return {"nodes": nodes, "edges": edges, "stats": graph_stats(nodes, edges)}


def get_job_subgraph(job_id):
    related_edges = [
        edge for edge in GRAPH_EDGES if edge["source"] == job_id or edge["target"] == job_id
    ]
    node_ids = {job_id}
    for edge in related_edges:
        node_ids.add(edge["source"])
        node_ids.add(edge["target"])
    nodes = [node for node in GRAPH_NODES if node["id"] in node_ids]
    return get_graph_payload(nodes, related_edges)


EVOLUTION_PROFILES = [
    {
        "job_id": "Java开发工程师",
        "job_title": "Java开发工程师",
        "cat": "后端",
        "jdCount": 1420,
        "summary": "Java开发岗位正从传统单体开发向云原生、AI集成方向演进，Spring Cloud Alibaba需求暴涨347%，Spring AI与OpenTelemetry成为新标配，Struts2/EJB等旧技术栈快速出局。",
        "period": "2026-02 至 2026-07",
        "trend": [
            {"month": "2026-02", "demand_index": 68, "job_count": 118},
            {"month": "2026-03", "demand_index": 70, "job_count": 124},
            {"month": "2026-04", "demand_index": 73, "job_count": 136},
            {"month": "2026-05", "demand_index": 76, "job_count": 145},
            {"month": "2026-06", "demand_index": 80, "job_count": 158},
            {"month": "2026-07", "demand_index": 85, "job_count": 172}
        ],
        "added": [
            {"name": "Spring Cloud Alibaba", "version": "v2026.1", "growth": "+347%"},
            {"name": "GraalVM Native Image", "version": "新出现", "growth": "+128"},
            {"name": "JDK 21 Virtual Thread", "version": "v17→v21", "growth": "+89%"},
            {"name": "Spring AI", "version": "新出现", "growth": "+147"},
            {"name": "OpenTelemetry", "version": "新出现", "growth": "+52"},
            {"name": "eBPF", "version": "新出现", "growth": "+45"}
        ],
        "removed": [
            {"name": "Struts2", "version": "已废弃", "decline": "-89%"},
            {"name": "EJB", "version": "已废弃", "decline": "-95%"},
            {"name": "JSP", "version": "边缘化", "decline": "-72%"},
            {"name": "SOAP", "version": "边缘化", "decline": "-58%"}
        ],
        "modified": [
            {"name": "微服务架构", "change": "中级→高级", "weight": "+18%"},
            {"name": "MySQL", "change": "加分→必备", "weight": "↑"},
            {"name": "Redis", "change": "加分→必备", "weight": "↑"},
            {"name": "Kafka", "change": "加分→必备", "weight": "↑"},
            {"name": "Kubernetes", "change": "加分→必备", "weight": "↑"}
        ],
        "hotSkills": ["Spring Cloud", "JDK 21", "OpenTelemetry", "GraalVM", "Kafka", "Redis", "MySQL", "Kubernetes", "Docker", "JVM调优"],
        "hotValues": [387, 289, 152, 128, 210, 198, 176, 168, 154, 132],
        "trendMust": [18, 19, 19, 20, 21, 22, 23, 24, 25, 26, 28, 30],
        "trendNice": [12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28],
        "forecast": [
            {"month": "2026-08", "demand_index": 88},
            {"month": "2026-09", "demand_index": 91},
            {"month": "2026-10", "demand_index": 95}
        ]
    },
    {
        "job_id": "前端开发工程师",
        "job_title": "前端开发工程师",
        "cat": "前端",
        "jdCount": 1180,
        "summary": "前端开发正从传统SPA向全栈SSR/SSG架构转型，React Server Components和Next.js App Router成为新一代标配，TypeScript已成硬性门槛，jQuery/Grunt等旧工具链快速退场。",
        "period": "2026-02 至 2026-07",
        "trend": [
            {"month": "2026-02", "demand_index": 72, "job_count": 95},
            {"month": "2026-03", "demand_index": 74, "job_count": 102},
            {"month": "2026-04", "demand_index": 76, "job_count": 115},
            {"month": "2026-05", "demand_index": 79, "job_count": 120},
            {"month": "2026-06", "demand_index": 83, "job_count": 133},
            {"month": "2026-07", "demand_index": 86, "job_count": 148}
        ],
        "added": [
            {"name": "React Server Components", "version": "新出现", "growth": "+210%"},
            {"name": "Next.js App Router", "version": "v13→v15", "growth": "+168%"},
            {"name": "Vite 6", "version": "新出现", "growth": "+92%"},
            {"name": "WebGPU", "version": "新出现", "growth": "+64%"},
            {"name": "Astro", "version": "新出现", "growth": "+71%"},
            {"name": "Tailwind v4", "version": "新出现", "growth": "+55%"}
        ],
        "removed": [
            {"name": "jQuery", "version": "边缘化", "decline": "-78%"},
            {"name": "Grunt", "version": "已废弃", "decline": "-91%"},
            {"name": "Bower", "version": "已废弃", "decline": "-96%"},
            {"name": "AngularJS 1.x", "version": "已废弃", "decline": "-88%"}
        ],
        "modified": [
            {"name": "TypeScript", "change": "加分→必备", "weight": "↑"},
            {"name": "React", "change": "中级→高级", "weight": "+22%"},
            {"name": "工程化", "change": "加分→必备", "weight": "↑"},
            {"name": "性能优化", "change": "加分→必备", "weight": "↑"},
            {"name": "微前端", "change": "选修→加分", "weight": "↑"}
        ],
        "hotSkills": ["TypeScript", "React 19", "Next.js", "Vite", "Vue3", "CSS-in-JS", "Webpack", "Node.js", "Playwright", "WebGPU"],
        "hotValues": [410, 360, 298, 240, 220, 180, 165, 150, 120, 95],
        "trendMust": [16, 17, 18, 19, 20, 22, 23, 24, 26, 27, 29, 31],
        "trendNice": [14, 15, 16, 17, 19, 20, 22, 24, 25, 27, 29, 32],
        "forecast": [
            {"month": "2026-08", "demand_index": 89},
            {"month": "2026-09", "demand_index": 93},
            {"month": "2026-10", "demand_index": 97}
        ]
    },
    {
        "job_id": "Python数据分析师",
        "job_title": "Python数据分析师",
        "cat": "数据",
        "jdCount": 860,
        "summary": "数据分析师岗位正从传统BI向现代数据栈转型，DuckDB/Polars等新一代分析引擎崛起，LLM for Analytics成为增长最快的能力要求，SPSS/SAS等传统工具需求持续下降。",
        "period": "2026-02 至 2026-07",
        "trend": [
            {"month": "2026-02", "demand_index": 58, "job_count": 68},
            {"month": "2026-03", "demand_index": 60, "job_count": 73},
            {"month": "2026-04", "demand_index": 63, "job_count": 82},
            {"month": "2026-05", "demand_index": 65, "job_count": 89},
            {"month": "2026-06", "demand_index": 68, "job_count": 95},
            {"month": "2026-07", "demand_index": 72, "job_count": 105}
        ],
        "added": [
            {"name": "DuckDB", "version": "新出现", "growth": "+190%"},
            {"name": "Polars", "version": "新出现", "growth": "+156%"},
            {"name": "dbt", "version": "新出现", "growth": "+112%"},
            {"name": "Lakehouse", "version": "新出现", "growth": "+88%"},
            {"name": "LLM for Analytics", "version": "新出现", "growth": "+134%"}
        ],
        "removed": [
            {"name": "SPSS", "version": "边缘化", "decline": "-62%"},
            {"name": "Excel宏主导", "version": "边缘化", "decline": "-48%"},
            {"name": "SAS基础岗", "version": "下降", "decline": "-41%"}
        ],
        "modified": [
            {"name": "SQL", "change": "必备→专家", "weight": "↑"},
            {"name": "Python", "change": "中级→高级", "weight": "+15%"},
            {"name": "可视化", "change": "加分→必备", "weight": "↑"},
            {"name": "A/B测试", "change": "加分→必备", "weight": "↑"}
        ],
        "hotSkills": ["SQL", "Python", "Pandas", "Polars", "dbt", "Tableau", "PowerBI", "Spark", "Airflow", "统计建模"],
        "hotValues": [420, 380, 310, 260, 210, 190, 175, 160, 140, 125],
        "trendMust": [14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25, 27],
        "trendNice": [10, 11, 12, 13, 14, 15, 16, 18, 19, 21, 23, 25],
        "forecast": [
            {"month": "2026-08", "demand_index": 74},
            {"month": "2026-09", "demand_index": 77},
            {"month": "2026-10", "demand_index": 80}
        ]
    },
    {
        "job_id": "AI算法工程师",
        "job_title": "AI算法工程师",
        "cat": "AI",
        "jdCount": 1560,
        "summary": "AI算法工程师是演化最剧烈的岗位，LLM应用工程需求暴增420%，RAG和Agent成为必备能力，传统SVM/浅层特征工程岗加速淘汰，PyTorch和分布式训练从加分变为硬门槛。",
        "period": "2026-02 至 2026-07",
        "trend": [
            {"month": "2026-02", "demand_index": 62, "job_count": 110},
            {"month": "2026-03", "demand_index": 66, "job_count": 125},
            {"month": "2026-04", "demand_index": 72, "job_count": 148},
            {"month": "2026-05", "demand_index": 78, "job_count": 172},
            {"month": "2026-06", "demand_index": 85, "job_count": 198},
            {"month": "2026-07", "demand_index": 92, "job_count": 228}
        ],
        "added": [
            {"name": "LLM 应用工程", "version": "新出现", "growth": "+420%"},
            {"name": "RAG", "version": "新出现", "growth": "+310%"},
            {"name": "Agent / Tool Use", "version": "新出现", "growth": "+280%"},
            {"name": "LoRA / PEFT", "version": "新出现", "growth": "+195%"},
            {"name": "vLLM", "version": "新出现", "growth": "+160%"},
            {"name": "多模态", "version": "新出现", "growth": "+148%"}
        ],
        "removed": [
            {"name": "传统SVM主岗", "version": "边缘化", "decline": "-55%"},
            {"name": "浅层特征工程岗", "version": "下降", "decline": "-43%"},
            {"name": "纯规则引擎", "version": "边缘化", "decline": "-60%"}
        ],
        "modified": [
            {"name": "PyTorch", "change": "加分→必备", "weight": "↑"},
            {"name": "深度学习", "change": "中级→高级", "weight": "+25%"},
            {"name": "CUDA", "change": "选修→加分", "weight": "↑"},
            {"name": "分布式训练", "change": "加分→必备", "weight": "↑"}
        ],
        "hotSkills": ["LLM", "PyTorch", "RAG", "Transformer", "CUDA", "LoRA", "Agent", "向量检索", "Python", "MLSys"],
        "hotValues": [480, 420, 390, 340, 280, 260, 240, 210, 190, 150],
        "trendMust": [20, 22, 24, 26, 28, 30, 33, 36, 38, 41, 44, 48],
        "trendNice": [15, 16, 18, 20, 22, 25, 28, 30, 33, 36, 40, 44],
        "forecast": [
            {"month": "2026-08", "demand_index": 98},
            {"month": "2026-09", "demand_index": 105},
            {"month": "2026-10", "demand_index": 113}
        ]
    },
    {
        "job_id": "产品经理",
        "job_title": "产品经理",
        "cat": "产品",
        "jdCount": 980,
        "summary": "产品经理岗位正从传统需求文档驱动转向AI+数据双轮驱动，AI产品设计能力增长260%，Prompt产品化成为全新能力赛道，纯画线框式交付模式加速淘汰。",
        "period": "2026-02 至 2026-07",
        "trend": [
            {"month": "2026-02", "demand_index": 55, "job_count": 78},
            {"month": "2026-03", "demand_index": 57, "job_count": 82},
            {"month": "2026-04", "demand_index": 58, "job_count": 88},
            {"month": "2026-05", "demand_index": 60, "job_count": 92},
            {"month": "2026-06", "demand_index": 63, "job_count": 98},
            {"month": "2026-07", "demand_index": 65, "job_count": 105}
        ],
        "added": [
            {"name": "AI 产品设计", "version": "新出现", "growth": "+260%"},
            {"name": "Prompt 产品化", "version": "新出现", "growth": "+180%"},
            {"name": "数据闭环设计", "version": "新出现", "growth": "+95%"},
            {"name": "增长实验平台", "version": "新出现", "growth": "+72%"}
        ],
        "removed": [
            {"name": "纯画线框交付", "version": "边缘化", "decline": "-50%"},
            {"name": "无数据决策", "version": "下降", "decline": "-66%"}
        ],
        "modified": [
            {"name": "用户研究", "change": "加分→必备", "weight": "↑"},
            {"name": "数据分析", "change": "加分→必备", "weight": "↑"},
            {"name": "商业Sense", "change": "中级→高级", "weight": "+12%"}
        ],
        "hotSkills": ["需求分析", "AI产品", "数据分析", "用户研究", "Roadmap", "SQL基础", "A/B测试", "竞品分析", "PRD", "跨团队协作"],
        "hotValues": [360, 320, 280, 250, 220, 180, 170, 160, 150, 140],
        "trendMust": [12, 13, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
        "trendNice": [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21],
        "forecast": [
            {"month": "2026-08", "demand_index": 67},
            {"month": "2026-09", "demand_index": 70},
            {"month": "2026-10", "demand_index": 73}
        ]
    },
    {
        "job_id": "运维工程师",
        "job_title": "运维工程师",
        "cat": "运维",
        "jdCount": 720,
        "summary": "运维岗位正从传统手工运维向平台工程和GitOps转型，Platform Engineering增长170%，eBPF可观测性成为新标配，纯手工部署模式被彻底淘汰。",
        "period": "2026-02 至 2026-07",
        "trend": [
            {"month": "2026-02", "demand_index": 50, "job_count": 58},
            {"month": "2026-03", "demand_index": 52, "job_count": 62},
            {"month": "2026-04", "demand_index": 54, "job_count": 68},
            {"month": "2026-05", "demand_index": 56, "job_count": 73},
            {"month": "2026-06", "demand_index": 59, "job_count": 78},
            {"month": "2026-07", "demand_index": 62, "job_count": 85}
        ],
        "added": [
            {"name": "Platform Engineering", "version": "新出现", "growth": "+170%"},
            {"name": "GitOps", "version": "新出现", "growth": "+130%"},
            {"name": "eBPF Observability", "version": "新出现", "growth": "+98%"},
            {"name": "FinOps", "version": "新出现", "growth": "+76%"}
        ],
        "removed": [
            {"name": "纯手工部署", "version": "已废弃", "decline": "-82%"},
            {"name": "无监控值班", "version": "下降", "decline": "-70%"}
        ],
        "modified": [
            {"name": "Kubernetes", "change": "加分→必备", "weight": "↑"},
            {"name": "IaC", "change": "选修→必备", "weight": "↑"},
            {"name": "SRE实践", "change": "加分→中级", "weight": "↑"}
        ],
        "hotSkills": ["Kubernetes", "Terraform", "Prometheus", "Grafana", "Linux", "CI/CD", "Ansible", "Istio", "AWS", "SRE"],
        "hotValues": [350, 300, 270, 250, 240, 220, 190, 170, 160, 145],
        "trendMust": [13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26],
        "trendNice": [10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 23],
        "forecast": [
            {"month": "2026-08", "demand_index": 64},
            {"month": "2026-09", "demand_index": 67},
            {"month": "2026-10", "demand_index": 70}
        ]
    },
    {
        "job_id": "测试工程师",
        "job_title": "测试工程师",
        "cat": "测试",
        "jdCount": 640,
        "summary": "测试工程师正从手工执行向智能化质量保障转型，AI辅助测试增长200%，契约测试和混沌工程成为新能力方向，纯手工点点点模式加速淘汰。",
        "period": "2026-02 至 2026-07",
        "trend": [
            {"month": "2026-02", "demand_index": 44, "job_count": 50},
            {"month": "2026-03", "demand_index": 46, "job_count": 54},
            {"month": "2026-04", "demand_index": 47, "job_count": 58},
            {"month": "2026-05", "demand_index": 49, "job_count": 63},
            {"month": "2026-06", "demand_index": 52, "job_count": 68},
            {"month": "2026-07", "demand_index": 55, "job_count": 75}
        ],
        "added": [
            {"name": "AI 辅助测试", "version": "新出现", "growth": "+200%"},
            {"name": "契约测试", "version": "新出现", "growth": "+110%"},
            {"name": "Chaos Engineering", "version": "新出现", "growth": "+85%"},
            {"name": "质量门禁左移", "version": "新出现", "growth": "+90%"}
        ],
        "removed": [
            {"name": "纯手工点点点", "version": "边缘化", "decline": "-58%"},
            {"name": "无自动化报表", "version": "下降", "decline": "-47%"}
        ],
        "modified": [
            {"name": "自动化测试", "change": "加分→必备", "weight": "↑"},
            {"name": "接口测试", "change": "中级→高级", "weight": "↑"},
            {"name": "性能测试", "change": "选修→加分", "weight": "↑"}
        ],
        "hotSkills": ["自动化测试", "Playwright", "接口测试", "CI质量门禁", "性能测试", "Python", "Java", "Appium", "Mock", "测试设计"],
        "hotValues": [330, 290, 260, 230, 200, 180, 170, 150, 140, 130],
        "trendMust": [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23],
        "trendNice": [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20],
        "forecast": [
            {"month": "2026-08", "demand_index": 57},
            {"month": "2026-09", "demand_index": 60},
            {"month": "2026-10", "demand_index": 63}
        ]
    },
    {
        "job_id": "UI设计师",
        "job_title": "UI设计师",
        "cat": "设计",
        "jdCount": 510,
        "summary": "UI设计师正从视觉执行向设计系统工程化转型，AI设计协作增长240%，Design System Token成为新标配，切图工厂模式快速退场。",
        "period": "2026-02 至 2026-07",
        "trend": [
            {"month": "2026-02", "demand_index": 40, "job_count": 40},
            {"month": "2026-03", "demand_index": 41, "job_count": 43},
            {"month": "2026-04", "demand_index": 42, "job_count": 46},
            {"month": "2026-05", "demand_index": 44, "job_count": 50},
            {"month": "2026-06", "demand_index": 46, "job_count": 55},
            {"month": "2026-07", "demand_index": 48, "job_count": 58}
        ],
        "added": [
            {"name": "AI 设计协作", "version": "新出现", "growth": "+240%"},
            {"name": "Design System Token", "version": "新出现", "growth": "+120%"},
            {"name": "动效工程化", "version": "新出现", "growth": "+80%"}
        ],
        "removed": [
            {"name": "切图工厂模式", "version": "边缘化", "decline": "-65%"},
            {"name": "无组件库交付", "version": "下降", "decline": "-52%"}
        ],
        "modified": [
            {"name": "Figma", "change": "加分→必备", "weight": "↑"},
            {"name": "交互设计", "change": "中级→高级", "weight": "↑"},
            {"name": "可用性测试", "change": "选修→加分", "weight": "↑"}
        ],
        "hotSkills": ["Figma", "设计系统", "交互设计", "视觉设计", "原型", "动效", "用户体验", "组件库", "插画", "AI作图"],
        "hotValues": [300, 270, 240, 210, 190, 170, 160, 140, 120, 100],
        "trendMust": [10, 11, 11, 12, 13, 14, 14, 15, 16, 17, 18, 19],
        "trendNice": [8, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
        "forecast": [
            {"month": "2026-08", "demand_index": 50},
            {"month": "2026-09", "demand_index": 52},
            {"month": "2026-10", "demand_index": 55}
        ]
    },
    {
        "job_id": "数据科学家",
        "job_title": "数据科学家",
        "cat": "数据",
        "jdCount": 890,
        "summary": "数据科学家正从离线建模向端到端ML体系升级，因果推断和Feature Store成为新标配，LLM Evaluation增长175%反映大模型评估需求激增，纯离线报表岗逐步退场。",
        "period": "2026-02 至 2026-07",
        "trend": [
            {"month": "2026-02", "demand_index": 56, "job_count": 70},
            {"month": "2026-03", "demand_index": 58, "job_count": 76},
            {"month": "2026-04", "demand_index": 61, "job_count": 85},
            {"month": "2026-05", "demand_index": 64, "job_count": 92},
            {"month": "2026-06", "demand_index": 68, "job_count": 100},
            {"month": "2026-07", "demand_index": 72, "job_count": 108}
        ],
        "added": [
            {"name": "Causal Inference", "version": "新出现", "growth": "+150%"},
            {"name": "Feature Store", "version": "新出现", "growth": "+125%"},
            {"name": "LLM Evaluation", "version": "新出现", "growth": "+175%"},
            {"name": "MLOps", "version": "新出现", "growth": "+140%"}
        ],
        "removed": [
            {"name": "纯离线报表岗", "version": "边缘化", "decline": "-45%"},
            {"name": "无线上闭环", "version": "下降", "decline": "-50%"}
        ],
        "modified": [
            {"name": "机器学习", "change": "中级→高级", "weight": "+20%"},
            {"name": "实验设计", "change": "加分→必备", "weight": "↑"},
            {"name": "特征工程", "change": "加分→必备", "weight": "↑"}
        ],
        "hotSkills": ["机器学习", "Python", "实验设计", "特征工程", "MLOps", "统计推断", "Spark", "SQL", "模型评估", "因果推断"],
        "hotValues": [400, 360, 300, 280, 250, 230, 200, 180, 160, 145],
        "trendMust": [15, 16, 17, 18, 20, 21, 23, 24, 26, 28, 30, 32],
        "trendNice": [12, 13, 14, 15, 16, 18, 19, 21, 23, 25, 27, 29],
        "forecast": [
            {"month": "2026-08", "demand_index": 75},
            {"month": "2026-09", "demand_index": 79},
            {"month": "2026-10", "demand_index": 83}
        ]
    },
    {
        "job_id": "DevOps工程师",
        "job_title": "DevOps工程师",
        "cat": "运维",
        "jdCount": 780,
        "summary": "DevOps工程师正从CI/CD执行向内部开发者平台建设转型，Internal Developer Platform增长185%，供应链安全和WASM Edge成为新方向，脚本堆砌式发布被淘汰。",
        "period": "2026-02 至 2026-07",
        "trend": [
            {"month": "2026-02", "demand_index": 52, "job_count": 62},
            {"month": "2026-03", "demand_index": 54, "job_count": 67},
            {"month": "2026-04", "demand_index": 56, "job_count": 73},
            {"month": "2026-05", "demand_index": 59, "job_count": 78},
            {"month": "2026-06", "demand_index": 62, "job_count": 85},
            {"month": "2026-07", "demand_index": 65, "job_count": 92}
        ],
        "added": [
            {"name": "Internal Developer Platform", "version": "新出现", "growth": "+185%"},
            {"name": "Policy as Code", "version": "新出现", "growth": "+115%"},
            {"name": "Supply Chain Security", "version": "新出现", "growth": "+102%"},
            {"name": "WASM Edge", "version": "新出现", "growth": "+68%"}
        ],
        "removed": [
            {"name": "脚本堆砌发布", "version": "已废弃", "decline": "-75%"},
            {"name": "无GitOps", "version": "下降", "decline": "-60%"}
        ],
        "modified": [
            {"name": "CI/CD", "change": "中级→专家", "weight": "↑"},
            {"name": "Kubernetes", "change": "加分→必备", "weight": "↑"},
            {"name": "可观测性", "change": "加分→必备", "weight": "↑"}
        ],
        "hotSkills": ["CI/CD", "Kubernetes", "Terraform", "GitOps", "Docker", "Prometheus", "ArgoCD", "Security", "Linux", "云原生"],
        "hotValues": [370, 340, 300, 270, 250, 230, 200, 180, 170, 155],
        "trendMust": [14, 15, 16, 17, 18, 20, 21, 23, 24, 26, 28, 30],
        "trendNice": [11, 12, 13, 14, 15, 16, 18, 19, 21, 22, 24, 26],
        "forecast": [
            {"month": "2026-08", "demand_index": 68},
            {"month": "2026-09", "demand_index": 72},
            {"month": "2026-10", "demand_index": 76}
        ]
    }
]
