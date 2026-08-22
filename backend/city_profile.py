# -*- coding: utf-8 -*-
"""
城市岗位画像引擎（City Job Profile）
====================================
为每个城市建立【确定性、差异化】的岗位画像，替代原先"全省共用一个岗位池"的
生成方式，从根本上解决全国各市岗位分析高度重复的问题。

核心机制：
1. 城市编码：provinceCode(1~N) + cityCode(省内序号) → citySeed = hash(provinceCode + cityCode)
   - 同城稳定（每次生成结果一致）、城城不同
2. 城市等级：major / mid / small（依据 MAJOR_CITIES + 已有数据量）
3. 产业分层：
   - 核心产业（省内主导产业，按 seed 稳定抽 2 个）
   - 次核心产业（省内剩余产业，抽 2 个）
   - 特色产业（全国特色产业池，按 seed 抽 2 个；重要城市有定向特色产业）
   - 辅助/通用岗（任何城市都存在的通用岗位）
4. 岗位权重：同一岗位在不同城市权重不同
   - 基础分：核心产业命中 1.0 / 特色产业命中 0.85 / 次核心 0.75 / 通用 0.55
   - 城市扰动：×(0.85~1.15)，由 citySeed+title 哈希决定 → 同岗不同城权重不同
5. 分层采样：核心 40% + 次核心 35% + 特色 15% + 其他 10%
6. 技能组合差异：同一岗位在不同城市，因城市特色产业不同而追加不同技能
   （如 Java 在"数字经济"城市 → Java/SpringBoot/Vue/MySQL/Redis；
      在"工业互联网"城市 → Java/SpringBoot/MySQL/MES/IoT/PLC）

调用方：
- seed_city_jobs.build_diverse_jobs / generate_jobs_for_city（生成并写库）
- services._generate_fallback_jobs（内存兜底）
"""
import hashlib
import random

from backend.mappings import CITY_TO_PROVINCE, PROVINCE_CODE
from backend.job_pool import JOB_POOL, JOB_TITLE_SET, MAJOR_CITIES, city_tier as _stable_city_tier

# ---------------------------------------------------------------------------
# 特色产业池：作为"城市专属岗位"来源（与省份主导产业区分）
# ---------------------------------------------------------------------------
FEATURE_INDUSTRY_POOL = [
    "数字经济", "软件外包", "大数据", "智能制造软件", "工业软件",
    "软件测试", "数据安全", "智能家居", "物联网", "工业互联网",
    "医疗器械", "新能源电池", "集成电路", "人工智能", "金融科技",
    "软件", "云计算", "虚拟现实", "电商", "现代物流",
]

# 重要城市的定向特色产业（保证用户重点城市画像符合直觉）
CITY_FEATURE_INDUSTRIES = {
    "南昌": ["人工智能", "数字经济"],
    "九江": ["工业互联网", "智能制造软件"],
    "赣州": ["智能制造", "工业软件"],
    "北京": ["人工智能", "金融科技"],
    "上海": ["集成电路", "人工智能"],
    "深圳": ["人工智能", "物联网"],
    "广州": ["数字经济", "大数据"],
    "杭州": ["数字经济", "电商"],
    "成都": ["数字经济", "人工智能"],
    "武汉": ["光电子", "工业软件"],
    "西安": ["集成电路", "大数据"],
    "南京": ["集成电路", "软件"],
    "合肥": ["集成电路", "人工智能"],
    "长沙": ["工程机械", "工业软件"],
    "郑州": ["智能电网", "大数据"],
    "青岛": ["海洋经济", "智能制造"],
    "苏州": ["集成电路", "智能制造"],
    "无锡": ["集成电路", "物联网"],
    "天津": ["智能制造", "大数据"],
    "重庆": ["智能制造", "新能源汽车"],
}

