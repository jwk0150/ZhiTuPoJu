# -*- coding: utf-8 -*-
"""
全国各市岗位数据补充脚本（智途破局）
=====================================
需求：
- 全国每个城市进入岗位分析后 ≥20 个岗位
- 真实数据优先，不足部分由 AI 生成补充并【写入数据库】
- 幂等（可重复运行，不重复生成）、不覆盖真实数据
- 有城市产业差异、岗位名称不重复、薪资合理（元/月）
- 字段完整（含 skills / industry_tags / job_description 等，供知识图谱使用）

用法：
    python backend/seed_city_jobs.py            # 补全全部城市
    python backend/seed_city_jobs.py --city 南昌  # 只补一个城市
    python backend/seed_city_jobs.py --rebuild   # 重建 ai_seed 数据（先删后插，仅影响 ai_seed 行）
    python backend/seed_city_jobs.py --dry-run   # 只统计不写入
"""
import asyncio
import hashlib
import os
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asyncpg
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from backend.mappings import CITY_TO_PROVINCE  # noqa: E402
from backend.services import (  # noqa: E402
    _infer_capabilities,
    JOB_TECH_MAPPING,
    _norm_city_for_query,
    _city_match_sql,
)
from backend.job_pool import (  # noqa: E402
    JOB_POOL,
    JOB_TITLE_SET,
    city_scale,
    pool_priority,
    hot_pool_for_city,
)
from backend.city_profile import (  # noqa: E402
    build_city_profile,
    pick_diverse_titles,
    city_skill_variant,
    city_seed,
)

# 全国核心通用岗位：每个城市都保证覆盖（数量由 city_seed 差异化计算，城市间不同）
CORE_NATIONAL_TITLES = [
    "Python开发工程师",
    "Java开发工程师",
    "前端开发工程师",
    "数据分析师",
    "测试开发工程师",
    "运维工程师",
]

# ---------------------------------------------------------------------------
# 省份 → 主导产业（用于城市产业差异）
# ---------------------------------------------------------------------------
PROVINCE_INDUSTRIES = {
    "北京": ["人工智能", "互联网", "生物医药", "金融科技"],
    "上海": ["集成电路", "人工智能", "新能源汽车", "金融科技"],
    "天津": ["智能制造", "集成电路", "生物医药", "新能源汽车"],
    "重庆": ["汽车制造", "智能制造", "电子信息", "大数据"],
    "广东": ["电子信息", "智能制造", "互联网", "新能源汽车", "生物医药"],
    "浙江": ["互联网", "电商", "智能制造", "数字经济"],
    "江苏": ["集成电路", "智能制造", "生物医药", "新能源"],
    "四川": ["电子信息", "装备制造", "软件", "新能源"],
    "湖北": ["汽车制造", "光电子", "智能制造", "软件"],
    "陕西": ["航空航天", "能源化工", "电子信息", "装备制造"],
    "河南": ["装备制造", "食品加工", "物流", "智能电网"],
    "湖南": ["工程机械", "电子信息", "新材料", "轨道交通"],
    "山东": ["装备制造", "化工", "海洋经济", "新能源"],
    "安徽": ["新能源汽车", "智能制造", "家电", "集成电路"],
    "福建": ["电子信息", "纺织鞋服", "海洋经济", "软件"],
    "江西": ["锂电新能源", "电子信息", "有色金属", "虚拟现实", "航空制造"],
    "广西": ["汽车制造", "食品加工", "铝产业", "生物医药"],
    "海南": ["旅游", "生物医药", "现代农业", "数字贸易"],
    "云南": ["绿色能源", "生物医药", "旅游", "有色金属"],
    "贵州": ["大数据", "新能源", "酱酒", "电子信息"],
    "甘肃": ["新能源", "有色冶金", "中医药", "石油化工"],
    "青海": ["新能源", "盐湖化工", "有色冶金"],
    "宁夏": ["新能源", "化工", "枸杞产业", "智能制造"],
    "新疆": ["能源", "现代农业", "纺织", "石油化工"],
    "西藏": ["旅游", "清洁能源", "藏药"],
    "内蒙古": ["能源", "乳业", "稀土", "冶金"],
    "辽宁": ["装备制造", "石油化工", "软件", "智能制造"],
    "吉林": ["汽车制造", "现代农业", "生物医药", "轨道交通"],
    "黑龙江": ["装备制造", "现代农业", "食品加工", "冰雪旅游"],
    "河北": ["钢铁", "装备制造", "生物医药", "新能源"],
    "山西": ["能源化工", "装备制造", "大数据", "新材料"],
    "香港": ["金融科技", "数字贸易", "生物医药"],
    "澳门": ["旅游", "会展", "数字贸易"],
    "台湾": ["电子信息", "半导体", "智能制造"],
}

