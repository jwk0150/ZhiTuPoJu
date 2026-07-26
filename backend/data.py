from copy import deepcopy


def ok(data):
    return {"code": 0, "message": "success", "data": data}


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
        "job_id": "job_ai_agent",
        "job_title": "AI Agent工程师",
        "summary": "AI Agent工程师近半年需求快速上升，企业更关注RAG、工具调用、多智能体协作和业务系统集成能力。",
        "period": "2026-02 至 2026-07",
        "trend": [
            {"month": "2026-02", "demand_index": 42, "job_count": 18},
            {"month": "2026-03", "demand_index": 51, "job_count": 25},
            {"month": "2026-04", "demand_index": 63, "job_count": 41},
            {"month": "2026-05", "demand_index": 76, "job_count": 69},
            {"month": "2026-06", "demand_index": 88, "job_count": 103},
            {"month": "2026-07", "demand_index": 96, "job_count": 136}
        ],
        "added_skills": [
            {"name": "Function Calling", "growth": "+214%", "evidence_count": 31},
            {"name": "多智能体协作", "growth": "+186%", "evidence_count": 24},
            {"name": "工具调用编排", "growth": "+173%", "evidence_count": 22},
            {"name": "Agent评测", "growth": "+126%", "evidence_count": 17}
        ],
        "weakened_skills": [
            {"name": "单轮Prompt编写", "decline": "-32%", "reason": "岗位要求从提示词编写转向完整Agent系统设计"},
            {"name": "纯关键词检索", "decline": "-28%", "reason": "RAG和语义检索成为主流要求"}
        ],
        "changed_skills": [
            {"name": "RAG", "change": "加分项 -> 核心必备", "weight_change": "+26%"},
            {"name": "LangChain", "change": "了解 -> 熟练应用", "weight_change": "+18%"},
            {"name": "Prompt工程", "change": "单点技能 -> 评测与优化体系", "weight_change": "+15%"}
        ],
        "forecast": [
            {"month": "2026-08", "demand_index": 102},
            {"month": "2026-09", "demand_index": 109},
            {"month": "2026-10", "demand_index": 117}
        ]
    },
    {
        "job_id": "job_java_backend",
        "job_title": "Java后端工程师",
        "summary": "Java后端岗位正在从传统业务开发转向云原生、微服务治理和AI应用集成。",
        "period": "2026-02 至 2026-07",
        "trend": [
            {"month": "2026-02", "demand_index": 70, "job_count": 96},
            {"month": "2026-03", "demand_index": 72, "job_count": 104},
            {"month": "2026-04", "demand_index": 74, "job_count": 116},
            {"month": "2026-05", "demand_index": 78, "job_count": 121},
            {"month": "2026-06", "demand_index": 82, "job_count": 134},
            {"month": "2026-07", "demand_index": 86, "job_count": 149}
        ],
        "added_skills": [
            {"name": "Kubernetes", "growth": "+88%", "evidence_count": 29},
            {"name": "OpenTelemetry", "growth": "+63%", "evidence_count": 18},
            {"name": "Spring AI", "growth": "+147%", "evidence_count": 21},
            {"name": "云原生部署", "growth": "+76%", "evidence_count": 25}
        ],
        "weakened_skills": [
            {"name": "JSP", "decline": "-72%", "reason": "传统服务端页面开发需求下降"},
            {"name": "Struts2", "decline": "-89%", "reason": "旧框架逐渐被Spring生态替代"}
        ],
        "changed_skills": [
            {"name": "Spring Boot", "change": "基础要求 -> 项目治理能力", "weight_change": "+12%"},
            {"name": "Redis", "change": "加分项 -> 必备", "weight_change": "+16%"},
            {"name": "MySQL", "change": "使用能力 -> 性能优化能力", "weight_change": "+14%"}
        ],
        "forecast": [
            {"month": "2026-08", "demand_index": 88},
            {"month": "2026-09", "demand_index": 91},
            {"month": "2026-10", "demand_index": 94}
        ]
    }
]