# 产业 → 岗位标题模板（对齐 seed_city_jobs.INDUSTRY_JOB_TEMPLATES 中数字相关键）
INDUSTRY_JOB_TEMPLATES = {
    "人工智能": ["算法工程师", "机器学习工程师", "深度学习工程师", "自然语言处理工程师", "计算机视觉工程师",
                "大模型应用开发工程师", "AI平台开发工程师", "数据挖掘工程师", "推荐算法工程师", "智能语音算法工程师"],
    "互联网": ["Java开发工程师", "Python开发工程师", "前端开发工程师", "后端开发工程师", "测试开发工程师",
               "运维开发工程师", "系统架构师", "全栈开发工程师", "Go开发工程师", "移动端开发工程师", "安全工程师"],
    "生物医药": ["药物研发工程师", "制剂研究员", "临床研究员", "质量分析工程师", "注册专员",
                "生物信息工程师", "细胞培养工程师", "医疗器械研发工程师", "工艺开发工程师", "药物质检工程师"],
    "汽车制造": ["整车设计工程师", "底盘工程师", "车身结构工程师", "动力系统工程师", "电气工程师",
                "汽车电子工程师", "CAE仿真工程师", "焊接工艺工程师", "质量工程师", "采购工程师"],
    "装备制造": ["机械设计工程师", "电气工程师", "自动化工程师", "工艺工程师", "数控编程工程师",
                "液压工程师", "结构工程师", "焊接工程师", "质检工程师", "设备维护工程师"],
    "航空航天": ["飞行器设计工程师", "航电工程师", "结构强度工程师", "气动工程师", "适航工程师",
                "复合材料工程师", "发动机工程师", "测试工程师", "工艺工程师", "项目管理工程师"],
    "能源化工": ["化工工艺工程师", "安全工程师", "设备工程师", "仪表工程师", "质量工程师",
                "研发工程师", "生产管理工程师", "环保工程师", "电气工程师", "储运工程师"],
    "食品加工": ["食品研发工程师", "质量管理工程师", "工艺工程师", "设备工程师", "食品检验员",
                "包装工程师", "生产主管", "食品安全专员", "仓储主管", "采购专员"],
    "物流": ["物流规划工程师", "仓储运营主管", "运输调度员", "供应链专员", "数据分析师",
             "快递网点经理", "关务专员", "配送主管", "物流专员", "WMS工程师"],
    "智能电网": ["电力系统工程师", "变电工程师", "继电保护工程师", "智能电网工程师", "电力设计工程师",
                "配电自动化工程师", "新能源并网工程师", "电能质量工程师", "电气试验工程师", "电力调度员"],
    "工程机械": ["机械设计工程师", "液压工程师", "电气工程师", "结构工程师", "试验工程师",
                "工艺工程师", "售后服务工程师", "销售工程师", "质量工程师", "智能化工程师"],
    "新材料": ["材料研发工程师", "高分子材料工程师", "复合材料工程师", "金属材料工程师", "工艺工程师",
              "质量工程师", "测试工程师", "研发工程师", "涂层工程师", "电池材料工程师"],
    "轨道交通": ["轨道车辆工程师", "信号工程师", "通信工程师", "电气工程师", "机械工程师",
                "供电工程师", "调度工程师", "检修工程师", "安全工程师", "站务管理"],
    "化工": ["化工工艺工程师", "设备工程师", "安全工程师", "仪表工程师", "分析工程师",
             "研发工程师", "质量工程师", "环保工程师", "电气工程师", "生产管理"],
    "家电": ["结构工程师", "电子工程师", "嵌入式软件工程师", "工业设计工程师", "制冷工程师",
             "品质工程师", "测试工程师", "工艺工程师", "自动化工程师", "模具工程师"],
    "纺织鞋服": ["服装设计师", "面料研发工程师", "打版师", "工艺工程师", "质量主管",
                "生产经理", "采购专员", "陈列设计师", "电商运营", "供应链专员"],
    "锂电新能源": ["电芯研发工程师", "模组设计工程师", "PACK结构工程师", "BMS软件工程师", "测试工程师",
                  "工艺工程师", "质量工程师", "设备工程师", "电池回收工程师", "材料研发工程师"],
    "有色金属": ["冶金工程师", "材料工程师", "工艺工程师", "设备工程师", "化验员",
                "质量工程师", "研发工程师", "采矿工程师", "选矿工程师", "安全工程师"],
    "铝产业": ["铝加工工程师", "熔炼工程师", "轧制工程师", "挤压工程师", "模具工程师",
              "工艺工程师", "质量工程师", "设备工程师", "电气工程师", "化验员"],
    "旅游": ["旅游产品经理", "景区运营经理", "旅游策划师", "酒店运营经理", "导游",
             "研学导师", "文旅项目经理", "市场营销经理", "新媒体运营", "客服主管"],
    "现代农业": ["农业技术员", "育种工程师", "植保工程师", "农业机械工程师", "土壤检测员",
                "水产养殖技术员", "农业信息化工程师", "农产品质检员", "农场运营经理", "食品加工工程师"],
    "数字贸易": ["跨境电商运营", "外贸专员", "数据分析师", "海外市场经理", "关务专员",
                "物流运营主管", "数字营销经理", "电商运营", "产品经理", "客服主管"],
    "绿色能源": ["光伏系统工程师", "风电运维工程师", "储能系统工程师", "电力电子工程师", "节能工程师",
                "能源管理工程师", "碳管理工程师", "环保工程师", "电气工程师", "项目工程师"],
    "酱酒": ["酿酒工程师", "发酵工程师", "品酒师", "质量工程师", "工艺工程师",
             "包装工程师", "生产主管", "设备工程师", "检验员", "渠道经理"],
    "有色冶金": ["冶金工程师", "工艺工程师", "设备工程师", "电气工程师", "化验员",
                "质量工程师", "研发工程师", "安全工程师", "环保工程师", "生产管理"],
    "中医药": ["中药研发工程师", "中药药剂师", "药物分析研究员", "提取工艺工程师", "质量工程师",
              "种植技术员", "制药工程师", "检验员", "注册专员", "生产主管"],
    "石油化工": ["化工工艺工程师", "设备工程师", "安全工程师", "仪表工程师", "管道工程师",
                "储运工程师", "分析工程师", "电气工程师", "质量工程师", "生产管理"],
    "盐湖化工": ["化工工艺工程师", "设备工程师", "电气工程师", "仪表工程师", "化验员",
                "研发工程师", "质量工程师", "安全工程师", "环保工程师", "生产管理"],
    "枸杞产业": ["农业技术员", "食品研发工程师", "质量工程师", "工艺工程师", "检验员",
                "电商运营", "销售经理", "品牌运营", "仓储主管", "生产主管"],
    "能源": ["能源工程师", "电气工程师", "项目工程师", "设备工程师", "安全工程师",
             "运维工程师", "分析工程师", "质量工程师", "采购工程师", "商务经理"],
    "纺织": ["纺织工程师", "染整工程师", "工艺工程师", "质量主管", "设备工程师",
             "生产管理", "采购专员", "检测员", "面料开发", "电商运营"],
    "清洁能源": ["光伏工程师", "风电工程师", "氢能工程师", "储能工程师", "电力电子工程师",
                "节能工程师", "项目工程师", "运维工程师", "电气工程师", "碳管理工程师"],
    "乳业": ["乳品研发工程师", "质量工程师", "工艺工程师", "设备工程师", "检验员",
             "牧场技术员", "生产主管", "采购专员", "仓储主管", "品牌运营"],
    "稀土": ["稀土材料工程师", "冶金工程师", "工艺工程师", "分析工程师", "设备工程师",
             "研发工程师", "质量工程师", "环保工程师", "电气工程师", "生产管理"],
    "冶金": ["冶金工程师", "炼钢工程师", "轧制工程师", "工艺工程师", "设备工程师",
             "质量工程师", "安全工程师", "化验员", "电气工程师", "生产管理"],
    "钢铁": ["炼钢工程师", "轧钢工程师", "冶金工程师", "工艺工程师", "设备工程师",
             "质量工程师", "安全工程师", "化验员", "电气工程师", "环保工程师"],
    "冰雪旅游": ["滑雪场运营经理", "酒店运营经理", "景区运营专员", "旅游策划师", "客服主管",
                "市场营销经理", "体育教练", "活动策划", "新媒体运营", "后勤主管"],
    "会展": ["会展策划师", "会展项目经理", "展位设计师", "活动执行", "客户经理",
             "市场推广专员", "搭建工程师", "后勤专员", "商务专员", "新媒体运营"],
    "半导体": ["芯片验证工程师", "数字IC设计工程师", "模拟IC设计工程师", "版图设计工程师", "半导体工艺工程师",
              "封装测试工程师", "固件开发工程师", "嵌入式软件工程师", "设备工程师", "硬件工程师"],
    "大数据": ["大数据开发工程师", "数据分析师", "数据仓库工程师", "数据挖掘工程师", "ETL工程师",
              "BI工程师", "数据治理工程师", "数据工程师", "算法工程师", "数据产品经理"],
    "数字经济": ["Java开发工程师", "前端开发工程师", "数据分析师", "产品经理", "测试工程师",
                "运维工程师", "UI设计师", "数字化顾问", "项目经理", "解决方案工程师"],
    "工业互联网": ["工业互联网工程师", "工业数据分析师", "数字化制造工程师", "物联网工程师",
                  "IoT开发工程师", "边缘计算工程师", "PLC工程师", "MES实施工程师", "设备联网工程师", "自动化软件工程师"],
    "智能制造软件": ["MES开发工程师", "WMS开发工程师", "工业软件工程师", "实施工程师",
                    "Java开发工程师", "前端开发工程师", "算法工程师", "数据库工程师", "系统架构师", "测试工程师"],
    "工业软件": ["工业软件工程师", "CAD/CAM工程师", "MES实施工程师", "算法工程师",
                "Java开发工程师", "前端开发工程师", "测试工程师", "产品经理", "数据库工程师", "系统架构师"],
    "软件": ["Java开发工程师", "前端开发工程师", "测试工程师", "Python开发工程师", "软件实施工程师",
             "运维工程师", "数据库工程师", "产品经理", "UI设计师", "系统集成工程师"],
    "软件外包": ["Java开发工程师", "前端开发工程师", "测试工程师", "运维工程师", "数据库工程师",
                "产品经理", "项目助理", "Python开发工程师", "UI设计师", "实施工程师"],
    "软件测试": ["测试开发工程师", "自动化测试工程师", "性能测试工程师", "功能测试工程师", "安全测试工程师",
                "测试经理", "测试架构师", "质量保障工程师", "Java开发工程师", "前端开发工程师"],
    "数据安全": ["安全工程师", "数据安全工程师", "渗透测试工程师", "安全运维工程师", "密码学工程师",
                "Java开发工程师", "前端开发工程师", "安全产品经理", "合规专员", "安全分析师"],
    "智能家居": ["嵌入式软件工程师", "硬件工程师", "Android开发工程师", "iOS开发工程师", "测试工程师",
                "Java开发工程师", "结构工程师", "产品经理", "工业设计师", "质量工程师"],
    "物联网": ["物联网开发工程师", "物联网平台工程师", "IoT软件工程师", "嵌入式开发工程师",
              "智能硬件工程师", "设备联网工程师", "传感器应用工程师", "IoT开发工程师", "边缘计算工程师"],
    "集成电路": ["芯片验证工程师", "数字IC设计工程师", "模拟IC设计工程师", "版图设计工程师", "嵌入式软件工程师",
                "FPGA开发工程师", "半导体工艺工程师", "封装测试工程师", "固件开发工程师", "硬件工程师"],
    "云计算": ["云计算工程师", "云平台开发工程师", "DevOps工程师", "云原生工程师", "容器技术工程师",
              "Kubernetes工程师", "系统架构师", "运维工程师", "Linux运维工程师", "网络工程师"],
    "虚拟现实": ["Unity开发工程师", "UE4开发工程师", "3D建模师", "VR开发工程师", "AR开发工程师",
                "渲染工程师", "Unity技术美术", "交互设计师", "图形算法工程师", "测试工程师"],
    "电商": ["Java开发工程师", "前端开发工程师", "数据分析师", "运营专员", "商品运营经理",
             "电商产品经理", "UI设计师", "物流运营专员", "客服运营主管", "增长运营经理"],
    "金融科技": ["Java开发工程师", "数据分析师", "风控建模工程师", "量化研究员", "区块链开发工程师",
                "支付系统工程师", "前端开发工程师", "测试工程师", "反欺诈算法工程师", "金融产品经理"],
    "现代物流": ["物流规划工程师", "仓储运营主管", "运输调度员", "供应链专员", "数据分析师",
                "Java开发工程师", "前端开发工程师", "物流产品经理", "配送网络规划师", "关务专员"],
    "医疗器械": ["医疗器械研发工程师", "结构工程师", "软件工程师", "测试工程师", "注册工程师",
                "质量工程师", "工艺工程师", "临床工程师", "售后工程师", "电气工程师"],
    "新能源电池": ["电芯研发工程师", "模组设计工程师", "PACK结构工程师", "BMS软件工程师", "测试工程师",
                  "工艺工程师", "质量工程师", "设备工程师", "电池回收工程师", "材料研发工程师"],
    "光电子": ["光学工程师", "光通信工程师", "激光工程师", "光学设计工程师", "光模块研发工程师",
              "封装工艺工程师", "测试工程师", "硬件工程师", "嵌入式软件工程师", "可靠性工程师"],
    "海洋经济": ["海洋工程工程师", "渔业工程师", "船舶工程师", "港口物流专员", "海洋生物研究员",
                "深海装备工程师", "海洋数据工程师", "水产养殖技术员", "海洋能源工程师", "项目工程师"],
    "智能制造": ["电气工程师", "机械设计工程师", "自动化工程师", "工业机器人工程师", "PLC工程师",
                "嵌入式开发工程师", "视觉检测工程师", "MES实施工程师", "数控编程工程师", "设备维护工程师"],
    "新能源汽车": ["电池系统工程师", "电控软件工程师", "电机设计工程师", "整车集成工程师", "充电桩开发工程师",
                  "自动驾驶算法工程师", "汽车电子工程师", "线束设计工程师", "热管理系统工程师", "BMS软件开发工程师"],
}