# ---------------------------------------------------------------------------
# 产业 → 岗位标题模板（优先保证能命中 _infer_capabilities / JOB_TECH_MAPPING）
# ---------------------------------------------------------------------------
INDUSTRY_JOB_TEMPLATES = {
    "人工智能": ["算法工程师", "机器学习工程师", "深度学习工程师", "自然语言处理工程师", "计算机视觉工程师",
                "大模型应用开发工程师", "AI平台开发工程师", "数据挖掘工程师", "推荐算法工程师", "智能语音算法工程师"],
    "互联网": ["Java开发工程师", "Python开发工程师", "前端开发工程师", "后端开发工程师", "测试开发工程师",
               "运维开发工程师", "系统架构师", "全栈开发工程师", "Go开发工程师", "移动端开发工程师", "安全工程师"],
    "集成电路": ["芯片验证工程师", "数字IC设计工程师", "模拟IC设计工程师", "版图设计工程师", "嵌入式软件工程师",
                "FPGA开发工程师", "半导体工艺工程师", "封装测试工程师", "固件开发工程师", "硬件工程师"],
    "智能制造": ["电气工程师", "机械设计工程师", "自动化工程师", "工业机器人工程师", "PLC工程师",
                "嵌入式开发工程师", "视觉检测工程师", "MES实施工程师", "数控编程工程师", "设备维护工程师"],
    "新能源汽车": ["电池系统工程师", "电控软件工程师", "电机设计工程师", "整车集成工程师", "充电桩开发工程师",
                  "自动驾驶算法工程师", "汽车电子工程师", "线束设计工程师", "热管理系统工程师", "BMS软件开发工程师"],
    "电子信息": ["嵌入式软件工程师", "硬件工程师", "射频工程师", "测试工程师", "结构设计工程师",
                "PCB设计工程师", "天线工程师", "电子工艺工程师", "电源工程师", "光学工程师"],
    "生物医药": ["药物研发工程师", "制剂研究员", "临床研究员", "质量分析工程师", "注册专员",
                "生物信息工程师", "细胞培养工程师", "医疗器械研发工程师", "工艺开发工程师", "药物质检工程师"],
    "软件": ["Java开发工程师", "前端开发工程师", "测试工程师", "Python开发工程师", "软件实施工程师",
             "运维工程师", "数据库工程师", "产品经理", "UI设计师", "系统集成工程师"],
    "新能源": ["光伏系统工程师", "风电运维工程师", "储能系统工程师", "电力电子工程师", "逆变器开发工程师",
              "电池研发工程师", "能源管理工程师", "电气设计工程师", "新能源项目工程师", "碳管理工程师"],
    "金融科技": ["Java开发工程师", "数据分析师", "风控建模工程师", "量化研究员", "区块链开发工程师",
                "支付系统工程师", "前端开发工程师", "测试工程师", "反欺诈算法工程师", "金融产品经理"],
    "汽车制造": ["汽车设计工程师", "车辆工程工程师", "制造工艺工程师", "质量工程师", "底盘工程师",
                "车身结构工程师", "汽车电子工程师", "生产计划工程师", "物流规划工程师", "焊接工艺工程师"],
    "电商": ["Java开发工程师", "前端开发工程师", "数据分析师", "运营专员", "商品运营经理",
             "电商产品经理", "UI设计师", "物流运营专员", "客服运营主管", "增长运营经理"],
    "装备制造": ["机械设计工程师", "电气工程师", "自动化工程师", "液压工程师", "结构工程师",
                "焊接工程师", "工艺工程师", "质量工程师", "装配工艺工程师", "测试工程师"],
    "光电子": ["光学工程师", "光通信工程师", "激光工程师", "光学设计工程师", "光模块研发工程师",
              "封装工艺工程师", "测试工程师", "硬件工程师", "嵌入式软件工程师", "可靠性工程师"],
    "航空航天": ["结构强度工程师", "飞行控制工程师", "航电工程师", "复合材料工程师", "气动工程师",
                "推进系统工程师", "嵌入式软件工程师", "可靠性工程师", "适航工程师", "试验工程师"],
    "能源化工": ["化工工艺工程师", "设备工程师", "安全工程师", "环境工程师", "仪控工程师",
                "材料工程师", "分析化验工程师", "能源管理工程师", "管道设计工程师", "项目管理工程师"],
    "有色金属": ["冶金工程师", "材料研发工程师", "选矿工程师", "工艺工程师", "质量工程师",
                "化验分析工程师", "设备工程师", "安全工程师", "新材料研发工程师", "表面处理工程师"],
    "新材料": ["材料研发工程师", "工艺工程师", "测试工程师", "配方工程师", "材料分析工程师",
              "高分子材料工程师", "复合材料工程师", "质量工程师", "研发助理", "实验工程师"],
    "食品加工": ["食品研发工程师", "品控工程师", "食品检验员", "工艺工程师", "包装工程师",
                "生产管理专员", "质量工程师", "食品标准专员", "设备工程师", "采购专员"],
    "现代物流": ["物流规划工程师", "仓储运营主管", "运输调度员", "供应链专员", "数据分析师",
                "Java开发工程师", "前端开发工程师", "物流产品经理", "配送网络规划师", "关务专员"],
    "现代农业": ["农艺师", "农业技术员", "智慧农业工程师", "植保工程师", "育种工程师",
                "农产品质检员", "农业数据分析师", "农机工程师", "农业项目经理", "土壤修复工程师"],
    "旅游": ["旅游产品经理", "景区运营主管", "酒店运营经理", "旅游策划师", "新媒体运营",
             "OTA运营专员", "导游", "文旅项目专员", "会展策划", "客户体验经理"],
    "冰雪旅游": ["景区运营主管", "旅游产品经理", "酒店运营经理", "活动策划", "新媒体运营",
                "票务系统运营", "客户服务经理", "文旅项目专员", "数据分析师", "市场营销专员"],
    "数字贸易": ["Java开发工程师", "前端开发工程师", "跨境电商运营", "数据分析师", "海外市场经理",
                "产品经理", "UI设计师", "支付系统工程师", "物流运营专员", "客户成功经理"],
    "大数据": ["大数据开发工程师", "数据分析师", "数据仓库工程师", "数据挖掘工程师", "ETL工程师",
              "BI工程师", "数据治理工程师", "Java开发工程师", "算法工程师", "数据产品经理"],
    "数字经济": ["Java开发工程师", "前端开发工程师", "数据分析师", "产品经理", "测试工程师",
                "运维工程师", "UI设计师", "数字化顾问", "项目经理", "解决方案工程师"],
    "虚拟现实": ["Unity开发工程师", "UE4开发工程师", "3D建模师", "VR开发工程师", "AR开发工程师",
                "渲染工程师", "Unity技术美术", "交互设计师", "图形算法工程师", "测试工程师"],
    "航空制造": ["结构工程师", "工艺工程师", "复材工程师", "装配工程师", "测试工程师",
                "机电工程师", "工业工程师", "质量工程师", "生产线长", "工装设计师"],
    "酱酒": ["酿造工艺工程师", "品酒师", "质量工程师", "生产管理专员", "包装工程师",
             "营销经理", "渠道经理", "电商运营", "品牌经理", "供应链专员"],
    "盐湖化工": ["化工工艺工程师", "提取工艺工程师", "分析化验工程师", "设备工程师", "安全工程师",
                "材料工程师", "生产管理专员", "环境工程师", "自动化工程师", "仪表工程师"],
    "绿色能源": ["光伏系统工程师", "风电运维工程师", "储能系统工程师", "电力电子工程师", "电力设计工程师",
                "电网规划工程师", "能源管理工程师", "碳管理工程师", "项目开发经理", "电气工程师"],
    "乳业": ["乳品研发工程师", "品控工程师", "检验员", "工艺工程师", "生产管理专员",
             "包装工程师", "质量工程师", "设备工程师", "牧场技术员", "供应链专员"],
    "稀土": ["材料研发工程师", "冶金工程师", "磁性材料工程师", "工艺工程师", "测试工程师",
             "分析化验工程师", "质量工程师", "设备工程师", "应用开发工程师", "研发助理"],
    "钢铁": ["炼钢工艺工程师", "轧钢工程师", "冶金工程师", "设备工程师", "安全工程师",
             "质量工程师", "能源管理工程师", "自动化工程师", "环境工程师", "生产管理专员"],
    "家电": ["结构设计工程师", "硬件工程师", "嵌入式软件工程师", "工业设计师", "测试工程师",
             "品质工程师", "工艺工程师", "制冷工程师", "电机工程师", "售后技术支持"],
    "纺织鞋服": ["服装设计师", "面料开发工程师", "版师", "工艺工程师", "质量管理专员",
                "生产管理专员", "电商运营", "品牌经理", "供应链专员", "质检员"],
    "海洋经济": ["海洋工程工程师", "渔业工程师", "船舶工程师", "港口物流专员", "海洋生物研究员",
                "深海装备工程师", "海洋数据工程师", "水产养殖技术员", "海洋能源工程师", "项目工程师"],
    "工程机械": ["机械设计工程师", "液压工程师", "电气工程师", "结构工程师", "测试工程师",
                "工艺工程师", "质量工程师", "服务工程师", "装配工程师", "研发工程师"],
    "轨道交通": ["车辆工程师", "信号工程师", "轨道工程师", "电气工程师", "机械工程师",
                "运维工程师", "调度系统工程师", "嵌入式软件工程师", "测试工程师", "项目管理工程师"],
    "智能电网": ["电力系统工程师", "继电保护工程师", "电气工程师", "调度自动化工程师", "电力电子工程师",
                "电能质量工程师", "数据通信工程师", "运维工程师", "项目管理工程师", "安全工程师"],
    "软件外包": ["Java开发工程师", "前端开发工程师", "测试工程师", "运维工程师", "数据库工程师",
                "产品经理", "项目助理", "Python开发工程师", "UI设计师", "实施工程师"],
    "新能源电池": ["电芯研发工程师", "模组设计工程师", "PACK结构工程师", "BMS软件工程师", "测试工程师",
                  "工艺工程师", "质量工程师", "设备工程师", "电池回收工程师", "材料研发工程师"],
    "装备研发": ["机械设计工程师", "电气工程师", "液压工程师", "软件工程师", "测试工程师",
                "嵌入式工程师", "工艺工程师", "工业设计工程师", "项目管理工程师", "售后工程师"],
    "医疗器械": ["医疗器械研发工程师", "结构工程师", "软件工程师", "测试工程师", "注册工程师",
                "质量工程师", "工艺工程师", "临床工程师", "售后工程师", "电气工程师"],
    "现代农业装备": ["农机设计工程师", "电气工程师", "软件工程师", "液压工程师", "测试工程师",
                    "工艺工程师", "嵌入式工程师", "质量工程师", "售后服务工程师", "生产管理专员"],
    "会展": ["会展策划", "项目经理", "会展销售", "活动执行", "展台设计师",
             "新媒体运营", "客户服务专员", "招商专员", "数据分析师", "品牌策划"],
    "清洁能源": ["风电工程师", "光伏工程师", "储能工程师", "水力发电工程师", "电气工程师",
                "能源管理工程师", "项目开发经理", "运维工程师", "安全管理工程师", "碳资产管理师"],
    "藏药": ["药物研发工程师", "质量分析工程师", "制剂研究员", "药材种植技术员", "注册专员",
             "检验员", "工艺工程师", "GMP专员", "临床研究员", "生产管理专员"],
    "集成电路装备": ["机械设计工程师", "电气工程师", "软件工程师", "工艺工程师", "测试工程师",
                   "光学工程师", "嵌入式工程师", "射频工程师", "质量工程师", "售后服务工程师"],
    "半导体": ["半导体工艺工程师", "设备工程师", "测试工程师", "良率工程师", "封装工程师",
              "版图设计工程师", "嵌入式软件工程师", "硬件工程师", "质量工程师", "材料工程师"],
    "工业软件": ["Java开发工程师", "前端开发工程师", "算法工程师", "测试工程师", "产品经理",
                "实施工程师", "数据库工程师", "系统架构师", "UI设计师", "运维工程师"],
    "软件测试": ["测试开发工程师", "自动化测试工程师", "性能测试工程师", "功能测试工程师", "安全测试工程师",
                "测试经理", "测试架构师", "质量保障工程师", "Java开发工程师", "前端开发工程师"],
    "数据安全": ["安全工程师", "数据安全工程师", "渗透测试工程师", "安全运维工程师", "密码学工程师",
                "Java开发工程师", "前端开发工程师", "安全产品经理", "合规专员", "安全分析师"],
    "智能家居": ["嵌入式软件工程师", "硬件工程师", "Android开发工程师", "iOS开发工程师", "测试工程师",
                "Java开发工程师", "结构工程师", "产品经理", "工业设计师", "质量工程师"],
    "智能制造软件": ["Java开发工程师", "前端开发工程师", "算法工程师", "实施工程师", "测试工程师",
                  "产品经理", "MES开发工程师", "WMS开发工程师", "数据库工程师", "运维工程师"],
}

