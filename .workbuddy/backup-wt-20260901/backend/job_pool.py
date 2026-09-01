# -*- coding: utf-8 -*-
"""
新一代信息技术全景岗位体系 + 城市规模分级（智途破局）
====================================================
为市级岗位分析提供：
1. 覆盖 8 大方向的 85+ 种数字岗位（含技能、热度、产业标签）
2. 城市规模分级：超大型/大型/中等/小型城市的岗位数量与类型目标
3. 城市产业差异：按省份主导产业选择岗位池子集，避免所有城市岗位集合雷同

设计原则：
- 不同城市允许存在相同岗位（Java/前端/Python 多城市出现是合理的），
  但岗位集合与展示顺序必须存在城市间差异。
- 同一岗位可存在多条招聘记录，但公司/薪资/学历/经验/描述各不相同。
- 岗位数量根据城市规模分级：大城市明显多于小城市，任何城市不低于 20 条。
"""

# ---------------------------------------------------------------------------
# 全景岗位池：8 大方向，85 种岗位
# 字段说明：
#   title    : 岗位名称
#   cat      : 8 大方向分类（作为 industry_tags 之一，供行业分布/筛选使用）
#   skills   : 技能列表（供知识图谱使用）
#   hot      : 基准热度 0.5~1.0（用于排序权重与生成加权）
#   ind_tags : 产业标签（对齐 seed_city_jobs.PROVINCE_INDUSTRIES 键，用于按城市产业筛选）
# ---------------------------------------------------------------------------