# 通用职能岗位池（任何城市都会补一些通用岗）
COMMON_FUNC_JOBS = [
    "人力资源专员", "招聘专员", "财务会计", "出纳", "行政专员",
    "销售经理", "市场专员", "商务专员", "采购专员", "客服主管",
    "品牌运营", "新媒体运营", "平面设计师", "项目经理", "法务专员",
    "外贸专员", "数据分析师", "物流专员", "培训专员", "体系工程师",
]

# 产业 → 追加技能（实现"同岗位不同城市技能不同"）
INDUSTRY_TECH_EXTRA = {
    "数字经济": ["Vue", "TypeScript", "微服务", "Docker"],
    "人工智能": ["PyTorch", "TensorFlow", "大模型", "OpenCV"],
    "大数据": ["Hadoop", "Spark", "Flink", "Hive"],
    "云计算": ["Docker", "Kubernetes", "AWS", "OpenStack"],
    "工业互联网": ["MES", "IoT", "PLC", "SCADA"],
    "智能制造软件": ["MES", "WMS", "数据采集", "工业软件"],
    "工业软件": ["CAD/CAM", "MES", "数据采集", "算法"],
    "软件": ["Spring Boot", "Vue", "MySQL", "微服务"],
    "软件外包": ["Spring Boot", "Vue", "项目交付", "客户沟通"],
    "软件测试": ["Selenium", "JMeter", "自动化测试", "性能测试"],
    "数据安全": ["渗透测试", "防火墙", "等保", "安全审计"],
    "智能家居": ["嵌入式", "Android", "IoT", "硬件"],
    "物联网": ["MQTT", "传感器", "嵌入式", "数据采集"],
    "集成电路": ["Verilog", "FPGA", "EDA", "Vivado"],
    "虚拟现实": ["Unity", "UE", "3D建模", "渲染"],
    "电商": ["电商运营", "商品管理", "流量投放", "供应链"],
    "金融科技": ["风控建模", "量化", "支付系统", "区块链"],
    "现代物流": ["物流管理", "仓储运营", "运输调度", "供应链"],
    "医疗器械": ["医疗器械注册", "ISO13485", "质量体系"],
    "新能源电池": ["BMS", "电芯", "PACK", "电池测试"],
    "光电子": ["光学设计", "光通信", "激光技术", "光学检测"],
    "海洋经济": ["海洋工程", "船舶", "港口物流", "海洋数据"],
    "智能制造": ["MES", "PLC", "工业机器人", "视觉检测"],
    "新能源汽车": ["BMS", "电控", "电机", "自动驾驶"],
}