# 通用职能岗位池（任何城市都会补一些通用岗）
COMMON_FUNC_JOBS = [
    "人力资源专员", "招聘专员", "财务会计", "出纳", "行政专员",
    "销售经理", "市场专员", "商务专员", "采购专员", "客服主管",
    "品牌运营", "新媒体运营", "平面设计师", "项目经理", "法务专员",
    "外贸专员", "数据分析师", "物流专员", "培训专员", "体系工程师",
    "报价工程师", "仓库管理员", "质检员", "车间主管", "计划员",
    "统计员", "客户经理", "渠道经理", "投标专员", "档案管理员",
]

# 行业/技术关键词 → 补充技能（当 _infer_capabilities 只返回通用技能时追加，
# 保证知识图谱的技术节点丰富）
ENRICH_SKILLS = {
    "Java": ["Spring Boot", "MySQL", "Redis", "微服务", "Kafka"],
    "Python": ["Python", "Django", "Flask", "爬虫", "数据分析"],
    "前端": ["HTML/CSS", "JavaScript", "Vue", "React", "TypeScript", "Webpack"],
    "算法": ["Python", "PyTorch", "TensorFlow", "机器学习", "数据挖掘"],
    "机器学习": ["Python", "PyTorch", "TensorFlow", "Scikit-learn", "特征工程"],
    "深度学习": ["Python", "PyTorch", "TensorFlow", "CNN", "Transformer"],
    "数据": ["SQL", "Python", "Pandas", "数据可视化", "ETL", "Power BI"],
    "测试": ["自动化测试", "Selenium", "JMeter", "接口测试", "质量保障"],
    "运维": ["Linux", "Docker", "Kubernetes", "CI/CD", "监控告警"],
    "嵌入式": ["C", "C++", "STM32", "Linux", "RTOS", "I2C/SPI"],
    "硬件": ["Altium Designer", "PCB设计", "数字电路", "模拟电路", "示波器"],
    "Unity": ["Unity", "C#", "3D建模", "游戏引擎", "Shader"],
    "UE": ["Unreal Engine", "C++", "蓝图", "3D建模", "渲染"],
    "3D": ["3D建模", "Blender", "Maya", "材质贴图", "渲染"],
    "VR": ["Unity", "3D建模", "VR开发", "交互设计", "图形渲染"],
    "AR": ["Unity", "AR开发", "3D建模", "SLAM", "图形渲染"],
    "光伏": ["PVsyst", "AutoCAD", "电气设计", "光伏系统", "并网技术"],
    "风电": ["风力发电", "SCADA", "PLC", "电气系统", "设备运维"],
    "储能": ["BMS", "锂电池", "电力电子", "EMS", "热管理"],
    "电池": ["锂电池", "BMS", "电化学", "材料分析", "测试验证"],
    "电力": ["MATLAB", "PLC", "继电保护", "AutoCAD", "电气设计"],
    "芯片": ["Verilog", "Vivado", "数字电路", "EDA", "芯片验证"],
    "IC": ["Verilog", "Vivado", "数字IC设计", "验证方法学", "EDA工具"],
    "FPGA": ["Verilog", "Vivado", "FPGA", "数字电路", "时序分析"],
    "制药": ["药物分析", "GMP", "色谱分析", "实验室规范", "药品注册"],
    "药物": ["药物分析", "GMP", "色谱分析", "实验室规范", "药品注册"],
    "临床": ["临床试验", "GCP", "医学统计", "数据管理", "患者随访"],
    "生物": ["细胞培养", "PCR", "分子生物学", "实验室规范", "生物信息"],
    "医疗器械": ["医疗器械注册", "ISO13485", "质量体系", "临床试验", "生物相容性"],
    "质量": ["质量管理", "ISO9001", "SPC", "8D报告", "过程控制"],
    "机械": ["SolidWorks", "AutoCAD", "机械设计", "有限元分析", "公差设计"],
    "机电": ["PLC", "AutoCAD", "电气控制", "机械设计", "设备调试"],
    "电气": ["PLC", "AutoCAD", "电气设计", "继电保护", "西门子"],
    "自动化": ["PLC", "SCADA", "工业机器人", "传感器", "组态软件"],
    "结构": ["ANSYS", "结构分析", "有限元", "SolidWorks", "强度校核"],
    "材料": ["材料分析", "XRD", "SEM", "性能测试", "材料表征"],
    "化工": ["化工工艺", "Aspen Plus", "安全管理", "传质传热", "化工原理"],
    "冶金": ["冶金工艺", "金相分析", "金属材料", "热处理", "光谱分析"],
    "工艺": ["工艺流程", "精益生产", "FMEA", "PFMEA", "标准作业"],
    "汽车": ["CATIA", "汽车构造", "整车集成", "底盘设计", "NVH"],
    "机器人": ["工业机器人", "PLC", "运动控制", "机器视觉", "示教编程"],
    "视觉": ["OpenCV", "机器视觉", "图像处理", "Halcon", "深度学习"],
    "安全": ["渗透测试", "网络安全", "漏洞挖掘", "安全合规", "防火墙"],
    "网络": ["TCP/IP", "路由交换", "网络规划", "网络安全", "负载均衡"],
    "产品": ["需求分析", "原型设计", "Axure", "项目管理", "数据分析"],
    "UI": ["Figma", "Sketch", "交互设计", "视觉设计", "设计规范"],
    "运营": ["内容运营", "用户增长", "数据分析", "活动策划", "SEO/SEM"],
    "电商": ["电商运营", "商品管理", "数据分析", "流量投放", "供应链"],
    "销售": ["客户开发", "商务谈判", "销售管理", "客户关系", "渠道管理"],
    "人力": ["招聘", "员工关系", "绩效管理", "劳动法规", "薪酬管理"],
    "财务": ["财务报表", "税务申报", "成本核算", "金蝶", "用友"],
    "物流": ["物流管理", "仓储管理", "运输调度", "供应链", "ERP"],
    "食品": ["食品检测", "HACCP", "食品安全", "实验室规范", "品控管理"],
    "农业": ["种植技术", "植物保护", "水肥管理", "农业大数据", "智慧农业"],
    "旅游": ["旅游策划", "景区运营", "客户服务", "活动策划", "市场营销"],
    "能源": ["能源管理", "能效分析", "碳管理", "电力系统", "节能技术"],
    "航": ["航空材料", "适航标准", "复合材料", "结构设计", "强度分析"],
    "光": ["光学设计", "Zemax", "光路调试", "激光技术", "光学检测"],
    "信号": ["信号处理", "MATLAB", "通信原理", "无线通信", "射频测试"],
    "射频": ["射频设计", "网络分析仪", "天线设计", "ADS仿真", "射频测试"],
    "纺织": ["面料开发", "纺织工艺", "服装设计", "版型设计", "染整技术"],
    "物流": ["物流管理", "仓储运营", "运输调度", "供应链", "ERP"],
}