JOB_POOL = [
    # ========== 软件开发 ==========
    {"title": "Java开发工程师", "cat": "软件开发", "hot": 0.98,
     "skills": ["Java", "Spring Boot", "MySQL", "Redis", "Git", "Linux"],
     "ind_tags": ["互联网", "软件", "金融科技"]},
    {"title": "Python开发工程师", "cat": "软件开发", "hot": 0.95,
     "skills": ["Python", "Django", "Flask", "MySQL", "Redis", "Git"],
     "ind_tags": ["人工智能", "大数据", "软件", "互联网"]},
    {"title": "C++开发工程师", "cat": "软件开发", "hot": 0.82,
     "skills": ["C++", "STL", "CMake", "Linux", "多线程"],
     "ind_tags": ["集成电路", "智能制造", "软件"]},
    {"title": "Go开发工程师", "cat": "软件开发", "hot": 0.8,
     "skills": ["Go", "Gin", "gRPC", "Docker", "Kubernetes", "MySQL"],
     "ind_tags": ["云计算", "互联网", "软件"]},
    {"title": "后端开发工程师", "cat": "软件开发", "hot": 0.9,
     "skills": ["Java", "Python", "MySQL", "Redis", "分布式", "Linux"],
     "ind_tags": ["互联网", "软件", "金融科技"]},
    {"title": "前端开发工程师", "cat": "软件开发", "hot": 0.96,
     "skills": ["Vue", "React", "TypeScript", "Webpack", "HTML5"],
     "ind_tags": ["互联网", "软件", "数字经济"]},
    {"title": "全栈开发工程师", "cat": "软件开发", "hot": 0.85,
     "skills": ["Vue", "React", "Node.js", "MySQL", "Redis"],
     "ind_tags": ["互联网", "软件"]},
    {"title": "Web开发工程师", "cat": "软件开发", "hot": 0.78,
     "skills": ["HTML5", "CSS3", "JavaScript", "Vue", "TypeScript"],
     "ind_tags": ["互联网", "软件"]},
    {"title": "移动端开发工程师", "cat": "软件开发", "hot": 0.74,
     "skills": ["Android", "Kotlin", "React Native", "Flutter"],
     "ind_tags": ["互联网", "软件"]},
    {"title": "Android开发工程师", "cat": "软件开发", "hot": 0.72,
     "skills": ["Kotlin", "Java", "Android SDK", "Flutter"],
     "ind_tags": ["互联网", "软件"]},
    {"title": "iOS开发工程师", "cat": "软件开发", "hot": 0.68,
     "skills": ["Swift", "Objective-C", "Xcode", "UIKit"],
     "ind_tags": ["互联网", "软件"]},
    {"title": "嵌入式软件工程师", "cat": "软件开发", "hot": 0.8,
     "skills": ["C", "ARM", "RTOS", "Linux", "驱动开发"],
     "ind_tags": ["集成电路", "智能制造", "物联网", "电子信息"]},
    {"title": "软件工程师", "cat": "软件开发", "hot": 0.88,
     "skills": ["Java", "C#", "SQL", "软件工程", "UML"],
     "ind_tags": ["软件", "互联网", "智能制造"]},
    {"title": "应用开发工程师", "cat": "软件开发", "hot": 0.7,
     "skills": ["Java", "Spring", "MySQL", "微服务"],
     "ind_tags": ["软件", "互联网"]},
    {"title": ".NET开发工程师", "cat": "软件开发", "hot": 0.62,
     "skills": ["C#", ".NET Core", "SQL Server", "MVC"],
     "ind_tags": ["软件", "金融科技"]},
    {"title": "测试开发工程师", "cat": "软件开发", "hot": 0.84,
     "skills": ["Python", "Java", "Selenium", "JMeter", "自动化测试"],
     "ind_tags": ["软件", "互联网", "金融科技"]},

    # ========== 数据与人工智能 ==========
    {"title": "数据分析师", "cat": "数据与人工智能", "hot": 0.97,
     "skills": ["SQL", "Python", "Excel", "Tableau", "PowerBI"],
     "ind_tags": ["大数据", "人工智能", "数字经济", "金融科技"]},
    {"title": "数据开发工程师", "cat": "数据与人工智能", "hot": 0.8,
     "skills": ["SQL", "Hadoop", "Spark", "Hive", "数据仓库"],
     "ind_tags": ["大数据", "金融科技"]},
    {"title": "数据工程师", "cat": "数据与人工智能", "hot": 0.82,
     "skills": ["Python", "ETL", "Hadoop", "Spark", "SQL"],
     "ind_tags": ["大数据", "人工智能"]},
    {"title": "大数据开发工程师", "cat": "数据与人工智能", "hot": 0.86,
     "skills": ["Hadoop", "Spark", "Flink", "Hive", "Kafka"],
     "ind_tags": ["大数据", "人工智能", "数字经济"]},
    {"title": "数据仓库工程师", "cat": "数据与人工智能", "hot": 0.72,
     "skills": ["Hive", "Spark", "数仓建模", "ETL", "SQL"],
     "ind_tags": ["大数据", "金融科技"]},
    {"title": "算法工程师", "cat": "数据与人工智能", "hot": 0.9,
     "skills": ["Python", "机器学习", "深度学习", "数据结构"],
     "ind_tags": ["人工智能", "大数据"]},
    {"title": "机器学习工程师", "cat": "数据与人工智能", "hot": 0.83,
     "skills": ["Python", "TensorFlow", "PyTorch", "Scikit-learn"],
     "ind_tags": ["人工智能", "大数据"]},
    {"title": "深度学习工程师", "cat": "数据与人工智能", "hot": 0.76,
     "skills": ["PyTorch", "TensorFlow", "CNN", "RNN", "GPU"],
     "ind_tags": ["人工智能"]},
    {"title": "人工智能工程师", "cat": "数据与人工智能", "hot": 0.87,
     "skills": ["Python", "TensorFlow", "PyTorch", "大模型"],
     "ind_tags": ["人工智能", "互联网"]},
    {"title": "计算机视觉工程师", "cat": "数据与人工智能", "hot": 0.75,
     "skills": ["OpenCV", "PyTorch", "图像处理", "目标检测"],
     "ind_tags": ["人工智能", "智能制造"]},
    {"title": "自然语言处理工程师", "cat": "数据与人工智能", "hot": 0.73,
     "skills": ["Python", "NLP", "BERT", "Transformer", "大模型"],
     "ind_tags": ["人工智能"]},
    {"title": "AI应用工程师", "cat": "数据与人工智能", "hot": 0.79,
     "skills": ["Python", "大模型", "Prompt", "API", "微服务"],
     "ind_tags": ["人工智能", "互联网"]},
    {"title": "数据挖掘工程师", "cat": "数据与人工智能", "hot": 0.71,
     "skills": ["Python", "机器学习", "SQL", "特征工程"],
     "ind_tags": ["大数据", "人工智能"]},
    {"title": "BI工程师", "cat": "数据与人工智能", "hot": 0.7,
     "skills": ["SQL", "Tableau", "PowerBI", "数据可视化", "ETL"],
     "ind_tags": ["大数据", "数字经济", "金融科技"]},
    {"title": "数据治理工程师", "cat": "数据与人工智能", "hot": 0.64,
     "skills": ["元数据", "数据标准", "数据质量", "数据资产"],
     "ind_tags": ["大数据", "金融科技"]},
    {"title": "数据架构师", "cat": "数据与人工智能", "hot": 0.69,
     "skills": ["数据中台", "Hadoop", "Spark", "架构设计", "数据治理"],
     "ind_tags": ["大数据", "金融科技"]},

    # ========== 云计算与基础设施 ==========
    {"title": "云计算工程师", "cat": "云计算与基础设施", "hot": 0.84,
     "skills": ["AWS", "阿里云", "OpenStack", "Kubernetes", "Docker"],
     "ind_tags": ["云计算", "互联网", "数字经济"]},
    {"title": "云平台开发工程师", "cat": "云计算与基础设施", "hot": 0.74,
     "skills": ["Kubernetes", "Docker", "微服务", "分布式"],
     "ind_tags": ["云计算", "互联网"]},
    {"title": "DevOps工程师", "cat": "云计算与基础设施", "hot": 0.82,
     "skills": ["Jenkins", "Docker", "Kubernetes", "CI/CD", "Linux"],
     "ind_tags": ["云计算", "互联网", "软件"]},
    {"title": "运维工程师", "cat": "云计算与基础设施", "hot": 0.83,
     "skills": ["Linux", "Nginx", "Shell", "Zabbix"],
     "ind_tags": ["互联网", "软件", "云计算"]},
    {"title": "Linux运维工程师", "cat": "云计算与基础设施", "hot": 0.7,
     "skills": ["Linux", "Shell", "Ansible", "Zabbix"],
     "ind_tags": ["云计算", "互联网"]},
    {"title": "系统运维工程师", "cat": "云计算与基础设施", "hot": 0.68,
     "skills": ["Linux", "Windows Server", "虚拟化", "监控"],
     "ind_tags": ["软件", "云计算"]},
    {"title": "网络工程师", "cat": "云计算与基础设施", "hot": 0.78,
     "skills": ["网络工程", "路由交换", "防火墙", "HCIA"],
     "ind_tags": ["互联网", "数字经济", "智能制造"]},
    {"title": "云原生工程师", "cat": "云计算与基础设施", "hot": 0.76,
     "skills": ["Kubernetes", "容器", "微服务", "Serverless"],
     "ind_tags": ["云计算", "互联网"]},
    {"title": "容器技术工程师", "cat": "云计算与基础设施", "hot": 0.66,
     "skills": ["Docker", "Kubernetes", "容器编排"],
     "ind_tags": ["云计算"]},
    {"title": "Kubernetes工程师", "cat": "云计算与基础设施", "hot": 0.67,
     "skills": ["Kubernetes", "Docker", "云原生"],
     "ind_tags": ["云计算"]},
    {"title": "系统架构师", "cat": "云计算与基础设施", "hot": 0.77,
     "skills": ["微服务", "分布式", "架构设计", "高并发"],
     "ind_tags": ["软件", "云计算", "互联网"]},

    # ========== 网络安全 ==========
    {"title": "网络安全工程师", "cat": "网络安全", "hot": 0.85,
     "skills": ["渗透测试", "防火墙", "安全加固", "等保"],
     "ind_tags": ["网络安全", "互联网"]},
    {"title": "信息安全工程师", "cat": "网络安全", "hot": 0.78,
     "skills": ["ISO27001", "安全审计", "风险评估"],
     "ind_tags": ["网络安全", "金融科技"]},
    {"title": "安全运维工程师", "cat": "网络安全", "hot": 0.72,
     "skills": ["SOC", "SIEM", "入侵检测", "安全监控"],
     "ind_tags": ["网络安全", "云计算"]},
    {"title": "渗透测试工程师", "cat": "网络安全", "hot": 0.74,
     "skills": ["渗透测试", "Web安全", "漏洞挖掘", "CTF"],
     "ind_tags": ["网络安全"]},
    {"title": "数据安全工程师", "cat": "网络安全", "hot": 0.75,
     "skills": ["数据加密", "隐私计算", "数据脱敏", "合规"],
     "ind_tags": ["网络安全", "大数据"]},
    {"title": "安全开发工程师", "cat": "网络安全", "hot": 0.7,
     "skills": ["Python", "C", "SDL", "安全编码"],
     "ind_tags": ["网络安全", "软件"]},
    {"title": "密码技术工程师", "cat": "网络安全", "hot": 0.6,
     "skills": ["密码学", "国密算法", "PKI", "SSL"],
     "ind_tags": ["网络安全", "金融科技"]},
    {"title": "网络安全运营工程师", "cat": "网络安全", "hot": 0.73,
     "skills": ["安全运营", "威胁情报", "应急响应"],
     "ind_tags": ["网络安全", "互联网"]},

    # ========== 数据库 ==========
    {"title": "数据库工程师", "cat": "数据库", "hot": 0.8,
     "skills": ["MySQL", "Redis", "SQL优化", "数据库设计"],
     "ind_tags": ["软件", "大数据", "金融科技"]},
    {"title": "MySQL数据库工程师", "cat": "数据库", "hot": 0.72,
     "skills": ["MySQL", "主从复制", "索引优化", "存储引擎"],
     "ind_tags": ["软件", "互联网"]},
    {"title": "Oracle数据库工程师", "cat": "数据库", "hot": 0.65,
     "skills": ["Oracle", "PL/SQL", "RAC", "备份恢复"],
     "ind_tags": ["金融科技", "软件"]},
    {"title": "数据库运维工程师", "cat": "数据库", "hot": 0.7,
     "skills": ["MySQL", "Redis", "MongoDB", "备份", "监控"],
     "ind_tags": ["大数据", "云计算"]},
    {"title": "数据平台工程师", "cat": "数据库", "hot": 0.68,
     "skills": ["Hadoop", "Spark", "数据平台", "调度"],
     "ind_tags": ["大数据", "云计算"]},
    {"title": "DBA数据库管理员", "cat": "数据库", "hot": 0.66,
     "skills": ["MySQL", "Oracle", "性能调优", "数据迁移"],
     "ind_tags": ["软件", "金融科技"]},

    # ========== 产品与数字化 ==========
    {"title": "产品经理", "cat": "产品与数字化", "hot": 0.9,
     "skills": ["需求分析", "PRD", "产品设计", "用户研究"],
     "ind_tags": ["互联网", "数字经济", "软件"]},
    {"title": "AI产品经理", "cat": "产品与数字化", "hot": 0.82,
     "skills": ["AI产品", "大模型", "需求分析", "PRD"],
     "ind_tags": ["人工智能", "互联网"]},
    {"title": "数据产品经理", "cat": "产品与数字化", "hot": 0.74,
     "skills": ["数据产品", "指标体系", "BI", "SQL"],
     "ind_tags": ["大数据", "数字经济"]},
    {"title": "技术产品经理", "cat": "产品与数字化", "hot": 0.71,
     "skills": ["技术架构", "API", "需求分析", "项目管理"],
     "ind_tags": ["互联网", "软件"]},
    {"title": "项目经理", "cat": "产品与数字化", "hot": 0.79,
     "skills": ["PMP", "项目管理", "敏捷", "风险管理"],
     "ind_tags": ["软件", "互联网", "智能制造"]},
    {"title": "IT项目经理", "cat": "产品与数字化", "hot": 0.72,
     "skills": ["项目管理", "PMP", "ITIL", "交付管理"],
     "ind_tags": ["软件", "金融科技"]},
    {"title": "数字化项目经理", "cat": "产品与数字化", "hot": 0.73,
     "skills": ["数字化转型", "项目管理", "ERP", "数据中台"],
     "ind_tags": ["数字经济", "智能制造"]},
    {"title": "企业信息化工程师", "cat": "产品与数字化", "hot": 0.76,
     "skills": ["ERP", "OA", "MES", "信息化规划"],
     "ind_tags": ["数字经济", "智能制造", "软件"]},
    {"title": "数字化解决方案工程师", "cat": "产品与数字化", "hot": 0.75,
     "skills": ["数字化转型", "解决方案", "售前", "数据分析"],
     "ind_tags": ["数字经济", "智能制造"]},
    {"title": "需求分析师", "cat": "产品与数字化", "hot": 0.68,
     "skills": ["需求调研", "原型设计", "流程图", "文档编写"],
     "ind_tags": ["软件", "数字经济"]},

    # ========== 智能制造 / 工业数字化 ==========
    {"title": "工业互联网工程师", "cat": "智能制造", "hot": 0.78,
     "skills": ["工业互联网", "平台架构", "设备接入", "IIoT"],
     "ind_tags": ["智能制造", "工业互联网"]},
    {"title": "智能制造工程师", "cat": "智能制造", "hot": 0.8,
     "skills": ["智能工厂", "MES", "自动化", "精益生产"],
     "ind_tags": ["智能制造", "装备制造"]},
    {"title": "工业软件工程师", "cat": "智能制造", "hot": 0.72,
     "skills": ["工业软件", "CAD/CAM", "MES", "数据采集"],
     "ind_tags": ["智能制造", "软件"]},
    {"title": "MES系统工程师", "cat": "智能制造", "hot": 0.71,
     "skills": ["MES", "生产管理", "制造执行", "工业软件"],
     "ind_tags": ["智能制造"]},
    {"title": "自动化软件工程师", "cat": "智能制造", "hot": 0.73,
     "skills": ["PLC", "SCADA", "自动化", "组态软件"],
     "ind_tags": ["智能制造", "装备制造"]},
    {"title": "工业数据分析师", "cat": "智能制造", "hot": 0.72,
     "skills": ["工业数据", "Python", "数据分析", "质量分析"],
     "ind_tags": ["智能制造", "大数据"]},
    {"title": "数字化制造工程师", "cat": "智能制造", "hot": 0.7,
     "skills": ["数字孪生", "智能工厂", "工艺数字化"],
     "ind_tags": ["智能制造", "数字经济"]},
    {"title": "物联网工程师", "cat": "智能制造", "hot": 0.81,
     "skills": ["物联网", "传感器", "MQTT", "数据采集"],
     "ind_tags": ["物联网", "智能制造"]},
    {"title": "IoT开发工程师", "cat": "智能制造", "hot": 0.74,
     "skills": ["MQTT", "物联网平台", "嵌入式", "云平台"],
     "ind_tags": ["物联网", "云计算"]},
    {"title": "边缘计算工程师", "cat": "智能制造", "hot": 0.69,
     "skills": ["边缘计算", "嵌入式", "容器", "数据采集"],
     "ind_tags": ["物联网", "云计算"]},
    {"title": "PLC工程师", "cat": "智能制造", "hot": 0.76,
     "skills": ["PLC", "电气控制", "自动化", "设备调试"],
     "ind_tags": ["智能制造", "装备制造"]},

    # ========== 物联网 ==========
    {"title": "物联网开发工程师", "cat": "物联网", "hot": 0.79,
     "skills": ["物联网", "嵌入式", "传感器", "MQTT"],
     "ind_tags": ["物联网"]},
    {"title": "物联网平台工程师", "cat": "物联网", "hot": 0.7,
     "skills": ["物联网平台", "微服务", "设备管理"],
     "ind_tags": ["物联网", "云计算"]},
    {"title": "IoT软件工程师", "cat": "物联网", "hot": 0.72,
     "skills": ["嵌入式", "Linux", "物联网", "通信协议"],
     "ind_tags": ["物联网", "软件"]},
    {"title": "嵌入式开发工程师", "cat": "物联网", "hot": 0.82,
     "skills": ["C", "C++", "ARM", "RTOS", "Linux"],
     "ind_tags": ["集成电路", "物联网", "智能制造"]},
    {"title": "智能硬件工程师", "cat": "物联网", "hot": 0.74,
     "skills": ["硬件设计", "嵌入式", "传感器", "PCB"],
     "ind_tags": ["物联网", "集成电路"]},
    {"title": "设备联网工程师", "cat": "物联网", "hot": 0.68,
     "skills": ["设备接入", "协议转换", "数据采集", "工业网关"],
     "ind_tags": ["物联网", "智能制造"]},
    {"title": "传感器应用工程师", "cat": "物联网", "hot": 0.67,
     "skills": ["传感器", "信号处理", "嵌入式", "数据采集"],
     "ind_tags": ["物联网", "智能制造"]},
]