def _stable_seed(text: str) -> int:
    return int(hashlib.md5(text.encode("utf-8")).hexdigest(), 16) % (2 ** 32)


# ---------------------------------------------------------------------------
# 城市编码：provinceCode + cityCode（全局稳定）
# ---------------------------------------------------------------------------
_CITY_CODES_CACHE: dict = None


def _build_city_codes() -> dict:
    """返回 {city_short: {"province": str, "province_code": str, "city_code": str}}

    - province_code 采用省级国标行政区划码（如 江西=360000）
    - city_code 为省内城市序号（1~N，按城市名排序，保证稳定）
    """
    codes = {}
    # 城市 → 省份（CITY_TO_PROVINCE 为 {city: province}）
    prov_cities: dict = {}
    for city, prov in CITY_TO_PROVINCE.items():
        short = str(city).split("·")[0].rstrip("市")
        prov_cities.setdefault(prov, set()).add(short)
    for prov, cities in prov_cities.items():
        p_code = PROVINCE_CODE.get(prov)
        if not p_code:
            # 未知省份：用省份名 hash 生成稳定 6 位码
            p_code = f"{_stable_seed('prov|' + prov) % 900000 + 100000:06d}"
        for c_idx, city in enumerate(sorted(cities), 1):
            codes.setdefault(city, {
                "province": prov,
                "province_code": str(p_code),
                "city_code": f"{c_idx:03d}",
            })
    return codes


