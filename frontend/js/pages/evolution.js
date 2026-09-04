// ============== Evolution View ==============
// build: 2026082301 — 历史版本对比重构：版本选择+能力结构演化关系
console.log('[evolution.js] build=2026082301, history version compare refactor');
let evolutionState = {currentJobId: 'Java开发工程师', timeOffset: 6};
// —— 支持 ?job=<岗位名> 直达（来自新岗发现/个人仓库「洞察该岗位」入口） ——
try {
    var __qJob = new URLSearchParams(location.search).get('job');
    if (__qJob && __qJob.trim()) evolutionState.currentJobId = __qJob.trim();
} catch (_) {}
window.initEvolution = function() {
    // 确保 Store 准备就绪
    if (!window.Store.state.evolution) window.generateAllData();

    // ===== 新布局：能力动态更新（参考页风格） =====
    const jobId = evolutionState.currentJobId || 'Java开发工程师';
    let profile = null;
    try { profile = window.getEvolutionForJob(jobId); } catch(e) { console.warn('getEvolutionForJob error', e); }
    if (!profile) profile = {};

    // 注入完整假数据（开发期 demo，未连后端 / 后端缺字段时使用）
    const DEMO = {
        period: '2026-08',
        prevPeriod: '2026-07',
        timelineTotal:  [38, 41, 45, 47, 52, 58, 64],
        timelineNewly:  [ 0,  3,  2,  3,  5,  6,  6],
        timelineEvents: [
            {
                time: '2026-03', count: 8, impact: 'mid',
                title: '微服务架构的普及',
                desc:  '随着微服务在企业中的广泛应用，相关架构能力需求显著上升',
                skills: ['Spring Cloud', '服务治理', '熔断降级', 'API 网关', '配置中心', '链路追踪', '容器化', 'CI/CD'],
                reason: '企业数字化转型推进，单体应用加速向微服务架构演进',
                analysis: '微服务架构已成为 Java 后端岗位的标配能力，相关技术栈需求持续扩大'
            },
            {
                time: '2026-05', count: 12, impact: 'high',
                title: '云原生技术要求提升',
                desc:  '云原生技术与 Kubernetes 能力在岗位要求中权重提升',
                skills: ['Kubernetes', 'Docker', 'Helm', 'Service Mesh', 'Serverless', 'GitOps', '可观测性', 'CKA', 'Operator', 'CRD', 'Tekton', 'Argo CD'],
                reason: '企业上云率持续提升，云原生成为新基础设施标准',
                analysis: '云原生能力将逐步替代传统部署能力，成为 Java 后端工程师的必备技能'
            },
            {
                time: '2026-07', count: 9, impact: 'high',
                title: 'AI 工具应用增加',
                desc:  'AI 辅助开发与 AIGC 工程化能力在岗位中显著出现',
                skills: ['AI 辅助编程', 'Copilot', 'Cursor', 'Prompt Engineering', 'LLM 应用', 'RAG', '向量数据库', 'Agent', 'MCP'],
                reason: '大模型技术爆发，企业开始系统性整合 AI 能力到研发流程',
                analysis: 'AI 工具的应用已从"加分项"转为"必选项"，相关工程化能力需求迅速扩大'
            }
        ],
        timelineMonths: ['2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08'],
        trendMax: 100,
        // 本期重点变化（按节点聚合的能力趋势，非逐条罗列）
        trendHighlights: [
            {
                node: '2026-07', trend: 'AI 辅助开发能力增强', direction: 'up', magnitude: 92,
                importance: 'high', confidence: 0.89,
                desc: 'AI 辅助编程、Prompt 工程、LLM 应用等能力在岗位要求中快速涌现，成为新的能力分支。',
                skills: ['AI 辅助编程', 'Copilot', 'Cursor', 'Prompt Engineering', 'LLM 应用', 'RAG', '向量数据库', 'Agent', 'MCP'],
                beforeAfter: '岗位 JD 中"AI 工具使用 / AIGC 工程化"相关关键词出现率由约 8% 升至 35%，从加分项转为必选项。',
                reason: '大模型技术爆发，企业开始系统性将 AI 能力整合进研发流程。',
                dataEvidence: '企业招聘数据（40%）：含 AI 工具岗位占比 +27pp；技术社区（15%）：相关话题热度 +180%；GitHub 趋势（10%）：AI 编码工具 star 增长显著。',
                analysis: 'AI 工具应用已从"加分项"转为"必选项"，相关工程化能力需求迅速扩大，建议在培养路径中前置。'
            },
            {
                node: '2026-05', trend: '云原生应用能力提升', direction: 'up', magnitude: 85,
                importance: 'high', confidence: 0.86,
                desc: 'Kubernetes、容器化、Service Mesh 等云原生能力权重持续上升，逐步替代传统部署能力。',
                skills: ['Kubernetes', 'Docker', 'Helm', 'Service Mesh', 'Serverless', 'GitOps', '可观测性', 'CKA', 'Operator', 'CRD'],
                beforeAfter: '"掌握 K8s / 容器编排"由高级要求下沉为通用要求；传统运维/部署相关描述减少。',
                reason: '企业上云率持续提升，云原生成为新基础设施标准。',
                dataEvidence: '行业报告（25%）：云原生岗位渗透率 +19%；企业招聘数据（40%）：K8s 要求占比 +22pp。',
                analysis: '云原生能力将逐步替代传统部署能力，成为 Java 后端工程师的必备技能。'
            },
            {
                node: '2026-07', trend: '传统 SSH 框架需求下降', direction: 'down', magnitude: 70,
                importance: 'mid', confidence: 0.82,
                desc: 'Struts + Spring + Hibernate 等传统框架组合在岗位要求中明显减少，被 Spring Boot 等现代栈替代。',
                skills: ['SSH 框架', 'Struts', '传统单体应用开发', 'XML 配置式开发'],
                beforeAfter: '要求"熟悉 SSH/SSM"的 JD 占比由 30% 降至 12%，"Spring Boot 优先"成为主流表述。',
                reason: '现代框架降低样板代码与配置成本，企业技术栈整体升级。',
                dataEvidence: '企业招聘数据（40%）：SSH 相关描述 -18pp；技术社区（15%）：相关问答量持续走低。',
                analysis: '传统框架维护能力需求持续下降，建议将学习资源向 Spring Boot / 响应式栈倾斜。'
            },
            {
                node: '2026-03', trend: '微服务架构重要性提升', direction: 'up', magnitude: 78,
                importance: 'high', confidence: 0.84,
                desc: '服务治理、熔断降级、链路追踪等微服务相关能力成为中高端岗位的核心要求。',
                skills: ['Spring Cloud', '服务治理', '熔断降级', 'API 网关', '配置中心', '链路追踪', '容器化', 'CI/CD'],
                beforeAfter: '"具备微服务设计与治理能力"由加分项转为中高级岗位硬性要求；分布式事务/幂等相关问题占比上升。',
                reason: '企业数字化转型推进，单体应用加速向微服务架构演进。',
                dataEvidence: '行业报告（25%）：微服务岗位占比 +15%；企业招聘数据（40%）：治理/可观测关键词 +20pp。',
                analysis: '微服务架构已成为 Java 后端岗位的标配能力，相关技术栈需求持续扩大。'
            },
            {
                node: '2026-06', trend: '可观测性与稳定性能力增强', direction: 'up', magnitude: 60,
                importance: 'mid', confidence: 0.8,
                desc: '日志、监控、链路追踪、混沌工程等稳定性保障能力在岗位要求中的权重稳步提升。',
                skills: ['Prometheus', 'Grafana', 'OpenTelemetry', 'ELK', '混沌工程', 'SLO/SLI'],
                beforeAfter: '"具备可观测性体系搭建经验"由高级要求扩散至通用要求。',
                reason: '系统规模与复杂度上升，稳定性保障成为工程成熟度标志。',
                dataEvidence: '技术社区（15%）：可观测性内容增长 +60%；企业招聘数据（40%）：监控/追踪关键词 +12pp。',
                analysis: '可观测性将成为后端工程师的基础能力，建议纳入标准培养模块。'
            },
            {
                node: '2026-07', trend: '分布式事务能力演进', direction: 'stable', magnitude: 45,
                importance: 'high', confidence: 0.83,
                desc: '分布式事务、幂等设计、最终一致性方案要求标准趋同，相关能力描述更加具体化。',
                skills: [
                    { name: 'Seata',     before: '了解分布式事务概念，能描述 ACID / CAP 理论', after: '掌握 Seata 在订单/库存/账户等场景的应用，能选型 AT / TCC / Saga 模式' },
                    { name: 'TCC',       before: '理解两阶段提交理论',                         after: '能基于 TCC 实现自定义事务框架，含 Try/Confirm/Cancel 幂等与悬挂处理' },
                    { name: '消息一致性', before: '了解最终一致性概念',                         after: '能基于 RocketMQ / Kafka 实现可靠消息 + 本地消息表，处理重复消费与对账' },
                    { name: '幂等设计',  before: '能识别重复请求场景',                         after: '掌握 Token / 唯一索引 / 状态机 / 分布式锁等幂等方案，能落地业务级幂等' }
                ],
                beforeAfter: '从"了解分布式事务"细化为"Seata / TCC / 消息一致性"具体方案与适用场景。',
                reason: '企业云原生与微服务落地加深，事务方案标准趋同。',
                dataEvidence: '企业招聘数据（40%）：具体方案关键词 +9pp；行业报告（25%）：分布式事务成熟度评估分 +0.6。',
                analysis: '分布式事务方案描述由抽象转为具体，建议在 JD 中明确所用方案与适用边界。'
            }
        ],
        changes: {
            added: [
                { name: 'AI 辅助编程（如 Copilot、Cursor）',   type: '技术工具', importance: 5, reason: 'AI 编程工具在企业中广泛运用' },
                { name: '云原生应用开发（K8s、Serverless）',   type: '云原生',   importance: 4, reason: '企业上云与云原生技术普及' },
                { name: '向量数据库使用（如 Milvus、Pinecone）', type: '数据库技术', importance: 3, reason: '大规模应用驱动向量检索需求' }
            ],
            modified: [
                { name: '微服务架构设计',     type: '架构设计', importance: 3, reason: '从基础到高级逐步标准化' },
                { name: '数据库调优',         type: '数据库',   importance: 3, reason: 'AI 性能优化扩展到非结构化' },
                { name: '分布式系统设计',     type: '架构设计', importance: 4, reason: '增加分布式事务、幂等需求' }
            ],
            removed: [
                { name: 'SSH 框架（Struts + Spring + Hibernate）', type: '框架',     importance: 1, reason: '已被 Spring Boot 等现代框架替代' },
                { name: '传统单体应用开发',                       type: '开发模式', importance: 1, reason: '企业架构向微服务转型' }
            ]
        },
        // 核心洞察：结构化，体现"现象 → 原因 → 趋势/结论"，并绑定时间节点用于联动
        insights: [
            {
                id: 'ai-baseline',
                tag: 'AI 协同',
                title: 'AI 辅助开发正从"加分项"转变为"基础能力"',
                phenomenon: '本期新增能力中，AI 辅助编程、Copilot、Cursor、代码生成相关技能集中出现，并在招聘要求中从"优先"下沉为"通用要求"。',
                reason: '大模型编码工具在企业研发流程中加速落地，单位人效提升诉求驱动岗位对 AI 协同开发能力形成刚性预期。',
                conclusion: '未来 1～2 年，AI 协同开发（含 Prompt 工程、代码审查辅助、单测生成）将成为 Java 工程师的基础门槛，而非差异化优势。',
                evidence: ['技术社区内容同比增长 +85%', '企业招聘"AI 辅助"关键词渗透率 +18pp', '样本岗位中 6/10 已将 AI 工具写入 JD'],
                nodes: ['2026-07', '2026-06']
            },
            {
                id: 'cloud-native',
                tag: '云原生',
                title: '企业上云推动云原生与容器化能力持续提升',
                phenomenon: '云原生应用、Kubernetes、Docker、Service Mesh 等能力在新增列表中权重居前，且从"高级"扩散至"核心"要求。',
                reason: '政企与互联网客户全面上云，弹性、可观测、标准化的交付方式倒逼后端工程能力向云原生栈迁移。',
                conclusion: '云原生能力（容器编排 + 服务网格 + 声明式运维）将长期作为 Java 后端的主线能力，且与微服务深度绑定。',
                evidence: ['企业招聘"云原生"提及率 +22pp', 'Kubernetes 要求岗位同比 +34%', '行业报告将云原生列为年度 Top3 技术主线'],
                nodes: ['2026-05', '2026-07']
            },
            {
                id: 'distributed',
                tag: '架构演进',
                title: '岗位能力从单一 Java 栈向"分布式 + 云原生 + AI"协同扩展',
                phenomenon: '微服务、分布式事务、消息一致性、可观测性等技术密集出现，传统单体 SSH/Struts 能力被标记为下降/移除。',
                reason: '业务复杂度与系统规模上升，单技术栈已无法覆盖稳定性、弹性与智能化诉求，岗位要求向复合能力演进。',
                conclusion: 'Java 工程师的能力边界正在外扩：内核仍是 Java，但价值高地转向分布式架构治理与跨栈协同。',
                evidence: ['分布式相关技能新增 8 项', '传统 SSH 框架要求下降 -15%', '架构类关键词 JD 占比升至 47%'],
                nodes: ['2026-03', '2026-07']
            },
            {
                id: 'observability',
                tag: '稳定性',
                title: '可观测性与稳定性成为工程成熟度标志',
                phenomenon: 'Prometheus、Grafana、OpenTelemetry、SLO/SLI 等能力要求稳步提升，并由高级要求扩散至通用要求。',
                reason: '系统规模与复杂度上升，故障定位与韧性保障成为高频痛点，稳定性能力被纳入标准培养模块。',
                conclusion: '可观测性将从"运维专属"转为"开发即职责"，SLO 思维成为后端工程师的通用素养。',
                evidence: ['可观测性内容增长 +60%', '监控/追踪关键词 +12pp', '样本岗位 7/10 要求具备稳定性体系经验'],
                nodes: ['2026-06']
            },
            {
                id: 'legacy-decline',
                tag: '技术更替',
                title: '传统单体框架能力需求持续走弱',
                phenomenon: 'SSH、Struts 等传统框架在删除/下降能力中集中出现，相关岗位要求明显收缩。',
                reason: '新型云原生与前后端分离架构全面替代传统 MVC 单体，遗留技术栈维护场景收窄。',
                conclusion: '建议减少对传统单体框架的投入，将学习预算转向微服务与云原生现代化栈。',
                evidence: ['传统 SSH 框架要求下降 -15%', 'Struts 相关 JD 同比减少 28%', '新增能力中 0 项涉及传统单体框架'],
                nodes: ['2026-07']
            }
        ],
        // 数据来源：结构化，体现可信链路（来源 → 数据 → 支撑的分析结论）
        sources: [
            {
                id: 'recruit',
                name: '企业招聘数据',
                type: '招聘 JD',
                updatedAt: '2026-08-01 更新',
                scale: '12,580 条有效 JD',
                coverage: '近 30 天 · 一线及新一线城市 · Java 后端岗位',
                contribution: '识别企业岗位能力需求变化，权重最高',
                status: '正常',
                links: ['ai-baseline', 'cloud-native', 'distributed'],
                details: '采集自 51JOB、智联、BOSS 等公开招聘渠道，经清洗去重后保留有效 Java 后端 JD 12,580 条。主要用于识别"AI 辅助编程""云原生""微服务"等关键词的渗透率与增长趋势，直接支撑新增能力（如 Copilot、Kubernetes）的判定。'
            },
            {
                id: 'internal',
                name: '企业内部岗位数据',
                type: '企业私有',
                updatedAt: '2026-08-15 更新',
                scale: '3,240 条岗位画像',
                coverage: '合作企业研发岗 · 含职级与薪酬带宽',
                contribution: '校准能力重要性权重，区分核心/辅助技能',
                status: '正常',
                links: ['distributed', 'observability'],
                details: '来自合作企业的内部岗位画像与晋升标准，用于校准能力重要性分级（high/mid/low），并将"可观测性""分布式事务"等标注为核心能力，避免仅依赖公开数据导致的偏差。'
            },
            {
                id: 'report',
                name: '行业研究报告',
                type: '研究报告',
                updatedAt: '2026-07-28 更新',
                scale: '18 份年度/季度报告',
                coverage: '2024Q4–2025Q2 · 云计算/AI/研发效能',
                contribution: '提供宏观技术趋势背景与年度主线判断',
                status: '正常',
                links: ['cloud-native', 'ai-baseline'],
                details: '汇总信通院、IDC、各大厂技术白皮书等 18 份报告，提取"云原生列为年度 Top3 技术主线""AI 工程化加速"等结论，为趋势洞察提供行业级背景支撑。'
            },
            {
                id: 'community',
                name: '技术社区数据',
                type: '技术社区',
                updatedAt: '2026-08-12 更新',
                scale: '46,300 条内容',
                coverage: 'CSDN/掘金/InfoQ/Stack Overflow',
                contribution: '捕捉新兴技术与工具的早期信号',
                status: '正常',
                links: ['ai-baseline', 'observability'],
                details: '爬取主流技术社区近 90 天内容，统计技术关键词增长。AI 辅助编程相关内容同比增长 +85%，可观测性内容增长 +60%，是"AI 从加分项转为基础能力"洞察的关键早期信号来源。'
            },
            {
                id: 'github',
                name: 'GitHub 趋势',
                type: '开源趋势',
                updatedAt: '2026-08-10 更新',
                scale: 'Top 2,000 仓库',
                coverage: 'Java/云原生/AI 工具链仓库',
                contribution: '验证工具链流行度与生态成熟度',
                status: '正常',
                links: ['cloud-native', 'ai-baseline'],
                details: '跟踪 GitHub Trending 与 star 增速，Kubernetes、LangChain4j 等仓库持续高位，佐证云原生与 AI 协同开发能力的实际采用热度。'
            },
            {
                id: 'trend',
                name: '技术趋势预测',
                type: 'AI 预测',
                updatedAt: '2026-08-16 更新',
                scale: '模型推理 1 次/日',
                coverage: '基于上述 5 源融合推理',
                contribution: '生成前瞻性演化预测与不确定性标注',
                status: '实验',
                links: ['legacy-decline', 'distributed'],
                details: '由 DeepSeek 驱动的演化预测引擎，对上述多源数据进行融合推理，输出"传统单体框架走弱""分布式+云原生+AI 协同"等前瞻性判断，并标注置信度，当前为实验性来源。'
            }
        ],
        // 历史版本对比：结构化，体现能力结构演化（而非简单增删改统计）
        history: {
            versions: [
                { id: 'v35', label: 'V3.5', date: '2026-07-16', count: 84, tag: '当前版本', desc: '云原生与 AI 协同开发成为主线' },
                { id: 'v30', label: 'V3.0', date: '2026-04-12', count: 80, tag: '上一版本', desc: '微服务与分布式能力稳定成形' },
                { id: 'v25', label: 'V2.5', date: '2024-10-08', count: 76, tag: '更早版本', desc: '单体架构能力仍占较高比重' }
            ],
            // 版本间能力演化关系（A → B），突出结构变化与演化方向
            evolution: [
                { type: 'replace', from: '传统部署', to: '容器化部署', importanceFrom: 2, importanceTo: 3, levelFrom: '掌握', levelTo: '精通', note: 'Docker/Kubernetes 成为交付标配', reason: '企业上云推动部署方式全面容器化', sources: ['recruit','cloud-native'], event: '2026-05' },
                { type: 'upgrade', from: 'Java 基础开发', to: '云原生开发', importanceFrom: 3, importanceTo: 3, levelFrom: '精通', levelTo: '精通', note: '能力重心向云原生栈外延', reason: '云原生与分布式成为价值高地', sources: ['report','internal'], event: '2026-05' },
                { type: 'upgrade', from: '辅助开发', to: 'AI 协同开发', importanceFrom: 1, importanceTo: 3, levelFrom: '了解', levelTo: '掌握', note: 'AI 工具从加分项变基础能力', reason: '大模型编码工具落地，人效诉求驱动', sources: ['community','recruit'], event: '2026-07' },
                { type: 'strengthen', from: '微服务架构', to: '微服务架构', importanceFrom: 2, importanceTo: 3, levelFrom: '掌握', levelTo: '精通', note: '重要性从"加分"升至"核心"', reason: '业务复杂度上升，架构治理价值突显', sources: ['internal','report'], event: '2026-03' },
                { type: 'strengthen', from: '可观测性', to: '可观测性', importanceFrom: 1, importanceTo: 2, levelFrom: '了解', levelTo: '掌握', note: '稳定性能力下沉为通用要求', reason: '系统规模上升，韧性保障成标配', sources: ['community','recruit'], event: '2026-06' },
                { type: 'weaken', from: 'SSH/Struts 单体', to: 'SSH/Struts 单体', importanceFrom: 2, importanceTo: 1, levelFrom: '掌握', levelTo: '了解', note: '传统框架能力要求收缩', reason: '云原生与前后端分离替代传统 MVC', sources: ['recruit','internal'], event: '2026-07' },
                { type: 'new', from: '—', to: '向量数据库/RAG', importanceFrom: 0, importanceTo: 2, levelFrom: '—', levelTo: '掌握', note: 'AI 工程化新能力进入视野', reason: 'RAG 技术需求进入快速扩张期', sources: ['community','github'], event: '2026-07' },
                { type: 'new', from: '—', to: 'Service Mesh', importanceFrom: 0, importanceTo: 2, levelFrom: '—', levelTo: '掌握', note: '服务网格成为微服务进阶能力', reason: '微服务规模化后治理复杂度上升', sources: ['github','report'], event: '2026-05' },
                { type: 'strengthen', from: '分布式事务', to: '分布式事务', importanceFrom: 2, importanceTo: 3, levelFrom: '掌握', levelTo: '精通', note: '方案描述由抽象转具体', reason: '云原生落地加深，事务方案标准趋同', sources: ['internal','recruit'], event: '2026-07' },
                { type: 'weaken', from: '手工运维', to: '声明式运维', importanceFrom: 2, importanceTo: 1, levelFrom: '掌握', levelTo: '了解', note: '手工运维被自动化替代', reason: 'IaC 与 GitOps 成为标准实践', sources: ['github','report'], event: '2026-05' }
            ]
        }
    };
    profile = Object.assign({}, DEMO, profile);
    // 如果 getEvolutionForJob 没返回 changes 等字段，用 DEMO 补
    profile.changes    = profile.changes    || DEMO.changes;
    profile.insights   = profile.insights   || DEMO.insights;
    profile.sources    = profile.sources    || DEMO.sources;
    profile.history    = profile.history    || DEMO.history;
    profile.timelineTotal = profile.timelineTotal || DEMO.timelineTotal;
    profile.timelineNewly = profile.timelineNewly || DEMO.timelineNewly;
    profile.timelineEvents = profile.timelineEvents || DEMO.timelineEvents;
    profile.timelineMonths = profile.timelineMonths || DEMO.timelineMonths;
    profile.trendHighlights = profile.trendHighlights || DEMO.trendHighlights;
    profile.trendMax = profile.trendMax || DEMO.trendMax;
    profile.period     = profile.period     || DEMO.period;
    profile.prevPeriod = profile.prevPeriod || DEMO.prevPeriod;

    // 头部：当前岗位 + 最近分析时间
    const jobNameEl = document.getElementById('evo-current-job');
    if (jobNameEl) jobNameEl.textContent = jobId;
    const lastEl = document.getElementById('evo-last-analysis');
    if (lastEl) {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        lastEl.textContent = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }

    // 周期标题
    const periodEl = document.getElementById('evo-important-period');
    const prevPeriodEl = document.getElementById('evo-prev-period');
    if (periodEl) periodEl.textContent = profile.period || '2026-08';
    if (prevPeriodEl) prevPeriodEl.textContent = profile.prevPeriod || '2026-07';

    // 渲染：时间轴 + 重要变化 + 右侧栏（防御性：每个独立 try-catch 避免一个失败连累全部）
    const monthsAll = (profile && profile.timelineMonths) || ['2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08'];
    const period = profile.period || monthsAll[monthsAll.length - 1];
    const defaultPeriod = monthsAll[Math.max(0, monthsAll.length - 2)];   // 默认对比「上一月」
    try { if (window.renderEvoTimelineChart) window.renderEvoTimelineChart(profile, 'all'); } catch(e) { console.warn('renderEvoTimelineChart error', e); }
    try { if (window.renderEvoImportantChanges) window.renderEvoImportantChanges(profile, { compareMonth: defaultPeriod }); } catch(e) { console.warn('renderEvoImportantChanges error', e); }
    try { if (window.renderEvoSidePanels) window.renderEvoSidePanels(profile); } catch(e) { console.warn('renderEvoSidePanels error', e); }

    // 时间范围切换（联动：时间轴 + 本期重点变化）
    document.querySelectorAll('.range-pill').forEach(p => {
        if (p.dataset.bound) return;
        p.dataset.bound = '1';
        p.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.range-pill').forEach(x => x.classList.remove('active'));
            p.classList.add('active');
            const raw = p.dataset.range; // '3' | '6' | '12' | 'all'
            const rangeForChart = (raw === 'all') ? 'all' : (parseInt(raw, 10) || 6);
            // 范围切换 → 对比基准月 =「当前月往前推 N 月」
            const n = (raw === 'all') ? monthsAll.length : parseInt(raw, 10);
            const cmp = monthsAll[Math.max(0, monthsAll.length - n)] || monthsAll[0];
            const sel = document.getElementById('evo-compare-select');
            if (sel) sel.value = cmp;
            try { if (window.renderEvoTimelineChart) window.renderEvoTimelineChart(profile, rangeForChart); } catch(err) { console.warn(err); }
            try { if (window.renderEvoImportantChanges) window.renderEvoImportantChanges(profile, { compareMonth: cmp }); } catch(err) { console.warn(err); }
            // 核心洞察联动：随范围切换更新
            try { if (window.renderEvoInsight) window.renderEvoInsight(profile, { range: raw }); } catch(err) { console.warn(err); }
        });
    });

    // 对比月份下拉：可选任意历史月份，切换后展示「对比月 → 当前月」之间的重点变化
    const compareSel = document.getElementById('evo-compare-select');
    if (compareSel) {
        compareSel.innerHTML = monthsAll.map(m => `<option value="${m}">${m}</option>`).join('');
        compareSel.value = defaultPeriod;
        if (!compareSel.dataset.bound) {
            compareSel.dataset.bound = '1';
            compareSel.addEventListener('change', (e) => {
                const m = e.target.value;
                // 下拉切换 → 同步顶部范围 pill（找到与对比月对应的「最近 N 月」）
                document.querySelectorAll('.range-pill').forEach(x => {
                    const n = (x.dataset.range === 'all') ? monthsAll.length : parseInt(x.dataset.range, 10);
                    const expected = monthsAll[Math.max(0, monthsAll.length - n)] || monthsAll[0];
                    x.classList.toggle('active', expected === m);
                });
                try { if (window.renderEvoTimelineChart) window.renderEvoTimelineChart(profile, 'all'); } catch(err) { console.warn(err); }
                try { if (window.renderEvoImportantChanges) window.renderEvoImportantChanges(profile, { compareMonth: m }); } catch(err) { console.warn(err); }
                try { if (window.renderEvoInsight) window.renderEvoInsight(profile, { range: 'all' }); } catch(err) { console.warn(err); }
            });
        }
    }

    // 数据来源：展开全部 / 收起 切换
    const expandBtn = document.getElementById('evo-source-expand');
    if (expandBtn && !expandBtn.dataset.bound) {
        expandBtn.dataset.bound = '1';
        expandBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const collapsed = expandBtn.dataset.collapsed !== '0';
            if (window.renderEvoSource) window.renderEvoSource(profile, { collapsed: !collapsed });
        });
    }
};
window.renderEvolutionList = function() {
    const el = document.getElementById('evo-list');
    if (!el) return;
    const jobs = Object.keys(window.EVOLUTION_JOB_PROFILES || {
        'Java开发工程师':1,'前端开发工程师':1,'Python数据分析师':1,'AI算法工程师':1,'产品经理':1,
        '运维工程师':1,'测试工程师':1,'UI设计师':1,'数据科学家':1,'DevOps工程师':1
    });
    el.innerHTML = jobs.map((t) => `
        <div class="evo-item ${t === evolutionState.currentJobId ? 'active' : ''}" data-job="${t}">
            <div class="evo-title">${t}</div>
            <div class="evo-cat">${(window.EVOLUTION_JOB_PROFILES[t]||{}).cat || '岗位'} · ${(window.EVOLUTION_JOB_PROFILES[t]||{}).jdCount || 800}个JD</div>
        </div>
    `).join('');
    el.querySelectorAll('.evo-item').forEach(item => {
        item.addEventListener('click', () => {
            el.querySelectorAll('.evo-item').forEach(x => x.classList.remove('active'));
            item.classList.add('active');
            evolutionState.currentJobId = item.dataset.job;
            window.renderEvolution();
        });
    });
};

