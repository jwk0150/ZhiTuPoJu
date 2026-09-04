/* ============================================================
 * 岗位能力演化工作台 · 数据层 (ev-data.js)
 * ------------------------------------------------------------
 * 职责：
 *   1. 定义「Java 开发工程师」岗位的能力版本化时序数据模型
 *      （OccupationVersion -> CapabilitySnapshot -> SkillSnapshot -> TrendPoint -> Forecast）
 *   2. 提供统一查询接口：
 *        getCapabilityHistory()  过去 N 个月某技能需求趋势
 *        getCapabilitySnapshot() 某版本的完整能力快照
 *        compareVersions()       两个版本差异
 *        forecastCapabilityTrend() 未来预测
 *   3. 可选对接后端 /api/career/* 接口（成功则覆盖，失败回退 Demo）
 *
 * 数据真实性说明：
 *   - 本文件内置为 Demo 数据（用于完整交互演示），UI 上明确标注「Demo 数据」
 *   - 若后端可达，dataSource 会切换为 "db"，并展示真实 JD 锚定信息
 * ============================================================ */
(function () {
  'use strict';

  // ---------- 时间轴 ----------
  // 2024-01 .. 2026-08 共 32 个月（真实粒度，不压缩）
  const MONTHS = [];
  for (let y = 2024; y <= 2026; y++) {
    const end = y === 2026 ? 8 : 12;
    const start = y === 2024 ? 1 : 1;
    for (let m = start; m <= end; m++) MONTHS.push(y + '-' + String(m).padStart(2, '0'));
  }
  const FORECAST_MONTHS = [];
  for (let m = 9; m <= 12; m++) FORECAST_MONTHS.push('2026-' + String(m).padStart(2, '0'));
  FORECAST_MONTHS.push('2027-01', '2027-02');

  const N = MONTHS.length; // 32

  // ---------- 序列生成工具 ----------
  function zeros() { return new Array(N).fill(0); }
  function ramp(v0, v1, i0, i1) {
    const a = zeros();
    for (let i = 0; i < N; i++) {
      if (i < i0) a[i] = 0;
      else if (i >= i1) a[i] = v1;
      else a[i] = Math.round(v0 + (v1 - v0) * (i - i0) / Math.max(1, i1 - i0));
    }
    return a;
  }
  function steady(v, i0) {
    const a = zeros();
    for (let i = i0; i < N; i++) a[i] = v;
    return a;
  }
  function decline(v0, v1, i0, i1) {
    const a = zeros();
    for (let i = 0; i < N; i++) {
      if (i < i0) a[i] = v0;
      else if (i >= i1) a[i] = v1;
      else a[i] = Math.round(v0 + (v1 - v0) * (i - i0) / Math.max(1, i1 - i0));
    }
    return a;
  }
  function smoothCurve(arr) { return arr; }

  // ---------- 版本系统 ----------
  /*MONTHLY_VERSIONS_PLACEHOLDER*/
  const VERSIONS_LEGACY = [
    { id: 'V2024.01', date: '2024-01-15', label: '2024.01', idx: 0,  demand: 62, maturity: 52, added: 2, modified: 1, removed: 0, note: '单体 + SSH 传统栈时期' },
    { id: 'V2024.07', date: '2024-07-10', label: '2024.07', idx: 6,  demand: 68, maturity: 58, added: 3, modified: 2, removed: 1, note: '微服务与容器化起步' },
    { id: 'V2025.01', date: '2025-01-12', label: '2025.01', idx: 12, demand: 72, maturity: 64, added: 4, modified: 3, removed: 1, note: 'AI 辅助编程进入视野' },
    { id: 'V2025.07', date: '2025-07-08', label: '2025.07', idx: 18, demand: 79, maturity: 76, added: 6, modified: 6, removed: 2, note: '云原生 + AI 双主线成形' },
    { id: 'V2026.01', date: '2026-01-10', label: '2026.01', idx: 24, demand: 84, maturity: 82, added: 7, modified: 10, removed: 4, note: 'AI 从加分项转为必备' },
    { id: 'V2026.08', date: '2026-08-28', label: '2026.08', idx: 31, demand: 92, maturity: 88, added: 8, modified: 12, removed: 5, note: '岗位进化完成新一轮升级', isForecast: true },
  ];
  // 每月一个可拖动节点，末尾追加 6 个月预测段。
  const VERSIONS = MONTHS.map((month, idx) => ({
    id: 'V' + month.replace('-', '.'), date: month + '-15', label: month.replace('-', '.'), idx,
    demand: Math.round(60 + (idx / Math.max(1, N - 1)) * 31),
    maturity: Math.round(52 + (idx / Math.max(1, N - 1)) * 36),
    added: Math.min(8, 2 + Math.floor(idx / 5)), modified: Math.min(12, 1 + Math.floor(idx / 3)),
    removed: idx < 12 ? 0 : Math.min(5, Math.floor((idx - 10) / 5)),
    note: idx < 12 ? '传统工程能力持续沉淀' : (idx < 24 ? '云原生与 AI 能力逐步进入岗位' : 'AI + 云原生成为能力主线')
  })).concat(FORECAST_MONTHS.map((month, i) => ({
    id: 'V' + month.replace('-', '.'), date: month + '-15', label: month.replace('-', '.'), idx: N - 1,
    forecastIndex: i, isForecast: true, demand: Math.min(100, 94 + i), maturity: Math.min(99, 90 + i),
    added: 5, modified: 8, removed: 2, note: '模型预测：基于近 12 个月需求趋势外推'
  })));

  // 岗位元信息（Header / 洞察面板使用）
  const JOB_META = {
    en: 'Career Evolution / Java Engineer',
    dataUpdated: '2025.07',
    confidence: 91,
    maturity: 76,
    fromRole: 'Java 后端开发',
    toRole: 'AI + 云原生开发',
  };

  // ---------- 技能明细（25 项，带完整时序） ----------
  const SKILLS = [
    {
      id: 'ai-coding', name: 'AI 辅助编程', en: 'AI Coding', short: 'AI 编程', category: 'AI', status: 'added', versionAdded: 'V2025.01', versionRemoved: null,
      series: smoothCurve(ramp(6, 92, 12, 31)), forecast: [95, 99, 104, 109, 115, 121],
      importance: 5, confidence: 0.92, demandNow: 92,
      reason: '大模型编码工具（Copilot / Cursor / Agent）在企业研发流程中加速落地，AI 协作从「加分项」转变为「基础能力」。',
      related: ['ai-agent', 'rag', 'prompt', 'ai-eval'],
      evidence: ['jd-recruit', 'corp', 'report', 'community'],
      tech: ['GitHub Copilot', 'Cursor', 'Agent'],
      gap: { required: 88, mine: 30 },
      desc: '利用 AI 工具完成代码生成、代码补全、单元测试生成与代码审查辅助，是当前岗位新增的最核心能力。',
    },
    {
      id: 'ai-agent', name: 'AI Agent', en: 'AI Agent', short: 'Agent', category: 'AI', status: 'added', versionAdded: 'V2025.07', versionRemoved: null,
      series: smoothCurve(ramp(4, 58, 18, 31)), forecast: [64, 71, 78, 86, 94, 103],
      importance: 5, confidence: 0.88, demandNow: 58,
      reason: 'Agent 化开发范式兴起，企业需要工程师具备设计、编排与评估多智能体的能力。',
      related: ['ai-coding', 'ai-eval', 'rag', 'mcp'],
      evidence: ['jd-recruit', 'community', 'github'],
      tech: ['MCP', 'Function Calling', 'Multi-Agent'],
      gap: { required: 82, mine: 24 },
      desc: '基于大模型构建自主执行任务的 AI 智能体，覆盖代码生成、测试、审查与运维等场景。',
    },
    {
      id: 'ai-eval', name: 'AI 代码评估', en: 'AI Evaluation', short: 'AI 评估', category: 'AI', status: 'added', versionAdded: 'V2025.10', versionRemoved: null,
      series: smoothCurve(ramp(4, 40, 21, 31)), forecast: [45, 51, 58, 65, 73, 81],
      importance: 4, confidence: 0.84, demandNow: 40,
      reason: 'AI 生成代码规模扩大，代码质量评估与 AI 输出验证成为工程化刚需。',
      related: ['ai-coding', 'ai-agent'],
      evidence: ['jd-recruit', 'report'],
      tech: ['LLM 评测', 'Code Review', 'CI 门禁'],
      gap: { required: 70, mine: 10 },
      desc: '对 AI 生成代码进行正确性、安全性与质量评估，建立 AI 产出的验收标准。',
    },
    {
      id: 'rag', name: 'RAG', en: 'RAG', short: 'RAG', category: 'AI', status: 'added', versionAdded: 'V2025.03', versionRemoved: null,
      series: smoothCurve(ramp(4, 52, 15, 31)), forecast: [56, 61, 66, 71, 77, 83],
      importance: 4, confidence: 0.86, demandNow: 52,
      reason: '企业知识库问答与 AI 应用普遍采用检索增强生成，RAG 工程化能力需求快速增长。',
      related: ['ai-coding', 'prompt', 'ai-agent'],
      evidence: ['jd-recruit', 'corp', 'community'],
      tech: ['向量数据库', 'Embedding', 'LangChain'],
      gap: { required: 66, mine: 20 },
      desc: '掌握检索增强生成的技术链路：文档切分、向量化、检索、重排与回答生成。',
    },
    {
      id: 'prompt', name: 'Prompt 工程', en: 'Prompt Engineering', short: 'Prompt', category: 'AI', status: 'added', versionAdded: 'V2025.02', versionRemoved: null,
      series: smoothCurve(ramp(4, 48, 13, 31)), forecast: [51, 54, 58, 62, 66, 70],
      importance: 4, confidence: 0.85, demandNow: 48,
      reason: '大模型应用效果依赖提示词设计，Prompt 工程成为工程师的新基础技能。',
      related: ['ai-coding', 'rag', 'ai-agent'],
      evidence: ['jd-recruit', 'community'],
      tech: ['Few-shot', 'CoT', 'RAG'],
      gap: { required: 64, mine: 26 },
      desc: '面向大模型的提示词设计、上下文管理与输出约束，提升 AI 协作效果。',
    },
    {
      id: 'kubernetes', name: 'Kubernetes', en: 'Kubernetes', short: 'K8s', category: '云原生', status: 'added', versionAdded: 'V2024.07', versionRemoved: null,
      series: smoothCurve(ramp(20, 72, 6, 31)), forecast: [78, 84, 90, 96, 103, 110],
      importance: 5, confidence: 0.9, demandNow: 72,
      reason: '企业上云率持续提升，Kubernetes 成为交付与运维的基础设施标准。',
      related: ['docker', 'cloud-native', 'service-mesh', 'observability'],
      evidence: ['jd-recruit', 'corp', 'github'],
      tech: ['K8s', 'Helm', 'Operator'],
      gap: { required: 85, mine: 25 },
      desc: '容器编排、声明式部署、弹性伸缩与集群治理能力。',
    },
    {
      id: 'cloud-native', name: '云原生', en: 'Cloud Native', short: '云原生', category: '云原生', status: 'added', versionAdded: 'V2025.01', versionRemoved: null,
      series: smoothCurve(ramp(12, 70, 12, 31)), forecast: [76, 83, 90, 97, 105, 113],
      importance: 5, confidence: 0.89, demandNow: 70,
      reason: '云原生架构从「高级要求」扩散为「通用要求」，12 因素应用成为标准实践。',
      related: ['kubernetes', 'docker', 'service-mesh'],
      evidence: ['jd-recruit', 'report', 'corp'],
      tech: ['12-Factor', 'Serverless', 'GitOps'],
      gap: { required: 85, mine: 25 },
      desc: '面向云环境的应用设计、交付与运维方法论，含可移植性、弹性与可观测。',
    },
    {
      id: 'docker', name: 'Docker', en: 'Docker', short: 'Docker', category: '云原生', status: 'stable', versionAdded: 'V2024.01', versionRemoved: null,
      series: smoothCurve(ramp(28, 66, 0, 29)), forecast: [68, 70, 72, 73, 75, 76],
      importance: 4, confidence: 0.9, demandNow: 66,
      reason: '容器化成为软件交付基线，Docker 需求保持稳定增长。',
      related: ['kubernetes', 'cloud-native'],
      evidence: ['jd-recruit'],
      tech: ['Container', 'Compose', 'Registry'],
      gap: { required: 76, mine: 40 },
      desc: '容器镜像构建、编排与交付能力。',
    },
    {
      id: 'service-mesh', name: 'Service Mesh', en: 'Service Mesh', short: 'Mesh', category: '云原生', status: 'added', versionAdded: 'V2025.02', versionRemoved: null,
      series: smoothCurve(ramp(4, 38, 13, 31)), forecast: [41, 44, 48, 52, 56, 60],
      importance: 3, confidence: 0.82, demandNow: 38,
      reason: '微服务规模化后治理复杂度上升，Service Mesh 成为进阶能力。',
      related: ['microservice', 'kubernetes'],
      evidence: ['github', 'report'],
      tech: ['Istio', 'Envoy'],
      gap: { required: 56, mine: 12 },
      desc: '服务间流量管理、可观测性与安全策略的网格化治理。',
    },
    {
      id: 'observability', name: '可观测性', en: 'Observability', short: '可观测性', category: '云原生', status: 'modified', versionAdded: 'V2024.07', versionRemoved: null,
      series: smoothCurve(ramp(22, 58, 6, 29)), forecast: [61, 63, 66, 68, 71, 73],
      importance: 4, confidence: 0.85, demandNow: 58,
      reason: '系统规模与复杂度上升，可观测性从「运维专属」下沉为「开发即职责」。',
      related: ['kubernetes', 'distributed'],
      evidence: ['jd-recruit', 'community'],
      tech: ['Prometheus', 'Grafana', 'OpenTelemetry'],
      beforeAfter: { before: '了解日志与监控基本概念', after: '掌握链路追踪、SLO 与主动观测体系搭建', depth: '+32%' },
      gap: { required: 64, mine: 30 },
      desc: '指标、日志、链路追踪三位一体的观测与故障定位能力。',
    },
    {
      id: 'microservice', name: '微服务架构', en: 'Microservices', short: '微服务', category: '架构', status: 'modified', versionAdded: 'V2024.01', versionRemoved: null,
      series: smoothCurve(ramp(66, 80, 0, 27)), forecast: [81, 82, 83, 84, 85, 86],
      importance: 5, confidence: 0.9, demandNow: 80,
      reason: '传统微服务治理逐步迁移到云原生微服务，能力要求深度 +42%。',
      related: ['spring-cloud', 'kubernetes', 'service-mesh', 'api-gateway'],
      evidence: ['jd-recruit', 'corp', 'report'],
      tech: ['Spring Cloud', 'K8s', 'Service Mesh'],
      beforeAfter: { before: '传统微服务：Feign / Ribbon / Hystrix 基础治理', after: '云原生微服务：K8s 基座 + 服务网格 + 声明式治理', depth: '+42%' },
      gap: { required: 85, mine: 62 },
      desc: '服务拆分、注册发现、配置中心、网关、熔断限流与治理一体化能力。',
    },
    {
      id: 'spring-cloud', name: 'Spring Cloud', en: 'Spring Cloud', short: 'Spring Cloud', category: '架构', status: 'modified', versionAdded: 'V2024.01', versionRemoved: null,
      series: smoothCurve(ramp(64, 72, 0, 24)), forecast: [73, 73, 74, 74, 75, 75],
      importance: 4, confidence: 0.88, demandNow: 72,
      reason: '技术栈从 Netflix OSS 向 Spring Cloud Alibaba / 云原生组件迁移。',
      related: ['microservice', 'distributed'],
      evidence: ['jd-recruit'],
      tech: ['Nacos', 'Gateway', 'Sentinel'],
      beforeAfter: { before: 'Spring Cloud Netflix（Eureka / Hystrix）', after: 'Spring Cloud Alibaba + 云原生注册配置中心', depth: '+18%' },
      gap: { required: 74, mine: 60 },
      desc: '微服务治理技术栈的选型与落地能力。',
    },
    {
      id: 'distributed', name: '分布式系统', en: 'Distributed Systems', short: '分布式', category: '架构', status: 'modified', versionAdded: 'V2024.01', versionRemoved: null,
      series: smoothCurve(ramp(58, 76, 0, 28)), forecast: [77, 78, 79, 80, 80, 81],
      importance: 5, confidence: 0.88, demandNow: 76,
      reason: '岗位要求从「了解分布式概念」细化为「掌握具体方案与落地实践」。',
      related: ['microservice', 'kafka', 'distributed'],
      evidence: ['jd-recruit', 'corp'],
      tech: ['Seata', 'TCC', '消息一致性'],
      beforeAfter: { before: '了解分布式事务与幂等概念', after: '掌握 Seata / TCC / 可靠消息等具体方案与落地', depth: '+24%' },
      gap: { required: 80, mine: 52 },
      desc: '分布式事务、幂等设计、最终一致性与高可用方案能力。',
    },
    {
      id: 'kafka', name: 'Kafka / 消息队列', en: 'Message Queue', short: 'Kafka', category: '架构', status: 'modified', versionAdded: 'V2024.01', versionRemoved: null,
      series: smoothCurve(ramp(56, 66, 0, 26)), forecast: [67, 68, 69, 70, 70, 71],
      importance: 4, confidence: 0.87, demandNow: 66,
      reason: '消息队列在事件驱动架构中地位上升，从「加分项」转为「必备项」。',
      related: ['distributed'],
      evidence: ['jd-recruit'],
      tech: ['Kafka', 'RocketMQ', 'RabbitMQ'],
      gap: { required: 70, mine: 48 },
      desc: '消息中间件选型、生产消费模型与可靠性保障能力。',
    },
    {
      id: 'api-gateway', name: 'API 网关', en: 'API Gateway', short: 'API 网关', category: '架构', status: 'modified', versionAdded: 'V2024.01', versionRemoved: null,
      series: smoothCurve(ramp(28, 42, 0, 26)), forecast: [43, 44, 44, 45, 45, 46],
      importance: 3, confidence: 0.84, demandNow: 42,
      reason: '网关从「转发代理」升级为「流量治理 + 安全策略」一体化能力。',
      related: ['microservice'],
      evidence: ['jd-recruit'],
      tech: ['Gateway', 'Sentinel'],
      beforeAfter: { before: '简单路由转发', after: '限流熔断 + 灰度发布 + 安全策略一体化', depth: '+15%' },
      gap: { required: 48, mine: 34 },
      desc: 'API 网关的流量治理、限流与安全能力。',
    },
    {
      id: 'java-base', name: 'Java 基础', en: 'Java Core', short: 'Java 基础', category: '后端', status: 'stable', versionAdded: 'V2024.01', versionRemoved: null,
      series: smoothCurve(steady(92, 0)), forecast: [92, 92, 92, 92, 92, 92],
      importance: 5, confidence: 0.96, demandNow: 92,
      reason: 'Java 依然是岗位地基能力，要求保持高位稳定。',
      related: ['spring-boot'],
      evidence: ['jd-recruit'],
      tech: ['JDK 17/21', 'JVM', '并发'],
      gap: { required: 95, mine: 90 },
      desc: 'Java 语言、JVM、集合、并发与 IO 等核心基础能力。',
    },
    {
      id: 'spring-boot', name: 'Spring Boot', en: 'Spring Boot', short: 'Boot', category: '后端', status: 'modified', versionAdded: 'V2024.01', versionRemoved: null,
      series: smoothCurve(ramp(78, 90, 0, 26)), forecast: [90, 91, 91, 92, 92, 93],
      importance: 5, confidence: 0.93, demandNow: 90,
      reason: 'Spring Boot 3 / Spring AI 普及，要求从「会用」升级到「工程化实践」。',
      related: ['java-base', 'spring-cloud'],
      evidence: ['jd-recruit', 'corp'],
      tech: ['Spring Boot 3', 'Spring AI', 'GraalVM'],
      beforeAfter: { before: '熟练使用 Spring Boot 完成 CRUD 开发', after: '掌握 Boot 3 / Spring AI 与可观测集成的工程化实践', depth: '+18%' },
      gap: { required: 90, mine: 88 },
      desc: 'Spring Boot 应用开发与工程化落地能力。',
    },
    {
      id: 'mysql', name: 'MySQL', en: 'MySQL', short: 'MySQL', category: '数据', status: 'stable', versionAdded: 'V2024.01', versionRemoved: null,
      series: smoothCurve(steady(78, 0)), forecast: [78, 78, 79, 79, 79, 80],
      importance: 4, confidence: 0.92, demandNow: 78,
      reason: '关系型数据库是后端岗位的长期刚需。',
      related: ['redis'],
      evidence: ['jd-recruit'],
      tech: ['索引优化', '事务', '分库分表'],
      gap: { required: 82, mine: 76 },
      desc: 'SQL、索引优化、事务隔离与数据库设计能力。',
    },
    {
      id: 'redis', name: 'Redis', en: 'Redis', short: 'Redis', category: '数据', status: 'stable', versionAdded: 'V2024.01', versionRemoved: null,
      series: smoothCurve(steady(76, 0)), forecast: [76, 77, 77, 78, 78, 79],
      importance: 4, confidence: 0.9, demandNow: 76,
      reason: '缓存与高并发场景的核心组件，需求稳定。',
      related: ['distributed'],
      evidence: ['jd-recruit'],
      tech: ['缓存设计', '分布式锁', '持久化'],
      gap: { required: 78, mine: 72 },
      desc: 'Redis 数据结构、缓存一致性、分布式锁等能力。',
    },
    {
      id: 'perf', name: '性能调优', en: 'Performance Tuning', short: '性能调优', category: '后端', status: 'stable', versionAdded: 'V2024.01', versionRemoved: null,
      series: smoothCurve(steady(66, 0)), forecast: [66, 67, 67, 68, 68, 69],
      importance: 4, confidence: 0.88, demandNow: 66,
      reason: '系统规模扩大，性能优化与故障定位能力保持重要。',
      related: ['java-base', 'distributed'],
      evidence: ['jd-recruit'],
      tech: ['JVM 调优', '压测', '链路追踪'],
      gap: { required: 70, mine: 58 },
      desc: '应用性能分析、JVM 调优与高并发优化能力。',
    },
    {
      id: 'cicd', name: 'CI/CD', en: 'CI/CD', short: 'CI/CD', category: '工程化', status: 'stable', versionAdded: 'V2024.01', versionRemoved: null,
      series: smoothCurve(steady(58, 0)), forecast: [58, 59, 59, 60, 60, 61],
      importance: 4, confidence: 0.88, demandNow: 58,
      reason: '持续集成与交付成为研发效能基线。',
      related: ['docker', 'kubernetes'],
      evidence: ['jd-recruit', 'corp'],
      tech: ['GitLab CI', 'Jenkins', 'GitOps'],
      gap: { required: 66, mine: 44 },
      desc: '流水线设计、自动化测试与持续部署能力。',
    },
    {
      id: 'jenkins', name: 'Jenkins', en: 'Jenkins', short: 'Jenkins', category: '工程化', status: 'modified', versionAdded: 'V2024.01', versionRemoved: null,
      series: smoothCurve(decline(42, 24, 0, 28)), forecast: [22, 21, 19, 18, 16, 15],
      importance: 2, confidence: 0.83, demandNow: 24,
      reason: 'Jenkins 被 GitOps / 云原生 CI 工具链替代，需求持续收缩。',
      related: ['cicd', 'kubernetes'],
      evidence: ['jd-recruit', 'community'],
      tech: ['GitOps', 'ArgoCD', 'GitHub Actions'],
      beforeAfter: { before: '基于 Jenkins 的流水线搭建', after: 'GitOps / 云原生 CI 工具链', depth: '-18%' },
      gap: { required: 30, mine: 50 },
      desc: '传统 CI 工具的使用能力（正在被替代）。',
    },
    {
      id: 'struts', name: 'Struts', en: 'Struts', short: 'Struts', category: '遗留', status: 'deleted', versionAdded: 'V2024.01', versionRemoved: 'V2026.01',
      series: smoothCurve(decline(55, 4, 0, 24)), forecast: [4, 4, 3, 3, 2, 2],
      importance: 1, confidence: 0.93, demandNow: 4,
      reason: 'Spring Boot 生态全面替代，Struts 退出核心岗位能力模型。',
      related: ['jsp', 'spring-boot'],
      evidence: ['jd-recruit', 'community'],
      tech: ['Spring Boot', 'Servlet 淘汰'],
      gap: { required: 6, mine: 20 },
      desc: '传统 MVC 框架（已退出核心模型，历史数据保留）。',
    },
    {
      id: 'jsp', name: 'JSP', en: 'JSP', short: 'JSP', category: '遗留', status: 'deleted', versionAdded: 'V2024.01', versionRemoved: 'V2026.01',
      series: smoothCurve(decline(40, 8, 0, 24)), forecast: [8, 7, 7, 6, 6, 5],
      importance: 1, confidence: 0.9, demandNow: 8,
      reason: '前后端分离架构普及，JSP 模板渲染被淘汰。',
      related: ['struts'],
      evidence: ['jd-recruit'],
      tech: ['Vue/React 生态'],
      gap: { required: 8, mine: 25 },
      desc: '服务端模板渲染（已退出核心模型）。',
    },
    {
      id: 'ssh', name: 'SSH 单体架构', en: 'SSH Stack', short: 'SSH 单体', category: '遗留', status: 'deleted', versionAdded: 'V2024.01', versionRemoved: 'V2025.07',
      series: smoothCurve(decline(34, 10, 0, 18)), forecast: [9, 8, 8, 7, 7, 6],
      importance: 1, confidence: 0.89, demandNow: 10,
      reason: '单体应用向微服务 / 云原生架构迁移，SSH 组合退出。',
      related: ['struts', 'microservice'],
      evidence: ['jd-recruit', 'report'],
      tech: ['微服务', '云原生'],
      gap: { required: 8, mine: 18 },
      desc: 'Struts + Spring + Hibernate 单体组合（已退出核心模型）。',
    },
  ];

  // 供快速查找
  const SKILL_MAP = {};
  SKILLS.forEach((s) => { SKILL_MAP[s.id] = s; });

  // ---------- 分层图谱（岗位能力时序图谱） ----------
  // 技术趋势 → 工作方式 → 岗位任务 → 核心能力 → 具体技能
  const LAYERS = [
    { id: 'trend',  name: '技术趋势', color: '#9B7BD4' },
    { id: 'mode',   name: '工作方式', color: '#7C9CD4' },
    { id: 'task',   name: '岗位任务', color: '#D99E6C' },
    { id: 'ability', name: '核心能力', color: '#5FA88F' },
    { id: 'skill',  name: '具体技能', color: '#5B8DB8' },
  ];

  // 上层复合节点（拥有与技能一致的时序，用于时间旅行动画）
  const GRAPH_NODES = [
    // 技术趋势
    { id: 't-ai', layer: 'trend', name: 'AI Agent', short: 'AI Agent', series: ramp(6, 80, 12, 31), forecast: [86, 93, 100, 108, 116, 124], status: 'added' },
    { id: 't-llm', layer: 'trend', name: '大模型', short: '大模型', series: ramp(10, 72, 12, 31), forecast: [76, 81, 86, 91, 96, 101], status: 'added' },
    { id: 't-cloud', layer: 'trend', name: '云原生', short: '云原生', series: ramp(16, 72, 12, 31), forecast: [78, 84, 90, 97, 104, 111], status: 'added' },
    { id: 't-micro', layer: 'trend', name: '微服务', short: '微服务', series: ramp(60, 74, 0, 26), forecast: [75, 75, 76, 76, 77, 77], status: 'stable' },
    // 工作方式
    { id: 'm-ai', layer: 'mode', name: 'AI 协作开发', short: 'AI 协作', series: ramp(8, 78, 12, 31), forecast: [83, 88, 93, 98, 103, 108], status: 'added' },
    { id: 'm-cloud', layer: 'mode', name: '云上交付', short: '云上交付', series: ramp(20, 66, 6, 30), forecast: [69, 71, 74, 76, 78, 80], status: 'added' },
    { id: 'm-devops', layer: 'mode', name: '敏捷 + DevOps', short: 'DevOps', series: steady(58, 0), forecast: [58, 59, 60, 60, 61, 62], status: 'stable' },
    { id: 'm-platform', layer: 'mode', name: '平台工程', short: '平台工程', series: ramp(12, 40, 12, 31), forecast: [43, 45, 48, 51, 54, 57], status: 'added' },
    // 岗位任务
    { id: 'k-code', layer: 'task', name: '代码生成 / 测试 / Debug', short: '代码生成·Debug', series: ramp(6, 74, 12, 31), forecast: [79, 84, 89, 94, 99, 104], status: 'added' },
    { id: 'k-micro', layer: 'task', name: '微服务设计与治理', short: '微服务治理', series: ramp(60, 76, 0, 27), forecast: [77, 78, 79, 80, 80, 81], status: 'stable' },
    { id: 'k-container', layer: 'task', name: '容器化部署', short: '容器化部署', series: ramp(24, 70, 6, 31), forecast: [73, 76, 78, 81, 83, 85], status: 'added' },
    { id: 'k-perf', layer: 'task', name: '性能调优', short: '性能调优', series: steady(64, 0), forecast: [64, 65, 65, 66, 66, 67], status: 'stable' },
    { id: 'k-ai', layer: 'task', name: 'AI 应用集成', short: 'AI 集成', series: ramp(4, 52, 15, 31), forecast: [57, 61, 66, 71, 76, 81], status: 'added' },
    // 核心能力
    { id: 'a-ai', layer: 'ability', name: 'AI 协作开发能力', short: 'AI 协作', series: ramp(6, 80, 12, 31), forecast: [85, 90, 96, 102, 108, 114], status: 'added' },
    { id: 'a-cloud', layer: 'ability', name: '云原生工程能力', short: '云原生工程', series: ramp(14, 74, 12, 31), forecast: [80, 86, 92, 98, 104, 110], status: 'added' },
    { id: 'a-micro', layer: 'ability', name: '微服务架构能力', short: '微服务架构', series: ramp(60, 78, 0, 27), forecast: [79, 80, 81, 82, 82, 83], status: 'stable' },
    { id: 'a-dist', layer: 'ability', name: '分布式系统能力', short: '分布式系统', series: ramp(56, 74, 0, 26), forecast: [75, 76, 77, 78, 78, 79], status: 'stable' },
    { id: 'a-eng', layer: 'ability', name: '工程化与 DevOps', short: '工程化 DevOps', series: steady(58, 0), forecast: [59, 60, 61, 61, 62, 63], status: 'stable' },
  ];

  const GRAPH_LINKS = [
    ['t-ai', 'm-ai'], ['t-llm', 'm-ai'], ['t-cloud', 'm-cloud'], ['t-micro', 'm-devops'], ['t-ai', 'm-platform'],
    ['m-ai', 'k-code'], ['m-ai', 'k-ai'], ['m-cloud', 'k-container'], ['m-devops', 'k-micro'], ['m-devops', 'k-perf'],
    ['k-code', 'a-ai'], ['k-ai', 'a-ai'], ['k-container', 'a-cloud'], ['k-micro', 'a-micro'], ['k-micro', 'a-dist'], ['k-perf', 'a-dist'], ['k-perf', 'a-eng'],
    ['a-ai', 'ai-coding'], ['a-ai', 'ai-agent'], ['a-ai', 'ai-eval'], ['a-ai', 'rag'], ['a-ai', 'prompt'],
    ['a-cloud', 'kubernetes'], ['a-cloud', 'docker'], ['a-cloud', 'cloud-native'], ['a-cloud', 'service-mesh'], ['a-cloud', 'observability'],
    ['a-micro', 'microservice'], ['a-micro', 'spring-cloud'], ['a-micro', 'api-gateway'],
    ['a-dist', 'distributed'], ['a-dist', 'kafka'],
    ['a-eng', 'cicd'], ['a-eng', 'jenkins'], ['a-eng', 'java-base'], ['a-eng', 'spring-boot'], ['a-eng', 'mysql'], ['a-eng', 'redis'], ['a-eng', 'perf'],
  ];

  // ---------- 能力变更（2025 H1 → 2026 H1） ----------
  const CHANGES = {
    periodFrom: '2025 H1',
    periodTo: '2026 H1',
    fromVersion: 'V2025.01',
    toVersion: 'V2026.08',
    summary: {
      all: 25, added: 8, modified: 12, deleted: 5, demandShift: 76,
    },
    added: [
      { id: 'ai-coding', name: 'AI 辅助编程', demandFrom: 12, demandTo: 68, growth: '+146%', why: 'AI Coding 技术成熟、企业开发流程变化、招聘要求变化', tech: ['AI Coding', 'GitHub Copilot', 'Agent'], evidence: ['jd-recruit', 'corp', 'report'], confidence: 0.92 },
      { id: 'ai-agent', name: 'AI Agent', demandFrom: 4, demandTo: 58, growth: '+81%', why: 'Agent 化开发范式兴起，多智能体协同进入企业研发', tech: ['MCP', 'Function Calling', 'Multi-Agent'], evidence: ['jd-recruit', 'community', 'github'], confidence: 0.88 },
      { id: 'cloud-native', name: '云原生', demandFrom: 22, demandTo: 70, growth: '+86%', why: '企业上云加深，云原生从高级要求变为通用要求', tech: ['12-Factor', 'Serverless', 'GitOps'], evidence: ['jd-recruit', 'report'], confidence: 0.89 },
      { id: 'ai-eval', name: 'AI 代码评估', demandFrom: 4, demandTo: 40, growth: '+68%', why: 'AI 生成代码规模化，质量评估成为工程化刚需', tech: ['LLM 评测', 'Code Review'], evidence: ['jd-recruit', 'report'], confidence: 0.84 },
      { id: 'rag', name: 'RAG', demandFrom: 6, demandTo: 52, growth: '+64%', why: '知识库问答与 AI 应用普遍采用检索增强生成', tech: ['向量数据库', 'Embedding'], evidence: ['jd-recruit', 'corp', 'community'], confidence: 0.86 },
      { id: 'prompt', name: 'Prompt 工程', demandFrom: 5, demandTo: 48, growth: '+58%', why: '大模型应用效果依赖提示词设计', tech: ['Few-shot', 'CoT'], evidence: ['jd-recruit', 'community'], confidence: 0.85 },
      { id: 'kubernetes', name: 'Kubernetes', demandFrom: 32, demandTo: 72, growth: '+74%', why: 'K8s 成为交付与运维基础设施标准', tech: ['K8s', 'Helm', 'Operator'], evidence: ['jd-recruit', 'github'], confidence: 0.9 },
      { id: 'service-mesh', name: 'Service Mesh', demandFrom: 8, demandTo: 38, growth: '+52%', why: '微服务规模化后治理复杂度上升', tech: ['Istio', 'Envoy'], evidence: ['github', 'report'], confidence: 0.82 },
    ],
    modified: [
      { id: 'microservice', name: '微服务架构', before: '传统微服务：Feign / Ribbon / Hystrix 基础治理', after: '云原生微服务：K8s 基座 + 服务网格 + 声明式治理', depth: '+42%', addLinks: ['Docker', 'Kubernetes', 'Service Mesh'], reason: '微服务治理向云原生栈迁移', evidence: ['jd-recruit', 'corp', 'report'], confidence: 0.9 },
      { id: 'spring-boot', name: 'Spring Boot', before: '熟练使用 Spring Boot 完成 CRUD 开发', after: '掌握 Boot 3 / Spring AI 与可观测集成的工程化实践', depth: '+18%', addLinks: ['Spring AI', 'GraalVM'], reason: 'Spring Boot 3 与 AI 生态普及', evidence: ['jd-recruit', 'corp'], confidence: 0.93 },
      { id: 'distributed', name: '分布式系统', before: '了解分布式事务与幂等概念', after: '掌握 Seata / TCC / 可靠消息等具体方案与落地', depth: '+24%', addLinks: ['Seata', 'TCC'], reason: '岗位要求从概念化走向具体化', evidence: ['jd-recruit', 'corp'], confidence: 0.88 },
      { id: 'observability', name: '可观测性', before: '了解日志与监控基本概念', after: '掌握链路追踪、SLO 与主动观测体系搭建', depth: '+32%', addLinks: ['OpenTelemetry', 'SLO'], reason: '从运维专属下沉为开发职责', evidence: ['jd-recruit', 'community'], confidence: 0.85 },
      { id: 'spring-cloud', name: 'Spring Cloud', before: 'Spring Cloud Netflix（Eureka / Hystrix）', after: 'Spring Cloud Alibaba + 云原生注册配置中心', depth: '+18%', addLinks: ['Nacos', 'Gateway'], reason: '技术栈向云原生组件迁移', evidence: ['jd-recruit'], confidence: 0.88 },
      { id: 'kafka', name: 'Kafka / 消息队列', before: '加分技能：了解消息队列', after: '必备技能：事件驱动架构落地', depth: '+14%', addLinks: ['RocketMQ', '事件驱动'], reason: '消息队列在架构中地位上升', evidence: ['jd-recruit'], confidence: 0.87 },
      { id: 'api-gateway', name: 'API 网关', before: '简单路由转发', after: '限流熔断 + 灰度发布 + 安全策略一体化', depth: '+15%', addLinks: ['Sentinel', '灰度'], reason: '网关从转发代理升级为流量治理', evidence: ['jd-recruit'], confidence: 0.84 },
      { id: 'jenkins', name: 'Jenkins', before: '基于 Jenkins 的流水线搭建', after: 'GitOps / 云原生 CI 工具链', depth: '-18%', addLinks: ['GitOps', 'ArgoCD'], reason: '被云原生 CI 工具链替代', evidence: ['jd-recruit', 'community'], confidence: 0.83 },
      { id: 'java-base', name: 'Java 基础', before: 'JDK 8 / 11 时代要求', after: 'JDK 17 / 21 虚拟线程 + 新语言特性', depth: '+10%', addLinks: ['Virtual Thread', 'JDK 21'], reason: 'JDK 版本迭代带动基础要求升级', evidence: ['jd-recruit'], confidence: 0.94 },
      { id: 'mysql', name: 'MySQL', before: '索引优化 + 事务', after: '分库分表 + 读写分离 + 高可用方案', depth: '+12%', addLinks: ['Sharding', '主从'], reason: '数据规模扩大驱动数据库能力加深', evidence: ['jd-recruit'], confidence: 0.9 },
      { id: 'cicd', name: 'CI/CD', before: '基础流水线搭建', after: 'GitOps + 自动化质量门禁 + 发布策略', depth: '+11%', addLinks: ['GitOps', '质量门禁'], reason: '研发效能工程化要求提升', evidence: ['jd-recruit', 'corp'], confidence: 0.88 },
      { id: 'perf', name: '性能调优', before: '应用层性能优化', after: '全链路压测 + 容量规划 + 成本优化', depth: '+13%', addLinks: ['压测', 'FinOps'], reason: '高并发与成本治理诉求上升', evidence: ['jd-recruit'], confidence: 0.86 },
    ],
    deleted: [
      { id: 'struts', name: 'Struts', from: 38, to: 4, reason: 'Spring Boot 生态替代', note: '退出核心岗位能力模型（历史数据完整保留）', confidence: 0.93 },
      { id: 'jsp', name: 'JSP', from: 26, to: 8, reason: '前后端分离架构普及', note: '退出核心岗位能力模型（历史数据完整保留）', confidence: 0.9 },
      { id: 'ssh', name: 'SSH 单体架构', from: 22, to: 10, reason: '单体应用向微服务/云原生迁移', note: '退出核心岗位能力模型（历史数据完整保留）', confidence: 0.89 },
      { id: 'xml-config', name: 'XML 配置式开发', from: 18, to: 6, reason: 'Spring Boot 自动化配置替代', note: '退出核心岗位能力模型（历史数据完整保留）', confidence: 0.87 },
      { id: 'ejb', name: 'EJB', from: 12, to: 2, reason: 'Spring 生态全面替代', note: '退出核心岗位能力模型（历史数据完整保留）', confidence: 0.91 },
    ],
  };

  // ---------- 技术驱动（因果路径） ----------
  const DRIVERS = [
    {
      id: 'ai', title: 'AI 重塑软件开发方式', startNode: 'AI Agent', impact: 'high',
      path: [
        { id: 'd1', name: 'AI Agent', type: '技术趋势' },
        { id: 'd2', name: 'AI 技术成熟', type: '技术趋势' },
        { id: 'd3', name: '企业自动化需求增加', type: '产业变化' },
        { id: 'd4', name: '软件开发流程改变', type: '工作方式' },
        { id: 'd5', name: 'Java 开发任务改变', type: '岗位任务' },
        { id: 'd6', name: '能力模型改变', type: '能力变化' },
        { id: 'd7', name: 'AI Agent / AI Coding / Evaluation 需求增加', type: '技能变化', highlight: true },
      ],
      impactJobs: ['Java 开发工程师', 'Python 开发工程师', 'AI 应用工程师'],
      impactTasks: ['代码生成', '代码测试', '代码审查', 'Debug'],
      impactAbilities: [
        { name: 'AI 辅助编程', change: '+146%' },
        { name: 'AI Evaluation', change: '+92%' },
        { name: 'Agent', change: '+81%' },
      ],
      sources: ['招聘数据', '企业数据', '技术报告', '技术社区'],
    },
    {
      id: 'cloud', title: '企业上云驱动云原生迁移', startNode: '云原生', impact: 'high',
      path: [
        { id: 'c1', name: '云原生', type: '技术趋势' },
        { id: 'c2', name: '企业上云率提升', type: '产业变化' },
        { id: 'c3', name: '基础设施标准化', type: '产业变化' },
        { id: 'c4', name: '部署与运维方式改变', type: '工作方式' },
        { id: 'c5', name: '交付与运维任务改变', type: '岗位任务' },
        { id: 'c6', name: '容器化 / K8s / DevOps 需求增加', type: '技能变化', highlight: true },
      ],
      impactJobs: ['Java 开发工程师', 'DevOps 工程师', '运维工程师'],
      impactTasks: ['容器化部署', '集群编排', '持续交付'],
      impactAbilities: [
        { name: '云原生', change: '+86%' },
        { name: 'Kubernetes', change: '+74%' },
        { name: 'Docker', change: '+42%' },
      ],
      sources: ['招聘数据', '行业报告', 'GitHub 趋势'],
    },
    {
      id: 'micro', title: '业务复杂度推动架构演进', startNode: '微服务', impact: 'mid',
      path: [
        { id: 'm1', name: '微服务', type: '技术趋势' },
        { id: 'm2', name: '业务复杂度上升', type: '产业变化' },
        { id: 'm3', name: '单体向微服务演进', type: '架构变化' },
        { id: 'm4', name: '治理复杂度上升', type: '岗位任务' },
        { id: 'm5', name: '能力要求深度 +42%', type: '能力变化', highlight: true },
      ],
      impactJobs: ['Java 开发工程师', '架构师'],
      impactTasks: ['微服务设计', '服务治理', '分布式事务'],
      impactAbilities: [
        { name: '微服务架构', change: '+42%' },
        { name: '分布式系统', change: '+24%' },
        { name: 'Service Mesh', change: '+52%' },
      ],
      sources: ['招聘数据', '企业数据', '行业报告'],
    },
    {
      id: 'legacy', title: '生态替代淘汰遗留技术', startNode: 'Spring Boot 生态', impact: 'low',
      path: [
        { id: 'l1', name: 'Spring Boot 生态成熟', type: '技术趋势' },
        { id: 'l2', name: '自动化配置替代 XML', type: '技术变化' },
        { id: 'l3', name: '遗留框架需求收缩', type: '产业变化' },
        { id: 'l4', name: 'Struts / JSP 退出核心模型', type: '技能变化', highlight: true },
      ],
      impactJobs: ['Java 开发工程师'],
      impactTasks: ['遗留系统维护'],
      impactAbilities: [
        { name: 'Struts', change: '-89%' },
        { name: 'JSP', change: '-72%' },
        { name: 'Jenkins', change: '-18%' },
      ],
      sources: ['招聘数据', '技术社区'],
    },
  ];

  // ---------- 证据（结论 → 数据 → 原始证据） ----------
  const EVIDENCE = [
    {
      id: 'jd-recruit', type: '招聘 JD', name: '公开招聘数据（51job / BOSS直聘 / 智联）',
      published: '2025-01', updated: '2026-08-20', timeRange: '2025-01 ~ 2026-08', scale: '12,842 条',
      confidence: 0.94, excerpt: '「要求熟练使用 AI Coding 工具（Copilot / Cursor），具备 Agent 辅助开发与 AI 代码审查实践经验，熟悉 Kubernetes 与 Cloud Native 部署……」',
      keywords: ['AI Coding', 'Agent', 'Kubernetes', 'Cloud Native'],
      supports: ['AI 辅助编程新增', 'Agent 需求增长', 'Kubernetes 需求增长'],
      url: '#', weight: 40,
    },
    {
      id: 'corp', type: '企业数据', name: '企业岗位与任职标准数据',
      published: '2025-02', updated: '2026-08-15', timeRange: '2025-02 ~ 2026-08', scale: '1,284 家',
      confidence: 0.9, excerpt: '合作企业研发岗任职标准显示：AI 协作开发已写入 68% 的 Java 岗位 JD 必选项，云原生技能在 P6 及以上职级要求中占比达 85%。',
      keywords: ['AI 协作开发', '云原生', '微服务'],
      supports: ['AI 辅助编程从加分项转必备', '云原生通用化'],
      url: '#', weight: 25,
    },
    {
      id: 'report', type: '行业报告', name: '行业研究报告汇总',
      published: '2025-06', updated: '2026-07-28', timeRange: '2025 Q1 ~ 2026 Q2', scale: '186 份',
      confidence: 0.86, excerpt: '信通院与 IDC 报告指出：AI 工程化与云原生列为年度 Top 3 技术主线；2026 年 Agent 相关岗位需求预计同比增长 81%。',
      keywords: ['AI 工程化', '云原生', 'Agent'],
      supports: ['AI Agent 预测增长', '云原生长期主线'],
      url: '#', weight: 18,
    },
    {
      id: 'community', type: '技术社区', name: '技术社区讨论数据',
      published: '2025-03', updated: '2026-08-12', timeRange: '近 90 天滚动', scale: '56,782 条讨论',
      confidence: 0.83, excerpt: 'AI 辅助编程相关内容同比增长 +85%，可观测性内容增长 +60%，「AI 从加分项转为基础能力」成为社区共识。',
      keywords: ['AI 辅助编程', '可观测性'],
      supports: ['AI 辅助编程新增', '可观测性能力升级'],
      url: '#', weight: 10,
    },
    {
      id: 'github', type: '开源趋势', name: 'GitHub 趋势数据',
      published: '2025-05', updated: '2026-08-10', timeRange: '近 6 个月滚动', scale: 'Top 2,000 仓库',
      confidence: 0.85, excerpt: 'Kubernetes、LangChain4j 等仓库 star 增速保持高位，AI 编码工具与 Agent 框架仓库持续霸榜 Trending。',
      keywords: ['Kubernetes', 'LangChain4j', 'Agent'],
      supports: ['Kubernetes 采用度验证', 'AI Agent 生态成熟'],
      url: '#', weight: 7,
    },
    {
      id: 'policy', type: '政策文件', name: '产业与人才政策文件',
      published: '2025-04', updated: '2026-06-20', timeRange: '2024 ~ 2026', scale: '38 份',
      confidence: 0.78, excerpt: '多地数字人才政策将 AI 工程化、云原生列为重点培养方向，支持企业引入 AI 辅助开发工具并设立相关岗位标准。',
      keywords: ['AI 工程化', '云原生'],
      supports: ['AI 辅助编程新增', '云原生通用化'],
      url: '#', weight: 5,
    },
    {
      id: 'trend-tech', type: '技术趋势', name: '技术趋势预测数据',
      published: '2025-06', updated: '2026-08-01', timeRange: '滚动预测', scale: '5 类指标',
      confidence: 0.8, excerpt: '基于多源融合的模型估计：AI 协作开发、云原生、Agent 为未来 6 个月增长最快的岗位能力方向，预测区间明确标注。',
      keywords: ['AI 协作', 'Agent', '云原生'],
      supports: ['AI Agent 预测增长', '云原生增长'],
      url: '#', weight: 6,
    },
  ];
  const EVIDENCE_MAP = {};
  EVIDENCE.forEach((e) => { EVIDENCE_MAP[e.id] = e; });

  // ---------- 个人能力差距（我的能力 vs 未来岗位要求） ----------
  const GAP = {
    profile: '当前用户（演示档案）',
    sourceNote: '来自简历解析与能力测评（Demo）',
    items: [
      { id: 'java-base', required: 95, mine: 90, gap: 5, level: '已具备' },
      { id: 'spring-boot', required: 90, mine: 88, gap: 2, level: '已具备' },
      { id: 'microservice', required: 85, mine: 62, gap: 23, level: '部分具备' },
      { id: 'cloud-native', required: 85, mine: 25, gap: 60, level: '能力缺口' },
      { id: 'kubernetes', required: 85, mine: 25, gap: 60, level: '能力缺口' },
      { id: 'ai-coding', required: 88, mine: 30, gap: 58, level: '能力缺口' },
      { id: 'ai-agent', required: 82, mine: 24, gap: 58, level: '能力缺口' },
      { id: 'ai-eval', required: 70, mine: 10, gap: 60, level: '推荐学习' },
    ],
  };

  // ---------- 能力进化路径 ----------
  const PATH = [
    { id: 'java-base', name: 'Java 基础', status: 'have', period: '1-2 周', desc: '巩固 JDK 17/21 与并发基础' },
    { id: 'spring-boot', name: 'Spring Boot', status: 'have', period: '2-3 周', desc: 'Boot 3 工程化与自动配置' },
    { id: 'microservice', name: '微服务', status: 'partial', period: '3-4 周', desc: '服务拆分、治理与分布式事务' },
    { id: 'docker', name: 'Docker', status: 'partial', period: '1-2 周', desc: '容器镜像与编排' },
    { id: 'kubernetes', name: 'Kubernetes', status: 'gap', period: '4-6 周', desc: 'K8s 集群、Helm 与部署' },
    { id: 'ai-coding', name: 'AI Coding', status: 'gap', period: '3-4 周', desc: 'Copilot / Cursor 深度工作流' },
    { id: 'ai-agent', name: 'Agent', status: 'gap', period: '4-6 周', desc: 'Agent 设计与编排实践' },
    { id: 'ai-eval', name: 'AI Evaluation', status: 'learn', period: '2-3 周', desc: 'AI 产出质量评估与门禁' },
  ];

  // ---------- 技能对比默认组 ----------
  const COMPARE_SKILLS = ['ai-coding', 'ai-agent', 'rag', 'kubernetes', 'microservice'];

  // ---------- 岗位版本摘要（用于切换） ----------
  function versionById(vid) {
    return VERSIONS.find((v) => v.id === vid) || VERSIONS[VERSIONS.length - 1];
  }

  // ============================================================
  // 「时间 × 能力层级」演化图数据（横轴 = 版本时间，纵轴 = 能力层级）
  // ============================================================
  const CHART_BANDS = [
    { id: 'trend', name: '技术趋势', ids: ['t-ai', 't-llm', 't-cloud', 't-micro'] },
    { id: 'mode', name: '工作方式', ids: ['m-ai', 'm-cloud', 'm-devops', 'm-platform'] },
    { id: 'task', name: '岗位任务', ids: ['k-code', 'k-micro', 'k-container', 'k-perf', 'k-ai'] },
    { id: 'ability', name: '核心能力', ids: ['a-ai', 'a-cloud', 'a-micro', 'a-dist', 'a-eng'] },
    { id: 'skill', name: '具体技能', ids: ['java-base', 'spring-boot', 'microservice', 'kubernetes', 'cloud-native', 'ai-coding', 'ai-agent', 'rag', 'struts'] },
  ];

  function chartNodeById(id) {
    const g = GRAPH_NODES.find((n) => n.id === id);
    if (g) return Object.assign({ isSkill: false }, g);
    const s = SKILL_MAP[id];
    if (s) return Object.assign({ isSkill: true }, s);
    return null;
  }

  // 某能力在某个版本列上的需求值（预测列取 forecast 首点）
  function chartValue(node, colIdx) {
    const ver = VERSIONS[colIdx];
    if (ver.isForecast) {
      const f = (node.forecast && node.forecast[ver.forecastIndex || 0]) || 0;
      return f || node.series[ver.idx] || 0;
    }
    return node.series[ver.idx] || 0;
  }

  // 图表展示状态（added / stable / declining / predicted）
  function chartStatusAt(node, colIdx) {
    const ver = VERSIONS[colIdx];
    const val = chartValue(node, colIdx);
    const prev = colIdx > 0 ? chartValue(node, colIdx - 1) : 0;
    if (ver.isForecast) {
      if (node.versionRemoved) return 'declining';
      const cur = node.series[VERSIONS[VERSIONS.length - 1].idx] || 0;
      const f = (node.forecast && node.forecast[0]) || cur;
      if (f > cur + 3) return 'predicted';
      if (f < cur - 3) return 'declining';
      return 'stable';
    }
    if (val > 0 && prev <= 0) return 'added'; // 该版本首次出现
    if (node.versionRemoved) {
      const removedIdx = VERSIONS.findIndex((v) => v.id === node.versionRemoved);
      if (colIdx >= removedIdx) return 'declining';
    }
    if (node.status === 'deleted') return 'declining';
    return 'stable';
  }

  // 图表筛选匹配（新增/修改/稳定/衰减/预测）
  function chartFilterMatch(node, colIdx, filter) {
    const st = chartStatusAt(node, colIdx);
    switch (filter) {
      case 'all': return true;
      case 'added': return st === 'added';
      case 'stable': return st === 'stable';
      case 'declining': return st === 'declining';
      case 'predicted': return st === 'predicted';
      case 'modified': return node.status === 'modified' && chartValue(node, colIdx) > 0;
      default: return true;
    }
  }

  // 数据证据计数（招聘 / 企业 / 报告 / 政策），按需求强度推导（可接入真实数据替换）
  function evidenceCounts(skill, versionId) {
    const ver = versionById(versionId);
    const d = skill.series[ver.idx] || 20;
    return {
      recruit: Math.round(40 + d * 1.7),
      corp: Math.round(8 + d * 0.55),
      report: Math.round(3 + d * 0.17),
      policy: Math.round(1 + d * 0.08),
    };
  }

  // 岗位相关度
  function relevance(skill, versionId) {
    const ver = versionById(versionId);
    return Math.min(99, Math.round(42 + (skill.series[ver.idx] || 20) * 0.52));
  }

  // 未来增长（%）
  function futureGrowth(skill) {
    const cur = Math.max(skill.series[N - 1], 1);
    const f = skill.forecast[5] || cur;
    return Math.round((f - cur) / cur * 100);
  }

  // ============================================================
  // 查询接口（对外暴露，规格与后端 /api/career/* 对齐）
  // ============================================================

  // getCapabilitySnapshot(occupationId, versionId) —— 某版本完整能力快照
  const ROLE_CONFIG = {
    'Java开发工程师': { title: 'Java 开发工程师', scale: 1, rename: {} },
    '前端开发工程师': { title: '前端开发工程师', scale: 0.92, rename: { 'java-base': ['TypeScript 基础', 'TypeScript'], 'spring-boot': ['React / Vue 框架', 'Frontend Framework'], 'microservice': ['前端工程化', 'Frontend Engineering'], 'kubernetes': ['前端部署与 CDN', 'Web Delivery'], 'mysql': ['浏览器存储', 'Web Storage'] } },
    '算法工程师': { title: '算法工程师', scale: 0.88, rename: { 'java-base': ['Python 与数学基础', 'Python & Math'], 'spring-boot': ['PyTorch / 深度学习', 'Deep Learning'], 'microservice': ['模型训练与服务化', 'Model Serving'], 'kubernetes': ['分布式训练', 'Distributed Training'], 'mysql': ['特征与数据处理', 'Feature Engineering'] } },
    '数据工程师': { title: '数据工程师', scale: 0.9, rename: { 'java-base': ['SQL 与数据建模', 'SQL & Modeling'], 'spring-boot': ['Spark / Flink', 'Stream Processing'], 'microservice': ['数据管道架构', 'Data Pipeline'], 'kubernetes': ['数据平台运维', 'Data Platform'], 'mysql': ['数据仓库', 'Data Warehouse'] } },
    'DevOps工程师': { title: 'DevOps 工程师', scale: 0.94, rename: { 'java-base': ['Linux 与脚本', 'Linux & Scripting'], 'spring-boot': ['CI/CD 流水线', 'CI/CD'], 'microservice': ['平台工程', 'Platform Engineering'], 'kubernetes': ['Kubernetes 集群', 'Kubernetes'], 'mysql': ['监控与告警', 'Observability'] } }
  };
  function roleSkill(skill, occupationId) {
    const cfg = ROLE_CONFIG[occupationId] || ROLE_CONFIG['Java开发工程师'];
    const pair = cfg.rename[skill.id];
    return pair ? Object.assign({}, skill, { name: pair[0], en: pair[1], short: pair[0] }) : skill;
  }

  function getCapabilitySnapshot(occupationId, versionId) {
    const ver = versionById(versionId);
    const cfg = ROLE_CONFIG[occupationId] || ROLE_CONFIG['Java开发工程师'];
    const skills = SKILLS.map((s) => {
      const rs = roleSkill(s, occupationId);
      const val = ver.isForecast
        ? (rs.forecast && rs.forecast[ver.forecastIndex] != null ? rs.forecast[ver.forecastIndex] : (rs.series[N - 1] || 0))
        : Math.round((rs.series[ver.idx] || 0) * cfg.scale);
      return {
        id: rs.id, name: rs.name, en: rs.en, category: rs.category,
        demand: val, importance: rs.importance, confidence: rs.confidence,
        status: ver.isForecast ? (rs.status === 'deleted' ? 'declining' : 'predicted') : nodeStatusAt(rs, ver.idx),
        validFrom: rs.versionAdded, validTo: rs.versionRemoved || null,
        sourceIds: rs.evidence,
      };
    });
    return {
      occupationId: occupationId,
      occupationTitle: cfg.title,
      version: ver.id,
      versionDate: ver.date,
      demandStrength: ver.demand,
      skills: skills,
      dataSource: window.__EV_DATA_SOURCE || 'demo',
    };
  }

  // getCapabilityHistory(occupationId, skillId, startIdx, endIdx) —— 某技能过去 N 个月时序
  function getCapabilityHistory(skillId, startIdx, endIdx) {
    const skill = SKILL_MAP[skillId] || SKILLS[0];
    const s = Math.max(0, startIdx || 0);
    const e = Math.min(N - 1, endIdx == null ? N - 1 : endIdx);
    const points = [];
    let prev = null;
    for (let i = s; i <= e; i++) {
      const v = skill.series[i];
      const point = {
        month: MONTHS[i], demand: v,
        yoy: i >= 12 && skill.series[i - 12] ? Math.round((v - skill.series[i - 12]) / Math.max(skill.series[i - 12], 0.5) * 100) : null,
        mom: prev != null ? Math.round((v - prev) / Math.max(prev, 0.5) * 100) : null,
      };
      points.push(point);
      prev = v;
    }
    return { skillId, skillName: skill.name, months: MONTHS.slice(s, e + 1), points, dataSource: window.__EV_DATA_SOURCE || 'demo' };
  }

  // compareVersions(a, b) —— 两个版本差异
  function compareVersions(va, vb) {
    const a = getCapabilitySnapshot('Java开发工程师', va);
    const b = getCapabilitySnapshot('Java开发工程师', vb);
    const added = [], removed = [], modified = [];
    b.skills.forEach((bs) => {
      const as = a.skills.find((x) => x.id === bs.id);
      if (!as) added.push({ id: bs.id, name: bs.name, demand: bs.demand });
      else if (as.demand === 0 && bs.demand > 0) added.push({ id: bs.id, name: bs.name, demand: bs.demand });
      else if (as.demand > 0 && bs.demand === 0) removed.push({ id: as.id, name: as.name, demandFrom: as.demand });
      else if (Math.abs(bs.demand - as.demand) >= 4) modified.push({ id: bs.id, name: bs.name, demandFrom: as.demand, demandTo: bs.demand });
    });
    a.skills.forEach((as) => {
      if (!b.skills.find((x) => x.id === as.id)) removed.push({ id: as.id, name: as.name, demandFrom: as.demand });
    });
    return { from: va, to: vb, added, removed, modified, dataSource: window.__EV_DATA_SOURCE || 'demo' };
  }

  // forecastCapabilityTrend(skillId, horizon) —— 预测
  function forecastCapabilityTrend(skillId, horizon) {
    const skill = SKILL_MAP[skillId] || SKILLS[0];
    const h = Math.min(6, Math.max(1, horizon || 6));
    const points = [];
    for (let i = 0; i < h; i++) {
      const v = skill.forecast[i];
      points.push({ month: FORECAST_MONTHS[i], demand: v, low: Math.round(v * 0.88), high: Math.round(v * 1.12) });
    }
    const last3 = skill.series.slice(-3);
    const step = (last3[2] - last3[0]) / 2 || 2;
    return {
      skillId, skillName: skill.name,
      current: skill.series[N - 1],
      currentMonth: MONTHS[N - 1],
      horizon: h,
      forecast: points,
      confidence: skill.confidence,
      method: '趋势外推 + 多源加权（Demo 预测）',
      isDemo: true,
      drivers: [
        { name: '招聘趋势', weight: 40 },
        { name: '技术趋势', weight: 25 },
        { name: '企业采用', weight: 18 },
        { name: '行业报告', weight: 10 },
        { name: '其他', weight: 7 },
      ],
      evidence: skill.evidence,
      dataSource: window.__EV_DATA_SOURCE || 'demo',
    };
  }

  // 未来能力增长榜（6 个月）
  function forecastRanking(horizon) {
    const h = horizon || 6;
    const list = SKILLS.filter((s) => s.series[N - 1] > 3).map((s) => {
      const base = Math.max(s.series[N - 1], 1);
      const future = s.forecast[h - 1] || s.forecast[s.forecast.length - 1];
      return {
        id: s.id, name: s.name, en: s.en, category: s.category, status: s.status,
        current: s.series[N - 1], future: future,
        growth: Math.round((future - base) / base * 100),
        confidence: s.confidence,
      };
    });
    list.sort((a, b) => b.growth - a.growth);
    return list.slice(0, 10);
  }

  // 图谱节点在某一时刻的状态（体现完整生命周期：未出现→正常→衰减→删除）
  function nodeStatusAt(s, idx) {
    const addedIdx = versionById(s.versionAdded).idx;
    if (s.versionRemoved) {
      const removedIdx = versionById(s.versionRemoved).idx;
      if (idx >= removedIdx) return 'deleted';        // 已退出核心模型
      if (idx >= removedIdx - 6) return 'declining';  // 进入下降通道
      if (idx < addedIdx) return 'hidden';
      return 'stable';                                 // 历史时期正常存在
    }
    if (idx < addedIdx) return 'hidden';               // 尚未出现
    return s.status;
  }

  function graphAt(idx, opts) {
    opts = opts || {};
    const showForecast = opts.showForecast;
    const nodes = GRAPH_NODES.map((n) => {
      const v = n.series[idx] || 0;
      let status = n.status;
      if (idx < 12 && n.status === 'added' && !n.forecast) status = 'stable';
      let size = 26 + Math.round(v / 5);
      return {
        id: n.id, layer: n.layer, name: n.name, short: n.short, status, demand: v, size,
        forecast: showForecast && idx === N - 1 ? n.forecast[0] : null,
      };
    });
    SKILLS.forEach((s) => {
      const v = s.series[idx] || 0;
      const status = nodeStatusAt(s, idx);
      const forecast = showForecast && idx === N - 1 ? (s.forecast[0] || null) : null;
      const size = status === 'deleted' ? 18 + Math.round(v / 8) : 24 + Math.round(v / 5);
      nodes.push({
        id: s.id, layer: 'skill', name: s.name, short: s.short, en: s.en, status, demand: v, size, forecast,
      });
    });
    return { nodes, links: GRAPH_LINKS, month: MONTHS[idx], version: versionForIndex(idx) };
  }

  function versionForIndex(idx) {
    let best = VERSIONS[0];
    VERSIONS.forEach((v) => { if (v.idx <= idx) best = v; });
    return best.id;
  }

  function indexOfMonth(m) {
    const i = MONTHS.indexOf(m);
    return i < 0 ? N - 1 : i;
  }

  // ---------- 后端对接（可选） ----------
  async function fetchServer(jobId) {
    try {
      const base = (window.API_BASE || 'http://127.0.0.1:5000');
      const res = await fetch(base + '/api/career/occupations/' + encodeURIComponent(jobId) + '/workbench');
      if (!res.ok) throw new Error('no workbench');
      const payload = await res.json();
      if (payload && payload.code === 0 && payload.data) {
        const meta = payload.data.meta || null;
        window.__EV_DB_META = meta;
        // 仅在真实 DB 可用时标记为 db（其余一律 demo，防幻觉）
        window.__EV_DATA_SOURCE = meta && meta.data_source === 'db' ? 'db' : 'demo';
        return true;
      }
      return false;
    } catch (e) {
      window.__EV_DATA_SOURCE = 'demo';
      return false;
    }
  }

  // ============================================================
  // 「Git Diff」专用接口（供新版 evolution.html 调用）
  // ============================================================

  // 比较两版本的完整差异（added / modified / deleted / stable）
  function getFullDiff(fromVersionId, toVersionId) {
    const from = getCapabilitySnapshot('Java开发工程师', fromVersionId);
    const to = getCapabilitySnapshot('Java开发工程师', toVersionId);
    const fromMap2 = {}; from.skills.forEach(s => { fromMap2[s.id] = s; });
    const toMap = {}; to.skills.forEach(s => { toMap[s.id] = s; });

    // 使用 label 字符串比较（如 '2025.03'）识别区间，
    // 这样能正确处理 V2025.02 / V2025.03 这类不在 VERSIONS 显式列表中的版本
    const norm = (s) => String(s || '').replace(/^V/i, '');
    const fromLabel = norm(versionById(fromVersionId).label);
    const toLabel = norm(versionById(toVersionId).label);
    const inRange = (label) => {
      const l = norm(label);
      return l && l > fromLabel && l <= toLabel;
    };

    const added = [], modified = [], removed = [], stable = [];

    // 先识别 removed：依靠 skill.versionRemoved 字段识别时间边界事件
    SKILLS.forEach(function (skill) {
      if (!skill.versionRemoved) return;
      if (!inRange(skill.versionRemoved)) return;
      const fs = fromMap2[skill.id];
      removed.push({
        id: skill.id, name: skill.name, en: skill.en,
        from: fs ? fs.demand : 0, to: 0,
        reason: skill.reason, confidence: skill.confidence || 0.85,
        status: 'del', sourceIds: skill.evidence || [],
        versionRemoved: skill.versionRemoved,
      });
    });

    // 识别 added：依靠 skill.versionAdded 字段识别时间边界事件
    SKILLS.forEach(function (skill) {
      if (skill.status !== 'added' || !skill.versionAdded) return;
      if (!inRange(skill.versionAdded)) return;
      const ts = toMap[skill.id];
      if (ts) {
        added.push({
          id: skill.id, name: skill.name, en: skill.en,
          demandFrom: 0, demandTo: ts.demand,
          growthStr: '+' + ts.demand + '%',
          why: skill.reason, tech: skill.tech || [],
          confidence: skill.confidence || 0.85,
          status: 'add', sourceIds: skill.evidence || [],
        });
      }
    });

    // 再处理 modified / stable（避开已记为删除/添加的）
    const removedIds = new Set(removed.map(r => r.id));
    const addedIds = new Set(added.map(a => a.id));

    // modified: status=modified 且 versionAdded 在 (fromIdx, toIdx] 之前
    const CHG_MOD = CHANGES.modified || [];
    CHG_MOD.forEach(function (cm) {
      const skill = SKILL_MAP[cm.id];
      if (!skill) return;
      // 不属于 status=modified 而 series 偶尔波动:用 CHANGES 作为锚定
      addedIds.add(cm.id);
      const ts = toMap[cm.id];
      const fs = fromMap2[cm.id];
      if (!ts || !fs) return;
      removedIds.add(cm.id); // 占位防止重复
      modified.push({
        id: skill.id, name: skill.name, en: skill.en,
        fromValue: Math.max(cm.demandFrom, fs.demand),
        toValue: Math.max(cm.demandTo, ts.demand),
        delta: Math.max(cm.demandTo, ts.demand) - Math.max(cm.demandFrom, fs.demand),
        deltaStr: (cm.depth && cm.depth.startsWith('+')) ? cm.depth : ('+' + (cm.demandTo - cm.demandFrom)),
        before: cm.before || '',
        after: cm.after || '',
        depth: cm.depth || '',
        addLinks: cm.addLinks || [],
        reason: cm.reason || skill.reason,
        evidence: cm.evidence || skill.evidence || [],
        confidence: cm.confidence || skill.confidence || 0.85,
        status: 'mod',
        sourceIds: cm.evidence || skill.evidence || [],
      });
    });

    // stable: 剩下的 demand>=50 且未被识别的
    to.skills.forEach(function (ts) {
      const skill = SKILL_MAP[ts.id];
      if (!skill) return;
      if (removedIds.has(ts.id)) return;
      if (addedIds.has(ts.id)) return;
      if (ts.demand >= 50) {
        stable.push({
          id: ts.id, name: ts.name, en: skill.en,
          value: ts.demand, status: skill.status || 'stable',
          category: skill.category || '',
        });
      }
    });

    // 限制 modified 显示数量：按 confidence 降序，最多 6 项
    if (modified.length > 6) {
      modified.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      const top = modified.slice(0, 6);
      const restCount = modified.length - 6;
      return {
        from: fromVersionId, to: toVersionId,
        added: added, modified: top, removed: removed, stable: stable,
        _restCount: restCount,
      };
    }

    return {
      from: fromVersionId, to: toVersionId,
      added: added, modified: modified, removed: removed, stable: stable,
    };
  }

  // 未来可能进入核心模型的能力（predictions）
  function getPredictions(horizonMonths) {
    const h = horizonMonths || 6;
    const list = forecastRanking(h).filter(function (r) {
      const skill = SKILL_MAP[r.id];
      return skill && skill.status === 'added' && r.growth >= 25;
    });
    // 如果不足 3 条，补充一些 status=stable 且未来也增长的能力
    if (list.length < 3) {
      const stable = forecastRanking(h).filter(function (r) {
        const skill = SKILL_MAP[r.id];
        return skill && skill.status === 'stable' && r.growth >= 15;
      });
      stable.forEach(function (s) {
        if (!list.find(function (x) { return x.id === s.id; }) && list.length < 4) {
          list.push(s);
        }
      });
    }
    return list.slice(0, 4).map(function (r) {
      const skill = SKILL_MAP[r.id];
      return {
        id: r.id, name: r.name, en: skill ? skill.en : '',
        currentValue: r.current, futureValue: r.future,
        growth: r.growth, confidence: r.confidence,
        horizonMonths: h,
        reason: skill ? skill.reason : '',
        tech: skill ? (skill.tech || []) : [],
        status: 'pred', sourceIds: skill ? skill.evidence : [],
      };
    });
  }

  // 当前版本的稳定核心能力（按 demand 排序）
  function getCoreSkills(versionId, top) {
    const t = top || 6;
    const snap = getCapabilitySnapshot('Java开发工程师', versionId);
    return snap.skills
      .filter(s => s.demand >= 50 && (s.status === 'stable' || s.status === 'modified'))
      .sort((a, b) => b.demand - a.demand)
      .slice(0, t)
      .map(s => {
        const skill = SKILL_MAP[s.id];
        return {
          id: s.id, name: s.name, en: skill ? skill.en : '',
          value: s.demand, category: skill ? skill.category : '',
        };
      });
  }

  // 当前版本下的新兴（增长）能力
  function getEmergingSkills(versionId, top) {
    const t = top || 4;
    const snap = getCapabilitySnapshot('Java开发工程师', versionId);
    const items = [];
    snap.skills.forEach(function (s) {
      const skill = SKILL_MAP[s.id];
      if (skill && skill.status === 'added' && s.demand > 0) {
        items.push(s);
      }
    });
    items.sort((a, b) => b.demand - a.demand);
    return items.slice(0, t).map(s => {
      const skill = SKILL_MAP[s.id];
      return {
        id: s.id, name: s.name, en: skill ? skill.en : '',
        value: s.demand,
        growth: skill ? futureGrowth(skill) : 0,
      };
    });
  }

  // 获取某版本相邻上一版本（用于显示 period）
  function getAdjacentVersion(versionId, dir) {
    const vs = VERSIONS;
    const i = vs.findIndex(v => v.id === versionId);
    if (i < 0) return vs[vs.length - 2];
    const target = dir === 'prev' ? i - 1 : i + 1;
    if (target < 0 || target >= vs.length) return null;
    return vs[target];
  }

  // 整合「VIEW EVIDENCE」数据：按能力汇总相关证据
  function gatherEvidenceForSkill(skillId, sourceIds) {
    const ids = sourceIds && sourceIds.length ? sourceIds : (SKILL_MAP[skillId] ? SKILL_MAP[skillId].evidence : []);
    return (ids || []).map(function (sid) {
      return EVIDENCE_MAP[sid] || null;
    }).filter(Boolean);
  }

  // 整合「VIEW EVIDENCE」数据（无指定技能，按整体变化汇总）
  function gatherEvidenceForChanges(changeIds) {
    const ids = new Set();
    (changeIds || []).forEach(function (cid) {
      const skill = SKILL_MAP[cid];
      if (skill && skill.evidence) skill.evidence.forEach(function (e) { ids.add(e); });
    });
    return Array.from(ids).map(function (sid) {
      return EVIDENCE_MAP[sid] || null;
    }).filter(Boolean);
  }

  // 获取指定技能用于详情面板
  function getSkillInfo(skillId, occupationId, versionId) {
    const baseSkill = SKILL_MAP[skillId];
    const skill = baseSkill ? roleSkill(baseSkill, occupationId || 'Java开发工程师') : null;
    if (!skill) return null;
    const ver = versionById(versionId || 'V2026.08');
    const val = (skill.series || [])[ver.idx] || 0;
    const growth = futureGrowth(skill);
    const rel = Math.min(99, Math.round(42 + val * 0.52));
    const counts = evidenceCounts(skill, 'V2025.07');
    return {
      id: skill.id, name: skill.name, en: skill.en, category: skill.category,
      value: val, growth: growth, rel: rel,
      firstVersion: skill.versionAdded,
      status: skill.status,
      reason: skill.reason,
      related: (skill.related || []).map(function (rid) {
        const r = SKILL_MAP[rid] ? roleSkill(SKILL_MAP[rid], occupationId || 'Java开发工程师') : null;
        return r ? { id: r.id, name: r.name } : null;
      }).filter(Boolean),
      counts: counts,
      tech: skill.tech || [],
      evidence: skill.evidence || [],
      confidence: skill.confidence || 0.85,
    };
  }

  // ---------- 暴露 ----------
  window.EVData = {
    MONTHS, FORECAST_MONTHS, N, VERSIONS, SKILLS, SKILL_MAP,
    LAYERS, GRAPH_NODES, GRAPH_LINKS, CHANGES, DRIVERS, EVIDENCE, EVIDENCE_MAP,
    GAP, PATH, COMPARE_SKILLS, JOB_META, CHART_BANDS,
    versionById, getCapabilitySnapshot, getCapabilityHistory, compareVersions,
    forecastCapabilityTrend, forecastRanking, graphAt, indexOfMonth, versionForIndex,
    chartNodeById, chartValue, chartStatusAt, chartFilterMatch, ROLE_CONFIG,
    evidenceCounts, relevance, futureGrowth,
    getFullDiff, getPredictions, getCoreSkills, getEmergingSkills,
    getAdjacentVersion, gatherEvidenceForSkill, gatherEvidenceForChanges,
    getSkillInfo,
    fetchServer,
    isDemo: function () { return window.__EV_DATA_SOURCE !== 'db'; },
  };
})();