def get_city_codes(city_short: str) -> dict:
    """获取城市编码；未知城市用省份名哈希生成稳定编码（保证幂等）"""
    global _CITY_CODES_CACHE
    if _CITY_CODES_CACHE is None:
        _CITY_CODES_CACHE = _build_city_codes()
    hit = _CITY_CODES_CACHE.get(city_short)
    if hit:
        return hit
    # 未知城市：用城市名哈希生成稳定编码
    h = _stable_seed("unknown-city|" + city_short)
    return {"province": "未知",
            "province_code": f"{h % 900000 + 100000:06d}",
            "city_code": f"{(h >> 8) % 900 + 1:03d}"}


def city_seed(city_short: str) -> int:
    """citySeed = hash(provinceCode + cityCode)：同城稳定、城城不同"""
    codes = get_city_codes(city_short)
    return _stable_seed(f"{codes['province_code']}|{codes['city_code']}")


def city_tier(city_short: str, existing_records: int = 0, existing_types: int = 0) -> str:
    """城市等级：major / mid / small（委托 job_pool 稳定版，幂等不漂移）"""
    return _stable_city_tier(city_short)


# ---------------------------------------------------------------------------
# 城市画像构建
# ---------------------------------------------------------------------------
def build_city_profile(city_short: str, existing_records: int = 0,
                       existing_types: int = 0) -> dict:
    """构建城市岗位画像（确定性）：

    {
      "city": 短名, "province": 省份,
      "seed": citySeed,
      "tier": major/mid/small,
      "core_industries": [2], "secondary_industries": [2], "feature_industries": [2],
      "core_titles": [...], "secondary_titles": [...],
      "feature_titles": [...], "aux_titles": [...],
      "title_weights": {title: weight},
    }
    """
    codes = get_city_codes(city_short)
    province = codes["province"]
    seed = city_seed(city_short)
    rng = random.Random(seed)
    tier = city_tier(city_short, existing_records, existing_types)

    # 省份主导产业
    try:
        from backend.seed_city_jobs import PROVINCE_INDUSTRIES
        prov_industries = list(PROVINCE_INDUSTRIES.get(province, ["互联网", "智能制造"]))
    except Exception:
        prov_industries = ["互联网", "智能制造"]

    # 1) 核心产业：省内主导产业按 seed 稳定抽 2 个（同省城市核心产业不同）
    shuffled_inds = prov_industries[:]
    rng.shuffle(shuffled_inds)
    core_inds = shuffled_inds[:2] or ["互联网"]
    # 2) 次核心产业：省内剩余抽 2 个
    rest_inds = [x for x in shuffled_inds if x not in core_inds]
    secondary_inds = rest_inds[:2] or []

    # 3) 特色产业：定向特色（重要城市）优先，否则全国池按 seed 抽 2 个
    directed = CITY_FEATURE_INDUSTRIES.get(city_short)
    if directed:
        feature_inds = directed[:2]
    else:
        pool = [x for x in FEATURE_INDUSTRY_POOL if x not in prov_industries]
        if len(pool) < 2:
            pool = FEATURE_INDUSTRY_POOL[:]
        rng2 = random.Random(seed + 7)
        rng2.shuffle(pool)
        feature_inds = pool[:2]

    # 4) 岗位池：按产业 → 标题模板 抽取；无模板的产业用全景池补
    def _titles_for_industries(inds: list) -> list:
        titles = []
        for ind in inds:
            titles.extend(INDUSTRY_JOB_TEMPLATES.get(ind, []))
        # 去重保序
        seen, out = set(), []
        for t in titles:
            if t not in seen:
                seen.add(t)
                out.append(t)
        return out

    core_titles = _titles_for_industries(core_inds)
    secondary_titles = _titles_for_industries(secondary_inds)
    feature_titles = _titles_for_industries(feature_inds)
    # 辅助/通用岗：全景池通用方向 + 通用职能岗
    aux_titles = []
    for p in JOB_POOL:
        if p["cat"] in ("软件开发", "产品与数字化", "云计算与基础设施"):
            aux_titles.append(p["title"])
    aux_titles += [t for t in COMMON_FUNC_JOBS if t not in aux_titles]

    # 5) 岗位权重：基础分 × 城市扰动
    def _base_weight(title: str) -> float:
        if title in core_titles:
            return 1.0
        if title in feature_titles:
            return 0.85
        if title in secondary_titles:
            return 0.75
        if title in aux_titles:
            return 0.55
        return 0.45

    title_weights = {}
    all_titles = list(dict.fromkeys(core_titles + secondary_titles + feature_titles + aux_titles))
    for t in all_titles:
        jitter = 0.85 + random.Random(seed + _stable_seed(t)).random() * 0.3
        title_weights[t] = round(_base_weight(t) * jitter, 3)

    return {
        "city": city_short,
        "province": province,
        "seed": seed,
        "tier": tier,
        "core_industries": core_inds,
        "secondary_industries": secondary_inds,
        "feature_industries": feature_inds,
        "core_titles": core_titles,
        "secondary_titles": secondary_titles,
        "feature_titles": feature_titles,
        "aux_titles": aux_titles,
        "title_weights": title_weights,
    }