# 行业技术关键词池（标题命中任意关键词 → 补充对应技能）
ENRICH_KEYWORDS = sorted(ENRICH_SKILLS.keys(), key=len, reverse=True)


def enrich_skills(title: str, base_skills: list) -> list:
    """标题命中行业/技术关键词时，追加对应技能（去重，最多 8 个）"""
    merged = list(base_skills)
    for kw in ENRICH_KEYWORDS:
        if kw.lower() in title.lower():
            for s in ENRICH_SKILLS[kw]:
                if s not in merged:
                    merged.append(s)
            break
    return merged[:8]

# ---------------------------------------------------------------------------
# 薪资区间（元/月）：按标题关键词 → (min, max)
# ---------------------------------------------------------------------------
SALARY_RULES = [
    (["算法", "架构", "量化", "芯片", "IC", "AI", "大模型", "自动驾驶", "FPGA", "研发工程师", "BMS", "电芯", "量子"],
     (18000, 35000)),
    (["Java", "Python", "前端", "后端", "全栈", "Go", "C++", "嵌入式", "软件", "Unity", "UE", "Android", "iOS", "测试开发", "大数据", "数据库", "固件", "系统"],
     (12000, 25000)),
    (["数据分析", "产品经理", "UI", "运营", "策划", "设计", "销售", "市场", "商务", "采购", "供应链", "物流", "新媒体", "外贸", "电商", "品牌", "渠道"],
     (8000, 16000)),
    (["机械", "电气", "自动化", "工艺", "质量", "设备", "结构", "液压", "焊接", "装配", "制造", "生产", "材料", "化工", "冶金", "工程", "品控", "检验", "质检", "维修"],
     (8000, 18000)),
]

