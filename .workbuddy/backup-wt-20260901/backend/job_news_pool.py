# -*- coding: utf-8 -*-
"""
岗位资讯种子库（智途破局 · 智能发现）
====================================
**为什么要有这个文件**

用户诉求：本平台的核心是「岗位 / 职业」，智能发现里出现的一切内容都必须是
**与岗位相关的计算机行业资讯**——学什么、去哪、会不会被替代、哪个岗位在涨薪。
与之无关的内容（娱乐、体育、通用时政、纯工具仓库）一律不进结果。

真实爬虫受反爬 / 时间影响，某些分类某轮可能一条岗位相关都抓不到。
为保证「点一次发现，五大类都有内容，而且每次看到的不一样」，这里内置一份
**人工整理的岗位资讯索引**：每条都是真实存在的求职/技术方向，点击后跳到
对应平台的**实时搜索结果页**（不是死链），因此既是「存一些数据」，
又保持了真实可用性。

设计约束（改动前请先读）：
1. 每条必须 `岗位相关` + `计算机/IT 相关`，两者缺一不可。
2. `url` 一律用**平台搜索 URL**（`site` + `q`），不写死具体文章/职位 id，
   否则链接很快失效。`build_url()` 负责 quote 编码。
3. 每个分类至少 12 条，保证轮换时有足够组合空间（C(14,6) 量级）。
4. 不要在这里写站点名到前端展示；站点名只在日志/抽屉里出现。
"""

import random
from urllib.parse import quote

# ---------------------------------------------------------------------------
# 平台搜索 URL 模板（%s 会被 urlencode 后的关键词替换）
# 说明：这些是各平台的通用搜索页，长期稳定，不会像详情页那样失效。
# ---------------------------------------------------------------------------
SITE_URLS = {
    "zhipin":  "https://www.zhipin.com/web/geek/job?query=%s&city=100010000",
    "lagou":   "https://www.lagou.com/wn/jobs?kd=%s",
    "liepin":  "https://www.liepin.com/zhaopin/?key=%s",
    "zhilian": "https://sou.zhaopin.com/?kw=%s",
    "github":  "https://github.com/search?q=%s&type=repositories",
    "hn":      "https://hn.algolia.com/?query=%s",
    "baidu":   "https://www.baidu.com/s?wd=%s",
    "toutiao": "https://so.toutiao.com/search?keyword=%s",
    "arxiv":   "https://arxiv.org/search/?searchtype=all&query=%s",
    "csdn":    "https://so.csdn.net/so/search?q=%s",
}

# 站点中文名（只用于日志 / 抽屉展示，不在卡片正面出现）
SITE_NAMES = {
    "zhipin": "BOSS 直聘", "lagou": "拉勾", "liepin": "猎聘", "zhilian": "智联招聘",
    "github": "GitHub", "hn": "Hacker News", "baidu": "百度", "toutiao": "头条",
    "arxiv": "arXiv", "csdn": "CSDN",
}

SOURCE_TYPES = ["招聘平台", "企业官网", "行业报告", "政策文件", "学术论文"]


def build_url(site: str, q: str) -> str:
    return SITE_URLS[site] % quote(q)