JOB_TITLE_SET = {p["title"] for p in JOB_POOL}

# 岗位池按方向分组（供展示与统计）
JOB_CATEGORIES = {
    "软件开发": "软件开发",
    "数据与人工智能": "数据与人工智能",
    "云计算与基础设施": "云计算与基础设施",
    "网络安全": "网络安全",
    "数据库": "数据库",
    "产品与数字化": "产品与数字化",
    "智能制造": "智能制造",
    "物联网": "物联网",
}

# ---------------------------------------------------------------------------
# 城市规模分级
# 超大型/大型城市：直辖市 + 省会 + 计划单列市 + 副省级市 + 万亿GDP经济强市
# （普通地级市、县级市归入中/小型，保证"大城市岗位明显多于小城市"）
# ---------------------------------------------------------------------------
MAJOR_CITIES = {
    # 直辖市
    "北京", "上海", "天津", "重庆",
    # 副省级市 / 计划单列市
    "广州", "深圳", "杭州", "南京", "武汉", "成都", "西安", "济南",
    "青岛", "沈阳", "大连", "宁波", "厦门", "哈尔滨", "长春",
    # 省会
    "石家庄", "太原", "呼和浩特", "郑州", "长沙", "合肥", "南昌", "福州",
    "南宁", "海口", "贵阳", "昆明", "兰州", "西宁", "银川", "乌鲁木齐",
    "拉萨", "台北", "香港", "澳门",
    # 万亿 GDP / 经济强市
    "苏州", "无锡", "常州", "南通", "徐州", "扬州", "温州", "嘉兴",
    "绍兴", "台州", "金华", "烟台", "潍坊", "临沂", "济宁", "泉州",
    "东莞", "佛山", "珠海", "中山", "惠州", "洛阳", "唐山", "保定",
    "廊坊", "岳阳", "襄阳", "宜昌", "芜湖", "绵阳", "遵义", "柳州",
    "桂林", "曲靖", "咸阳", "包头", "鄂尔多斯", "大庆", "三亚", "汕头",
}