DEFAULT_SALARY = (8000, 15000)

EXPERIENCES = ["1-3年", "3-5年", "5-10年", "不限"]
EDUCATIONS = ["大专", "本科", "硕士"]

# 公司名后缀池
COMPANY_PREFIX = ["智造", "云帆", "精工", "华创", "蓝海", "凯瑞", "恒远", "锐新", "卓力", "博科",
                  "睿达", "领航", "跃动", "星河", "锦程", "正泰", "宏图", "开元", "优特", "盛源"]
COMPANY_SUFFIX = ["科技有限公司", "信息技术有限公司", "智能制造有限公司", "新能源科技有限公司",
                  "电子科技有限公司", "网络科技有限公司", "装备制造有限公司", "数据服务有限公司",
                  "生物科技有限公司", "自动化设备有限公司", "软件有限公司", "产业投资有限公司"]


def stable_seed(text: str) -> int:
    """确定性随机种子"""
    return int(hashlib.md5(text.encode("utf-8")).hexdigest(), 16) % (2 ** 32)


def pick_salary(title: str, rng: random.Random):
    """按标题关键词给合理薪资（元/月）"""
    for kws, (lo, hi) in SALARY_RULES:
        if any(k.lower() in title.lower() for k in kws):
            base_lo, base_hi = lo, hi
            break
    else:
        base_lo, base_hi = DEFAULT_SALARY
    span = rng.randint(3000, 6000)
    salary_min = base_lo + rng.randint(0, 4000)
    salary_max = max(salary_min + span, base_hi - rng.randint(0, 5000))
    if salary_max < salary_min:
        salary_max = salary_min + span
    return salary_min, salary_max


def build_company_name(city_short: str, rng: random.Random) -> str:
    return f"{city_short}{rng.choice(COMPANY_PREFIX)}{rng.choice(COMPANY_SUFFIX)}"


def make_job_description(title: str, industry_tags: list) -> str:
    ind = "/".join(industry_tags) if industry_tags else "相关产业"
    return (f"负责{title}相关工作，参与{ind}方向的方案设计、开发与交付，"
            f"推动项目高质量落地并持续优化。")

# ---------------------------------------------------------------------------
# 数据库操作
# ---------------------------------------------------------------------------

MIGRATE_SQL = """
ALTER TABLE the_total_table_copy1
    ADD COLUMN IF NOT EXISTS industry_tags text,
    ADD COLUMN IF NOT EXISTS skills text,
    ADD COLUMN IF NOT EXISTS job_description text,
    ADD COLUMN IF NOT EXISTS qualification text,
    ADD COLUMN IF NOT EXISTS work_experience text,
    ADD COLUMN IF NOT EXISTS city_seed text,
    ADD COLUMN IF NOT EXISTS sort_weight double precision
"""