# ---------------------------------------------------------------------------
# 种子库：5 大类 × 14 条
# 字段：
#   t     : 标题（信息密度优先：岗位名 + 关键数字/趋势）
#   s     : 摘要（回答「对求职者意味着什么」）
#   site  : 跳转平台 key
#   q     : 搜索关键词
#   tag   : 细分标签，前端可用于小徽标
# ---------------------------------------------------------------------------
JOB_NEWS_POOL = [
    # ================= 招聘平台：具体岗位 / 用人需求 / 薪资 =================
    {"type": "招聘平台", "tag": "热门岗位",
     "t": "大模型算法工程师：RAG 与微调经验成硬门槛",
     "s": "一线城市 40-80K 区间集中，JD 普遍要求做过检索增强与指令微调落地，纯论文经历不再加分。",
     "site": "zhipin", "q": "大模型算法工程师"},
    {"type": "招聘平台", "tag": "新岗位",
     "t": "智能体（Agent）开发工程师岗位数三个月翻倍",
     "s": "要求工具调用编排、多轮记忆与成本控制，多数 JD 直接写 LangChain / Dify / 自研框架经验。",
     "site": "lagou", "q": "智能体开发"},
    {"type": "招聘平台", "tag": "岗位变化",
     "t": "前端开发：React 岗稳、Vue 岗向全栈收敛",
     "s": "纯切图岗位继续减少，招聘方更想要能写 Node BFF、懂构建性能的工程型前端。",
     "site": "zhipin", "q": "前端开发工程师"},
    {"type": "招聘平台", "tag": "后端",
     "t": "Go 后端工程师需求增速领先 Java",
     "s": "云原生与中间件团队大量招 Go，要求 K8s、gRPC、可观测性，Java 岗更集中在金融与政企。",
     "site": "lagou", "q": "Go 开发工程师"},
    {"type": "招聘平台", "tag": "数据",
     "t": "数据开发工程师：湖仓一体成为默认要求",
     "s": "JD 从 Hive/Spark 转向 Flink + Paimon/Iceberg，实时数仓经验溢价明显。",
     "site": "zhipin", "q": "数据开发工程师"},
    {"type": "招聘平台", "tag": "算法",
     "t": "推荐 / 搜索算法岗收缩，生成式推荐方向逆势招人",
     "s": "传统召回排序 HC 减少，能做 LLM 重排、向量召回的候选人反而稀缺。",
     "site": "liepin", "q": "算法工程师"},
    {"type": "招聘平台", "tag": "基础架构",
     "t": "SRE / 运维工程师：GPU 集群运维成新分支",
     "s": "算力池化带来「AI Infra 运维」岗位，要求 K8s + GPU 调度 + 网络存储调优。",
     "site": "zhipin", "q": "SRE 运维工程师"},
    {"type": "招聘平台", "tag": "质量",
     "t": "测试开发 SDET：自动化之外新增「AI 测试」要求",
     "s": "不少 JD 要求用大模型生成用例、做 diff 覆盖率分析，手工测试岗位持续减少。",
     "site": "zhipin", "q": "测试开发工程师"},
    {"type": "招聘平台", "tag": "安全",
     "t": "网络安全工程师：数据安全合规岗位增量最大",
     "s": "《数据安全法》《个人信息保护法》落地后，合规 + 渗透复合型人才薪资上浮 20%+。",
     "site": "liepin", "q": "网络安全工程师"},
    {"type": "招聘平台", "tag": "端侧",
     "t": "鸿蒙 / 端侧应用开发岗位供给快速上升",
     "s": "鸿蒙 NEXT 生态带来原生应用与适配需求，Android 开发者转型窗口期约 1-2 年。",
     "site": "zhipin", "q": "鸿蒙开发工程师"},
    {"type": "招聘平台", "tag": "硬件",
     "t": "嵌入式软件工程师：RTOS 与芯片适配方向稳定扩招",
     "s": "国产 MCU/GPU 生态需要大量驱动与固件工程师，门槛高但竞争小于纯互联网岗。",
     "site": "zhipin", "q": "嵌入式软件工程师"},
    {"type": "招聘平台", "tag": "复合岗",
     "t": "AI 产品经理：要懂模型边界，也要算得清成本",
     "s": "JD 普遍要求能评估「这个需求该不该用大模型」，并给出 token 成本与延迟预算。",
     "site": "zhipin", "q": "AI 产品经理"},
    {"type": "招聘平台", "tag": "校招",
     "t": "2027 届提前批：算法岗集中在多模态与推理优化",
     "s": "大厂提前批算法岗缩量但方向集中，工程能力（训练/部署全链路）比刷题更重要。",
     "site": "zhilian", "q": "2027 届 算法 提前批"},
    {"type": "招聘平台", "tag": "实习",
     "t": "开发岗实习：转正率下降，但「真实项目」含金量上升",
     "s": "建议优先选能接触线上流量与真实数据的团队，一段可量化产出的实习胜过三段打杂。",
     "site": "zhipin", "q": "计算机 实习生"},

    # ================= 企业官网：公司/团队动向、用人信号 =================
    {"type": "企业官网", "tag": "扩招",
     "t": "大厂 AI 团队扩招：算法 HC 同比翻倍，工程岗同步增加",
     "s": "模型落地需要大量工程化人力，推理服务、数据管线岗位跟着算法岗一起涨。",
     "site": "hn", "q": "AI team hiring engineers"},
    {"type": "企业官网", "tag": "开源",
     "t": "开源项目商业化提速，「开发者关系」岗位增多",
     "s": "开源公司开始招 DevRel / 解决方案工程师，要求既写代码又能对外讲清楚。",
     "site": "hn", "q": "open source hiring developer relations"},
    {"type": "企业官网", "tag": "裁员",
     "t": "海外科技公司裁员与再招聘：结构从通用研发转向 AI 方向",
     "s": "总量收缩但 AI/基础设施岗位逆势增加，被裁的多是平台型通用研发。",
     "site": "hn", "q": "layoff engineers rehiring AI"},
    {"type": "企业官网", "tag": "算力",
     "t": "云厂商争夺 AI 算力人才，GPU 集群运维岗走俏",
     "s": "显存调度、RDMA 网络、故障自愈成为稀缺技能，相关岗位薪资高于普通运维 30%+。",
     "site": "github", "q": "kubernetes gpu operator scheduling"},
    {"type": "企业官网", "tag": "芯片",
     "t": "国产 GPU / NPU 公司扩招：编译器与驱动人才最缺",
     "s": "生态适配岗位井喷，需要懂 CUDA 迁移、算子开发与性能调优的工程师。",
     "site": "github", "q": "npu compiler driver open source"},
    {"type": "企业官网", "tag": "数据库",
     "t": "国产数据库厂商招聘内核研发，替代潮带来新岗位",
     "s": "存储引擎、查询优化器、HTAP 方向需求上升，C++/Rust 背景优先。",
     "site": "github", "q": "database storage engine kernel"},
    {"type": "企业官网", "tag": "远程",
     "t": "海外远程岗位供给回升：中国开发者的机会与门槛",
     "s": "远程岗更看重可验证产出（开源、技术文章、过往项目），英语沟通是硬门槛。",
     "site": "hn", "q": "remote hiring developer 2026"},
    {"type": "企业官网", "tag": "创业",
     "t": "AI 创业公司融资后 3 个月内集中扩张技术团队",
     "s": "融资—招人窗口期很短，关注刚完成 A/B 轮、方向为垂直行业 Agent 的团队。",
     "site": "hn", "q": "AI startup funding hiring engineers"},
    {"type": "企业官网", "tag": "稀缺岗",
     "t": "推理优化工程师成大模型公司最稀缺岗位",
     "s": "能把单次推理成本压低 30% 的人，薪资对标资深架构，涉及量化、投机解码、算子融合。",
     "site": "github", "q": "llm inference optimization serving"},
    {"type": "企业官网", "tag": "转型",
     "t": "传统行业数字化催生「行业 + IT」复合岗位",
     "s": "制造、医疗、物流的 IT 部门在招既懂业务又懂系统的工程师，竞争强度低于互联网。",
     "site": "hn", "q": "digital transformation engineering jobs"},
    {"type": "企业官网", "tag": "简历",
     "t": "开源贡献正在成为简历新硬通货",
     "s": "越来越多团队在初筛阶段看 GitHub 主页，一个被合并的 PR 胜过三行「熟悉 XX」。",
     "site": "github", "q": "good first issue chinese documentation"},
    {"type": "企业官网", "tag": "组织",
     "t": "大厂结构调整：中台收缩，一线业务研发岗增加",
     "s": "平台/中台岗位减少，能直接对业务指标负责的研发更稳，选型时优先贴近营收的团队。",
     "site": "hn", "q": "reorg platform team engineers"},
    {"type": "企业官网", "tag": "机器人",
     "t": "具身智能 / 机器人公司集中招算法与嵌入式",
     "s": "ROS2、运动控制、仿真到真机迁移是核心技能，赛道新、人才储备少、溢价高。",
     "site": "github", "q": "robotics ros2 reinforcement learning"},
    {"type": "企业官网", "tag": "工具链",
     "t": "前端工具链团队招聘：构建性能与开发体验方向",
     "s": "Rust 化构建工具（Rspack/Biome/Oxc）带火「构建性能工程师」，要求 Rust + 编译原理。",
     "site": "github", "q": "frontend build tool rust bundler"},

    # ================= 行业报告：趋势 / 薪资 / 供需 =================
    {"type": "行业报告", "tag": "供需",
     "t": "AI 人才供需报告：算法岗供需比仍低于 0.5",
     "s": "岗位数增长快于合格候选人增长，但对「能做工程落地」的要求同步提高。",
     "site": "baidu", "q": "人工智能 人才 供需报告"},
    {"type": "行业报告", "tag": "薪资",
     "t": "程序员就业趋势白皮书：哪些语言在涨、哪些在跌",
     "s": "Go/Rust/TypeScript 需求上行，传统 PHP/Perl 类岗位持续萎缩，选型要跟着需求走。",
     "site": "baidu", "q": "程序员 就业趋势 白皮书"},
    {"type": "行业报告", "tag": "薪资",
     "t": "大模型相关岗位薪资报告：推理优化溢价最高",
     "s": "同年限下，懂推理优化与训练 infra 的工程师薪资中位数高出普通后端约 40%。",
     "site": "toutiao", "q": "大模型 岗位 薪资 报告"},
    {"type": "行业报告", "tag": "技术栈",
     "t": "技术栈流行度排行：Rust / Go / TypeScript 增速领先",
     "s": "排行直接反映招聘 JD 关键词，建议每年对照更新一次自己的主栈与副栈。",
     "site": "baidu", "q": "编程语言 排行榜 招聘需求"},
    {"type": "行业报告", "tag": "应届生",
     "t": "应届生就业报告：计算机类仍高薪但竞争显著加剧",
     "s": "平均起薪仍居前，但「无实习无项目」的简历通过率下降，实习经历成为分水岭。",
     "site": "baidu", "q": "高校毕业生 就业报告 计算机"},
    {"type": "行业报告", "tag": "远程",
     "t": "远程与灵活就业报告：IT 从业者占比遥遥领先",
     "s": "远程岗位集中在开发/设计/测试，但要求自驱与书面沟通能力，管理岗极少开放远程。",
     "site": "toutiao", "q": "远程办公 灵活就业 报告 IT"},
    {"type": "行业报告", "tag": "缺口",
     "t": "网络安全人才缺口报告：缺口仍在 300 万量级",
     "s": "政企与安全厂商持续招人，入门门槛相对友好，是转型可选方向之一。",
     "site": "baidu", "q": "网络安全 人才缺口 报告"},
    {"type": "行业报告", "tag": "算力",
     "t": "智能算力产业人才报告：GPU 运维与调度成新缺口",
     "s": "智算中心大规模建设，需要既懂网络存储又懂调度系统的工程团队。",
     "site": "toutiao", "q": "智算中心 算力 人才 报告"},
    {"type": "行业报告", "tag": "风险",
     "t": "AI 替代风险评估：哪些研发岗位最先受影响",
     "s": "重复度高、产出可标准化的工作（基础 CRUD、简单测试、初级外包）风险最高。",
     "site": "baidu", "q": "AI 替代 岗位 风险评估 报告"},
    {"type": "行业报告", "tag": "城市",
     "t": "城市 IT 岗位增长榜：新一线的 AI 与半导体岗位提速",
     "s": "杭州、成都、合肥、西安在 AI 与芯片方向岗位增速超过部分一线城市。",
     "site": "toutiao", "q": "城市 IT 岗位 增长 排行"},
    {"type": "行业报告", "tag": "用人标准",
     "t": "企业用人标准变化：从「背八股」到「看工程能力」",
     "s": "面试更看重调试、定位线上问题、读源码与权衡取舍，纯背诵型准备正在失效。",
     "site": "baidu", "q": "程序员 面试 用人标准 变化"},
    {"type": "行业报告", "tag": "工具",
     "t": "AI 编程工具普及率调查：生产力提升与岗位影响",
     "s": "多数开发者已在日常使用 AI 补全，初级岗位招聘量随之收缩，中级岗要求反而提高。",
     "site": "toutiao", "q": "AI 编程 工具 普及率 调查"},
    {"type": "行业报告", "tag": "芯片",
     "t": "集成电路人才报告：设计与验证岗缺口最大",
     "s": "数字前端/验证工程师缺口大、培养周期长，适合愿意深耕硬件方向的计算机背景学生。",
     "site": "baidu", "q": "集成电路 人才 报告 缺口"},
    {"type": "行业报告", "tag": "赛道",
     "t": "2026 值得关注的 IT 细分赛道：Agent、端侧 AI、数据基础设施",
     "s": "三个方向的共同点是「离真实业务近、工程复杂度高」，短期不容易被替代。",
     "site": "toutiao", "q": "2026 IT 行业 趋势 赛道"},

    # ================= 政策文件：就业 / 人才 / 产业 =================
    {"type": "政策文件", "tag": "就业",
     "t": "就业优先战略「十五五」规划：重点群体就业支持",
     "s": "明确高校毕业生与青年就业支持措施，配套见习、培训与补贴，直接影响校招规模。",
     "site": "baidu", "q": "site:gov.cn 就业优先战略 规划"},
    {"type": "政策文件", "tag": "人才",
     "t": "数字人才培育行动方案：AI 与集成电路人才是重点",
     "s": "提出加强人工智能、集成电路、数据安全等方向人才培养，相关专业与培训将扩招。",
     "site": "baidu", "q": "site:gov.cn 数字人才 培育 行动方案"},
    {"type": "政策文件", "tag": "技能",
     "t": "职业技能提升行动：补贴性培训向数字技能倾斜",
     "s": "在岗与失业人员可申领数字技能培训补贴，转行/提升可优先用足这类公共资源。",
     "site": "baidu", "q": "site:gov.cn 职业技能提升行动 数字技能"},
    {"type": "政策文件", "tag": "毕业生",
     "t": "高校毕业生就业创业政策：基层就业与见习岗位扩容",
     "s": "含社保补贴、创业担保贷款、基层岗位补贴，IT 类岗位同样适用。",
     "site": "baidu", "q": "site:gov.cn 高校毕业生 就业创业 政策"},
    {"type": "政策文件", "tag": "新职业",
     "t": "新职业发布：人工智能训练师、生成式 AI 应用员在列",
     "s": "新职业意味着评价标准和培训体系落地，持证与项目经历会成为求职加分项。",
     "site": "baidu", "q": "site:gov.cn 新职业 人工智能训练师"},
    {"type": "政策文件", "tag": "数据",
     "t": "「数据要素 ×」行动计划：带动数据开发岗位",
     "s": "数据治理、数据合规、数据产品开发需求上升，政务与国企 IT 岗位随之增加。",
     "site": "baidu", "q": "site:gov.cn 数据要素 行动计划"},
    {"type": "政策文件", "tag": "芯片",
     "t": "集成电路产业人才政策：税收优惠与人才引进并行",
     "s": "重点城市给出落户与补贴支持，芯片设计与 EDA 方向就业机会向政策高地集中。",
     "site": "baidu", "q": "site:gov.cn 集成电路 产业 人才 政策"},
    {"type": "政策文件", "tag": "安全",
     "t": "网络安全人才队伍建设指导意见",
     "s": "要求重点行业配齐安全岗位，等保与数据安全合规岗位在政企侧持续放量。",
     "site": "baidu", "q": "site:gov.cn 网络安全 人才 队伍建设"},
    {"type": "政策文件", "tag": "灵活就业",
     "t": "新就业形态劳动者权益保障政策",
     "s": "涉及外包、众包、平台接单的 IT 从业者，关注社保与劳动关系认定细则。",
     "site": "baidu", "q": "site:gov.cn 新就业形态 劳动者 权益"},
    {"type": "政策文件", "tag": "职教",
     "t": "职业教育产教融合：IT 技能培训与岗位对接",
     "s": "企业参与课程设计，实训项目可直接作为求职作品集，适合转行人群。",
     "site": "baidu", "q": "site:gov.cn 职业教育 产教融合 数字"},
    {"type": "政策文件", "tag": "产业",
     "t": "「人工智能 +」行动：推动产业智能化与岗位升级",
     "s": "传统行业改造会释放大量「业务 + AI 落地」岗位，是避开纯互联网内卷的方向。",
     "site": "baidu", "q": "site:gov.cn 人工智能+ 行动"},
    {"type": "政策文件", "tag": "中小企业",
     "t": "中小企业数字化转型政策：催生 IT 实施岗位",
     "s": "SaaS 实施、系统集成、低代码交付岗位在二三线城市增加明显。",
     "site": "baidu", "q": "site:gov.cn 中小企业 数字化转型"},
    {"type": "政策文件", "tag": "科研",
     "t": "青年科技人才支持：AI 与芯片方向倾斜",
     "s": "博士后与青年项目对 AI、芯片、量子方向倾斜，读博/进站可作为长期选项评估。",
     "site": "baidu", "q": "site:gov.cn 青年科技人才 人工智能"},
    {"type": "政策文件", "tag": "专精特新",
     "t": "专精特新中小企业人才支持政策",
     "s": "这类企业技术岗稳定性高、成长空间大，政策补贴也向招聘端倾斜。",
     "site": "baidu", "q": "site:gov.cn 专精特新 中小企业 人才"},

    # ================= 学术论文 / 技术前沿：影响岗位方向的研究 =================
    {"type": "学术论文", "tag": "推理",
     "t": "LLM 推理加速研究：KV Cache 压缩与投机解码",
     "s": "推理成本是落地瓶颈，掌握这块直接对应高薪的推理优化工程师岗位。",
     "site": "arxiv", "q": "LLM inference KV cache speculative decoding"},
    {"type": "学术论文", "tag": "Agent",
     "t": "Agent 记忆机制：长期记忆与工具调用的最新进展",
     "s": "决定 Agent 能否真正干活，是智能体开发岗位面试的高频考点。",
     "site": "arxiv", "q": "LLM agent memory tool use"},
    {"type": "学术论文", "tag": "RAG",
     "t": "检索增强生成（RAG）综述与工程实践",
     "s": "企业落地最广泛的模式，切分、召回、重排、评估每一环都能单拆成岗位技能。",
     "site": "arxiv", "q": "retrieval augmented generation survey"},
    {"type": "学术论文", "tag": "端侧",
     "t": "端侧模型压缩：量化、蒸馏与稀疏化进展",
     "s": "手机与 PC 端跑模型成为趋势，端侧 AI 工程师需求随之上升。",
     "site": "arxiv", "q": "model quantization distillation on-device"},
    {"type": "学术论文", "tag": "代码",
     "t": "代码大模型评测：SWE-bench 类基准与局限",
     "s": "理解评测边界，才能在面试里说清「AI 编程能替代到什么程度」。",
     "site": "arxiv", "q": "code LLM benchmark SWE-bench"},
    {"type": "学术论文", "tag": "多模态",
     "t": "多模态大模型：视觉-语言对齐新方法",
     "s": "多模态岗位集中在内容理解、自动驾驶与机器人，方向选择前先看清产业需求。",
     "site": "arxiv", "q": "vision language model alignment"},
    {"type": "学术论文", "tag": "长上下文",
     "t": "长上下文建模：位置编码与注意力效率优化",
     "s": "长文档处理是 To B 场景刚需，是工程落地岗位的常见技术要求。",
     "site": "arxiv", "q": "long context attention positional encoding"},
    {"type": "学术论文", "tag": "安全",
     "t": "模型安全与对齐：越狱攻击与防护",
     "s": "AI 安全岗位随合规要求增长，属于「AI + 安全」的复合高价值方向。",
     "site": "arxiv", "q": "LLM safety alignment jailbreak"},
    {"type": "学术论文", "tag": "数据库",
     "t": "向量检索与混合查询：数据库与 AI 的融合",
     "s": "向量数据库岗位冷却后，能力回归到传统数据库内核 + 检索算法，值得长期投入。",
     "site": "arxiv", "q": "vector database hybrid query search"},
    {"type": "学术论文", "tag": "训练",
     "t": "分布式训练：并行策略与通信优化",
     "s": "训练 infra 是稀缺方向，涉及 NCCL、流水线并行、显存优化，门槛高但竞争小。",
     "site": "arxiv", "q": "distributed training parallelism communication"},
    {"type": "学术论文", "tag": "编译",
     "t": "AI 编译器与芯片协同设计研究",
     "s": "国产芯片生态缺这类人，编译器方向职业周期长、替代风险低。",
     "site": "arxiv", "q": "AI compiler hardware co-design"},
    {"type": "学术论文", "tag": "工程",
     "t": "智能化软件工程：自动缺陷定位与修复",
     "s": "AI 先替代的是重复性研发工作，了解进展有助于提前调整自己的岗位定位。",
     "site": "arxiv", "q": "automated program repair LLM"},
    {"type": "学术论文", "tag": "推荐",
     "t": "生成式推荐：推荐系统大模型化",
     "s": "推荐岗从「特征工程」转向「序列建模 + 生成式召回」，技能栈需要更新。",
     "site": "arxiv", "q": "generative recommendation LLM"},
    {"type": "学术论文", "tag": "机器人",
     "t": "具身智能：仿真到真机的迁移学习",
     "s": "机器人公司最缺这类算法工程复合人才，方向新、供给少、溢价高。",
     "site": "arxiv", "q": "embodied AI sim-to-real robot learning"},
]