# 目标规模配置：
#   records_min / records_max : 岗位总记录数目标区间
#   types_min / types_max     : 岗位类型（去重标题）数区间
TIER_TARGETS = {
    # 超大型/大型城市：岗位丰富，类型全面（60~150 条）
    "major": {"records_min": 60, "records_max": 150, "types_min": 34, "types_max": 48},
    # 中等城市：软件开发+信息化+数据+制造为主（40~80 条）
    "mid": {"records_min": 40, "records_max": 80, "types_min": 26, "types_max": 38},
    # 小型城市：结构集中，但必须 ≥ 20 条且类型 ≥ 22
    "small": {"records_min": 20, "records_max": 60, "types_min": 22, "types_max": 32},
}


def _city_seed(city_short: str) -> int:
    """城市名稳定随机种子（幂等、城城不同）"""
    h = 0
    for ch in city_short:
        h = (h * 31 + ord(ch)) & 0x7FFFFFFF
    return h


def city_tier(city_short: str) -> str:
    """城市等级：major / mid / small（完全由城市名 seed 决定，稳定幂等）"""
    if city_short in MAJOR_CITIES:
        return "major"
    # 普通城市按稳定 seed 分入 mid / small（约 40% 中型、60% 小型）
    return "mid" if _city_seed(city_short) % 5 < 2 else "small"