async def migrate(conn: asyncpg.Connection) -> None:
    await conn.execute(MIGRATE_SQL)


async def get_city_stats(conn: asyncpg.Connection, city_short: str) -> dict:
    """返回该城市现有岗位标题（真实 + ai_seed 的 union）"""
    city_match = _city_match_sql("1")
    rows = await conn.fetch(
        f"""
        SELECT job_title, count(*)::int AS cnt,
               bool_or(source_name = 'ai_seed') AS is_ai_seed
        FROM the_total_table_copy1
        WHERE {city_match} AND job_title IS NOT NULL AND job_title <> ''
        GROUP BY job_title
        """,
        city_short,
    )
    return {"rows": rows}


def _hash_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


async def upsert_seed_jobs(conn: asyncpg.Connection, city_short: str, jobs: list[dict]) -> int:
    """幂等插入 ai_seed 岗位（按 source_id 去重，已存在则跳过）"""
    inserted = 0
    for j in jobs:
        sid = j["source_id"]
        exists = await conn.fetchval(
            "SELECT 1 FROM the_total_table_copy1 WHERE source_name='ai_seed' AND source_id=$1",
            sid,
        )
        if exists:
            continue
        await conn.execute(
            """
            INSERT INTO the_total_table_copy1
                (source_name, source_id, source_id_hash, job_title, company_name,
                 city, district, salary_min, salary_max, salary_unit,
                 experience, education, job_type, publish_time, crawl_time,
                 status, fingerprint, completeness, data_source,
                 industry_tags, skills, job_description, qualification, work_experience,
                 city_seed, sort_weight)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
            """,
            "ai_seed", sid, _hash_hex(sid), j["job_title"], j["company_name"],
            city_short, None, j["salary_min"], j["salary_max"], "元/月",
            j["experience"], j["education"], "全职", j["publish_time"], j["crawl_time"],
            0, _hash_hex(sid + j["job_title"]), 100, "ai_seed",
            j["industry_tags"], j["skills"], j["job_description"], j["qualification"], j["work_experience"],
            j.get("city_seed", ""), j.get("sort_weight", 0.0),
        )
        inserted += 1
    return inserted


async def rebuild_city_ai_seed(conn: asyncpg.Connection, city_short: str) -> int:
    """删除该城市已有 ai_seed 行（--rebuild 时使用）"""
    deleted = await conn.execute(
        "DELETE FROM the_total_table_copy1 WHERE source_name='ai_seed' AND split_part(city,'·',1)=$1",
        city_short,
    )
    # deleted 返回类似 "DELETE 12"
    try:
        return int(deleted.split()[-1])
    except Exception:
        return 0


async def delete_all_ai_seed(conn: asyncpg.Connection) -> int:
    deleted = await conn.execute("DELETE FROM the_total_table_copy1 WHERE source_name='ai_seed'")
    try:
        return int(deleted.split()[-1])
    except Exception:
        return 0


async def ensure_city_min_jobs(conn: asyncpg.Connection, city_short: str, min_jobs: int = 20) -> int:
    """确保某城市岗位质量：数量 >= max(城市规模目标, min_jobs)、类型多样化。

    - 按城市规模（超大/大/中/小）确定目标记录数与类型数
    - 不足则从"新一代信息技术全景岗位池"按城市产业补充并【写入数据库】
    - 同一岗位可生成多条记录，但公司/薪资/学历/经验各不相同
    - 幂等：重复运行不重复生成（按 source_id 去重）

    供 services.py 在城市详情/岗位查询兜底时调用（真实进入数据层）。
    返回本次实际新增条数（0 表示无需补充或无可生成）。
    """
    city_short = _norm_city_for_query(city_short)
    if not city_short or min_jobs <= 0:
        return 0
    await migrate(conn)
    stats = await get_city_stats(conn, city_short)
    existing_titles = {r["job_title"] for r in stats["rows"]}
    total_records = sum(r["cnt"] for r in stats["rows"])
    target_records, target_types = city_scale(city_short, total_records, len(existing_titles))
    target_records = max(target_records, min_jobs)
    target_types = max(target_types, min(min_jobs, 20))
    if total_records >= target_records and len(existing_titles) >= target_types:
        return 0
    province = _find_province_for_city(city_short)
    sids = await conn.fetch(
        "SELECT source_id FROM the_total_table_copy1 WHERE source_name='ai_seed' AND split_part(city,'·',1)=$1",
        city_short,
    )
    existing_sids = {r["source_id"] for r in sids}
    rng = random.Random(stable_seed(city_short + "|quality|" + province + "|" + str(target_records)))
    jobs = build_diverse_jobs(city_short, province, existing_titles, total_records,
                              target_records, target_types, existing_sids, rng)
    if not jobs:
        return 0
    return await upsert_seed_jobs(conn, city_short, jobs)


def _find_province_for_city(city_short: str) -> str:
    """通过 CITY_TO_PROVINCE 反查城市所属省份（找不到则按通用模板兜底）"""
    # CITY_TO_PROVINCE 结构为 {city: province}
    prov = CITY_TO_PROVINCE.get(city_short)
    if prov:
        return prov
    for c, p in CITY_TO_PROVINCE.items():
        if _norm_city_for_query(c) == city_short:
            return p
    return "广东"


# ---------------------------------------------------------------------------
# 生成器
# ---------------------------------------------------------------------------

def _next_sid(city_short: str, used_sids: set) -> str:
    """生成不冲突的 seedq-{city}-{n:04d} 格式 source_id（与旧 seed- 前缀区分）"""
    n = len(used_sids) + 1
    while True:
        sid = f"seedq-{city_short}-{n:04d}"
        n += 1
        if sid not in used_sids:
            used_sids.add(sid)
            return sid