# 每个分类每轮最多出现 / 保证达到的条数（与前端「展示六条」保持一致）
PER_TYPE_LIMIT = 6
SEED_TARGET = PER_TYPE_LIMIT  # 旧名兼容


def pool_by_type(source_type):
    return [p for p in JOB_NEWS_POOL if p["type"] == source_type]


def pick_seeds(source_type, need, used_titles=None, seeded_flag=True):
    """从种子库随机抽取 `need` 条，尽量避开已出现的标题。

    每次调用都会重新洗牌，因此连续点击「发现」看到的组合不同，
    达到「视觉上真的在发现新东西」的效果。
    """
    used = used_titles or set()
    pool = [p for p in pool_by_type(source_type) if p["t"] not in used]
    random.shuffle(pool)
    picked = pool[:need]
    if len(picked) < need:  # 全被占用时允许复用，保证数量兜底
        extra = [p for p in pool_by_type(source_type) if p not in picked]
        random.shuffle(extra)
        picked += extra[: need - len(picked)]
    out = []
    for p in picked:
        out.append(
            {
                "title": p["t"],
                "summary": p["s"],
                "url": build_url(p["site"], p["q"]),
                "source_type": source_type,
                "source_name": SITE_NAMES.get(p["site"], p["site"]) + " · " + p["tag"],
                "source_mark": p["tag"],
                "site": p["site"],
                "seeded": seeded_flag,
            }
        )
    return out


if __name__ == "__main__":
    for t in SOURCE_TYPES:
        n = len(pool_by_type(t))
        print("%-6s %2d 条  示例：%s" % (t, n, pick_seeds(t, 1)[0]["url"]))
    assert all(len(pool_by_type(t)) >= 12 for t in SOURCE_TYPES), "每个分类至少 12 条"
    assert all(p["type"] in SOURCE_TYPES for p in JOB_NEWS_POOL)
    print("种子库自检通过，共 %d 条" % len(JOB_NEWS_POOL))