# ---------------------------------------------------------------------------
# 分层采样：核心 40% + 次核心 35% + 特色 15% + 其他 10%
# ---------------------------------------------------------------------------
def pick_diverse_titles(profile: dict, used_titles: set, need_types: int,
                        rng: random.Random) -> list:
    """按城市画像分层采样岗位标题（不重复 used_titles）"""
    core = [t for t in profile["core_titles"] if t not in used_titles]
    secondary = [t for t in profile["secondary_titles"] if t not in used_titles]
    feature = [t for t in profile["feature_titles"] if t not in used_titles]
    aux = [t for t in profile["aux_titles"] if t not in used_titles]

    weights = profile["title_weights"]
    picked = []

    def _pick(pool: list, n: int) -> int:
        if not pool or n <= 0:
            return 0
        w = [max(weights.get(t, 0.5), 0.05) for t in pool]
        chosen = rng.choices(pool, weights=w, k=n)
        got = 0
        for t in chosen:
            if t not in picked:
                picked.append(t)
                got += 1
        return got

    n_core = round(need_types * 0.40)
    n_sec = round(need_types * 0.35)
    n_feat = round(need_types * 0.15)
    n_aux = need_types - n_core - n_sec - n_feat

    got = _pick(core, n_core)
    got += _pick(secondary, n_sec)
    got += _pick(feature, n_feat)
    got += _pick(aux, n_aux)

    # 仍不足时：按权重从全池补
    if len(picked) < need_types:
        remain = [t for t in profile["title_weights"] if t not in used_titles and t not in picked]
        remain.sort(key=lambda t: -weights.get(t, 0.5))
        for t in remain:
            if len(picked) >= need_types:
                break
            picked.append(t)
    return picked[:need_types]