def city_scale(city_short: str, existing_records: int, existing_types: int) -> tuple:
    """根据城市规模返回 (target_records, target_types)

    - tier 完全由城市名 seed 决定（稳定幂等，不随已有数据量漂移）
    - 目标记录数/类型数在 tier 区间内按 seed 取稳定值（城城不同、同城不变）
    - 已有数据超过目标则视为达标（不删已有数据）
    """
    tier = city_tier(city_short)
    cfg = TIER_TARGETS[tier]
    seed = _city_seed(city_short)

    span_rec = cfg["records_max"] - cfg["records_min"]
    span_typ = cfg["types_max"] - cfg["types_min"]
    target_records = cfg["records_min"] + seed % (span_rec + 1)
    target_types = cfg["types_min"] + (seed >> 7) % (span_typ + 1)

    # 已有数据超过目标则视为达标
    if existing_records >= target_records:
        target_records = existing_records
    if existing_types >= target_types:
        target_types = existing_types
    return target_records, target_types


def pool_priority(pool_item: dict, industries: list) -> int:
    """岗位与城市产业的匹配度：命中产业标签越多，优先级越高"""
    score = 0
    for t in pool_item["ind_tags"]:
        if t in industries:
            score += 3
    # 软件/互联网类通用岗位保底 1 分，保证小城市也有基础 IT 岗位
    if pool_item["cat"] in ("软件开发", "产品与数字化"):
        score += 1
    return score