// ===== 新布局：能力变化时间轴（双线 + 关键事件浮窗卡片） =====
window.renderEvoTimelineChart = function(profile, range) {
    const dom = document.getElementById('chart-evo-timeline');
    if (!dom || !window.echarts) return;
    if (range === 'all') range = 9999;
    range = parseInt(range, 10) || 6;

    const totalAll = (profile && profile.timelineTotal) || [38, 41, 45, 47, 52, 58, 64];
    const newlyAll = (profile && profile.timelineNewly) || [ 0,  3,  2,  3,  5,  6,  6];
    const monthsAll = ['2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08'];
    // 按 range 取末尾 N 个月
    const n = Math.min(range, totalAll.length);
    const xs = monthsAll.slice(-n);
    const ys1 = totalAll.slice(-n);
    const ys2 = newlyAll.slice(-n);

    // 关键事件（按 month 聚合；范围切换后只显示该范围内的）
    const eventsAll = (profile && profile.timelineEvents) || [];
    const visibleMonths = xs;
    const events = eventsAll.filter(e => visibleMonths.indexOf(e.time) >= 0);

    // markPoint data
    const markPointData = events.map((e, i) => {
        const idx = visibleMonths.indexOf(e.time);
        if (idx < 0) return null;
        return {
            name: e.title,
            value: ys1[idx],
            xAxis: idx,
            yAxis: ys1[idx],
            // 自定义数据传给 formatter
            eventData: e
        };
    }).filter(Boolean);

    if (window.echarts.getInstanceByDom) {
        const old = window.echarts.getInstanceByDom(dom);
        if (old) old.dispose();
    }
    const chart = window.echarts.init(dom);
    // 左侧 Y 轴：能力总数（按数据动态上界，向上取整）
    const totalMax = Math.max(10, Math.ceil(Math.max(...ys1) * 1.15 / 10) * 10);
    // 右侧 Y 轴：新生变化的能力（按数据动态上界，至少 6，圆整到合适的整十/整五）
    const newlyMaxRaw = Math.max(...ys2);
    const newlyMax = Math.max(6, Math.ceil(newlyMaxRaw * 1.4 / 5) * 5);
    chart.setOption({
        grid: { left: 44, right: 56, top: 34, bottom: 32 },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(15,25,40,0.92)',
            borderColor: 'rgba(31,200,217,0.4)',
            textStyle: { color: '#eaf6fb' },
            formatter: function(params) {
                if (!params || !params.length) return '';
                const month = params[0].axisValue;
                const ev = events.find(e => e.time === month);
                const t = params.find(p => p.seriesName === '能力总数');
                const n2 = params.find(p => p.seriesName === '发生变化的能力');
                let html = `<div style="font-weight:700;margin-bottom:4px;">${month}</div>`;
                if (t) html += `<div style="font-size:12px;color:#1fc8d9;">● 能力总数：<b>${t.value}</b></div>`;
                if (n2) html += `<div style="font-size:12px;color:#F0B429;">● 发生变化的能力：<b>${n2.value}</b></div>`;
                if (ev) {
                    html += `<div style="font-size:12px;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.15);">`;
                    html += `<b style="color:#1fc8d9;">${ev.count} 项变化</b> · ${ev.title}`;
                    html += `<div style="color:rgba(220,232,240,0.75);margin-top:2px;">${ev.desc}</div>`;
                    html += `</div>`;
                }
                return html;
            }
        },
        xAxis: {
            type: 'category',
            data: xs,
            boundaryGap: false,
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
            axisLabel: { color: 'rgba(220,232,240,0.75)', fontSize: 11 }
        },
        yAxis: [
            {
                type: 'value',
                name: '能力总数',
                nameTextStyle: { color: 'rgba(220,232,240,0.6)', fontSize: 11 },
                min: 0,
                max: totalMax,
                position: 'left',
                axisLine: { show: false },
                axisLabel: { color: 'rgba(220,232,240,0.6)', fontSize: 11 },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)', type: 'dashed' } }
            },
            {
                type: 'value',
                name: '新生变化的能力',
                nameTextStyle: { color: 'rgba(220,232,240,0.6)', fontSize: 11 },
                min: 0,
                max: newlyMax,
                position: 'right',
                axisLine: { show: false },
                axisLabel: { color: 'rgba(240,180,41,0.7)', fontSize: 11 },
                splitLine: { show: false }
            }
        ],
        series: [
            {
                name: '能力总数', type: 'line', smooth: true, data: ys1,
                yAxisIndex: 0,
                lineStyle: { color: '#1fc8d9', width: 2.5 },
                itemStyle: { color: '#1fc8d9' },
                areaStyle: { color: 'rgba(31,200,217,0.18)' },
                symbol: 'circle', symbolSize: 7,
                markPoint: {
                    symbol: 'circle',
                    symbolSize: 14,
                    itemStyle: {
                        color: '#1fc8d9',
                        borderColor: '#fff',
                        borderWidth: 2,
                        shadowColor: 'rgba(31,200,217,0.6)',
                        shadowBlur: 8
                    },
                    label: {
                        show: false
                    },
                    data: markPointData
                }
            },
            {
                name: '新生变化的能力', type: 'line', smooth: true, data: ys2,
                yAxisIndex: 1,
                lineStyle: { color: '#F0B429', width: 2 },
                itemStyle: { color: '#F0B429' },
                symbol: 'circle', symbolSize: 5
            }
        ]
    });

    // 鼠标悬停 markPoint → 显示白底浮层卡片
    let floatingCard = dom.querySelector('.evo-timeline-floating-card');
    if (!floatingCard) {
        floatingCard = document.createElement('div');
        floatingCard.className = 'evo-timeline-floating-card';
        floatingCard.style.display = 'none';
        dom.appendChild(floatingCard);
    }
    function hideFloating() { floatingCard.style.display = 'none'; }
    chart.on('mouseover', function(params) {
        if (params.componentType !== 'markPoint' || !params.data || !params.data.eventData) return;
        const e = params.data.eventData;
        const count = e.count != null ? e.count : '';
        floatingCard.innerHTML = [
            '<div class="evo-fc-count">' + count + ' 项变化</div>',
            '<div class="evo-fc-title"></div>',
            '<div class="evo-fc-desc"></div>'
        ].join('');
        floatingCard.querySelector('.evo-fc-title').textContent = e.title || '';
        floatingCard.querySelector('.evo-fc-desc').textContent  = e.desc  || '';
        // 转换为容器内像素坐标
        let px = null, py = null;
        try {
            const dataIndex = (params.data && params.data.xAxis != null) ? params.data.xAxis : null;
            const val = (params.data && params.data.yAxis != null) ? params.data.yAxis : null;
            if (dataIndex != null) {
                px = chart.convertToPixel({ xAxisIndex: 0 }, dataIndex);
            }
            if (val != null) {
                py = chart.convertToPixel({ yAxisIndex: 0 }, val);
            }
        } catch (err) {}
        // 回退：使用鼠标事件 offsetX/offsetY
        if (px == null && params.event && params.event.offsetX != null) px = params.event.offsetX;
        if (py == null && params.event && params.event.offsetY != null) py = params.event.offsetY;
        if (px == null) px = dom.clientWidth / 2;
        if (py == null) py = 30;
        const cardW = floatingCard.offsetWidth || 180;
        const cardH = floatingCard.offsetHeight || 60;
        // 卡片居中显示在点上方
        floatingCard.style.left = Math.max(4, Math.min(dom.clientWidth - cardW - 4, px - cardW / 2)) + 'px';
        floatingCard.style.top  = Math.max(4, py - cardH - 12) + 'px';
        floatingCard.style.display = 'block';
    });
    chart.on('mouseout', function(params) {
        if (params.componentType === 'markPoint') hideFloating();
    });
    // 鼠标离开整个图表也收起
    dom.addEventListener('mouseleave', hideFloating);

    // 点击 markPoint → 弹窗显示该时间点详情，并联动「本期重点变化」
    chart.on('click', function(params) {
        if (params.componentType === 'markPoint' && params.data && params.data.eventData) {
            window.openEvoTimepointModal(params.data.eventData, params.data.eventData.skills || []);
            try { if (window.renderEvoImportantChanges) window.renderEvoImportantChanges(profile, { timeNode: params.data.eventData.time }); } catch(err) { console.warn(err); }
            // 核心洞察联动：聚焦点击的时间节点
            try { if (window.renderEvoInsight) window.renderEvoInsight(profile, { timeNode: params.data.eventData.time }); } catch(err) { console.warn(err); }
        }
    });

    setTimeout(() => chart && chart.resize && chart.resize(), 80);
    // 暴露给弹窗使用
    window.__evoCurrentEvents = events;
};