def _make_diverse_record(city_short: str, pool_item: dict, profile: dict,
                         rng: random.Random, used_sids: set) -> dict:
    """生成一条差异化岗位记录：公司/薪资/学历/经验/发布时间均随机且各不相同。

    - 技能：按城市画像生成【城市专属技能组合】（同岗位不同城市技能不同）
    - 产业标签：岗位方向 + 城市核心/特色产业命中项
    - 额外输出 city_seed / sort_weight（供数据库标识与稳定排序）
    """
    title = pool_item["title"]
    # 技能：城市画像差异化技能组合（核心产业+特色产业驱动）
    skills = city_skill_variant(title, profile)
    if not skills:
        _, inferred = _infer_capabilities(title)
        skills = enrich_skills(title, inferred)

    # 产业标签：岗位方向 + 城市核心/特色产业命中项
    ind_tags = [pool_item.get("cat") or "综合"]
    profile_inds = profile.get("core_industries", []) + profile.get("feature_industries", [])
    for t in pool_item.get("ind_tags", []):
        if t in profile_inds and t not in ind_tags:
            ind_tags.append(t)
    ind_tags = ind_tags[:3]

    salary_min, salary_max = pick_salary(title, rng)
    exp = rng.choices(EXPERIENCES, weights=[35, 30, 15, 20])[0]
    edu = rng.choices(EDUCATIONS, weights=[35, 45, 20])[0]
    now = datetime.now()
    publish = (now - timedelta(days=rng.randint(1, 120))).strftime("%Y-%m-%d")

    return {
        "source_id": _next_sid(city_short, used_sids),
        "job_title": title,
        "company_name": build_company_name(city_short, rng),
        "salary_min": float(salary_min),
        "salary_max": float(salary_max),
        "experience": exp,
        "education": edu,
        "publish_time": publish,
        "crawl_time": now.strftime("%Y-%m-%d %H:%M:%S"),
        "industry_tags": ",".join(ind_tags),
        "skills": ",".join(skills),
        "job_description": make_job_description(title, ind_tags),
        "qualification": edu,
        "work_experience": exp,
        "city_seed": str(profile.get("seed", "")),
        "sort_weight": float(profile.get("title_weights", {}).get(title, 0.5)),
    }


def _pool_item_for_title(title: str) -> dict:
    """按标题从全景池查岗位模板；未覆盖则构造一个轻量模板（技能走画像推断）"""
    for p in JOB_POOL:
        if p["title"] == title:
            return p
    return {"title": title, "hot": 0.7, "cat": "综合", "ind_tags": [], "skills": []}


def build_diverse_jobs(city_short: str, province: str, existing_titles: set[str],
                       total_records: int, target_records: int, target_types: int,
                       existing_sids: set, rng: random.Random) -> list[dict]:
    """基于【城市岗位画像】为城市生成多样化岗位记录（写入数据库前调用）

    逻辑：
    1. 构建城市画像（核心/次核心/特色产业 + 城市专属岗位池 + 岗位权重 + citySeed）
    2. 分层补齐类型：核心 40% + 次核心 35% + 特色 15% + 其他 10%（画像采样，城城不同）
    3. 补齐记录数：从城市专属加权岗位池抽取，同一岗位可多条但参数各不相同
    """
    jobs = []
    used_titles = set(existing_titles)
    used_sids = set(existing_sids)
    profile = build_city_profile(city_short, total_records, len(used_titles))
    weights = profile["title_weights"]

    # 1) 补齐类型：先覆盖全国核心通用岗位，剩余由城市画像分层采样
    #    （核心岗位每个城市都有，但数量/排序由 city_seed 差异化，城市间不同）
    need_types = target_types - len(used_titles)
    if need_types > 0:
        picked = []
        for t in CORE_NATIONAL_TITLES:
            if need_types <= 0:
                break
            if t not in used_titles:
                picked.append(t)
                used_titles.add(t)
                need_types -= 1
        # 剩余类型走画像分层采样（核心40% + 次核心35% + 特色15% + 其他10%）
        if need_types > 0:
            extra = pick_diverse_titles(profile, used_titles, need_types, rng)
            for t in extra:
                if t not in used_titles:
                    picked.append(t)
                    used_titles.add(t)
        for title in picked:
            item = _pool_item_for_title(title)
            jobs.append(_make_diverse_record(city_short, item, profile, rng, used_sids))

    # 2) 补齐记录数（同一岗位允许多条记录，城市专属权重高者概率更高）
    current = total_records + len(jobs)
    if current < target_records:
        hot_pool = hot_pool_for_city(profile.get("core_industries", []) + profile.get("secondary_industries", []))
        real_items = []
        for t in existing_titles:
            if t not in JOB_TITLE_SET:
                real_items.append({"title": t, "hot": 0.7, "cat": "综合", "ind_tags": []})
        all_items = hot_pool + real_items
        all_items = [x for x in all_items if x["title"] not in used_titles or x["title"] in existing_titles]
        if all_items:
            w = [max(weights.get(p["title"], p.get("hot", 0.5)), 0.1) for p in all_items]
            while current < target_records:
                p = rng.choices(all_items, weights=w)[0]
                jobs.append(_make_diverse_record(city_short, p, profile, rng, used_sids))
                current += 1

    return jobs