def pick_diverse_titles(industries: list, used_titles: set, limit: int) -> list:
    """按城市产业从全景池中挑选未覆盖岗位（用于补齐类型）"""
    candidates = [p for p in JOB_POOL if p["title"] not in used_titles]
    candidates.sort(key=lambda p: (-pool_priority(p, industries), -p["hot"]))
    return [p["title"] for p in candidates[:limit]]


def hot_pool_for_city(industries: list) -> list:
    """城市热门岗位池：产业匹配优先，用于同一岗位多条记录的加权选择"""
    pool = sorted(
        JOB_POOL,
        key=lambda p: (-pool_priority(p, industries), -p["hot"]),
    )
    return pool


def job_by_title(title: str):
    """按标题查岗位池（供生成记录时取 skills/hot/ind_tags）"""
    for p in JOB_POOL:
        if p["title"] == title:
            return p
    return None


# ---------------------------------------------------------------------------
# 岗位展示需求数量（城市画像 → 数量系数 → 展示数量）
# ---------------------------------------------------------------------------
# 超大型城市：岗位需求数量区间 100~500+（普通大型 60~300 / 中型 40~150 / 普通 20~80）
MEGA_CITIES = {"北京", "上海", "广州", "深圳"}


def city_job_demand_count(
    city_short: str,
    title: str,
    real_cnt: int = 0,
    hot: float = 0.5,
    profile_weight: float = None,
    is_panorama: bool = True,
) -> int:
    """计算城市岗位【展示需求数量】（每个岗位类型 ≥ 20，城城不同、同城稳定）

    数量受 5 个因素共同影响（全确定性，无随机）：
    - 城市规模等级：超大型 100~500 / 大型 60~300 / 中型 40~150 / 普通 20~80
    - 岗位热度 hot：热门岗位向区间上限倾斜
    - 城市画像权重 profile_weight：城市产业方向越匹配数量越多
    - 已有真实数据 real_cnt：真实数据充足（≥计算值）时尊重真实数据
    - 是否全景数字人才岗位 is_panorama：真实爬取的杂岗/辅助岗位（非全景）不随城市
      等级大幅放大，统一收敛到 20~40，避免"鞋子QC""游戏陪练"等挤占正常岗位

    稳定性：完全由 (city_short, title) 级联哈希决定 → 每次进入同一城市数量不变。
    差异性：不同城市/不同岗位哈希分散 → 数量分布均匀、城城不同。
    """
    if city_short in MEGA_CITIES:
        lo, hi = 100, 500
    elif city_tier(city_short) == "major":
        lo, hi = 60, 300
    elif city_tier(city_short) == "mid":
        lo, hi = 40, 150
    else:
        lo, hi = 20, 80

    if not is_panorama:
        # 非全景岗位（真实爬取杂岗/辅助岗位）：保留真实数据，但不再随城市等级放大
        lo, hi = 20, min(40, hi)

    # 级联哈希：city|title 逐字符哈希，同一城市不同岗位、不同城市同岗位均分散
    seed = _city_seed(f"{city_short}|{title}")
    ratio = (seed % 997) / 997.0
    hot_k = 0.9 + (hot or 0.5) * 0.2              # 0.9 ~ 1.1（热门岗位 +10% 左右）
    w = profile_weight if profile_weight is not None else 0.5
    w_k = 0.9 + w * 0.2                           # 0.9 ~ 1.1（城市产业匹配 ±10%）
    count = int(lo + ratio * (hi - lo) * hot_k * w_k)
    count = max(20, min(count, hi))
    # 真实数据优先：真实记录数超过计算值时，尊重真实数据
    if real_cnt > count:
        count = real_cnt
    return count