// ===== 时间节点详情弹窗（点击节点触发） =====
window.openEvoTimepointModal = function(eventData, skills) {
    let modal = document.getElementById('evo-timepoint-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'evo-timepoint-modal';
        modal.className = 'evo-modal-mask';
        document.body.appendChild(modal);
    }
    const impactMap = { high: '高', mid: '中', low: '低' };
    const impactLevel = impactMap[eventData.impact] || '中';
    const skillsHtml = (skills || []).map(s => `<span class="evo-modal-skill">${s}</span>`).join('');
    modal.innerHTML = `
      <div class="evo-modal-box">
        <button class="evo-modal-close" aria-label="关闭">×</button>
        <div class="evo-modal-head">
          <div class="evo-modal-time">${eventData.time}</div>
          <div class="evo-modal-title">${eventData.title || ''}</div>
          <div class="evo-modal-meta">
            <span class="evo-modal-badge">${eventData.count} 项变化</span>
            <span class="evo-modal-impact impact-${eventData.impact || 'mid'}">影响程度：${impactLevel}</span>
          </div>
        </div>
        <div class="evo-modal-body">
          <div class="evo-modal-section">
            <div class="evo-modal-h">简要说明</div>
            <div class="evo-modal-p">${eventData.desc || ''}</div>
          </div>
          <div class="evo-modal-section">
            <div class="evo-modal-h">涉及的能力</div>
            <div class="evo-modal-skills">${skillsHtml || '<span style="color:rgba(220,232,240,0.5);">无</span>'}</div>
          </div>
          <div class="evo-modal-section">
            <div class="evo-modal-h">变化原因</div>
            <div class="evo-modal-p">${eventData.reason || '暂无说明'}</div>
          </div>
          <div class="evo-modal-section">
            <div class="evo-modal-h">数据依据</div>
            <div class="evo-modal-p">综合自 ${eventData.sources || 5} 个数据源（企业招聘、行业报告、技术社区、GitHub 趋势、企业内部数据），权重分布 40% / 25% / 15% / 10% / 10%。</div>
          </div>
          <div class="evo-modal-section">
            <div class="evo-modal-h">分析结果</div>
            <div class="evo-modal-p">${eventData.analysis || '本次变化反映岗位能力结构的调整方向，建议关注相关能力提升路径。'}</div>
          </div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
    // 关闭
    modal.querySelector('.evo-modal-close').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    }, { once: true });
};

// ===== 新布局：本期重点变化（参考图排版：新增/修改/删除 三组表格） =====
window.renderEvoImportantChanges = function(profile, opts) {
    opts = opts || {};
    const groupsEl  = document.getElementById('evo-groups');
    const legendEl  = document.getElementById('evo-importance-legend');
    const loadingEl = document.getElementById('evo-important-loading');
    const emptyEl   = document.getElementById('evo-important-empty');
    const errorEl   = document.getElementById('evo-important-error');
    const periodEl  = document.getElementById('evo-important-period');
    const prevEl    = document.getElementById('evo-important-prev');
    const showState = (state) => {
        [loadingEl, emptyEl, errorEl, groupsEl, legendEl].forEach(el => {
            if (el) el.style.display = (state === el) ? '' : 'none';
        });
    };
    showState(loadingEl);

    setTimeout(() => {
        try {
            const range = opts.range == null ? 6 : opts.range;
            const compareMonth = opts.compareMonth || null;   // 对比基准月（用户选择）
            const months = (profile && profile.timelineMonths) || ['2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08'];
            const all = (profile && profile.trendHighlights) || [];
            const period = profile.period || months[months.length - 1];
            const periodIdx = months.lastIndexOf(period);

            // 池筛选：优先「对比月视角」（对比月→当前月之间的差异），否则按时间范围
            let pool = all;
            if (compareMonth != null) {
                const startIdx = months.indexOf(compareMonth);
                pool = all.filter(h => {
                    const i = months.indexOf(h.node);
                    return i >= startIdx && i <= periodIdx;
                });
            } else if (range !== 'all' && range !== 9999 && !isNaN(parseInt(range,10))) {
                const n = Math.min(parseInt(range,10), months.length);
                const recent = months.slice(-n);
                pool = all.filter(h => recent.indexOf(h.node) >= 0);
            }

            // 排序：影响程度 + 变化幅度 + 数据可信度
            const impScore = { high: 3, mid: 2, low: 1 };
            pool = pool.slice().sort((a, b) => {
                const s = (h) => (impScore[h.importance] || 2) * 100 + (h.magnitude || 0) + (h.confidence || 0) * 10;
                return s(b) - s(a);
            });

            // 周期标题：始终是「当前数据（period）」
            if (periodEl) periodEl.textContent = period;
            // 对比文本：显示用户选择的对比月（没有则用默认「上一月」）
            if (prevEl) prevEl.textContent = compareMonth || profile.prevPeriod || months[Math.max(0, months.length - 2)];

            // 按方向分三组
            const groups = { add: [], mod: [], del: [] };
            pool.forEach(h => {
                if (h.direction === 'up')   groups.add.push(h);
                else if (h.direction === 'down') groups.del.push(h);
                else                          groups.mod.push(h);
            });

            if (!pool.length) { showState(emptyEl); return; }

            // 重要性 → ★ 数
            const impToStars = { high: 5, mid: 3, low: 1 };
            const stars = (n) => {
                const full = '★'.repeat(Math.max(0, Math.min(5, n || 0)));
                const empty = '☆'.repeat(5 - full.length);
                return `<span class="evo-stars-row">${full}<span class="evo-stars-empty">${empty}</span></span>`;
            };

            // 拆分为单行（每个 trend 的每个 skill 为一行，每行带 ★ 和 reason + 完整 trend 数据）
            const buildRows = (hs) => {
                const rows = [];
                hs.forEach(h => {
                    const imp = impToStars[h.importance] || 3;
                    (h.skills || []).forEach((sk, i) => {
                        const skName = (typeof sk === 'string') ? sk : (sk && sk.name) || '未命名';
                        const type = (h.skillTypes && h.skillTypes[i]) || (h.trend && h.trend.split(' ')[0]) || (h.importance === 'high' ? '核心技术' : '辅助技能');
                        rows.push(`
                          <div class="evo-table-row" data-trend='${JSON.stringify(h).replace(/'/g,"&#39;")}'>
                            <div class="evo-table-cell col-name">${skName}</div>
                            <div class="evo-table-cell col-type"><span class="evo-type-pill">${type}</span></div>
                            <div class="evo-table-cell col-imp">${stars(imp)}</div>
                            <div class="evo-table-cell col-reason">${h.reason || h.desc || ''}</div>
                          </div>`);
                    });
                });
                return rows;
            };

            // 每组默认显示前 N 行，其余行折叠到下拉浮层
            const DEFAULT_ROWS = 3;
            const renderGroup = (arr, containerId, countId) => {
                const wrap = document.getElementById(containerId);
                const cnt  = document.getElementById(countId);
                // 「项」按用户视角 = 实际行数（每个 skill 一行）；右侧「查看更多(N)」= 折叠行数
                const allRows = buildRows(arr);
                if (cnt) cnt.textContent = allRows.length + ' 项';
                if (!wrap) return;
                // 保留容器内已有的 .evo-table-header，仅清掉之前的行/toggle/empty
                const headerHtml = wrap.querySelector('.evo-table-header')?.outerHTML || '';
                wrap.innerHTML = headerHtml;
                if (!arr.length) {
                    wrap.insertAdjacentHTML('beforeend', `<div class="evo-group-empty">无</div>`);
                    return;
                }
                const visible  = allRows.slice(0, DEFAULT_ROWS);
                const hidden   = allRows.slice(DEFAULT_ROWS);
                wrap.insertAdjacentHTML('beforeend', visible.join(''));
                if (hidden.length) {
                    wrap.insertAdjacentHTML('beforeend',
                        `<div class="evo-table-toggle-wrap">
                            <div class="evo-table-toggle" data-target="${containerId}-more" data-group="${containerId}">查看更多 (${hidden.length}) ▾</div>
                            <div class="evo-table-dropdown" id="${containerId}-more" data-dropdown="${containerId}">
                                <div class="evo-table-dropdown-inner">${hidden.join('')}</div>
                            </div>
                        </div>`
                    );
                }
            };

            renderGroup(groups.add, 'evo-group-add', 'evo-group-add-count');
            renderGroup(groups.mod, 'evo-group-mod', 'evo-group-mod-count');
            renderGroup(groups.del, 'evo-group-del', 'evo-group-del-count');

            // 绑定查看更多（下拉浮层）
            document.querySelectorAll('.evo-table-toggle').forEach(t => {
                if (t.dataset.bound) return;
                t.dataset.bound = '1';
                t.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    const target = document.getElementById(t.dataset.target);
                    if (!target) return;
                    const willOpen = !target.classList.contains('open');
                    // 先关闭所有其他 dropdown + 重置所有箭头
                    document.querySelectorAll('.evo-table-dropdown.open').forEach(d => d.classList.remove('open'));
                    document.querySelectorAll('.evo-table-toggle').forEach(x => {
                        x.textContent = x.textContent.replace(/ [▴]$/, ' ▾');
                    });
                    if (willOpen) {
                        target.classList.add('open');
                        t.textContent = t.textContent.replace(/ ▾$/, ' ▴');
                    }
                });
            });
            // 点击其他位置关闭所有 dropdown（用 mousedown 捕获 + closest 排除，避免与 toggle click 时序冲突）
            if (!window.__evoDropdownOutsideBound) {
                window.__evoDropdownOutsideBound = true;
                document.addEventListener('mousedown', (e) => {
                    if (e.target.closest && e.target.closest('.evo-table-toggle')) return;
                    if (e.target.closest && e.target.closest('.evo-table-dropdown')) return;
                    document.querySelectorAll('.evo-table-dropdown.open').forEach(d => d.classList.remove('open'));
                    document.querySelectorAll('.evo-table-toggle').forEach(t => {
                        t.textContent = t.textContent.replace(/ [▴]$/, ' ▾');
                    });
                }, true);
            }

            // 绑定行点击 → 详情弹窗
            document.querySelectorAll('.evo-table-row').forEach(r => {
                if (r.dataset.bound) return;
                r.dataset.bound = '1';
                r.addEventListener('click', () => {
                    let data = null;
                    try { data = JSON.parse(r.getAttribute('data-trend').replace(/&#39;/g, "'")); } catch(e) {}
                    if (data) window.openEvoTrendDetailModal(data);
                });
            });

            showState(groupsEl);
            if (legendEl) legendEl.style.display = '';
        } catch (e) {
            console.warn('renderEvoImportantChanges error', e);
            showState(errorEl);
        }
    }, 280);
};

// ===== 重点变化详情弹窗 =====
window.openEvoTrendDetailModal = function(h) {
    let modal = document.getElementById('evo-trend-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'evo-trend-modal';
        modal.className = 'evo-modal-mask';
        document.body.appendChild(modal);
    }
    const dirText = { up: '增强', down: '下降', stable: '稳定' };
    const impLabel = { high: '高', mid: '中', low: '低' };
    const impScore = { high: 3, mid: 2, low: 1 };
    const dirCls = h.direction === 'up' ? 'dir-up' : (h.direction === 'down' ? 'dir-down' : 'dir-stable');
    const skillName = (s) => (typeof s === 'string') ? s : (s && s.name) || '未命名';
    const skillsHtml = (h.skills || []).map(s => `<span class="evo-modal-skill">${skillName(s)}</span>`).join('');
    // 「修改明细」：仅在修改方向、且 skills 是带 before/after 的对象数组时渲染
    const isModify = (h.direction === 'stable' || h.direction === 'mod');
    const modifyRows = isModify ? (h.skills || []).filter(s => s && typeof s === 'object' && (s.before || s.after)) : [];
    const modifySectionHtml = (isModify && modifyRows.length) ? `
          <div class="evo-modal-section">
            <div class="evo-modal-h">修改明细（原本要求 → 修改后要求）</div>
            <div class="evo-modal-modify-list">
              ${modifyRows.map(s => `
                <div class="evo-modal-modify-item">
                  <div class="evo-modal-modify-name">${skillName(s)}</div>
                  <div class="evo-modal-modify-compare">
                    <div class="evo-modal-modify-before">
                      <div class="evo-modal-modify-tag">原本要求</div>
                      <div class="evo-modal-modify-text">${s.before || '—'}</div>
                    </div>
                    <div class="evo-modal-modify-arrow">→</div>
                    <div class="evo-modal-modify-after">
                      <div class="evo-modal-modify-tag tag-after">修改后要求</div>
                      <div class="evo-modal-modify-text">${s.after || '—'}</div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
    ` : '';
    modal.innerHTML = `
      <div class="evo-modal-box">
        <button class="evo-modal-close" aria-label="关闭">×</button>
        <div class="evo-modal-head">
          <div class="evo-modal-time">${h.node || ''} 重点变化</div>
          <div class="evo-modal-title">${h.trend || ''} <span class="evo-trend-dir ${dirCls}" style="font-size:16px;">${dirText[h.direction] || ''}</span></div>
          <div class="evo-modal-meta">
            <span class="evo-modal-badge">重要程度：${impLabel[h.importance] || '中'}</span>
            <span class="evo-modal-impact impact-${h.importance || 'mid'}">影响程度：${impLabel[h.importance] || '中'}</span>
            <span class="evo-modal-impact impact-mid">数据可信度：${Math.round((h.confidence || 0) * 100)}%</span>
          </div>
        </div>
        <div class="evo-modal-body">
          <div class="evo-modal-section">
            <div class="evo-modal-h">变化描述</div>
            <div class="evo-modal-p">${h.desc || ''}</div>
          </div>
          <div class="evo-modal-section">
            <div class="evo-modal-h">变化前后对比</div>
            <div class="evo-modal-p">${h.beforeAfter || '该能力方向在岗位要求中的权重与出现频率发生变化。'}</div>
          </div>
          ${modifySectionHtml}
          <div class="evo-modal-section">
            <div class="evo-modal-h">具体涉及的能力</div>
            <div class="evo-modal-skills">${skillsHtml || '<span style="color:rgba(220,232,240,0.5);">无</span>'}</div>
          </div>
          <div class="evo-modal-section">
            <div class="evo-modal-h">变化原因</div>
            <div class="evo-modal-p">${h.reason || '暂无说明'}</div>
          </div>
          <div class="evo-modal-section">
            <div class="evo-modal-h">相关数据依据</div>
            <div class="evo-modal-p">${h.dataEvidence || '综合自 5 个数据源（企业招聘、行业报告、技术社区、GitHub 趋势、企业内部数据），权重分布 40% / 25% / 15% / 10% / 10%。'}</div>
          </div>
          <div class="evo-modal-section">
            <div class="evo-modal-h">分析依据与结论</div>
            <div class="evo-modal-p">${h.analysis || '该变化反映岗位能力结构的调整方向，建议持续关注相关能力的演进与提升路径。'}</div>
          </div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
    modal.querySelector('.evo-modal-close').addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; }, { once: true });
};

// ===== 新布局：右侧栏（核心洞察 + 数据来源 + 历史版本对比） =====
window.renderEvoInsight = function(profile, opts) {
    opts = opts || {};
    const ins = document.getElementById('evo-insight-list');
    if (!ins) return;
    const all = (profile && profile.insights) || [];
    if (!all.length) { ins.innerHTML = '<div class="evo-insight-empty">暂无洞察数据</div>'; return; }

    // ===== 联动过滤 =====
    let picked = all;
    const timeNode = opts.timeNode; // 形如 '2026-07'
    if (timeNode) {
        const matched = all.filter(x => (x.nodes || []).indexOf(timeNode) > -1);
        // 节点命中不足 2 条时回退全量，保证可读性
        picked = matched.length >= 2 ? matched : all.slice(0, 3);
    } else {
        // 按时间范围决定条数：近3月更聚焦(2条)，其余 3~4 条
        const range = parseInt(opts.range, 10);
        const maxN = (range === 3) ? 2 : 4;
        picked = all.slice(0, maxN);
    }

    // 节点联动时给卡片加高亮标记
    const scopeLabel = timeNode
        ? `聚焦节点 ${timeNode}`
        : (opts.range === '3' ? '近 3 个月' : opts.range === '6' ? '近 6 个月' : opts.range === '12' ? '近 1 年' : '全部周期');

    ins.innerHTML = picked.map(x => `
        <div class="evo-insight-item" data-insight="${x.id}">
            <div class="evo-insight-item-head">
                <span class="evo-insight-tag">${x.tag || '洞察'}</span>
                <span class="evo-insight-title">${x.title || ''}</span>
            </div>
            <div class="evo-insight-flow">
                <div class="evo-insight-step">
                    <span class="evo-insight-step-label">现象</span>
                    <p class="evo-insight-step-text">${x.phenomenon || ''}</p>
                </div>
                <div class="evo-insight-step">
                    <span class="evo-insight-step-label">原因</span>
                    <p class="evo-insight-step-text">${x.reason || ''}</p>
                </div>
                <div class="evo-insight-step evo-insight-step-conclusion">
                    <span class="evo-insight-step-label">趋势 / 结论</span>
                    <p class="evo-insight-step-text">${x.conclusion || ''}</p>
                </div>
            </div>
            <div class="evo-insight-evidence">
                <span class="evo-insight-evidence-label">数据支撑</span>
                <div class="evo-insight-evidence-chips">
                    ${(x.evidence || []).map(e => `<span class="evo-insight-chip">${e}</span>`).join('')}
                </div>
            </div>
        </div>
    `).join('') + `<div class="evo-insight-scope">当前范围：${scopeLabel}</div>`;
};

window.renderEvoSource = function(profile, opts) {
    opts = opts || {};
    const src = document.getElementById('evo-source-list');
    const sub = document.getElementById('evo-source-sub');
    const expandBtn = document.getElementById('evo-source-expand');
    if (!src) return;
    const all = (profile && profile.sources) || [];
    if (!all.length) { src.innerHTML = '<div class="evo-insight-empty">暂无数据来源</div>'; return; }
    if (sub) sub.textContent = `多源数据综合分析（共 ${all.length} 个来源）`;

    // 默认只展示最核心的 3 个，其余折叠
    const DEFAULT_N = 3;
    const collapsed = opts.collapsed !== false; // 默认折叠
    const shown = collapsed ? all.slice(0, DEFAULT_N) : all;
    if (expandBtn) {
        expandBtn.textContent = collapsed && all.length > DEFAULT_N ? '展开全部 ▸' : '收起 ▴';
        expandBtn.dataset.collapsed = collapsed ? '1' : '0';
    }

    const statusMap = { '正常': 'ok', '实验': 'exp', '异常': 'err' };
    src.innerHTML = shown.map(s => `
        <div class="evo-source-item" data-source="${s.id}">
            <div class="evo-source-dot"></div>
            <div class="evo-source-info">
                <div class="evo-source-name-row">
                    <span class="evo-source-name">${s.name}</span>
                    <span class="evo-source-type">${s.type || ''}</span>
                </div>
                <div class="evo-source-meta">${s.scale || ''} · ${s.updatedAt || ''}</div>
            </div>
            <span class="evo-source-status evo-source-status-${(statusMap[s.status] || 'ok')}">${s.status || '正常'}</span>
        </div>
    `).join('') + (collapsed && all.length > DEFAULT_N
        ? `<div class="evo-source-more" id="evo-source-more-hint">还有 ${all.length - DEFAULT_N} 个来源，点击右上角"展开全部"查看</div>`
        : '');

    // 点击来源 → 弹详情（含证据链）
    src.querySelectorAll('.evo-source-item').forEach(el => {
        if (el.dataset.bound) return;
        el.dataset.bound = '1';
        el.addEventListener('click', () => {
            const s = all.find(x => x.id === el.dataset.source);
            if (s) window.openEvoSourceModal(s, profile);
        });
    });
};

window.openEvoSourceModal = function(s, profile) {
    const statusMap = { '正常': 'ok', '实验': 'exp', '异常': 'err' };
    let modal = document.getElementById('evo-source-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'evo-source-modal';
        modal.className = 'evo-modal-mask';
        document.body.appendChild(modal);
    }
    // 构建支撑的洞察/变化链路
    const insights = (profile && profile.insights) || [];
    const linked = (s.links || []).map(id => insights.find(x => x.id === id)).filter(Boolean);
    const linkHtml = linked.length ? linked.map(x => `
        <div class="evo-source-link-item">
            <span class="evo-source-link-tag">${x.tag || '洞察'}</span>
            <span class="evo-source-link-title">${x.title || ''}</span>
        </div>`).join('') : '<div class="evo-source-link-empty">该来源暂未直接关联核心洞察</div>';

    modal.innerHTML = `
        <div class="evo-modal-box evo-source-modal-box">
            <button class="evo-modal-close" data-close="1">×</button>
            <div class="evo-source-modal-head">
                <div class="evo-source-modal-name">${s.name}</div>
                <span class="evo-source-type">${s.type || ''}</span>
                <span class="evo-source-status evo-source-status-${(statusMap[s.status] || 'ok')}">${s.status || '正常'}</span>
            </div>
            <div class="evo-source-modal-grid">
                <div class="evo-source-modal-cell"><span class="k">数据规模</span><span class="v">${s.scale || '—'}</span></div>
                <div class="evo-source-modal-cell"><span class="k">更新时间</span><span class="v">${s.updatedAt || '—'}</span></div>
                <div class="evo-source-modal-cell"><span class="k">覆盖范围</span><span class="v">${s.coverage || '—'}</span></div>
                <div class="evo-source-modal-cell"><span class="k">主要贡献</span><span class="v">${s.contribution || '—'}</span></div>
            </div>
            <div class="evo-source-modal-section">
                <div class="evo-source-modal-section-title">数据说明</div>
                <p class="evo-source-modal-detail">${s.details || ''}</p>
            </div>
            <div class="evo-source-modal-section">
                <div class="evo-source-modal-section-title">数据来源 → 分析结论（证据链）</div>
                <div class="evo-source-modal-links">${linkHtml}</div>
            </div>
        </div>`;
    modal.style.display = 'flex';
    modal.onclick = (e) => {
        if (e.target === modal || e.target.dataset.close) modal.style.display = 'none';
    };
};

window.renderEvoSidePanels = function(profile) {
    // 核心洞察（默认按 6 个月范围渲染）
    if (window.renderEvoInsight) window.renderEvoInsight(profile, { range: 6 });
    // 数据来源
    if (window.renderEvoSource) window.renderEvoSource(profile, {});
};

window.getEvolutionForJob = function(jobId) {
    const profiles = window.EVOLUTION_JOB_PROFILES || {};
    const profile = profiles[jobId] || profiles['Java开发工程师'];
    if (!profile) {
        return { added:[], removed:[], modified:[], hotSkills:[], hotValues:[], trendMust:[], trendNice:[], cat:'岗位', jdCount:0 };
    }
    const seed = (jobId || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const jitter = (arr, key) => (arr || []).map((item, i) => {
        const copy = Object.assign({}, item);
        if (key === 'growth' && copy.growth && String(copy.growth).includes('%')) {
            const n = parseInt(String(copy.growth).replace(/[^\d-]/g, ''), 10) || 40;
            copy.growth = '+' + Math.max(8, n + ((seed + i * 17) % 40) - 15) + '%';
        }
        return copy;
    });
    return {
        added: jitter(profile.added, 'growth'),
        removed: (profile.removed || []).slice(),
        modified: (profile.modified || []).slice(),
        hotSkills: (profile.hotSkills || []).slice(),
        hotValues: (profile.hotValues || []).map((v, i) => Math.round(v * (0.85 + ((seed + i) % 30) / 100))),
        trendMust: (profile.trendMust || []).map((v, i) => Math.round(v + ((seed + i) % 5) - 2)),
        trendNice: (profile.trendNice || []).map((v, i) => Math.round(v + ((seed + i * 3) % 4) - 1)),
        cat: profile.cat,
        jdCount: profile.jdCount
    };
};
window.renderEvolution = function() {
    window.renderEvolutionCharts();
};
window.renderEvolutionCharts = function() {
    window.disposeChart('chart-evo-trend');
    window.disposeChart('chart-evo-bar');
    const data = window.getEvolutionForJob(evolutionState.currentJobId);
    const factor = 1 + (6 - evolutionState.timeOffset) * 0.08;
    const must = data.trendMust.map(v => Math.round(v * factor));
    const nice = data.trendNice.map(v => Math.round(v * factor));
    const total = must.map((v, i) => v + nice[i]);
    window.chartInstances['chart-evo-trend'] = window.safeChart('chart-evo-trend');
    window.chartInstances['chart-evo-trend'].setOption({
        ...window.baseChartOpt(),
        legend:{data:['必备技能','加分技能','总技能数'], top:0, textStyle:{color:'#475569'}},
        xAxis:{type:'category',data:['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],axisLabel:{color:'#475569', fontSize:11},axisLine:{lineStyle:{color:'#e2e8f0'}}},
        yAxis:{type:'value',axisLabel:{color:'#475569', fontSize:11},splitLine:{lineStyle:{color:'#f1f3f9'}}},
        series:[
            {name:'必备技能',type:'line',smooth:true,symbolSize:6,lineStyle:{width:3, color:'#0D9488'},itemStyle:{color:'#0D9488'},data:must},
            {name:'加分技能',type:'line',smooth:true,symbolSize:6,lineStyle:{width:3, color:'#10b981'},itemStyle:{color:'#10b981'},data:nice},
            {name:'总技能数',type:'bar',barWidth:18,itemStyle:{borderRadius:[4,4,0,0], color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(13,148,136,.6)'},{offset:1,color:'rgba(13,148,136,.2)'}]}},data:total}
        ]
    });
    window.chartInstances['chart-evo-bar'] = window.safeChart('chart-evo-bar');
    const hotSkills = data.hotSkills.slice().reverse();
    const hotValues = data.hotValues.slice().reverse().map(v => Math.round(v * factor));
    window.chartInstances['chart-evo-bar'].setOption({
        ...window.baseChartOpt(),
        grid:{left:90, right:30, top:10, bottom:30, containLabel:true},
        tooltip:{trigger:'axis', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}},
        xAxis:{type:'value',axisLabel:{color:'#475569', fontSize:11},splitLine:{lineStyle:{color:'#f1f3f9'}}},
        yAxis:{type:'category',data:hotSkills,axisLabel:{color:'#475569', fontSize:11}},
        series:[{type:'bar',barWidth:14,data:hotValues,itemStyle:{borderRadius:[0,7,7,0],color:{type:'linear',x:0,y:0,x2:1,y2:0,colorStops:[{offset:0,color:'#0D9488'},{offset:1,color:'#F5A524'}]}}}]
    });
};

// 分岗位演化画像（切换左侧岗位时驱动变化）
window.EVOLUTION_JOB_PROFILES = {
    'RAG 知识工程师': {
        cat:'人工智能', jdCount:860,
        added:[{name:'GraphRAG',version:'新出现',growth:'+310%'},{name:'Rerank 重排',version:'新出现',growth:'+240%'},{name:'HyDE 假设文档',version:'新出现',growth:'+168%'},{name:'Agentic RAG',version:'新出现',growth:'+205%'},{name:'多路召回',version:'加分→必备',growth:'+96%'},{name:'RAGAS 评估',version:'新出现',growth:'+88%'}],
        removed:[{name:'单路向量检索',version:'边缘化',decline:'-64%'},{name:'纯关键词倒排',version:'边缘化',decline:'-71%'},{name:'固定长度切片',version:'被替代',decline:'-55%'},{name:'朴素 Top-K',version:'被替代',decline:'-48%'}],
        modified:[{name:'向量数据库',change:'加分→必备',weight:'↑'},{name:'混合检索',change:'新出现→必备',weight:'↑'},{name:'查询改写',change:'选修→加分',weight:'+26%'},{name:'评估体系',change:'—→必备',weight:'↑'},{name:'切片策略',change:'加分→核心',weight:'+31%'}],
        hotSkills:['GraphRAG','Rerank','向量数据库','混合检索','RAGAS','HyDE','LangChain','LlamaIndex','Embedding','查询改写'],
        hotValues:[296,241,228,205,148,132,196,154,188,118],
        trendMust:[14,17,20,24,28,33,38,44,50,57,64,72], trendNice:[8,10,12,15,18,21,25,29,33,38,43,48]
    },
    'Java开发工程师': {
        cat:'后端', jdCount:1420,
        added:[{name:'Spring Cloud Alibaba',version:'v2026.1',growth:'+347%'},{name:'GraalVM Native Image',version:'新出现',growth:'+128'},{name:'JDK 21 Virtual Thread',version:'v17→v21',growth:'+89%'},{name:'Spring AI',version:'新出现',growth:'+147'},{name:'OpenTelemetry',version:'新出现',growth:'+52'},{name:'eBPF',version:'新出现',growth:'+45'}],
        removed:[{name:'Struts2',version:'已废弃',decline:'-89%'},{name:'EJB',version:'已废弃',decline:'-95%'},{name:'JSP',version:'边缘化',decline:'-72%'},{name:'SOAP',version:'边缘化',decline:'-58%'}],
        modified:[{name:'微服务架构',change:'中级→高级',weight:'+18%'},{name:'MySQL',change:'加分→必备',weight:'↑'},{name:'Redis',change:'加分→必备',weight:'↑'},{name:'Kafka',change:'加分→必备',weight:'↑'},{name:'Kubernetes',change:'加分→必备',weight:'↑'}],
        hotSkills:['Spring Cloud','JDK 21','OpenTelemetry','GraalVM','Kafka','Redis','MySQL','Kubernetes','Docker','JVM调优'],
        hotValues:[387,289,152,128,210,198,176,168,154,132],
        trendMust:[18,19,19,20,21,22,23,24,25,26,28,30], trendNice:[12,13,14,15,16,17,18,20,22,24,26,28]
    },
    '前端开发工程师': {
        cat:'前端', jdCount:1180,
        added:[{name:'React Server Components',version:'新出现',growth:'+210%'},{name:'Next.js App Router',version:'v13→v15',growth:'+168%'},{name:'Vite 6',version:'新出现',growth:'+92%'},{name:'WebGPU',version:'新出现',growth:'+64%'},{name:'Astro',version:'新出现',growth:'+71%'},{name:'Tailwind v4',version:'新出现',growth:'+55%'}],
        removed:[{name:'jQuery',version:'边缘化',decline:'-78%'},{name:'Grunt',version:'已废弃',decline:'-91%'},{name:'Bower',version:'已废弃',decline:'-96%'},{name:'AngularJS 1.x',version:'已废弃',decline:'-88%'}],
        modified:[{name:'TypeScript',change:'加分→必备',weight:'↑'},{name:'React',change:'中级→高级',weight:'+22%'},{name:'工程化',change:'加分→必备',weight:'↑'},{name:'性能优化',change:'加分→必备',weight:'↑'},{name:'微前端',change:'选修→加分',weight:'↑'}],
        hotSkills:['TypeScript','React 19','Next.js','Vite','Vue3','CSS-in-JS','Webpack','Node.js','Playwright','WebGPU'],
        hotValues:[410,360,298,240,220,180,165,150,120,95],
        trendMust:[16,17,18,19,20,22,23,24,26,27,29,31], trendNice:[14,15,16,17,19,20,22,24,25,27,29,32]
    },
    'Python数据分析师': {
        cat:'数据', jdCount:860,
        added:[{name:'DuckDB',version:'新出现',growth:'+190%'},{name:'Polars',version:'新出现',growth:'+156%'},{name:'dbt',version:'新出现',growth:'+112%'},{name:'Lakehouse',version:'新出现',growth:'+88%'},{name:'LLM for Analytics',version:'新出现',growth:'+134%'}],
        removed:[{name:'SPSS',version:'边缘化',decline:'-62%'},{name:'Excel宏主导',version:'边缘化',decline:'-48%'},{name:'SAS基础岗',version:'下降',decline:'-41%'}],
        modified:[{name:'SQL',change:'必备→专家',weight:'↑'},{name:'Python',change:'中级→高级',weight:'+15%'},{name:'可视化',change:'加分→必备',weight:'↑'},{name:'A/B测试',change:'加分→必备',weight:'↑'}],
        hotSkills:['SQL','Python','Pandas','Polars','dbt','Tableau','PowerBI','Spark','Airflow','统计建模'],
        hotValues:[420,380,310,260,210,190,175,160,140,125],
        trendMust:[14,15,16,17,18,19,20,21,22,24,25,27], trendNice:[10,11,12,13,14,15,16,18,19,21,23,25]
    },
    'AI算法工程师': {
        cat:'AI', jdCount:1560,
        added:[{name:'LLM 应用工程',version:'新出现',growth:'+420%'},{name:'RAG',version:'新出现',growth:'+310%'},{name:'Agent / Tool Use',version:'新出现',growth:'+280%'},{name:'LoRA / PEFT',version:'新出现',growth:'+195%'},{name:'vLLM',version:'新出现',growth:'+160%'},{name:'多模态',version:'新出现',growth:'+148%'}],
        removed:[{name:'传统SVM主岗',version:'边缘化',decline:'-55%'},{name:'浅层特征工程岗',version:'下降',decline:'-43%'},{name:'纯规则引擎',version:'边缘化',decline:'-60%'}],
        modified:[{name:'PyTorch',change:'加分→必备',weight:'↑'},{name:'深度学习',change:'中级→高级',weight:'+25%'},{name:'CUDA',change:'选修→加分',weight:'↑'},{name:'分布式训练',change:'加分→必备',weight:'↑'}],
        hotSkills:['LLM','PyTorch','RAG','Transformer','CUDA','LoRA','Agent','向量检索','Python','MLSys'],
        hotValues:[480,420,390,340,280,260,240,210,190,150],
        trendMust:[20,22,24,26,28,30,33,36,38,41,44,48], trendNice:[15,16,18,20,22,25,28,30,33,36,40,44]
    },
    '产品经理': {
        cat:'产品', jdCount:980,
        added:[{name:'AI 产品设计',version:'新出现',growth:'+260%'},{name:'Prompt 产品化',version:'新出现',growth:'+180%'},{name:'数据闭环设计',version:'新出现',growth:'+95%'},{name:'增长实验平台',version:'新出现',growth:'+72%'}],
        removed:[{name:'纯画线框交付',version:'边缘化',decline:'-50%'},{name:'无数据决策',version:'下降',decline:'-66%'}],
        modified:[{name:'用户研究',change:'加分→必备',weight:'↑'},{name:'数据分析',change:'加分→必备',weight:'↑'},{name:'商业Sense',change:'中级→高级',weight:'+12%'}],
        hotSkills:['需求分析','AI产品','数据分析','用户研究','Roadmap','SQL基础','A/B测试','竞品分析','PRD','跨团队协作'],
        hotValues:[360,320,280,250,220,180,170,160,150,140],
        trendMust:[12,13,13,14,15,16,17,18,19,20,21,22], trendNice:[9,10,11,12,13,14,15,16,17,18,20,21]
    },
    '运维工程师': {
        cat:'运维', jdCount:720,
        added:[{name:'Platform Engineering',version:'新出现',growth:'+170%'},{name:'GitOps',version:'新出现',growth:'+130%'},{name:'eBPF Observability',version:'新出现',growth:'+98%'},{name:'FinOps',version:'新出现',growth:'+76%'}],
        removed:[{name:'纯手工部署',version:'已废弃',decline:'-82%'},{name:'无监控值班',version:'下降',decline:'-70%'}],
        modified:[{name:'Kubernetes',change:'加分→必备',weight:'↑'},{name:'IaC',change:'选修→必备',weight:'↑'},{name:'SRE实践',change:'加分→中级',weight:'↑'}],
        hotSkills:['Kubernetes','Terraform','Prometheus','Grafana','Linux','CI/CD','Ansible','Istio','AWS','SRE'],
        hotValues:[350,300,270,250,240,220,190,170,160,145],
        trendMust:[13,14,15,16,17,18,19,21,22,23,25,26], trendNice:[10,11,12,13,14,15,16,17,18,20,21,23]
    },
    '测试工程师': {
        cat:'测试', jdCount:640,
        added:[{name:'AI 辅助测试',version:'新出现',growth:'+200%'},{name:'契约测试',version:'新出现',growth:'+110%'},{name:'Chaos Engineering',version:'新出现',growth:'+85%'},{name:'质量门禁左移',version:'新出现',growth:'+90%'}],
        removed:[{name:'纯手工点点点',version:'边缘化',decline:'-58%'},{name:'无自动化报表',version:'下降',decline:'-47%'}],
        modified:[{name:'自动化测试',change:'加分→必备',weight:'↑'},{name:'接口测试',change:'中级→高级',weight:'↑'},{name:'性能测试',change:'选修→加分',weight:'↑'}],
        hotSkills:['自动化测试','Playwright','接口测试','CI质量门禁','性能测试','Python','Java','Appium','Mock','测试设计'],
        hotValues:[330,290,260,230,200,180,170,150,140,130],
        trendMust:[11,12,13,14,15,16,17,18,19,20,21,23], trendNice:[8,9,10,11,12,13,14,15,16,17,18,20]
    },
    'UI设计师': {
        cat:'设计', jdCount:510,
        added:[{name:'AI 设计协作',version:'新出现',growth:'+240%'},{name:'Design System Token',version:'新出现',growth:'+120%'},{name:'动效工程化',version:'新出现',growth:'+80%'}],
        removed:[{name:'切图工厂模式',version:'边缘化',decline:'-65%'},{name:'无组件库交付',version:'下降',decline:'-52%'}],
        modified:[{name:'Figma',change:'加分→必备',weight:'↑'},{name:'交互设计',change:'中级→高级',weight:'↑'},{name:'可用性测试',change:'选修→加分',weight:'↑'}],
        hotSkills:['Figma','设计系统','交互设计','视觉设计','原型','动效','用户体验','组件库','插画','AI作图'],
        hotValues:[300,270,240,210,190,170,160,140,120,100],
        trendMust:[10,11,11,12,13,14,14,15,16,17,18,19], trendNice:[8,8,9,10,11,12,13,14,15,16,17,18]
    },
    '数据科学家': {
        cat:'数据', jdCount:890,
        added:[{name:'Causal Inference',version:'新出现',growth:'+150%'},{name:'Feature Store',version:'新出现',growth:'+125%'},{name:'LLM Evaluation',version:'新出现',growth:'+175%'},{name:'MLOps',version:'新出现',growth:'+140%'}],
        removed:[{name:'纯离线报表岗',version:'边缘化',decline:'-45%'},{name:'无线上闭环',version:'下降',decline:'-50%'}],
        modified:[{name:'机器学习',change:'中级→高级',weight:'+20%'},{name:'实验设计',change:'加分→必备',weight:'↑'},{name:'特征工程',change:'加分→必备',weight:'↑'}],
        hotSkills:['机器学习','Python','实验设计','特征工程','MLOps','统计推断','Spark','SQL','模型评估','因果推断'],
        hotValues:[400,360,300,280,250,230,200,180,160,145],
        trendMust:[15,16,17,18,20,21,23,24,26,28,30,32], trendNice:[12,13,14,15,16,18,19,21,23,25,27,29]
    },
    'DevOps工程师': {
        cat:'运维', jdCount:780,
        added:[{name:'Internal Developer Platform',version:'新出现',growth:'+185%'},{name:'Policy as Code',version:'新出现',growth:'+115%'},{name:'Supply Chain Security',version:'新出现',growth:'+102%'},{name:'WASM Edge',version:'新出现',growth:'+68%'}],
        removed:[{name:'脚本堆砌发布',version:'已废弃',decline:'-75%'},{name:'无GitOps',version:'下降',decline:'-60%'}],
        modified:[{name:'CI/CD',change:'中级→专家',weight:'↑'},{name:'Kubernetes',change:'加分→必备',weight:'↑'},{name:'可观测性',change:'加分→必备',weight:'↑'}],
        hotSkills:['CI/CD','Kubernetes','Terraform','GitOps','Docker','Prometheus','ArgoCD','Security','Linux','云原生'],
        hotValues:[370,340,300,270,250,230,200,180,170,155],
        trendMust:[14,15,16,17,18,20,21,23,24,26,28,30], trendNice:[11,12,13,14,15,16,18,19,21,22,24,26]
    }
};


/* extracted for evolution */

// ============== Learning Path View ==============
let learningPathState = { currentJobId: 'Java开发工程师' };

window.initLearningPath = function() {
    const profiles = window.EVOLUTION_JOB_PROFILES || {};
    const jobs = Object.keys(profiles).length ? Object.keys(profiles) : [learningPathState.currentJobId];
    learningPathState.currentJobId = evolutionState.currentJobId || jobs[0] || 'Java开发工程师';
    console.log('[initLearningPath] jobId=', learningPathState.currentJobId, 'profiles=', jobs.length);
    // 直接渲染左侧岗位列表、步骤、效果、详情
    const lpList = document.getElementById('lp-job-list');
    const lpSteps = document.getElementById('lp-steps');
    const lpDetail = document.getElementById('lp-detail');
    const lpPct = document.getElementById('lp-effect-pct');
    const lpStars = document.getElementById('lp-stars');
    console.log('[initLearningPath] elements:', !!lpList, !!lpSteps, !!lpDetail, !!lpPct, !!lpStars);
    window.renderLpJobList();
    window.renderLpPage();
    window.bindLearningPathEvents();
    // 兜底：若 lp-steps 仍为空，直接基于当前岗位数据手动渲染
    if (lpSteps && !lpSteps.innerHTML.trim()) {
      const d = window.getEvolutionForJob(learningPathState.currentJobId);
      let steps = (d.added || []).slice(0, 3);
      if (steps.length < 3) (d.modified || []).forEach(m => { if (steps.length < 3 && m.name) steps.push(m); });
      if (steps.length < 3) ['核心框架','工程实践','架构设计'].forEach(n => { if (steps.length < 3) steps.push({ name: n }); });
      const periods = ['2-3 周', '1-2 周', '2-3 周'];
      const priorities = ['高', '高', '中'];
      lpSteps.innerHTML = steps.map((s, i) => `
        <div class="lp-step anim-fade-up" style="animation-delay:${i * 0.05}s">
          <div class="lp-step-num">${i + 1}</div>
          <div class="lp-step-name">${s.name}</div>
          <div class="lp-step-priority">优先级: <strong>${priorities[i]}</strong></div>
          <div class="lp-step-meta">预计学习周期 ${periods[i]}</div>
        </div>
        ${i < steps.length - 1 ? '<div class="lp-step-arrow">→</div>' : ''}
      `).join('');
      console.log('[initLearningPath] fallback steps rendered:', lpSteps.children.length);
    }
};

window.bindLearningPathEvents = function() {
    const search = document.getElementById('lp-search');
    if (search && !search.dataset.bound) {
        search.dataset.bound = '1';
        search.addEventListener('input', () => {
            const kw = search.value.trim().toLowerCase();
            document.querySelectorAll('#lp-job-list .lp-job-item').forEach(el => {
                const t = (el.dataset.job || '').toLowerCase();
                el.style.display = t.includes(kw) ? '' : 'none';
            });
        });
    }
};

window.renderLpJobList = function() {
    const el = document.getElementById('lp-job-list');
    if (!el) return;
    const profiles = window.EVOLUTION_JOB_PROFILES || {};
    let jobs = Object.keys(profiles);
    if (!jobs.length) jobs = window.Store && window.Store.state ? window.Store.state.jobs.map(j => j.title) : [learningPathState.currentJobId];
    const tags = ['紧缺','热门','新兴','稳定','高潜'];
    el.innerHTML = jobs.map((jid, i) => {
        const d = profiles[jid] || {};
        const active = jid === learningPathState.currentJobId ? ' active' : '';
        const tag = tags[i % tags.length];
        return `
            <div class="lp-job-item${active}" data-job="${jid}" onclick="window.switchLearningPathJob('${jid}')">
                <div class="lp-job-name"><span>${jid}</span><span class="lp-job-tag">${tag}</span></div>
                <div class="lp-job-meta">数据来源: ${d.jdCount || window.Utils.rand(120, 520)} 份JD</div>
                <div class="lp-job-meta">学习完成率: ${window.Utils.rand(68, 94)}%</div>
            </div>
        `;
    }).join('');
};

window.switchLearningPathJob = function(jid) {
    if (!jid) return;
    learningPathState.currentJobId = jid;
    evolutionState.currentJobId = jid;
    window.renderLpJobList();
    window.renderLpPage();
};

window.renderLpPage = function() {
    const d = window.getEvolutionForJob(learningPathState.currentJobId);
    window.renderLpSteps(d);
    window.renderLpEffect(d);
    window.renderLpDetail(d);
};

window.renderLpSteps = function(d) {
    const el = document.getElementById('lp-steps');
    if (!el) return;
    let steps = (d.added || []).slice(0, 3);
    if (steps.length < 3) (d.modified || []).forEach(m => { if (steps.length < 3 && m.name) steps.push(m); });
    if (steps.length < 3) ['核心框架','工程实践','架构设计'].forEach(n => { if (steps.length < 3) steps.push({ name: n, growth: '+0%' }); });
    const periods = ['2-3 周', '1-2 周', '2-3 周'];
    const priorities = ['高', '高', '中'];
    el.innerHTML = steps.map((s, i) => `
        <div class="lp-step anim-fade-up" style="animation-delay:${i * 0.05}s">
            <div class="lp-step-num">${i + 1}</div>
            <div class="lp-step-name">${s.name}</div>
            <div class="lp-step-priority">优先级: <strong>${priorities[i]}</strong></div>
            <div class="lp-step-meta">预计学习周期 ${periods[i]}</div>
        </div>
        ${i < steps.length - 1 ? '<div class="lp-step-arrow">→</div>' : ''}
    `).join('');
};

window.renderLpEffect = function(d) {
    const added = (d.added || []).length;
    const modified = (d.modified || []).length;
    const pct = Math.min(96, Math.max(70, 72 + added * 3 + modified * 2));
    const pctEl = document.getElementById('lp-effect-pct');
    if (pctEl) pctEl.textContent = pct;
    const starsEl = document.getElementById('lp-stars');
    if (starsEl) starsEl.textContent = '★'.repeat(Math.floor(pct / 20)) + '☆'.repeat(5 - Math.floor(pct / 20));

    window.disposeChart('lp-effect-chart');
    const chart = window.safeChart('lp-effect-chart');
    if (!chart) return;
    window.chartInstances['lp-effect-chart'] = chart;
    const vals = [window.Utils.rand(55, 65), window.Utils.rand(60, 72), window.Utils.rand(68, 78), window.Utils.rand(78, 86), pct];
    chart.setOption({
        ...window.baseChartOpt(),
        grid: { left: 0, right: 0, top: 6, bottom: 0 },
        xAxis: { type: 'category', show: false, data: ['M1', 'M2', 'M3', 'M4', 'M5'] },
        yAxis: { type: 'value', show: false, min: 40, max: 100 },
        tooltip: { trigger: 'axis', formatter: '{c}% 能力预估' },
        series: [{
            type: 'line', data: vals, smooth: true, symbol: 'none',
            lineStyle: { color: '#0D9488', width: 2.5 },
            areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(13,148,136,.35)' }, { offset: 1, color: 'rgba(13,148,136,.04)' }] } }
        }]
    });
};

window.renderLpDetail = function(d) {
    const el = document.getElementById('lp-detail');
    if (!el) return;
    let steps = (d.added || []).slice(0, 3);
    if (steps.length < 3) (d.modified || []).forEach(m => { if (steps.length < 3 && m.name) steps.push(m); });
    if (steps.length < 3) ['核心框架','工程实践','架构设计'].forEach(n => { if (steps.length < 3) steps.push({ name: n, growth: '+0%' }); });
    const goals = [
        ['理解核心概念与应用场景', '掌握框架及工具使用', '能够独立构建简单的应用'],
        ['深入掌握高级特性与配置', '能够解决复杂业务问题', '具备性能优化基础能力'],
        ['理解底层实现原理', '具备架构设计与扩展能力', '能够带领团队落地应用']
    ];
    const gains = [
        ['自动化流程能力', '智能决策能力', '提升开发效率'],
        ['复杂系统设计能力', '问题排查与优化能力', '提升代码质量'],
        ['技术领导力', '架构设计能力', '提升团队产出']
    ];
    const resources = [
        [{name:'官方文档', tag:'入门'}, {name:'实战课程', tag:'进阶'}, {name:'项目练习', tag:'提升'}],
        [{name:'源码阅读', tag:'进阶'}, {name:'案例拆解', tag:'进阶'}, {name:'社区讨论', tag:'提升'}],
        [{name:'架构实战', tag:'提升'}, {name:'最佳实践', tag:'提升'}, {name:'技术分享', tag:'提升'}]
    ];
    el.innerHTML = steps.map((s, i) => `
        <div class="lp-detail-step anim-fade-up" style="animation-delay:${i * 0.06}s">
            <div class="lp-detail-num">${i + 1}</div>
            <div>
                <div class="lp-detail-title">${s.name}</div>
                <div class="lp-detail-grid">
                    <div class="lp-detail-col">
                        <h4>学习目标</h4>
                        <ul>${goals[i].map(g => `<li>${g}</li>`).join('')}</ul>
                    </div>
                    <div class="lp-detail-col">
                        <h4>推荐资源</h4>
                        <div class="lp-resources">${resources[i].map(r => `<div class="lp-resource"><span>${r.name}</span><span class="lp-resource-tag">${r.tag}</span></div>`).join('')}</div>
                    </div>
                    <div class="lp-detail-col">
                        <h4>预计收获</h4>
                        <ul>${gains[i].map(g => `<li>${g}</li>`).join('')}</ul>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
};

// ============== 新增技能详情 ==============
let newSkillState = { currentName: '—', currentJobId: '' };

window.initNewSkill = function() {
    if (!window.EVOLUTION_JOB_PROFILES || !Object.keys(window.EVOLUTION_JOB_PROFILES).length) {
        window.generateAllData();
    }
    // 从 URL 读取 job / skill 参数（由演化页"详细变更清单"技能项跳转带入）
    try {
        const q = new URLSearchParams(window.location.search);
        const qJob = q.get('job');
        const qSkill = q.get('skill');
        if (qJob && window.EVOLUTION_JOB_PROFILES[qJob]) {
            newSkillState.currentJobId = qJob;
            evolutionState.currentJobId = qJob;
        }
        window.__nsFocusSkill = qSkill || '';
    } catch (e) {}
    newSkillState.currentJobId = evolutionState.currentJobId;
    window.renderNsJobList();
    window.renderNewSkillDetail();
    window.bindNewSkillEvents();
    // 若带有 skill 参数，自动定位到该技能详情并高亮
    if (window.__nsFocusSkill) {
        setTimeout(function () {
            const target = document.getElementById('ns-skill-name');
            if (target) { target.textContent = window.__nsFocusSkill; target.classList.add('ns-focus'); }
        }, 60);
    }
};

window.bindNewSkillEvents = function() {
    const search = document.getElementById('ns-search');
    if (search && !search.dataset.bound) {
        search.dataset.bound = '1';
        search.addEventListener('input', () => {
            const kw = search.value.trim().toLowerCase();
            document.querySelectorAll('#ns-job-list .lp-job-item').forEach(el => {
                const t = (el.dataset.job || '').toLowerCase();
                el.style.display = t.includes(kw) ? '' : 'none';
            });
        });
    }
};

window.renderNsJobList = function() {
    const el = document.getElementById('ns-job-list');
    if (!el) return;
    const profiles = window.EVOLUTION_JOB_PROFILES || {};
    const jobs = Object.keys(profiles);
    const tags = ['紧缺','热门','新兴','稳定','高潜'];
    el.innerHTML = jobs.map((jid, i) => {
        const d = profiles[jid] || {};
        const active = jid === newSkillState.currentJobId ? ' active' : '';
        const tag = tags[i % tags.length];
        return `
            <div class="lp-job-item${active}" data-job="${jid}" onclick="window.switchNsJob('${jid}')">
                <div class="lp-job-name"><span>${jid}</span><span class="lp-job-tag">${tag}</span></div>
                <div class="lp-job-meta">数据来源: ${d.jdCount || window.Utils.rand(120, 520)} 份JD</div>
                <div class="lp-job-meta">学习完成率: ${window.Utils.rand(68, 94)}%</div>
            </div>
        `;
    }).join('');
};

window.switchNsJob = function(jid) {
    if (!jid) return;
    newSkillState.currentJobId = jid;
    evolutionState.currentJobId = jid;
    window.renderNsJobList();
    window.renderNewSkillDetail();
};

window.renderNewSkillDetail = function() {
    const d = window.getEvolutionForJob(newSkillState.currentJobId);
    const top = (d.added || [])[0] || {};
    const skill = top.name || '—';
    const version = top.version || '—';
    const growth = top.growth || '+0%';
    const growthNum = Math.abs(parseInt(String(growth).replace(/[^0-9]/g, ''), 10)) || 0;
    const jdCount = d.jdCount || 0;
    const period = evolutionState.currentMonth || evolutionState.period || 3;

    newSkillState.currentName = skill;

    document.getElementById('ns-skill-name').textContent = skill;
    document.getElementById('ns-skill-meta').textContent = `版本 ${version} · 首次出现时间 ${period}个月内 · 数据来源 ${jdCount}条JD`;

    // Growth
    document.getElementById('ns-growth-val').textContent = growth;

    // Impact stars
    let stars = '★☆☆☆☆', label = '一般';
    if (growthNum >= 300) { stars = '★★★★★'; label = '极高'; }
    else if (growthNum >= 150) { stars = '★★★★☆'; label = '非常重要'; }
    else if (growthNum >= 80) { stars = '★★★☆☆'; label = '重要'; }
    else if (growthNum >= 30) { stars = '★★☆☆☆'; label = '关注'; }
    document.getElementById('ns-impact-stars').textContent = stars;
    document.getElementById('ns-impact-label').textContent = label;

    // Ratio
    const ratio = Math.min(35, Math.max(3, Math.round(growthNum / 10) + 4));
    document.getElementById('ns-ratio-val').textContent = ratio + '%';

    // Frequency
    document.getElementById('ns-freq-val').textContent = jdCount + ' 条JD';

    // Related skills: skip first, take 2-3 more from added + 1-2 from modified
    const related = [];
    (d.added || []).slice(1, 5).forEach(s => { if (s.name && !related.includes(s.name)) related.push(s.name); });
    if (related.length < 4) (d.modified || []).forEach(m => { if (related.length < 4 && m.name && !related.includes(m.name)) related.push(m.name); });
    if (related.length < 4) ['Less', 'Vue3', 'Node.js', 'JavaScript', 'TypeScript'].forEach(n => { if (related.length < 4 && !related.includes(n)) related.push(n); });
    document.getElementById('ns-related').innerHTML = related.map(s => `<span class="ns-related-tag">${s}</span>`).join('');

    // Typical JD examples
    const examples = [
        `熟悉使用 ${skill} 框架构建自动化流程，提升团队研发效率`,
        `熟悉 ${skill} 协作与工程化实践，具备开展实际项目的经验`
    ];
    document.getElementById('ns-jd-examples').innerHTML = examples.map(e => `<li>${e}</li>`).join('');

    // AI interpretation
    const trend = growthNum >= 200 ? '高速增长型' : growthNum >= 80 ? '快速增长型' : '稳步增长型';
    const urgency = growthNum >= 150 ? '立即' : '尽快';
    const aiBody = `这个 <strong style="color:var(--primary)">${skill}</strong> 是近 ${period} 个月新增的核心技能，需求增长率达 <strong style="color:#10b981">${growth}</strong>，呈现「${trend}」趋势。该技能的岗位需求占比已达 <strong>${ratio}%</strong>，影响等级 ${label}。建议${urgency}纳入学习计划，掌握 ${skill} 相关技术栈（含 ${related.slice(0, 3).join('、')} 等关联技能），以提升在 ${d.cat || '相关'} 岗位的竞争力。`;
    document.getElementById('ns-ai-body').innerHTML = aiBody;

    // Charts：等布局完成后再 init，避免 display:none/未挂载时容器尺寸为 0
    requestAnimationFrame(() => {
        window.renderNsGrowthChart(growthNum);
        window.renderNsTrendChart(skill, growthNum, period);
        // 主动 resize 一次，处理容器从 display:none 切到 block 后的尺寸为 0 问题
        setTimeout(() => {
            try { window.chartInstances['ns-trend-chart'] && window.chartInstances['ns-trend-chart'].resize(); } catch(e){}
            try { window.chartInstances['ns-growth-chart'] && window.chartInstances['ns-growth-chart'].resize(); } catch(e){}
        }, 60);
    });
};

window.renderNsGrowthChart = function(growthNum) {
    window.disposeChart('ns-growth-chart');
    const chart = window.safeChart('ns-growth-chart');
    if (!chart) return;
    window.chartInstances['ns-growth-chart'] = chart;
    const v = [10, 18, 26, 35, Math.max(40, growthNum)];
    chart.setOption({
        ...window.baseChartOpt(),
        grid: { left: 0, right: 0, top: 2, bottom: 0 },
        xAxis: { type: 'category', show: false, data: ['M1','M2','M3','M4','M5'] },
        yAxis: { type: 'value', show: false },
        tooltip: { show: false },
        series: [{
            type: 'line', data: v, smooth: true, symbol: 'none',
            lineStyle: { color: '#10b981', width: 2 },
            areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(16,185,129,.3)' }, { offset: 1, color: 'rgba(16,185,129,.02)' }] } }
        }]
    });
};

window.renderNsTrendChart = function(skill, growthNum, period) {
    window.disposeChart('ns-trend-chart');
    const chart = window.safeChart('ns-trend-chart');
    if (!chart) return;
    window.chartInstances['ns-trend-chart'] = chart;
    const months = ['10月','11月','12月','1月','2月','3月','4月','5月','6月','7月','8月','9月'].slice(0, Math.min(12, period));
    const base = Math.max(3, Math.round(growthNum / 30));
    const bars = months.map((_, i) => Math.round(base * Math.pow(1.35, i) + window.Utils.rand(0, 5)));
    const line = months.map((_, i) => Math.min(30, Math.round(2 + i * (ratio_at_end(i, months.length, growthNum)) + window.Utils.rand(0, 2))));
    function ratio_at_end(i, total, g) { return Math.max(2, Math.min(8, g / 30)); }
    chart.setOption({
        ...window.baseChartOpt(),
        tooltip: { trigger: 'axis' },
        legend: { data: ['提及次数','需求占比'], top: 0, textStyle: { color: '#475569' } },
        grid: { left: 44, right: 56, top: 32, bottom: 28 },
        xAxis: { type: 'category', data: months, axisLabel: { color: '#475569', fontSize: 11 }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
        yAxis: [
            { type: 'value', name: '提及次数', axisLabel: { color: '#475569', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(13,148,136,.1)' } } },
            { type: 'value', name: '需求占比', max: 30, axisLabel: { formatter: '{value}%', color: '#475569', fontSize: 10 }, splitLine: { show: false } }
        ],
        series: [
            { name: '提及次数', type: 'bar', data: bars, itemStyle: { color: '#0D9488', borderRadius: [4, 4, 0, 0] } },
            { name: '需求占比', type: 'line', data: line, yAxisIndex: 1, smooth: true, lineStyle: { color: '#F5A524', width: 2.5 }, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#F5A524' } }
        ]
    });
};

window.exportNewSkillReport = function() {
    window.Utils.showToast('✓ 已生成「' + newSkillState.currentName + '」技能详情报告（演示）', 'mint');
};



// ============ 岗位洞察入口守卫：无明确岗位且无收藏 → 提示先收藏 ============
(function () {
    try {
        var qJob = new URLSearchParams(location.search).get('job');
        if (qJob && qJob.trim()) return; // 有明确岗位参数，直接展示
        var u = JSON.parse(localStorage.getItem('zhitu_user') || 'null') || {};
        var uid = String(u.username || u.user_id || u.id || 'guest');
        var favs = [];
        try { favs = JSON.parse(localStorage.getItem('zhitu_disc_favs__' + uid) || '[]') || []; } catch (_) {}
        if (Array.isArray(favs) && favs.length) return;
        var ov = document.createElement('div');
        ov.id = 'evo-no-fav-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(250,247,240,.96);display:flex;align-items:center;justify-content:center;padding:24px';
        ov.innerHTML = '<div style="width:min(420px,100%);background:#fff;border:1px solid #e8dfca;border-radius:18px;padding:34px 30px;text-align:center;box-shadow:0 24px 64px rgba(60,45,30,.18)">'
            + '<div style="width:58px;height:58px;margin:0 auto 14px;border-radius:50%;background:linear-gradient(135deg,#c9a86a,#8c6f3e);color:#fff;display:grid;place-items:center;font-size:26px">☆</div>'
            + '<h3 style="margin:0 0 8px;font:600 20px \'Noto Serif SC\',serif;color:#2a1f10">请先收藏岗位</h3>'
            + '<p style="margin:0 0 20px;color:#6a6258;font-size:13px;line-height:1.8">岗位洞察基于你收藏的岗位生成。<br/>前往「新岗位发现」收藏感兴趣的岗位后，这里会展示对应的能力演化洞察。</p>'
            + '<div style="display:flex;gap:10px">'
            + '<a href="discovery.html?v=fix25" style="flex:1;text-align:center;padding:12px;border-radius:10px;background:linear-gradient(135deg,#c9a86a,#8c6f3e);color:#fff;font:600 14px sans-serif;text-decoration:none">前往新岗位发现</a>'
            + '</div></div>';
        document.body.appendChild(ov);
    } catch (_) {}
})();