# ---------------------------------------------------------------------------
# 技能组合差异：同岗位不同城市技能不同
# ---------------------------------------------------------------------------
def _base_skills_for_title(title: str) -> list:
    for p in JOB_POOL:
        if p["title"] == title:
            return list(p.get("skills") or [])
    # 全景池未覆盖：按关键词粗推
    if any(k in title for k in ("Java", "后端", "全栈")):
        return ["Java", "Spring Boot", "MySQL", "Redis"]
    if any(k in title for k in ("前端", "Web", "Vue", "React")):
        return ["HTML/CSS", "JavaScript", "Vue", "TypeScript"]
    if any(k in title for k in ("算法", "AI", "机器学习", "深度学习")):
        return ["Python", "PyTorch", "TensorFlow", "机器学习"]
    if any(k in title for k in ("数据", "BI", "ETL")):
        return ["SQL", "Python", "Pandas", "数据分析"]
    if any(k in title for k in ("测试", "QA")):
        return ["Python", "Selenium", "JMeter", "自动化测试"]
    if any(k in title for k in ("运维", "DevOps", "云")):
        return ["Linux", "Docker", "Kubernetes", "CI/CD"]
    if any(k in title for k in ("嵌入式", "硬件", "芯片", "IC", "FPGA")):
        return ["C", "C++", "Linux", "嵌入式"]
    return ["SQL", "Excel", "办公自动化"]


def city_skill_variant(title: str, profile: dict) -> list:
    """同一岗位在不同城市生成不同技能组合（确定性）：
    - 基础技能来自全景池/关键词推断
    - 按城市核心+特色产业追加产业技能（前 2 个产业）
    - 按 citySeed+title 稳定裁剪，最多 8 个
    """
    base = _base_skills_for_title(title)
    extra = []
    inds = profile["feature_industries"] + profile["core_industries"]
    for ind in inds[:2]:
        for s in INDUSTRY_TECH_EXTRA.get(ind, []):
            if s not in base and s not in extra:
                extra.append(s)
    merged = base + extra[:5]
    # 稳定打乱后去重，保证同城稳定、城城不同
    rng = random.Random(profile["seed"] + _stable_seed(title))
    rng.shuffle(merged)
    seen, out = set(), []
    for s in merged:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out[:8]