def generate_jobs_for_city(city_short: str, province: str, existing_titles: set[str],
                           need: int, rng: random.Random) -> list[dict]:
    """基于【城市岗位画像】为城市生成 need 个不重复岗位记录"""
    jobs = []
    used_titles = set(existing_titles)
    used_sids = set()
    profile = build_city_profile(city_short, len(used_titles), len(used_titles))
    picked = pick_diverse_titles(profile, used_titles, need, rng)
    for title in picked:
        item = _pool_item_for_title(title)
        jobs.append(_make_diverse_record(city_short, item, profile, rng, used_sids))
        used_titles.add(title)

    # 若还不够（画像池耗尽），追加带序号变体（不重复标题）
    extra_idx = 1
    pool_titles = list(profile["title_weights"].keys()) or ["软件工程师", "前端开发工程师"]
    while len(jobs) < need:
        base_title = pool_titles[len(jobs) % len(pool_titles)]
        title = f"{base_title}（{extra_idx}）"
        extra_idx += 1
        if title in used_titles:
            continue
        used_titles.add(title)
        item = _pool_item_for_title(base_title)
        rec = _make_diverse_record(city_short, item, profile, rng, used_sids)
        rec["job_title"] = title
        rec["industry_tags"] = "综合管理"
        jobs.append(rec)

    # 分配确定性的 source_id（覆盖 _next_sid，保持 seed- 前缀兼容）
    for i, j in enumerate(jobs):
        j["source_id"] = f"seed-{city_short}-{i:03d}"
    return jobs


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

async def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="全国各市岗位数据补充（ai_seed）")
    parser.add_argument("--city", help="只处理指定城市（短名，如：南昌）")
    parser.add_argument("--rebuild", action="store_true", help="先删除已有 ai_seed 行再重建")
    parser.add_argument("--dry-run", action="store_true", help="只统计不写入")
    parser.add_argument("--min-jobs", type=int, default=20, help="每市最少岗位数（默认 20）")
    args = parser.parse_args()

    # Windows 控制台 GBK 传参时中文可能乱码，尝试还原为 UTF-8
    if args.city and sys.platform == "win32":
        try:
            args.city = args.city.encode("gbk", "ignore").decode("utf-8")
        except Exception:
            pass

    db = {
        "host": os.getenv("PG_HOST", "127.0.0.1"),
        "port": int(os.getenv("PG_PORT", "5432")),
        "user": os.getenv("PG_USER", "postgres"),
        "password": os.getenv("PG_PASSWORD", "123456"),
        "database": os.getenv("PG_DB", "postgres"),
    }
    conn = await asyncpg.connect(**db)
    try:
        await migrate(conn)
        print("[迁移] the_total_table_copy1 已补齐 industry_tags/skills/job_description/qualification/work_experience/city_seed/sort_weight 列")

        if args.rebuild and not args.dry_run:
            if args.city:
                n = await rebuild_city_ai_seed(conn, _norm_city_for_query(args.city))
                print(f"[重建] 已删除 {args.city} 的 ai_seed 行 {n} 条")
            else:
                n = await delete_all_ai_seed(conn)
                print(f"[重建] 已删除全部 ai_seed 行 {n} 条")

        if args.city:
            cities = [(args.city, CITY_TO_PROVINCE.get(_norm_city_for_query(args.city), "未知"))]
        else:
            cities = sorted(CITY_TO_PROVINCE.items(), key=lambda x: x[0])

        summary = []
        total_inserted = 0
        for city_short, province in cities:
            city_short = _norm_city_for_query(city_short)
            stats = await get_city_stats(conn, city_short)
            existing_titles = {r["job_title"] for r in stats["rows"]}
            total_records = sum(r["cnt"] for r in stats["rows"])
            real_count = sum(1 for r in stats["rows"] if not r["is_ai_seed"])
            ai_seed_count = len(existing_titles) - real_count

            # 城市画像目标（按城市规模分级：大城市60-150 / 中型40-90 / 普通20-70）
            target_records, target_types = city_scale(city_short, total_records, len(existing_titles))
            target_records = max(target_records, args.min_jobs)
            target_types = max(target_types, min(args.min_jobs, 20))
            need_records = target_records - total_records
            if need_records <= 0 and len(existing_titles) >= target_types:
                summary.append((city_short, province, real_count, ai_seed_count,
                                len(existing_titles), len(existing_titles), 0, True))
                continue

            sids = await conn.fetch(
                "SELECT source_id FROM the_total_table_copy1 WHERE source_name='ai_seed' AND split_part(city,'·',1)=$1",
                city_short,
            )
            existing_sids = {r["source_id"] for r in sids}
            rng = random.Random(stable_seed(city_short + "|profile|" + province + "|" + str(target_records)))
            jobs = build_diverse_jobs(city_short, province, existing_titles, total_records,
                                      target_records, target_types, existing_sids, rng)

            if args.dry_run:
                total_after = total_records + len(jobs)
                ok = total_after >= target_records and len(existing_titles | {j["job_title"] for j in jobs}) >= target_types
                summary.append((city_short, province, real_count, ai_seed_count,
                                len(existing_titles), total_after, len(jobs), ok))
                continue

            inserted = await upsert_seed_jobs(conn, city_short, jobs)
            total_inserted += inserted
            total_after = total_records + inserted
            ok = total_after >= target_records and (len(existing_titles) + len(jobs)) >= target_types
            summary.append((city_short, province, real_count, ai_seed_count,
                            len(existing_titles), total_after, inserted, ok))

        # 输出验证表
        print()
        print(f"{'城市':<10}{'省份':<8}{'真实标题':<8}{'已有AI':<8}{'补齐前':<8}{'补齐后':<8}{'新增':<6}{'达标'}")
        print("-" * 70)
        fail = 0
        for row in summary:
            city, prov, real, ai, before, after, added, ok = row
            mark = "OK" if ok else "!!"
            if not ok:
                fail += 1
            print(f"{city:<10}{prov:<8}{real:<8}{ai:<8}{before:<8}{after:<8}{added:<6}{mark}")
        print("-" * 70)
        print(f"共 {len(summary)} 个城市，新增写入 {total_inserted} 条，未达标 {fail} 个")
        if fail:
            print("未达标城市：", [s[0] for s in summary if not s[7]])
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
