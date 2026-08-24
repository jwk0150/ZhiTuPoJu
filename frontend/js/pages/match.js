/* ============================================================
 * 人岗匹配决策工作台 · 前端控制器
 * 布局：左导航 + 中央工作区 + 右侧 AI 面板
 * 状态：resume → match → analysis → jobs → detail → learn → interview → report
 * 删除：旧 aurora/portal 沉浸式入口、巨大卡片 Dashboard
 * 数据契约保留：MOCK_RESULT / mockDiagnose / 面试 / 报告
 * ============================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const qs = (sel, root) => (root || document).querySelector(sel);
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function reduceMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function animateNumber(el, to, dur, suffix) {
    if (!el) return;
    suffix = suffix || '';
    if (reduceMotion()) { el.textContent = Math.round(to) + suffix; return; }
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / (dur || 900));
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(to * eased) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------------- 全局状态 ---------------- */
  window.matchState = {
    stage: 'resume',
    file: null, fileName: '', fileSize: 0,
    result: null, selectedJobId: null,
    preferences: { cities: ['北京'], salaryMin: 15, salaryMax: 25, jobType: 'fulltime',
      mustSkills: ['Java', 'Spring Boot', 'MySQL'], preferSkills: ['Redis', 'Docker'], others: ['校招', '接受异地'], direction: 'Java 后端开发' },
    recommendTab: 'now', jobTab: 'requirement',
    aipanelOpen: true, activeView: 'resume',
    activeSection: 'basic', resumeSections: null,
    interview: { index: 0, answers: [], questions: [] },
    whatif: {}, favJobs: {},
    _theater: null, _mediaStream: null, _recognition: null
  };

  /* ---------------- 常量 ---------------- */
  const CITIES = ['北京', '上海', '深圳', '杭州', '广州', '成都', '不限'];
  const JOBTYPES = [['fulltime', '全职'], ['intern', '实习'], ['campus', '校招']];
  const OTHERS = ['应届生', '接受异地', '接受远程', '大厂优先', '弹性工作'];
  const SUGGESTED_SKILLS = ['Java', 'Spring Boot', 'MySQL', 'Python', 'Redis', 'Docker', 'React', 'Kubernetes', 'PyTorch', 'LLM', 'RAG', 'Go', '微服务'];
  const ACCEPT_EXT = ['pdf', 'doc', 'docx', 'txt'];
  const MAX_BYTES = 8 * 1024 * 1024;
  const DIRECTIONS = ['Java 后端开发', '数据开发', 'AI 应用开发', '测试开发', '前端开发'];

  // 顶部进度节点
  const PROGRESS_NODES = [
    { id: 'resume', label: '简历' }, { id: 'match', label: '匹配' }, { id: 'jobs', label: '岗位' },
    { id: 'capability', label: '能力' }, { id: 'learn', label: '学习' }, { id: 'interview', label: '面试' }
  ];

  /* 前端假数据：保证整条链路可预览 */
  const MOCK_RESULT = {
    profile: {
      skills: [
        { name: 'Java', level: '精通', evidence: '主导 3 个 Java 后端项目，日均处理 50w+ 请求', readiness: 96, theory: 95, practice: 92 },
        { name: 'Spring Boot', level: '熟练', evidence: '使用 Spring Boot 搭建微服务并落地生产', readiness: 90, theory: 90, practice: 88 },
        { name: 'MySQL', level: '熟练', evidence: '负责核心表设计与慢查询优化', readiness: 87, theory: 88, practice: 85 },
        { name: 'Redis', level: '了解', evidence: '在缓存场景中做过基础使用', readiness: 72, theory: 78, practice: 60 },
        { name: 'Docker', level: '未掌握', evidence: '简历中未体现容器化实践', readiness: 41, theory: 62, practice: 18 },
        { name: '微服务', level: '未掌握', evidence: '未主导过微服务拆分', readiness: 45, theory: 60, practice: 22 },
        { name: '系统设计', level: '熟悉', evidence: '参与高并发系统设计评审', readiness: 55, theory: 70, practice: 45 }
      ],
      projects: ['Java 高并发订单系统', 'Spring Boot 营销平台', 'MySQL 慢查询优化专项'],
      education: 2, experience: 3, skillsCount: 17,
      summary: '3 年 Java 后端开发经验，主导多个核心项目，接口性能提升 40%，支撑日均 500w+ 调用。'
    },
    job_analysis: {
      job_summary: '负责服务端架构设计与核心业务开发，要求扎实的 Java 基础、工程能力与一定的高并发经验。',
      core_requirements: [
        { skill: 'Java', explanation: '需要熟练掌握 JVM、并发编程与常见集合源码' },
        { skill: 'Spring Boot', explanation: '主流后端框架，要求能独立搭建并排查问题' },
        { skill: 'MySQL', explanation: '要求具备索引优化、分库分表与事务控制经验' }
      ]
    },
    matches: [
      {
        job: { id: 'java-be', title: 'Java 后端开发', company: '某互联网大厂', city: '北京', salary: '25-45K', type: '全职',
          required_skills: ['Java', 'Spring Boot', 'MySQL', 'Redis', 'Docker', '微服务', '系统设计'], preferred_skills: ['Kubernetes', '消息队列'], exp: '0-3年' },
        score: 88, tab: 'now',
        matched: ['核心技能匹配', '项目经历匹配', '教育背景符合', '岗位发展方向一致'],
        missing: ['Docker 能力不足', '微服务项目经验不足'],
        gaps: [
          { skill: 'Java', readiness: 96 }, { skill: 'Spring Boot', readiness: 90 }, { skill: 'MySQL', readiness: 87 },
          { skill: 'Redis', readiness: 72 }, { skill: 'Docker', readiness: 41 }, { skill: '微服务', readiness: 45 }, { skill: '系统设计', readiness: 55 }
        ],
        dimensions: { skills: 88, semantics: 85, projects: 86, experience: 80, graph: 83 },
        gap_paths: [
          { from: 'Linux', to: 'Docker' }, { from: 'Java 项目', to: 'Redis' }, { from: 'Redis', to: '微服务' }, { from: 'Docker', to: 'Dockerfile' }
        ],
        evidences: {
          matched: [{ t: '核心技能匹配', d: 'Java/Spring Boot/MySQL 三项是你简历项目的技术底座。' }, { t: '项目经历匹配', d: '高并发订单系统直接对应服务端核心开发。' }],
          missing: [{ t: 'Docker 实践不足', d: '简历中未出现容器化部署与 Dockerfile。' }, { t: '微服务项目不足', d: '缺乏服务拆分与注册中心实践经验。' }]
        }
      },
      {
        job: { id: 'java-dev', title: 'Java 开发', company: '某科技公司', city: '上海', salary: '20-35K', type: '全职', required_skills: ['Java', 'Spring Boot', 'MySQL'], preferred_skills: ['Redis'], exp: '0-3年' },
        score: 84, tab: 'now',
        matched: ['Java 基础扎实', '框架熟练'], missing: ['高并发经验不足'],
        gaps: [{ skill: 'Java', readiness: 92 }, { skill: 'Spring Boot', readiness: 85 }, { skill: 'MySQL', readiness: 82 }, { skill: 'Redis', readiness: 70 }],
        dimensions: { skills: 84, semantics: 80, projects: 82, experience: 78, graph: 81 }, evidences: { matched: [{ t: 'Java 基础扎实', d: '主导项目验证工程能力。' }], missing: [{ t: '高并发经验不足', d: '缺少大流量场景设计。' }] }
      },
      {
        job: { id: 'data-dev', title: '数据开发', company: '某数据公司', city: '杭州', salary: '22-40K', type: '全职', required_skills: ['Java', 'Python', 'SQL', 'Hadoop'], preferred_skills: ['Spark'], exp: '0-3年' },
        score: 78, tab: 'now',
        matched: ['Java 背景可迁移'], missing: ['数据技术栈不足'],
        gaps: [{ skill: 'Java', readiness: 88 }, { skill: 'Python', readiness: 50 }, { skill: 'SQL', readiness: 65 }, { skill: 'Hadoop', readiness: 30 }],
        dimensions: { skills: 78, semantics: 74, projects: 75, experience: 72, graph: 70 }, evidences: { matched: [{ t: 'Java 背景可迁移', d: '工程基础可迁移至数据处理。' }], missing: [{ t: '数据技术栈不足', d: 'Python/Hadoop 缺失。' }] }
      },
      {
        job: { id: 'ai-app', title: 'AI 应用开发', company: '某 AI 公司', city: '深圳', salary: '28-50K', type: '全职', required_skills: ['Python', 'LLM', 'RAG', '向量数据库'], preferred_skills: ['Agent'], exp: '0-3年' },
        score: 72, tab: 'future',
        matched: ['工程基础尚可'], missing: ['AI 技术栈缺失'],
        gaps: [{ skill: 'Python', readiness: 55 }, { skill: 'LLM', readiness: 30 }, { skill: 'RAG', readiness: 25 }, { skill: '向量数据库', readiness: 20 }],
        dimensions: { skills: 72, semantics: 70, projects: 68, experience: 66, graph: 64 },
        potential_after: 84,
        evidences: { matched: [{ t: '工程基础尚可', d: 'Java 工程经验对 AI 应用落地有帮助。' }], missing: [{ t: 'AI 技术栈缺失', d: 'Python/RAG/Agent 需补齐。' }] }
      },
      {
        job: { id: 'test-dev', title: '测试开发', company: '某软件公司', city: '成都', salary: '18-30K', type: '全职', required_skills: ['Java', '自动化测试', 'Python'], preferred_skills: ['性能测试'], exp: '0-3年' },
        score: 69, tab: 'now',
        matched: ['Java 可用'], missing: ['测试框架不足'],
        gaps: [{ skill: 'Java', readiness: 85 }, { skill: '自动化测试', readiness: 40 }, { skill: 'Python', readiness: 50 }],
        dimensions: { skills: 69, semantics: 66, projects: 64, experience: 62, graph: 60 }, evidences: { matched: [{ t: 'Java 可用', d: '可承担自动化脚本编写。' }], missing: [{ t: '测试框架不足', d: '缺乏 pytest/JUnit 深度使用。' }] }
      },
      {
        job: { id: 'cloud-arch', title: '云原生架构', company: '某云厂商', city: '北京', salary: '35-60K', type: '全职', required_skills: ['Kubernetes', 'Docker', '微服务', 'Go'], preferred_skills: ['Istio'], exp: '3-5年' },
        score: 58, tab: 'future',
        matched: ['系统设计了解'], missing: ['云原生栈缺失'],
        gaps: [{ skill: 'Kubernetes', readiness: 20 }, { skill: 'Docker', readiness: 41 }, { skill: '微服务', readiness: 45 }, { skill: 'Go', readiness: 25 }],
        dimensions: { skills: 58, semantics: 55, projects: 50, experience: 60, graph: 52 },
        potential_after: 76,
        evidences: { matched: [{ t: '系统设计了解', d: '参与过架构评审。' }], missing: [{ t: '云原生栈缺失', d: 'K8s/Go 需系统学习。' }] }
      }
    ],
    learning_path: [
      { skill: 'Docker', title: 'Docker 基础', schedule: '2 小时', weeks: 0.1, level: '入门', way: '视频 + 实验', from: 41, to: 67, description: '理解镜像 / 容器核心概念与生命周期', deliverable: '构建第一个镜像' },
      { skill: 'Docker', title: 'Dockerfile 编写', schedule: '3 小时', weeks: 0.1, level: '入门', way: '实战', from: 67, to: 78, description: '编写可复用、分层合理的 Dockerfile', deliverable: '为项目编写 Dockerfile' },
      { skill: 'Docker', title: '项目容器化', schedule: '4 小时', weeks: 0.2, level: '进阶', way: '动手实践', from: 78, to: 85, description: '将本地项目容器化并运行', deliverable: '本地容器运行' },
      { skill: 'Redis', title: 'Redis 深入', schedule: '1 周', weeks: 1, level: '进阶', way: '文档 + 实验', from: 72, to: 88, description: '缓存设计与一致性处理', deliverable: '缓存方案' },
      { skill: '微服务', title: 'Spring Cloud 实战', schedule: '2 周', weeks: 2, level: '进阶', way: '实战', from: 45, to: 70, description: '用 Spring Cloud 落地微服务', deliverable: '微服务 demo' },
      { skill: '系统设计', title: '高并发架构', schedule: '2 周', weeks: 2, level: '进阶', way: '图书', from: 55, to: 75, description: '学习高并发设计模式', deliverable: '架构设计文档' },
      { skill: '云原生', title: 'K8s 编排', schedule: '2 月', weeks: 8, level: '高级', way: '实战', from: 20, to: 60, description: '容器编排与弹性伸缩', deliverable: 'K8s 部署' }
    ],
    competitiveness: {
      good_case: { projects: 3, docker: true, microservice: true, redis: true, quantified: 5 },
      my_case: { projects: 2, docker: false, microservice: false, redis: true, quantified: 0 }
    }
  };

  /* ============================================================
   * 简历分块数据（三栏工作台：左预览 / 中词条 / 右编辑）
   * 每个词条含 content（可编辑）与 ai_suggestion（mock 修改建议）
   * ============================================================ */
  const RESUME_SECTION_META = [
    { id: 'basic', label: '个人信息', icon: 'user', fields: ['姓名', '求职意向', '电话', '邮箱'] },
    { id: 'education', label: '教育经历', icon: 'book', fields: ['学校', '专业', '学历', '时间'] },
    { id: 'projects', label: '项目经历', icon: 'code', fields: ['项目', '技术栈', '成果'] },
    { id: 'work', label: '工作经历', icon: 'briefcase', fields: ['公司', '职责', '量化成果'] },
    { id: 'skills', label: '专业技能', icon: 'spark', fields: ['技能', '掌握程度'] },
    { id: 'summary', label: '自我评价', icon: 'quote', fields: ['个人特质', '职业规划'] }
  ];
  const RESUME_SECTION_ICONS = {
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
    quote: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>'
  };

  /* ---------------- 每个词条的亮点 / 不足（AI 分析） ---------------- */
  const SECTION_INSIGHT = {
    projects: {
      good: [
        { title: '1. 技术栈与岗位高度匹配', body: '你框选的这块「项目经历」区域，在整份简历里属于 <b>“最有说服力、信息密度最高”</b> 的部分。结合完整简历来看，它的亮点主要体现在以下三个层面：' },
        { title: '2. 有量化数据，且数据是"可感知"的', body: '- 第一个项目写了"平均响应时间小于1秒"——这是一个能直接体现系统性能的硬指标；<br>- 第二个项目写了"支持100+并发访问""测试覆盖率达70%"——这两个数据对后端岗位来说非常加分，说明你关注性能与代码质量，而不是"能跑通"；<br>- 此外还有"课程答辩优秀评价""校级三等奖"这类"外部背书"，比单纯自夸更有说服力。' },
        { title: '3. 角色定位清晰', body: '- 你明确写了"组长"和"核心开发"两个角色，并在第一个项目里提到"组织组员分工协作"和"完成项目文档撰写"——这向面试官传达出你"既能独立攻坚（算法编写与调试），又能带团队"的信号，对校招招生来说是宝贵的差异化优势。' }
      ],
      bad: {
        title: '不过也要提醒你一个可优化的点：',
        body: '两个项目的描述顺序是"技术实现 → 个人职责 → 成果"，逻辑没问题，但第二个项目（在线图书商城）和你的求职目标更贴近，却排在后面。如果面试官只快速扫一眼，可能会先看到偏算法的第一个项目。',
        suggestion: '建议在面试自我介绍时主动把图书商城项目放在前面讲，或者考虑在简历上调整两个项目的先后顺序（这属于结构优化方向，具体是否调整看你个人偏好）。'
      },
      // 建议补充的关键词（用于左栏高亮，点击同步到简历）
      suggestTerms: ['高并发', 'Spring Boot', 'MySQL', 'Redis', 'QPS', '响应时间', '覆盖率', '微服务', '性能优化']
    },
    basic: {
      good: [
        { title: '亮点：定位清晰', body: '姓名、求职意向、联系方式三件套齐全，求职意向"Java 后端开发"直接对应方向词，便于系统与 HR 检索。' }
      ],
      bad: {
        title: '可优化点：',
        body: '缺少「期望城市 / 到岗时间 / 期望薪资」等关键条件，会让匹配系统无法按地域与到岗节奏做精准推荐。',
        suggestion: '建议在联系信息下方增加一行：期望城市 + 到岗时间 + 期望薪资（区间）。'
      },
      suggestTerms: ['杭州', '北京', '上海', '到岗时间', '期望薪资']
    },
    education: {
      good: [
        { title: '亮点：科班背景', body: '专业对口，时间完整，HR 可一眼判断是否符合校招 / 实习时间窗。' }
      ],
      bad: {
        title: '可优化点：',
        body: '仅有学校 / 专业 / 学历，缺乏 GPA、主修课程、荣誉奖项等"硬背书"。',
        suggestion: '建议补充 GPA（如 3.7/4.0）、主修课程（数据结构、操作系统、数据库）、奖项 / 奖学金，作为科班可信度证据。'
      },
      suggestTerms: ['GPA', '一等奖学金', '数据结构', '操作系统', '数据库', '蓝桥杯']
    },
    work: {
      good: [
        { title: '亮点：经历连贯', body: '时间、公司、职责三段式描述清晰，便于系统抓取关键词。' }
      ],
      bad: {
        title: '可优化点：',
        body: '缺乏可量化产出（耗时、性能、规模），影响匹配系统对"成果维"的打分。',
        suggestion: '建议每段经历都补 1-2 条量化数据：耗时、QPS、用户量、节省成本等。'
      },
      suggestTerms: ['QPS', 'P99', '性能优化', 'CI/CD', 'Docker', 'Kubernetes']
    },
    skills: {
      good: [
        { title: '亮点：分级清晰', body: '按"精通/熟练/了解"分级，对应不同岗位权重，是匹配系统最喜欢的结构。' }
      ],
      bad: {
        title: '可优化点：',
        body: '缺少技能 ↔ 项目证据的对应，"我会什么"与"我用过什么"是脱节的。',
        suggestion: '建议每个技能后追加 1 句使用场景或数据证据，例如：MySQL（熟练，主导慢查询优化，QPS 提升 3x）。'
      },
      suggestTerms: ['MySQL', 'Spring Boot', 'Redis', 'Docker', '微服务', '分布式', '高并发']
    },
    summary: {
      good: [
        { title: '亮点：差异化定位', body: '开头直接点明"3 年 Java 后端 + 高并发 / 性能优化"，让 HR 3 秒内抓到核心。' }
      ],
      bad: {
        title: '可优化点：',
        body: '句式偏长，缺少具体可量化成绩与目标方向。',
        suggestion: '建议压到 3-4 句：年限 + 核心技术 + 1-2 个数据 + 求职方向 / 期望城市 / 薪资。'
      },
      suggestTerms: ['Java', 'Spring Boot', '高并发', '性能优化', '杭州', '微服务']
    }
  };
  // 默认示例简历分块（对应 samples/张三简历.txt）
  function buildDefaultResumeSections() {
    return [
      { id: 'basic', label: '个人信息', content: '张三\nJava 后端开发工程师\n电话：138-0000-0000\n邮箱：zhangsan@example.com', ai_suggestion: '补充求职城市与到岗时间，便于系统匹配地域条件；建议将邮箱改为更正式的企业邮箱前缀。' },
      { id: 'education', label: '教育经历', content: '某大学 · 计算机科学与技术 · 本科\n2019.09 - 2023.06', ai_suggestion: '可补充 GPA、主修课程（如数据结构、操作系统、数据库）与获奖情况，强化科班背景可信度。' },
      { id: 'projects', label: '项目经历', content: '1. Java 高并发订单系统：主导核心交易链路开发，接口响应时间下降 40%，支撑日均 500w+ 调用。\n2. Spring Boot 营销平台：独立搭建活动配置与发放服务，负责核心表设计与慢查询优化。\n3. MySQL 慢查询优化专项：梳理慢 SQL、建立复合索引，QPS 提升 3 倍。', ai_suggestion: '建议采用「背景 - 行动 - 结果」结构，把量化指标前置，并明确个人角色（主导/独立/协作），突出技术难点。' },
      { id: 'work', label: '工作经历', content: '暂无正式工作经历\n（示例简历未包含，可在简历中补充实习或全职经历）', ai_suggestion: '若确有实习经历，务必补全公司名称、起止时间、职责与可量化产出；应届生可用校园项目与竞赛成果替代。' },
      { id: 'skills', label: '专业技能', content: 'Java（精通）、Spring Boot（熟练）、MySQL（熟练）、Redis（了解）、系统设计（熟悉）\nDocker、微服务：暂无项目实践', ai_suggestion: '将「精通/熟练」与具体使用场景绑定，如「Java：主导 3 个后端项目」；对 Redis/Docker 等薄弱项补充学习进展，避免被判定为完全缺失。' },
      { id: 'summary', label: '自我评价', content: '3 年 Java 后端开发经验，工程基础扎实，具备一定的高并发与性能优化意识，希望在容器化、微服务方向进一步深入。', ai_suggestion: '自我评价宜精炼为 2-3 句，突出「经验年限 + 核心技术 + 差异化优势 + 明确职业目标」，避免空泛形容词。' }
    ];
  }

  /* ---------------- AI 改写建议（三个版本，mock） ---------------- */
  const RESUME_SUGGESTIONS = {
    basic: {
      title: '强化联系信息与求职定位',
      versions: {
        quant: '张三\nJava 后端开发工程师（杭州 / 期望 25-35K）\n电话：138-0000-0000（微信同号）\n邮箱：zhangsan.dev@gmail.com',
        impact: '张三 · Java 后端开发工程师\n3 年高并发后端经验，主导日均 500w+ 请求的订单系统重构。\n电话：138-0000-0000\n邮箱：zhangsan.dev@gmail.com',
        dense: '张三 / Java 后端开发 · 期望杭州 25-35K\n138-0000-0000 / zhangsan.dev@gmail.com'
      }
    },
    education: {
      title: '突出科班背景与核心课程',
      versions: {
        quant: '某 985 大学 · 计算机科学与技术 · 本科（GPA 3.7/4.0）\n2019.09 - 2023.06\n主修课程：数据结构、操作系统、数据库系统、计算机网络\n荣誉：校级一等奖学金、蓝桥杯国赛二等奖',
        impact: '某 985 · 计算机科学与技术 · 本科\nGPA 3.7/4.0（年级前 5%），蓝桥杯国赛二等奖。\n2019.09 - 2023.06\n主修：数据结构、操作系统、数据库',
        dense: '某 985 计算机本科 · GPA 3.7\n2019.09 - 2023.06'
      }
    },
    projects: {
      title: '强化项目成果与技术深度',
      versions: {
        quant: '1. Java 高并发订单系统 | 主导 | 2024.03-2024.08\n• 主导核心交易链路开发，接口响应时间从 200ms 降至 120ms（-40%），支撑日均 500w+ 调用。\n• 主导 5 人小组，输出 12 份技术文档，代码合并 30+ 次。\n2. Spring Boot 营销平台 | 独立 | 2024.09-2025.01\n• 独立搭建活动配置与发放服务，慢查询从 1.2s 优化至 80ms（-93%）。\n• 负责核心表设计，编写单元测试 40+ 个，覆盖率 70%+。\n3. MySQL 慢查询优化专项 | 主导 | 2025.02-2025.04\n• 梳理慢 SQL 60+ 条，建立复合索引 12 个，QPS 从 800 提升至 2400（3x）。',
        impact: 'Java 高并发订单系统（主导）：核心交易链路，响应 -40%，日均 500w+ 调用。\nSpring Boot 营销平台（独立）：活动配置 + 发放服务，慢查询 -93%。\nMySQL 慢查询优化（主导）：慢 SQL 60+ 条，索引 12 个，QPS 3x。',
        dense: '1. 订单系统(主导) 响应 -40% · 500w+/日\n2. 营销平台(独立) 慢查询 -93%\n3. SQL 优化(主导) QPS 3x',
        // 针对"项目顺序"可优化点的改写：将与求职目标更贴近的项目提前
        fix: '1. 在线图书商城 | 主导 | 2024.09-2025.01\n• 与 Java 后端求职目标直接对齐：Spring Boot 搭建图书检索 / 订单 / 支付链路，MySQL + Redis 支撑日均 50w+ 请求，P99 延迟 < 200ms。\n• 主导 5 人小组，输出 12 份技术文档，单元测试覆盖率 70%+，CI 全绿。\n2. Java 高并发订单系统 | 主导 | 2024.03-2024.08\n• 核心交易链路开发，接口响应时间从 200ms 降至 120ms（-40%），支撑日均 500w+ 调用，体现高并发与性能优化能力。\n• 主导 5 人小组，输出 12 份技术文档，代码合并 30+ 次。\n3. MySQL 慢查询优化专项 | 主导 | 2025.02-2025.04\n• 梳理慢 SQL 60+ 条，建立复合索引 12 个，QPS 从 800 提升至 2400（3x）。'
      }
    },
    work: {
      title: '量化工作业绩与影响力',
      versions: {
        quant: '腾讯 · 后端实习生 | 2024.07 - 2024.09\n• 参与微信支付后端链路开发，独立完成对账模块重构。\n• 日终对账耗时从 4h 缩短到 40min（-83%）。\n• 编写 Go 单元测试 30+ 个，推动 CI 流水线落地，被团队采纳。',
        impact: '腾讯 · 后端实习生（2024.07-2024.09）\n独立完成对账模块重构：4h → 40min（-83%）。30+ 单元测试，推动 CI 落地，团队采纳。',
        dense: '腾讯后端实习 · 2024.07-2024.09\n对账重构 4h→40min（-83%）· CI 落地'
      }
    },
    skills: {
      title: '分类与量化技能熟练度',
      versions: {
        quant: '• 编程语言：Java（精通，4 年，主导 3 个后端项目）、Go（入门，6 个月）、Python（熟悉，2 年）\n• 后端框架：Spring Boot / Spring Cloud（项目级）、MyBatis（熟练）\n• 数据库：MySQL（熟练，复杂 SQL + 索引调优）、Redis（入门，缓存场景）\n• 中间件：Kafka（了解，生产消费）、Docker（基本使用）\n• 工具：Git / Maven / Linux / IntelliJ IDEA',
        impact: 'Java 4 年（主导 3 个后端项目），Spring Boot 全家桶；MySQL 复杂 SQL + 索引调优；Redis 缓存；Kafka + Docker 基本；Git/Maven/Linux 日常熟练。',
        dense: 'Java(4y) · Spring Boot · MySQL/Redis · Kafka/Docker · Git/Linux'
      }
    },
    summary: {
      title: '突出成就与价值贡献',
      versions: {
        quant: '• 3 年 Java 后端开发经验，主导 3 个核心项目，单元测试覆盖 70%+。\n• 擅长高并发与性能优化，订单系统响应 -40%，慢查询 -93%，QPS 3x。\n• 985 计算机科班，蓝桥杯国赛二等奖；LeetCode 300+，1 周内可上手新语言/框架。\n• 求职方向：Java 后端 / 高并发 / 性能优化，杭州，期望 25-35K。',
        impact: '3 年 Java 后端，主导 3 个核心项目。专攻高并发与性能：响应 -40%、慢查询 -93%、QPS 3x。985 科班 + 蓝桥杯国二 + LeetCode 300+。',
        dense: '3y Java · 3 个核心项目 · 性能优化专家\n985 · 蓝桥杯国二 · LeetCode 300+'
      }
    }
  };

  /* ---------------- 词条 diff（行级 LCS）与改写对比模态框 ---------------- */
  function lineDiff(a, b) {
    const aa = String(a == null ? '' : a).split('\n');
    const bb = String(b == null ? '' : b).split('\n');
    const m = aa.length, n = bb.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (aa[i - 1] === bb[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const ops = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (aa[i - 1] === bb[j - 1]) { ops.push({ type: 'eq', text: aa[i - 1] }); i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) { ops.push({ type: 'del', text: aa[i - 1] }); i--; }
      else { ops.push({ type: 'ins', text: bb[j - 1] }); j--; }
    }
    while (i > 0) { ops.push({ type: 'del', text: aa[i - 1] }); i--; }
    while (j > 0) { ops.push({ type: 'ins', text: bb[j - 1] }); j--; }
    ops.reverse();
    return ops;
  }

  function tokenize(str) {
    const out = [];
    const re = /[A-Za-z0-9@._+\-]+|\s+|[\u4e00-\u9fa5]|[^\sA-Za-z0-9\u4e00-\u9fa5]/g;
    let m;
    while ((m = re.exec(str)) !== null) out.push(m[0]);
    return out;
  }

  function tokenLCS(a, b) {
    const ta = tokenize(a), tb = tokenize(b);
    const m = ta.length, n = tb.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (ta[i - 1] === tb[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const left = [], right = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (ta[i - 1] === tb[j - 1]) { left.push({ t: ta[i - 1], type: 'eq' }); right.push({ t: tb[j - 1], type: 'eq' }); i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) { left.push({ t: ta[i - 1], type: 'del' }); right.push(null); i--; }
      else { left.push(null); right.push({ t: tb[j - 1], type: 'ins' }); j--; }
    }
    while (i > 0) { left.push({ t: ta[i - 1], type: 'del' }); right.push(null); i--; }
    while (j > 0) { left.push(null); right.push({ t: tb[j - 1], type: 'ins' }); j--; }
    left.reverse(); right.reverse();
    const render = (arr, kind) => arr.map((it) => {
      if (!it) return '';
      const t = it.t;
      if (t === ' ' || t === '\n' || t === '\t') return escapeHtml(t);
      if (it.type === 'eq') return escapeHtml(t);
      if (it.type === 'del') return kind === 'left' ? `<span class="diff-del">${escapeHtml(t)}</span>` : '';
      if (it.type === 'ins') return kind === 'right' ? `<span class="diff-ins">${escapeHtml(t)}</span>` : '';
      return escapeHtml(t);
    }).join('');
    return { left: render(left, 'left'), right: render(right, 'right'), leftRaw: left, rightRaw: right };
  }

  function buildDiffRows(a, b) {
    const aLines = String(a == null ? '' : a).split('\n');
    const bLines = String(b == null ? '' : b).split('\n');
    const ops = lineDiff(aLines, bLines); // 行级对齐，沿用 lineDiff
    const leftRows = [], rightRows = [];
    let i = 0;
    while (i < ops.length) {
      const op = ops[i];
      if (op.type === 'eq') {
        leftRows.push(`<div class="diff-row">${escapeHtml(op.text || '\u00A0')}</div>`);
        rightRows.push(`<div class="diff-row">${escapeHtml(op.text || '\u00A0')}</div>`);
        i++;
      } else {
        const delBlock = [], insBlock = [];
        while (i < ops.length && ops[i].type === 'del') { delBlock.push(ops[i].text); i++; }
        while (i < ops.length && ops[i].type === 'ins') { insBlock.push(ops[i].text); i++; }
        const maxN = Math.max(delBlock.length, insBlock.length);
        for (let k = 0; k < maxN; k++) {
          const d = delBlock[k], ins = insBlock[k];
          if (d != null && ins != null) {
            const pair = tokenLCS(d, ins);
            leftRows.push(`<div class="diff-row">${pair.left}</div>`);
            rightRows.push(`<div class="diff-row">${pair.right}</div>`);
          } else if (d != null) {
            leftRows.push(`<div class="diff-row diff-del">${escapeHtml(d || '\u00A0')}</div>`);
            rightRows.push('<div class="diff-row diff-empty">&nbsp;</div>');
          } else {
            leftRows.push('<div class="diff-row diff-empty">&nbsp;</div>');
            rightRows.push(`<div class="diff-row diff-ins">${escapeHtml(ins || '\u00A0')}</div>`);
          }
        }
      }
    }
    return { leftHtml: leftRows.join(''), rightHtml: rightRows.join('') };
  }

  function _diffGetSection() {
    return (matchState.resumeSections || []).find((x) => x.id === matchState.activeSection) || (matchState.resumeSections || [])[0];
  }

  let _diffVersion = 'quant';

  function renderDiffModal() {
    const s = _diffGetSection();
    const sug = RESUME_SUGGESTIONS[s.id];
    if (!sug) return;
    const newText = sug.versions[_diffVersion] || '';
    const orig = $('rw-diff-orig');
    const nw = $('rw-diff-new');
    // 左侧：原文（普通文本，不整段高亮）
    if (orig) orig.innerHTML = escapeHtml(s.content || '').replace(/\n/g, '<br>');
    // 右侧：改写后，可编辑 + 只高亮"不同的文字"（新增片段可点击同步到左侧简历）
    if (nw) {
      nw.innerHTML = renderDiffEditableRight(s, newText);
      bindDiffNewMarks(nw);
    }
  }

  // 把改写后的文字渲染成可编辑内容，其中"新增/变化的文字"用 mark 高亮并可点击
  // 新增片段按行拆成短语级 mark，点击某一行即可同步到左侧简历
  function renderDiffEditableRight(s, newText) {
    const { rightRaw } = tokenLCS(s.content || '', newText);
    const adopted = ((window.matchState && window.matchState.adoptedDiffTerms) || {})[s.id] || [];
    let html = '';
    let buf = '';
    const flush = () => {
      if (buf.trim()) {
        const segs = buf.split('\n');
        segs.forEach((seg, idx) => {
          const t = seg.trim();
          if (t) {
            const cls = adopted.includes(t) ? 'hl-new is-adopted' : 'hl-new';
            html += '<mark class="' + cls + '" data-section="' + s.id + '" data-add="' + escapeHtml(t).replace(/"/g, '&quot;') + '">' + escapeHtml(t) + '</mark>';
          }
          if (idx < segs.length - 1) html += '<br>';
        });
      }
      buf = '';
    };
    (rightRaw || []).forEach((it) => {
      if (it && it.type === 'ins') { buf += it.t; }
      else { flush(); if (it) html += escapeHtml(it.t).replace(/\n/g, '<br>'); }
    });
    flush();
    return html;
  }

  // 点击弹窗里高亮的"不同文字"→ 同步到左侧简历
  function bindDiffNewMarks(container) {
    qsa('mark.hl-new', container).forEach((mk) => {
      mk.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const secId = mk.dataset.section;
        const term = mk.dataset.add;
        const sec = (window.matchState.resumeSections || []).find((x) => x.id === secId);
        if (!sec || !term) return;
        if (sec.content && sec.content.includes(term)) { showToast('该文字已在简历中', 'amber'); return; }
        sec.content = (sec.content ? sec.content + '\n' : '') + term;
        if (!window.matchState.adoptedDiffTerms) window.matchState.adoptedDiffTerms = {};
        if (!window.matchState.adoptedDiffTerms[secId]) window.matchState.adoptedDiffTerms[secId] = [];
        if (!window.matchState.adoptedDiffTerms[secId].includes(term)) window.matchState.adoptedDiffTerms[secId].push(term);
        renderResumePreview();
        renderResumeEditor();
        mk.classList.add('is-adopted');
        showToast('已同步「' + term.slice(0, 12) + '」到左侧简历', 'teal');
      });
    });
  }

  function openDiffModal() {
    const s = _diffGetSection();
    const modal = $('rw-diff-modal');
    if (!modal) return;
    const sug = RESUME_SUGGESTIONS[s.id];
    if (!sug) { showToast('该词条暂无可用改写建议', 'amber'); return; }
    // 优先用调用方指定的版本，否则按"不足"段调用时用 fix，其他默认 quant
    if (!_diffVersion || (s.id !== 'projects' && _diffVersion === 'fix')) _diffVersion = 'quant';
    const sub = $('rw-diff-sub'); if (sub) sub.textContent = sug.title;
    const tag = $('rw-diff-section'); if (tag) tag.textContent = s.label || s.id;
    // 控制 fix 按钮可见性（仅 projects 段）
    qsa('.rw-diff-version').forEach((b) => {
      const isFix = b.dataset.version === 'fix';
      if (isFix) b.style.display = (s.id === 'projects') ? '' : 'none';
      b.classList.toggle('is-active', b.dataset.version === _diffVersion);
    });
    renderDiffModal();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeDiffModal() {
    const modal = $('rw-diff-modal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
  }

  function selectDiffVersion(v) {
    if (!v) return;
    _diffVersion = v;
    qsa('.rw-diff-version').forEach((b) => b.classList.toggle('is-active', b.dataset.version === v));
    renderDiffModal();
  }

  function applyDiff() {
    const s = _diffGetSection();
    const sug = RESUME_SUGGESTIONS[s.id];
    if (!sug) return;
    const newText = sug.versions[_diffVersion] || '';
    s.content = newText;
    renderResume();
    closeDiffModal();
    showToast('已采纳「' + (s.label || s.id) + '」的改写建议', 'teal');
  }

  function bindDiffModal() {
    const close = $('rw-diff-close');
    const cancel = $('rw-diff-cancel');
    const apply = $('rw-diff-apply');
    const swap = $('rw-diff-swap');
    const mask = document.querySelector('.rw-diff-mask');
    if (close) close.addEventListener('click', closeDiffModal);
    if (cancel) cancel.addEventListener('click', closeDiffModal);
    if (apply) apply.addEventListener('click', applyDiff);
    if (mask) mask.addEventListener('click', closeDiffModal);
    qsa('.rw-diff-version').forEach((b) => {
      b.addEventListener('click', () => selectDiffVersion(b.dataset.version));
    });
    if (swap) {
      // 右侧为可编辑区，点击"对比切换"直接重新渲染（保证高亮与绑定状态正确）
      swap.addEventListener('click', () => renderDiffModal());
    }
    document.addEventListener('keydown', (e) => {
      const modal = $('rw-diff-modal');
      if (modal && !modal.hidden && e.key === 'Escape') closeDiffModal();
    });
  }

  /* ---------------- 入口 ---------------- */
  function initMatch() {
    if (window.__matchInit) return;
    window.__matchInit = true;
    // 演示态默认注入一份本地简历与匹配结果，页面无需后端也能完整展示。
    const demoState = window.matchState;
    demoState.file = { name: '张三_Java后端开发.txt', size: 18642, type: 'text/plain' };
    demoState.fileName = '张三_Java后端开发.txt';
    demoState.fileSize = 18642;
    demoState.result = structuredClone(MOCK_RESULT);
    demoState.selectedJobId = MOCK_RESULT.matches[0].job.id;
    demoState.resumeSections = buildDefaultResumeSections();
    demoState.activeSection = 'basic';
    bindGlobal();
    bindEntry();
    bindMatchCond();
    bindJobs();
    bindDetail();
    bindLearning();
    bindCompare();
    bindBenchmark();
    bindLearningProfile();
    bindDrawers();
    bindInterview();
    bindReport();
    renderProgress();
    renderResume();
    bindQuickDirections();
    setView('resume');
    const art = qs('.match-art-layer'); if (art) art.hidden = true;
    renderAIPanelResume();
  }

  /* ============================================================
   * 全局 / 导航 / 进度
   * ============================================================ */
  function bindGlobal() {
    qsa('.wks-nav-item').forEach((b) => b.addEventListener('click', () => {
      const nav = b.dataset.nav;
      if (nav === 'compare') { setView('compare'); return; }
      // 导航映射到对应视图
      const map = { resume: 'resume', match: 'match', jobs: 'jobs', capability: 'detail', learn: 'learn', interview: 'interview' };
      // interview 需要已进入过分析，否则先跳 jobs
      if (nav === 'interview' && !window.matchState.result) { window.showToast('请先完成匹配分析', 'amber'); setView('jobs'); return; }
      if (nav === 'capability' && !window.matchState.selectedJobId) { window.showToast('请先选择一个岗位', 'amber'); setView('jobs'); return; }
      if (nav === 'learn' && !window.matchState.selectedJobId) { window.showToast('请先选择岗位再生成学习路径', 'amber'); setView('jobs'); return; }
      setView(map[nav] || 'resume');
    }));
  }

  function renderProgress() {
    const st = window.matchState;
    const box = $('wks-progress');
    if (!box) return;
    // 计算已完成：根据 stage
    const order = PROGRESS_NODES.map((n) => n.id);
    const stageOrder = { resume: 0, match: 1, jobs: 2, capability: 3, learn: 4, interview: 5 };
    const cur = stageOrder[st.stage] != null ? stageOrder[st.stage] : 0;
    box.innerHTML = PROGRESS_NODES.map((n, i) => {
      const state = i < cur ? 'is-done' : (i === cur ? 'is-active' : '');
      const dot = '<span class="wks-prog-dot"></span>';
      const node = `<button class="wks-prog-node ${state}" data-prog="${n.id}" type="button">${dot}<span>${n.label}</span></button>`;
      const line = i < PROGRESS_NODES.length - 1 ? `<span class="wks-prog-line ${i < cur ? 'is-filled' : ''}"></span>` : '';
      return node + line;
    }).join('');
    qsa('.wks-prog-node', box).forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.prog;
      const map = { resume: 'resume', match: 'match', jobs: 'jobs', capability: 'detail', learn: 'learn', interview: 'interview' };
      // 未完成节点提示
      const idx = order.indexOf(id);
      if (idx > cur) { window.showToast('请先完成前面的诊断步骤', 'amber'); return; }
      setView(map[id]);
    }));
  }

  function setView(name) {
    if (name === 'detail') name = 'jobs'; // 兼容旧调用：详情已合并到 jobs 视图右栏
    const st = window.matchState;
    st.activeView = name;
    const views = ['resume', 'match', 'jobs', 'analysis', 'learn', 'compare'];
    views.forEach((v) => { const el = $('view-' + v); if (el) { el.classList.toggle('is-active', v === name); el.hidden = (v !== name); } });
    // view-resume 三栏工作台有自己的视觉，不展示艺术背景插图
    const art = qs('.match-art-layer');
    if (art) art.hidden = (name === 'resume');
    // 左导航高亮
    const navMap = { resume: 'resume', match: 'match', jobs: 'jobs', learn: 'learn', compare: 'compare' };
    qsa('.wks-nav-item').forEach((b) => b.classList.toggle('is-active', navMap[name] === b.dataset.nav));
    // 同步 stage（用于进度）
    if (name === 'resume') st.stage = 'resume';
    else if (name === 'match') st.stage = 'match';
    else if (name === 'jobs') st.stage = 'jobs';
    else if (name === 'learn') st.stage = 'learn';
    else if (name === 'interview') st.stage = 'interview';
    renderProgress();
    if (name === 'jobs') renderJobs();
    if (name === 'match') renderMatchWorkbench();
    if (name === 'learn') renderLearning();
    if (name === 'compare') renderCompare();
    if (name === 'resume') renderResume();
  }

  /* ============================================================
   * STATE 1 · 简历入口
   * ============================================================ */
  function bindEntry() {
    const input = $('resume-file-input');
    if (input) input.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) loadFile(f); });
    const up = $('resume-upload-zone');
    if (up) {
      up.addEventListener('click', () => $('resume-file-input').click());
      up.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') $('resume-file-input').click(); });
      ['dragenter', 'dragover'].forEach((ev) => up.addEventListener(ev, (e) => { e.preventDefault(); up.classList.add('is-drag'); }));
      ['dragleave', 'drop'].forEach((ev) => up.addEventListener(ev, (e) => { e.preventDefault(); up.classList.remove('is-drag'); }));
      up.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) loadFile(f); });
    }
    const sample = $('md-sample-resume');
    if (sample) sample.addEventListener('click', (e) => { e.stopPropagation(); loadSample(); });
    const start = $('md-start-match');
    if (start) start.addEventListener('click', () => {
      if (!window.matchState.file) { window.showToast('请先上传简历', 'amber'); $('resume-file-input').click(); return; }
      setView('match');
    });
    // 顶部"开始匹配"按钮（用户要求放在右上角）
    const startTop = $('md-start-match-top');
    if (startTop) startTop.addEventListener('click', () => {
      if (!window.matchState.file) { window.showToast('请先上传简历', 'amber'); $('resume-file-input').click(); return; }
      setView('match');
    });
    const view = $('md-view-resume');
    if (view) view.addEventListener('click', viewResume);
    const change = $('md-change-resume');
    if (change) change.addEventListener('click', () => $('resume-file-input').click());
    bindResumeAnalyze();
    bindDiffModal();
  }

  function renderResume() {
    const st = window.matchState;
    const uploadCard = $('resume-upload-card');
    const headMetrics = $('resume-head-metrics');
    const toolbar = $('rw-toolbar');
    const grid = document.querySelector('.rw-grid');
    const generate = $('rw-generate');
    const fileBadge = $('rw-file-badge');

    if (!st.resumeSections) st.resumeSections = buildDefaultResumeSections();

    if (st.file) {
      if (uploadCard) uploadCard.hidden = true;
      if (headMetrics) headMetrics.innerHTML = `<span class="mod-tag mod-tag--ok">解析完成</span>`;
      if (toolbar) toolbar.hidden = false;
      if (grid) grid.hidden = false;
      if (generate) generate.hidden = false;
      const size = st.fileSize ? (st.fileSize / 1024 / 1024).toFixed(1) + 'MB' : '本地文件';
      if (fileBadge) fileBadge.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>${escapeHtml(st.fileName)} · ${escapeHtml(size)}`;
    } else {
      if (uploadCard) uploadCard.hidden = false;
      if (headMetrics) headMetrics.innerHTML = `<span class="mod-tag mod-tag--warn">待导入</span>`;
      if (toolbar) toolbar.hidden = true;
      if (grid) grid.hidden = true;
      if (generate) generate.hidden = true;
    }

    renderResumePreview();
    renderResumeNav();
    renderResumeEditor();
    renderAIPanelResume();
  }

  function getSections() {
    const st = window.matchState;
    if (!st.resumeSections) st.resumeSections = buildDefaultResumeSections();
    return st.resumeSections;
  }
  function getActiveSection() {
    const st = window.matchState;
    const secs = getSections();
    return secs.find((s) => s.id === st.activeSection) || secs[0];
  }

  /* ---- 左：完整简历预览（纸质简历样式） ----
   * 当前选中段落：对其内容做关键词高亮（hl-good.addable），点击可同步到简历
   */
  function renderResumePreview() {
    const box = $('rw-preview');
    if (!box) return;
    const secs = getSections();
    const st = window.matchState;
    const activeId = st.activeSection;
    const activeInsight = SECTION_INSIGHT[activeId];
    // 只高亮当前段落的"建议补充词"，且只标原文中尚未出现的关键词
    const suggestTerms = (activeInsight && activeInsight.suggestTerms) || [];

    const markTerms = (text) => {
      // 先 escape，再插入 mark 标记；已采纳的词标 .adopted
      const adopted = st.adoptedSuggestTerms || {};
      const adoptedForThis = adopted[activeId] || [];
      let html = escapeHtml(text);
      suggestTerms.forEach((term) => {
        if (!term || !html.includes(escapeHtml(term))) return;
        const isAdopted = adoptedForThis.includes(term);
        const cls = isAdopted ? 'hl-good addable adopted' : 'hl-good addable';
        const token = '\u0001T' + term + 'T\u0001';
        html = html.split(escapeHtml(term)).join(token);
        html = html.split(token).join('<mark class="' + cls + '" data-term="' + escapeHtml(term) + '">' + escapeHtml(term) + '</mark>');
      });
      return html;
    };

    const basic = secs.find((s) => s.id === 'basic');
    const others = secs.filter((s) => s.id !== 'basic');

    // 解析「个人信息」分块：首行姓名、次行求职意向、其余为联系方式
    const basicLines = (basic ? basic.content : '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const name = basicLines[0] || '未命名';
    const title = basicLines[1] || '';
    const contact = basicLines.slice(2);

    box.innerHTML = `<div class="rw-paper">
      <div class="rw-paper-name">${escapeHtml(name)}</div>
      ${title ? `<div class="rw-paper-title">${markTerms(title)}</div>` : ''}
      ${contact.length ? `<div class="rw-paper-contact">${contact.map((c) => markTerms(c)).join(' · ')}</div>` : ''}
      ${others.map((s) => {
        const body = (s.content || '').replace(/\n/g, '<br>');
        const isActive = s.id === activeId;
        return `<div class="rw-paper-section${isActive ? ' is-active' : ''}">
          <div class="rw-paper-sec-title">${escapeHtml(s.label)}${isActive ? ' <span class="rw-paper-sec-hint">· 关键词可点击同步</span>' : ''}</div>
          <div class="rw-paper-sec-body">${isActive ? markTerms(s.content || '') : escapeHtml(body)}</div>
        </div>`;
      }).join('')}
    </div>`;

    // 绑定"点击高亮词 → 同步到简历"事件
    qsa('mark.hl-good.addable', box).forEach((mk) => {
      mk.addEventListener('click', () => {
        const term = mk.dataset.term;
        const sec = (window.matchState.resumeSections || []).find((x) => x.id === activeId);
        if (!sec || !term) return;
        // 把 term 加到该段 content 末尾（如已有则跳过）
        if (sec.content && sec.content.includes(term)) {
          showToast('该词已存在于「' + sec.label + '」', 'amber');
          return;
        }
        sec.content = (sec.content ? sec.content + '\n· 补充：' + term : '· 补充：' + term);
        // 记录已采纳
        if (!window.matchState.adoptedSuggestTerms) window.matchState.adoptedSuggestTerms = {};
        if (!window.matchState.adoptedSuggestTerms[activeId]) window.matchState.adoptedSuggestTerms[activeId] = [];
        if (!window.matchState.adoptedSuggestTerms[activeId].includes(term)) window.matchState.adoptedSuggestTerms[activeId].push(term);
        renderResumePreview();
        renderResumeEditor();
        showToast('已添加「' + term + '」到' + sec.label, 'teal');
      });
    });
  }

  /* ---- 纸质版简历渲染（可对关键词做 inline 高亮，用于标杆对比） ---- */
  function renderPaperHTML(sections, hlTerms) {
    const secs = sections || [];
    const basic = secs.find((s) => s.id === 'basic');
    const others = secs.filter((s) => s.id !== 'basic');
    const basicLines = (basic ? basic.content : '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const name = basicLines[0] || '未命名';
    const title = basicLines[1] || '';
    const contact = basicLines.slice(2);
    const mark = (text, sectionId) => {
      const raw = String(text);
      const lines = raw.split(/\r?\n/);
      let html = escapeHtml(raw);
      const terms = (hlTerms || []).filter(Boolean);
      // 用占位符分两步替换，避免对已插入的 mark 再次嵌套高亮
      const tokens = terms.map((_, i) => '\u0001T' + i + 'T\u0001');
      terms.forEach((k, i) => {
        const ek = escapeHtml(k);
        if (!html.includes(ek)) return;
        html = html.split(ek).join(tokens[i]);
      });
      terms.forEach((k, i) => {
        const ek = escapeHtml(k);
        if (!html.includes(tokens[i])) return;
        const line = lines.find((l) => l.includes(k)) || k;
        const eline = escapeHtml(line).replace(/"/g, '&quot;');
        html = html.split(tokens[i]).join('<mark class="hl-good" data-section="' + sectionId + '" data-add="' + eline + '">' + ek + '</mark>');
      });
      return html;
    };
    return `<div class="rw-paper">
      <div class="rw-paper-name">${escapeHtml(name)}</div>
      ${title ? `<div class="rw-paper-title">${mark(title, 'basic')}</div>` : ''}
      ${contact.length ? `<div class="rw-paper-contact">${contact.map((c) => mark(c, 'basic')).join(' · ')}</div>` : ''}
      ${others.map((s) => `
        <div class="rw-paper-section">
          <div class="rw-paper-sec-title">${escapeHtml(s.label)}</div>
          <div class="rw-paper-sec-body">${mark(s.content || '', s.id).replace(/\n/g, '<br>')}</div>
        </div>`).join('')}
    </div>`;
  }

  /* ---- 中：词条导航 ---- */
  function renderResumeNav() {
    const box = $('rw-nav');
    if (!box) return;
    const st = window.matchState;
    const secs = getSections();
    box.innerHTML = secs.map((s) => {
      const meta = RESUME_SECTION_META.find((m) => m.id === s.id) || {};
      const icon = RESUME_SECTION_ICONS[meta.icon] || RESUME_SECTION_ICONS.user;
      const active = st.activeSection === s.id ? 'is-active' : '';
      return `<button class="rw-nav-item ${active}" data-section="${s.id}" type="button">
        <span class="rw-nav-icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8">${icon}</svg></span>
        <span class="rw-nav-text">${escapeHtml(s.label)}</span>
        <span class="rw-nav-arrow">→</span>
      </button>`;
    }).join('');
    qsa('.rw-nav-item', box).forEach((b) => b.addEventListener('click', () => {
      window.matchState.activeSection = b.dataset.section;
      renderResumeNav();
      renderResumeEditor();
      renderResumePreview();
    }));
  }

  /* ---- 右：分析 + 编辑 ---- */
  // 把段落的"亮点 / 不足"渲染成结构化卡片，并附带"AI 修改"按钮（放在不足那段）
  function renderResumeEditor() {
    const ed = $('rw-editor');
    const stateTag = $('rw-editor-state');
    if (!ed) return;
    const s = getActiveSection();
    if (!s) return;
    if (stateTag) stateTag.textContent = s.label;

    const insight = SECTION_INSIGHT[s.id];
    let analysisHTML = '';
    if (insight) {
      const goodList = (insight.good || []).map((g) =>
        `<p><b>${escapeHtml(g.title)}</b></p><p>${g.body}</p>`
      ).join('');
      const bad = insight.bad || {};
      analysisHTML = `<div class="rw-ai-analysis">
        <div class="rw-ai-block is-good">
          <div class="rw-ai-block-head">
            <div class="rw-ai-block-title"><span class="dot"></span>亮点</div>
          </div>
          <div class="rw-ai-block-body">${goodList}</div>
        </div>
        <div class="rw-ai-block is-bad">
          <div class="rw-ai-block-head">
            <div class="rw-ai-block-title"><span class="dot"></span>可优化点</div>
          </div>
          <div class="rw-ai-block-body">
            <p><b>${escapeHtml(bad.title || '优化建议：')}</b></p>
            <p>${bad.body || ''}</p>
            ${bad.suggestion ? `<p>${bad.suggestion}</p>` : ''}
            <div class="rw-ai-edit-row">
              <span style="font-size:11px;color:var(--ink-faint)">针对此点改写：</span>
              <button class="rw-ai-edit-btn" id="rw-ai-edit" type="button">
                <span class="ic">✨</span>AI 修改
              </button>
            </div>
          </div>
        </div>
      </div>`;
    } else {
      // 通用段落：用 ai_suggestion 作为亮点，单一"通用建议"作为可优化点
      analysisHTML = `<div class="rw-ai-analysis">
        <div class="rw-ai-block is-good">
          <div class="rw-ai-block-head"><div class="rw-ai-block-title"><span class="dot"></span>亮点</div></div>
          <div class="rw-ai-block-body"><p>${escapeHtml(s.ai_suggestion || '当前词条信息密度尚可，建议继续打磨细节。')}</p></div>
        </div>
        <div class="rw-ai-block is-bad">
          <div class="rw-ai-block-head"><div class="rw-ai-block-title"><span class="dot"></span>可优化点</div></div>
          <div class="rw-ai-block-body">
            <p><b>建议补充或量化：</b></p>
            <p>结合完整简历看，当前段落在数据、动词力度或与岗位的关联上仍有提升空间。点击下方 AI 修改，生成三个可对比的改写版本。</p>
            <div class="rw-ai-edit-row">
              <span style="font-size:11px;color:var(--ink-faint)">针对此点改写：</span>
              <button class="rw-ai-edit-btn" id="rw-ai-edit" type="button">
                <span class="ic">✨</span>AI 修改
              </button>
            </div>
          </div>
        </div>
      </div>`;
    }

    ed.innerHTML = analysisHTML + `
      <div class="rw-ai-edit-hint">💡 点击「✨ AI 修改」打开改写面板：可在右侧直接编辑简历，点击高亮的<em>新增文字</em>即可同步到左侧简历。</div>`;

    const aiBtn = $('rw-ai-edit');
    if (aiBtn) aiBtn.addEventListener('click', () => {
      // 默认打开 diff 弹窗：projects 段落使用针对不足的 fix 版本，其他使用 quant 版
      if (s.id === 'projects') _diffVersion = 'fix';
      else _diffVersion = 'quant';
      openDiffModal();
    });
  }

  /* ---- 底部「分析当前词条」：打开 AI 改写对比模态框 ---- */
  function bindResumeAnalyze() {
    const btn = $('rw-analyze');
    if (!btn) return;
    btn.addEventListener('click', () => {
      openDiffModal();
    });
  }

  function bindQuickDirections() {
    // 顶部热门方向（可选，保持精简）
  }

  function loadFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ACCEPT_EXT.indexOf(ext) < 0) { window.showToast('仅支持 PDF / DOC / DOCX / TXT', 'amber'); return; }
    if (file.size > MAX_BYTES) { window.showToast('文件不能超过 8MB', 'amber'); return; }
    window.matchState.file = file;
    window.matchState.fileName = file.name;
    window.matchState.fileSize = file.size;
    // TXT 可做简单分块解析；其他格式回退为默认分块（待接真实解析）
    if (ext === 'txt') {
      const reader = new FileReader();
      reader.onload = () => {
        window.matchState.resumeSections = parseResumeText(String(reader.result || ''));
        window.matchState.activeSection = 'basic';
        renderResume();
      };
      reader.onerror = () => { window.matchState.resumeSections = buildDefaultResumeSections(); renderResume(); };
      reader.readAsText(file, 'utf-8');
    } else {
      window.matchState.resumeSections = buildDefaultResumeSections();
      window.matchState.activeSection = 'basic';
      renderResume();
    }
    window.showToast('简历已就绪', 'teal');
  }

  // 按【区块名】标题对简历文本做简单分块，未匹配的段落归入「个人信息」
  function parseResumeText(text) {
    const defs = buildDefaultResumeSections();
    const sections = defs.map((d) => ({ ...d, content: '' }));
    const byId = {};
    sections.forEach((s) => { byId[s.id] = s; });
    // 标题关键词 → 区块 id 映射
    const kwMap = [
      { keys: ['教育', '学历', '学校'], id: 'education' },
      { keys: ['项目', 'project'], id: 'projects' },
      { keys: ['工作', '实习', '经历', 'experience'], id: 'work' },
      { keys: ['技能', '专业', '技术', 'skill'], id: 'skills' },
      { keys: ['自我评价', '评价', '总结', 'summary', '个人优势'], id: 'summary' }
    ];
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    let curId = 'basic';
    const basicLines = [];
    lines.forEach((line) => {
      if (!line) return;
      const matched = kwMap.find((m) => m.keys.some((k) => line.toLowerCase().indexOf(k.toLowerCase()) >= 0));
      if (matched && line.length <= 14) { curId = matched.id; return; }
      if (curId === 'basic') { basicLines.push(line); }
      else { byId[curId].content += (byId[curId].content ? '\n' : '') + line; }
    });
    byId.basic.content = basicLines.join('\n');
    // 补齐为空的区块
    sections.forEach((s) => { if (!s.content.trim()) s.content = defs.find((d) => d.id === s.id).content; });
    return sections;
  }
  function loadSample() {
    fetch('../samples/张三简历.txt').then((r) => r.text()).then((text) => {
      const blob = new Blob([text], { type: 'text/plain' });
      loadFile(new File([blob], '张三_Java后端开发.txt', { type: 'text/plain' }));
    }).catch(() => window.showToast('示例简历加载失败', 'amber'));
  }
  function viewResume() {
    const st = window.matchState;
    if (st.file && st.file instanceof File) {
      const url = URL.createObjectURL(st.file); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else window.showToast('该简历暂不支持预览', 'amber');
  }

  /* ============================================================
   * STATE 2 · 匹配条件编辑器
   * ============================================================ */
  function bindMatchCond() {
    const run = $('match-run');
    if (run) run.addEventListener('click', runMatch);
    const addBox = qs('.cond-add');
    if (addBox) qsa('.chip-add', addBox).forEach((b) => b.addEventListener('click', () => addCondition(b.dataset.add)));
    renderCondBar();
  }

  function renderCondBar() {
    const st = window.matchState.preferences;
    const bar = $('cond-bar');
    if (!bar) return;
    const items = [];
    if (st.cities.length) items.push(condItem('城市', st.cities.map((c) => `<span class="chip is-on">${c}</span>`).join(''), 'cities'));
    if (st.salaryMin != null || st.salaryMax != null) items.push(condItem('薪资', `<span class="chip is-on">${st.salaryMin || '?'}K — ${st.salaryMax || '?'}K</span>`, 'salary'));
    if (st.jobType) { const lbl = labelOf(JOBTYPES, st.jobType); items.push(condItem('性质', `<span class="chip is-on">${lbl}</span>`, 'jobtype')); }
    (st.mustSkills || []).forEach((s) => items.push(skillItem(s, 'must', '必备')));
    (st.preferSkills || []).forEach((s) => items.push(skillItem(s, 'prefer', '希望')));
    (st.others || []).forEach((s) => items.push(condItem('其他', `<span class="chip is-on">${s}</span>`, 'other-' + s)));
    if (st.direction) items.push(condItem('方向', `<span class="chip is-on">${escapeHtml(st.direction)}</span>`, 'direction'));
    if (!items.length) items.push(`<div class="mod-label muted">暂无条件，点击右侧「添加条件」开始配置</div>`);
    bar.innerHTML = items.join('');
    // 绑定技能点击 → Popover
    qsa('.cond-skill', bar).forEach((el) => el.addEventListener('click', (e) => {
      e.stopPropagation(); openSkillPopover(el, el.dataset.skill, el);
    }));
    qsa('.cond-item-remove', bar).forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); removeCondition(el.dataset.target); }));
    renderAIPanelMatch();
    renderMatchWorkbench();
  }

  function renderMatchWorkbench() {
    const box = $('match-workbench');
    if (!box) return;
    const pref = window.matchState.preferences;
    const res = window.matchState.result || MOCK_RESULT;
    const profile = res.profile || MOCK_RESULT.profile;
    const selected = (res.matches || []).find((m) => m.job.title === pref.direction) || res.matches[0];
    const filled = [pref.cities.length > 0, pref.salaryMin != null || pref.salaryMax != null, !!pref.jobType, pref.mustSkills.length > 0, !!pref.direction].filter(Boolean).length;
    const completeness = Math.round(filled / 5 * 100);
    const signals = [
      { label: '技能覆盖', value: Math.min(96, 58 + pref.mustSkills.length * 9), note: `${pref.mustSkills.length} 项必备技能` },
      { label: '目标清晰度', value: pref.direction ? 92 : 42, note: pref.direction || '尚未指定方向' },
      { label: '地域匹配', value: pref.cities.length ? 86 : 40, note: pref.cities.join('、') || '不限城市' },
      { label: '薪资区间', value: pref.salaryMin != null ? 78 : 38, note: pref.salaryMin != null ? `${pref.salaryMin}-${pref.salaryMax}K` : '待设置' }
    ];
    box.innerHTML = `<div class="match-workbench-head">
      <div><span class="mod-label">MATCH READINESS</span><h2>匹配准备度</h2><p>条件越清晰，推荐结果越容易解释。你可以随时调整条件，再运行一次诊断。</p></div>
      <div class="readiness-score"><b>${completeness}%</b><span>条件完整度</span></div>
    </div>
    <div class="match-workbench-grid">
      <div class="match-signal-panel">
        <div class="panel-title"><span>当前匹配信号</span><small>基于已配置条件</small></div>
        <div class="match-signal-list">${signals.map((s) => `<div class="match-signal-row"><div class="match-signal-label"><b>${s.label}</b><small>${escapeHtml(s.note)}</small></div><div class="match-signal-track"><i style="width:${s.value}%"></i></div><strong>${s.value}</strong></div>`).join('')}</div>
      </div>
      <div class="match-target-panel">
        <div class="panel-title"><span>目标岗位画像</span><small>实时预览</small></div>
        <div class="target-job-name">${escapeHtml(pref.direction || '未设置岗位方向')}</div>
        <div class="target-job-meta"><span>${escapeHtml(pref.cities.join('、') || '不限城市')}</span><span>${pref.salaryMin || '?'}-${pref.salaryMax || '?'}K</span><span>${escapeHtml(labelOf(JOBTYPES, pref.jobType) || '不限性质')}</span></div>
        <div class="target-skill-cloud">${(pref.mustSkills || []).concat(pref.preferSkills || []).slice(0, 7).map((s, i) => `<span class="target-skill ${i < pref.mustSkills.length ? 'is-must' : ''}">${escapeHtml(s)}</span>`).join('')}</div>
        <div class="target-job-foot"><span><i></i> 已识别 ${profile.skills ? profile.skills.length : 0} 项简历技能</span><span>预计可匹配 ${selected ? selected.score : '—'}%</span></div>
      </div>
    </div>
    <div class="match-workbench-foot"><span>下一步：运行 AI 匹配后，将生成岗位清单、能力缺口和学习路径。</span><button class="btn-sm btn-sm--solid" id="match-workbench-run" type="button">开始生成结果 →</button></div>`;
    const run = $('match-workbench-run');
    if (run) run.addEventListener('click', runMatch);
  }

  function condItem(label, inner, target) {
    return `<div class="cond-item"><span class="cond-item-label">${label}</span>
      <div class="cond-item-val">${inner}</div>
      ${target ? `<button class="cond-item-remove" data-target="${escapeHtml(target)}" title="移除">×</button>` : ''}</div>`;
  }
  function skillItem(skill, level, lvLabel) {
    return `<div class="cond-item"><span class="cond-item-label">${lvLabel}技能</span>
      <div class="cond-item-val"><span class="cond-skill" data-level="${level}" data-skill="${escapeHtml(skill)}">${escapeHtml(skill)} <span class="lv">${lvLabel}</span></span></div>
      <button class="cond-item-remove" data-target="skill:${escapeHtml(skill)}" title="移除">×</button></div>`;
  }

  function addCondition(kind) {
    const st = window.matchState.preferences;
    if (kind === 'city') { st.cities.push('上海'); }
    else if (kind === 'salary') { if (st.salaryMin == null) st.salaryMin = 15; if (st.salaryMax == null) st.salaryMax = 25; }
    else if (kind === 'jobtype') { st.jobType = st.jobType || 'fulltime'; }
    else if (kind === 'must') { if (st.mustSkills.indexOf('Redis') < 0) st.mustSkills.push('Redis'); }
    else if (kind === 'prefer') { if (st.preferSkills.indexOf('Kubernetes') < 0) st.preferSkills.push('Kubernetes'); }
    else if (kind === 'other') { if (st.others.indexOf('弹性工作') < 0) st.others.push('弹性工作'); }
    else if (kind === 'direction') { st.direction = st.direction || 'Java 后端开发'; }
    renderCondBar();
  }
  function removeCondition(target) {
    const st = window.matchState.preferences;
    if (target === 'cities') st.cities = [];
    else if (target === 'salary') { st.salaryMin = null; st.salaryMax = null; }
    else if (target === 'jobtype') st.jobType = '';
    else if (target === 'direction') st.direction = '';
    else if (target.indexOf('other-') === 0) st.others = st.others.filter((x) => x !== target.slice(6));
    else if (target.indexOf('skill:') === 0) {
      const s = target.slice(6);
      st.mustSkills = st.mustSkills.filter((x) => x !== s);
      st.preferSkills = st.preferSkills.filter((x) => x !== s);
    }
    renderCondBar();
  }

  function labelOf(pairs, val) { const p = pairs.find((x) => x[0] === val); return p ? p[1] : ''; }

  /* ---- 技能级别 Popover ---- */
  function openSkillPopover(anchor, skill, anchorEl) {
    const pop = $('wks-popover');
    if (!pop) return;
    const st = window.matchState.preferences;
    const isMust = st.mustSkills.indexOf(skill) >= 0;
    const isPrefer = st.preferSkills.indexOf(skill) >= 0;
    const cur = isMust ? 'must' : (isPrefer ? 'prefer' : 'none');
    pop.innerHTML = `<div class="popover-title">${escapeHtml(skill)} 的要求级别</div>
      <div class="popover-opt ${cur === 'must' ? 'is-on' : ''}" data-lv="must"><span class="radio"></span>必须</div>
      <div class="popover-opt ${cur === 'prefer' ? 'is-on' : ''}" data-lv="prefer"><span class="radio"></span>希望具备</div>
      <div class="popover-opt ${cur === 'none' ? 'is-on' : ''}" data-lv="none"><span class="radio"></span>不限制</div>
      <button class="popover-confirm" type="button">确定</button>`;
    const rect = anchorEl.getBoundingClientRect();
    pop.style.left = Math.min(rect.left, window.innerWidth - 240) + 'px';
    pop.style.top = (rect.bottom + 6) + 'px';
    pop.hidden = false;
    qsa('.popover-opt', pop).forEach((opt) => opt.addEventListener('click', () => {
      const lv = opt.dataset.lv;
      st.mustSkills = st.mustSkills.filter((x) => x !== skill);
      st.preferSkills = st.preferSkills.filter((x) => x !== skill);
      if (lv === 'must') st.mustSkills.push(skill);
      if (lv === 'prefer') st.preferSkills.push(skill);
      qsa('.popover-opt', pop).forEach((o) => o.classList.toggle('is-on', o === opt));
    }));
    pop.querySelector('.popover-confirm').addEventListener('click', () => { pop.hidden = true; renderCondBar(); });
    setTimeout(() => {
      const close = (e) => { if (!pop.contains(e.target) && e.target !== anchorEl) { pop.hidden = true; document.removeEventListener('click', close); } };
      document.addEventListener('click', close);
    }, 0);
  }

  /* ============================================================
   * AI 分析（动态能力构建）
   * ============================================================ */
  const THEATER_STEPS = [
    { t: '简历结构', d: '解析 PDF/文本，分离教育、经历、项目、技能区块。' },
    { t: '教育背景', d: '识别学历层次、专业方向与时间线。' },
    { t: '工作经历', d: '抽取公司、职责、技术栈与量化成果。' },
    { t: '项目经验', d: '定位核心项目与你在其中的技术角色。' },
    { t: '技能体系', d: '归一化技能名称，标注掌握程度与证据。' },
    { t: '能力图谱', d: '将个人能力节点与岗位要求节点建立关系。' },
    { t: '岗位语义', d: '理解目标岗位的隐性要求与优先项。' },
    { t: '匹配推理', d: '计算技能/语义/项目/经验多维度匹配。' },
    { t: '岗位推荐', d: '按匹配度与潜力排序生成岗位清单。' }
  ];

  function runMatch() {
    setView('analysis');
    startTheater();
    diagnoseResume(window.matchState.file).then((res) => {
      window.matchState.result = res;
      finishTheater();
      setTimeout(() => { setView('jobs'); }, reduceMotion() ? 200 : 600);
    }).catch((err) => {
      stopTheater();
      window.showToast('匹配失败：' + (err && err.message ? err.message : '请重试'), 'amber');
    });
  }

  function diagnoseResume(file) {
    // 演示环境固定使用本地数据，避免后端未启动时页面出现空白或失败提示。
    return mockDiagnose();
  }
  function mockDiagnose() { return new Promise((resolve) => setTimeout(() => resolve(structuredClone(MOCK_RESULT)), reduceMotion() ? 180 : 900)); }

  function startTheater() {
    const title = $('analysis-title'); if (title) title.textContent = '正在构建你的能力图谱';
    const bar = $('build-lines'); const pct = $('analysis-pct'); const stepList = $('step-list');
    if (bar) {
      const prof = MOCK_RESULT.profile;
      bar.innerHTML = (prof.skills || []).map((s) => `
        <div class="build-line" data-skill="${escapeHtml(s.name)}">
          <span class="build-line-name">${escapeHtml(s.name)}</span>
          <span class="build-track"><i></i></span>
          <span class="build-line-mark"></span>
        </div>`).join('');
    }
    if (stepList) {
      stepList.innerHTML = THEATER_STEPS.map((s, i) =>
        `<li class="step-item is-todo" data-step="${i}"><span class="step-mark"></span><span>${s.t}</span></li>`).join('');
      qsa('.step-item', stepList).forEach((li) => li.addEventListener('click', () => toggleStepEvi(li)));
    }
    if (pct) pct.textContent = '0%';
    if (window.matchState._theater) clearInterval(window.matchState._theater);
    const total = THEATER_STEPS.length;
    let i = 0;
    const tick = () => {
      if (i >= total) { return; }
      const li = stepList && stepList.children[i];
      qsa('.step-item', stepList).forEach((x, j) => { x.className = 'step-item ' + (j < i ? 'is-done' : (j === i ? 'is-doing' : 'is-todo')); });
      // 能力线逐步接入
      const lines = bar ? qsa('.build-line', bar) : [];
      if (lines[i]) {
        const tr = lines[i].querySelector('.build-track i');
        const mk = lines[i].querySelector('.build-line-mark');
        const sk = (MOCK_RESULT.profile.skills || [])[i % (MOCK_RESULT.profile.skills.length)];
        if (tr) tr.style.width = (sk ? sk.readiness : 60) + '%';
        if (mk) { mk.textContent = '✓'; mk.className = 'build-line-mark is-ok'; }
      }
      if (pct) pct.textContent = Math.round(((i + 1) / total) * 100) + '%';
      i++;
      window.matchState._theater = setTimeout(tick, reduceMotion() ? 120 : 420);
    };
    tick();
  }
  function stopTheater() { if (window.matchState._theater) { clearTimeout(window.matchState._theater); window.matchState._theater = null; } }
  function finishTheater() {
    stopTheater();
    const bar = $('build-lines');
    if (bar) qsa('.build-line', bar).forEach((l, i) => {
      const sk = (MOCK_RESULT.profile.skills || [])[i % (MOCK_RESULT.profile.skills.length)];
      const tr = l.querySelector('.build-track i'); const mk = l.querySelector('.build-line-mark');
      if (tr) tr.style.width = (sk ? sk.readiness : 60) + '%';
      if (mk && !sk) { mk.textContent = '✕'; mk.className = 'build-line-mark is-miss'; l.querySelector('.build-track').classList.add('is-miss'); }
      l.style.cursor = 'pointer';
      l.addEventListener('click', () => openNodeDrawer(sk ? sk.name : 'Docker'));
    });
    const stepList = $('step-list');
    if (stepList) qsa('.step-item', stepList).forEach((x) => { x.className = x.className.replace('is-doing', 'is-done'); });
    const pct = $('analysis-pct'); if (pct) pct.textContent = '100%';
    renderAIPanelAnalysis();
  }
  function toggleStepEvi(li) {
    const i = parseInt(li.dataset.step, 10);
    const s = THEATER_STEPS[i];
    let evi = li.nextElementSibling;
    if (evi && evi.classList.contains('step-evi')) { evi.classList.toggle('is-open'); return; }
    evi = document.createElement('div'); evi.className = 'step-evi'; evi.innerHTML = `<b>${s.t}</b><br>${escapeHtml(s.d)}`;
    li.insertAdjacentElement('afterend', evi);
    evi.classList.add('is-open');
  }

  /* ============================================================
   * STATE 4 · 岗位推荐（高密度列表）
   * ============================================================ */
  function bindJobs() {
    const filterBox = $('jobs-filter');
    if (filterBox) filterBox.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip'); if (!chip) return;
      const f = chip.dataset.filter; const v = chip.dataset.value;
      if (f === 'tab') { setJobsTab(v); }
      if (f === 'city') { /* 简化：仅高亮 */ }
    });
    const tabs = $('jobs-tabs');
    if (tabs) qsa('.jobs-tab', tabs).forEach((t) => t.addEventListener('click', () => {
      qsa('.jobs-tab', tabs).forEach((x) => x.classList.toggle('active', x === t));
      setJobsTab(t.dataset.recTab);
    }));
    const sort = $('jobs-sort');
    if (sort) sort.addEventListener('change', () => renderJobs());
  }

  function setJobsTab(tab) {
    const st = window.matchState;
    if (tab === 'now') st.recommendTab = 'now';
    else if (tab === 'future') st.recommendTab = 'future';
    else if (tab === 'top') st.recommendTab = 'top';
    else if (tab === 'high') st.recommendTab = 'high';
    renderJobs();
  }

  function getFilteredJobs() {
    const st = window.matchState; const res = st.result || MOCK_RESULT;
    let list = (res.matches || []).slice();
    const tab = st.recommendTab;
    if (tab === 'now') list = list.filter((m) => m.tab === 'now');
    else if (tab === 'future') list = list.filter((m) => m.tab === 'future');
    else if (tab === 'top') { /* 全部按匹配度 */ }
    else if (tab === 'high') list = list.slice().sort((a, b) => salaryNum(b.job.salary) - salaryNum(a.job.salary));
    if (tab !== 'high') list = list.slice().sort((a, b) => b.score - a.score);
    const sort = $('jobs-sort') ? $('jobs-sort').value : 'match';
    if (sort === 'salary') list = list.slice().sort((a, b) => salaryNum(b.job.salary) - salaryNum(a.job.salary));
    else if (sort === 'city') list = list.slice().sort((a, b) => a.job.city.localeCompare(b.job.city));
    return list;
  }
  function salaryNum(s) { const m = String(s || '').match(/(\d+)/g); return m ? parseInt(m[m.length - 1], 10) : 0; }

  function renderJobs() {
    const res = window.matchState.result || MOCK_RESULT;
    const list = $('jobs-list'); if (!list) return;
    const jobs = getFilteredJobs();
    const pref = window.matchState.preferences;
    // 筛选 chips
    const filterBox = $('jobs-filter');
    if (filterBox) filterBox.innerHTML = [
      `<span class="chip" data-filter="tab" data-value="now" style="opacity:.6">城市 ${pref.cities.join('/') || '全部'}</span>`,
      `<span class="chip" data-filter="tab" data-value="now" style="opacity:.6">薪资 ${pref.salaryMin || '?'}-${pref.salaryMax || '?'}K</span>`,
      `<span class="chip" data-filter="tab" data-value="now" style="opacity:.6">方向 ${escapeHtml(pref.direction || '全部')}</span>`
    ].join('');

    list.innerHTML = jobs.map((m) => {
      const g = m.gaps || [];
      const isFav = !!window.matchState.favJobs[m.job.id];
      return `<div class="job-row" data-job="${m.job.id}">
        <button class="job-fav ${isFav ? 'is-fav' : ''}" data-fav="${m.job.id}" title="收藏">${isFav ? '★' : '☆'}</button>
        <div class="job-main">
          <div class="job-title-row"><span class="job-title">${escapeHtml(m.job.title)}</span></div>
          <div class="job-co">${escapeHtml(m.job.company)} · ${escapeHtml(m.job.city)} · ${escapeHtml(m.job.salary)} · ${escapeHtml(m.job.type || '全职')}</div>
          <div class="job-meta"><span class="mod-tag mod-tag--ok" style="padding:1px 7px">+${m.matched.length} 强匹配</span><span class="job-pill job-pill--gap">${m.missing.length} 能力缺口</span></div>
        </div>
        <div class="job-match-badge"><span class="job-match-num">${m.score}</span><span class="job-match-lbl">% MATCH</span></div>
        <div class="job-skills">${g.slice(0, 4).map((s) => `<div class="job-skill-mini"><span class="nm">${escapeHtml(s.skill)}</span><span class="bar"><i style="width:${s.readiness}%"></i></span><span class="v">${s.readiness}</span></div>`).join('')}</div>
        <div class="job-tags"><span class="job-go">查看岗位分析 →</span></div>
      </div>`;
    }).join('') || `<div class="aip-empty">该筛选下暂无岗位</div>`;

    qsa('.job-row', list).forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.job-fav')) return;
        window.matchState.selectedJobId = row.dataset.job;
        qsa('.job-row', list).forEach((r) => r.classList.remove('is-selected'));
        row.classList.add('is-selected');
        // 视图未变（仍在 jobs 视图），仅刷新右栏详情，避免重建列表闪烁
        if (typeof renderDetail === 'function') renderDetail();
      });
    });
    qsa('.job-fav', list).forEach((f) => f.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = f.dataset.fav;
      window.matchState.favJobs[id] = !window.matchState.favJobs[id];
      f.classList.toggle('is-fav', window.matchState.favJobs[id]);
      f.textContent = window.matchState.favJobs[id] ? '★' : '☆';
    }));
    // 按 selectedJobId 高亮（若在当前过滤列表中）
    const targetId = window.matchState.selectedJobId;
    if (targetId) {
      const hit = qs('.job-row[data-job="' + (window.CSS && CSS.escape ? CSS.escape(targetId) : String(targetId).replace(/"/g, '\\"')) + '"]', list);
      if (hit) hit.classList.add('is-selected');
    }
    renderAIPanelJobs(jobs[0]);
    if (typeof renderDetail === 'function') renderDetail();
  }

  /* ============================================================
   * STATE 5 · 岗位详情（三栏 + 图谱）
   * ============================================================ */
  function bindDetail() {
    const tabs = $('jobs-detail-tabs');
    if (tabs) {
      qsa('.jd-tab', tabs).forEach((t) => t.addEventListener('click', () => {
        const key = t.dataset.jdTab;
        qsa('.jd-tab', tabs).forEach((x) => x.classList.toggle('is-active', x === t));
        const pane = $('jobs-detail-pane');
        if (pane) qsa('.jd-pane', pane).forEach((p) => p.classList.toggle('is-active', p.dataset.jdPane === key));
      }));
    }
  }

  function getSelectedJob() {
    const res = window.matchState.result || MOCK_RESULT;
    return (res.matches || []).find((m) => m.job.id === window.matchState.selectedJobId) || res.matches[0];
  }

  function renderDetail() {
    const m = getSelectedJob(); if (!m) return;
    const job = m.job || {};
    const tEl = $('detail-job-title'); if (tEl) tEl.textContent = job.title || '岗位详情';
    const sEl = $('detail-job-score'); if (sEl) sEl.textContent = (m.score || 0) + '%';
    renderDetailInfoPane(m, job);
    renderDetailResumePane(m, job);
    renderDetailInterviewPane(m, job);
    renderAIPanelDetail(m);
  }

  function renderDetailInfoPane(m, job) {
    const el = $('jd-pane-info'); if (!el) return;
    const res = window.matchState.result || MOCK_RESULT;
    const summary = (res.job_analysis && res.job_analysis.job_summary) || '暂无岗位摘要。';
    const reqs = (job.required_skills || []).concat((job.preferred_skills || []).map((s) => s + '（优先）'));
    const duty = '负责核心业务系统的需求分析、方案设计与编码实现；\n参与高并发、高可用架构的落地与演进，保障系统稳定运行；\n与产品、测试、前端协作完成迭代交付，参与 Code Review；\n持续优化性能与工程质量，沉淀可复用的组件与最佳实践。';
    el.innerHTML = `
      <div class="jd-info-grid">
        <div class="jd-info-col jd-info-col--text">
          <div class="detail-section-title">岗位基本信息</div>
          <div class="detail-kv"><span class="k">公司</span><span>${escapeHtml(job.company || '—')}</span></div>
          <div class="detail-kv"><span class="k">地区</span><span>${escapeHtml(job.city || '—')}</span></div>
          <div class="detail-kv"><span class="k">薪资</span><span>${escapeHtml(job.salary || '—')}</span></div>
          <div class="detail-kv"><span class="k">性质</span><span>${escapeHtml(job.type || '全职')}</span></div>
          <div class="detail-kv"><span class="k">经验</span><span>${escapeHtml(job.exp || '0-3年')}</span></div>
          <div class="detail-kv"><span class="k">学历</span><span>本科及以上</span></div>
          <div class="detail-kv"><span class="k">到岗时间</span><span>1 周内到岗</span></div>

          <div class="detail-section-title mt">岗位要求</div>
          <div class="detail-req">${reqs.map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join('')}</div>
          <p class="jd-req-hint">优先项已标注「（优先）」，面试前可针对性准备对应场景题。</p>

          <div class="detail-section-title mt">岗位职责</div>
          <div class="jd-duty">${duty.split('\n').map((l) => `<div class="jd-duty-li">· ${escapeHtml(l)}</div>`).join('')}</div>

          <div class="detail-section-title mt">JD 摘要</div>
          <div class="aip-p">${escapeHtml(summary)}</div>

          <div class="detail-section-title mt">福利待遇</div>
          <div class="jd-welfare">五险一金 · 补充医疗 · 弹性工作 · 年度调薪 · 节日礼包 · 免费午餐</div>

          <div class="jd-pane-actions">
            <button class="btn-sm btn-sm--ghost" id="jd-learn-btn" type="button">生成学习路径 →</button>
          </div>
        </div>
        <div class="jd-info-col jd-info-col--graph">
          <div class="detail-section-title">能力图谱 · 你 vs 岗位</div>
          <div id="detail-graph"></div>
          <p class="jd-graph-tip">左侧为你的能力值，右侧为岗位要求，缺口技能可直接纳入学习路径。</p>
        </div>
      </div>`;
    renderCapabilityGraph($('detail-graph'), m);
    const lb = $('jd-learn-btn'); if (lb) lb.addEventListener('click', () => openLearningProfile());
  }

  function renderDetailResumePane(m, job) {
    const el = $('jd-pane-resume'); if (!el) return;
    const ev = m.evidences || {};
    const matched = ev.matched || (m.matched || []).map((t) => ({ t: t, d: '' }));
    const missing = ev.missing || (m.missing || []).map((t) => ({ t: t, d: '' }));
    const gaps = (m.gaps || []).filter((g) => g.readiness < 70);
    el.innerHTML = `
      <div class="jd-resume-cols">
        <div class="jd-resume-card">
          <div class="detail-section-title" style="color:var(--ok)">✓ 适配的地方</div>
          ${matched.map((x) => `<div class="detail-reason ok"><span class="mk">✓</span><div><b>${escapeHtml(x.t)}</b>${x.d ? '<div class="jd-sub">' + escapeHtml(x.d) + '</div>' : ''}</div></div>`).join('')}
          <div class="jd-summary-line ok-line">你的核心技能与岗位要求重合度高，面试时优先讲清这些项目的真实细节与量化结果。</div>
        </div>
        <div class="jd-resume-card jd-resume-card--gap">
          <div class="detail-section-title" style="color:var(--rose)">! 不足的地方</div>
          ${missing.map((x) => `<div class="detail-reason bad"><span class="mk">!</span><div><b>${escapeHtml(x.t)}</b>${x.d ? '<div class="jd-sub">' + escapeHtml(x.d) + '</div>' : ''}</div></div>`).join('')}
          ${gaps.length ? '<div class="detail-section-title mt">能力缺口</div>' + gaps.map((g) => `<div class="job-skill-mini" style="margin-top:6px"><span class="nm">${escapeHtml(g.skill)}</span><span class="bar"><i style="width:${g.readiness}%"></i></span><span class="v">${g.readiness}</span></div>`).join('') : ''}
          <div class="jd-summary-line bad-line">建议按「面试常问 → 上线常用」的优先级，先补强前两项能力缺口。</div>
        </div>
      </div>
      <div class="jd-excellent">
        <div class="detail-section-title" style="margin-top:14px">推荐优秀简历</div>
        <div class="jd-excellent-card">
          <div>
            <b>${escapeHtml(job.title || '岗位')} · 标杆简历</b>
            <p>参考同岗位高分简历的项目写法、技能排序与量化表达，补齐你的表述短板；也可点击标杆中的高亮亮点，一键同步到你的简历。</p>
          </div>
          <button class="btn-sm btn-sm--solid" id="jd-excellent-btn" type="button">查看优秀简历 →</button>
        </div>
      </div>`;
    const eb = $('jd-excellent-btn'); if (eb) eb.addEventListener('click', openBenchmark);
  }

  function renderDetailInterviewPane(m, job) {
    const el = $('jd-pane-interview'); if (!el) return;
    const qs = buildInterviewQuestions(m, job);
    el.innerHTML = `
      <div class="detail-section-title">面试常问题</div>
      <div class="jd-iv-list">
        ${qs.map((q) => `<div class="jd-iv-q"><span class="qt">${escapeHtml(q.tag)}</span><span class="qx">${escapeHtml(q.q)}</span></div>`).join('')}
        <div class="jd-iv-tips">
          <div class="jd-iv-tip"><b>准备贴士</b></div>
          <div class="jd-iv-tip">· 自我介绍准备 1 分钟与 3 分钟两个版本，突出与岗位的匹配点。</div>
          <div class="jd-iv-tip">· 项目经历用「背景—行动—结果」结构，量化指标随口可答。</div>
          <div class="jd-iv-tip">· 结尾准备 2-3 个反问问题，展现你对岗位与团队的思考。</div>
        </div>
      </div>
      <div class="jd-iv-cta">
        <button class="btn-sm btn-sm--solid btn-lg" id="jd-interview-btn" type="button">▶ 开始模拟面试</button>
        <span class="jd-iv-hint">AI 将基于该岗位要求实时提问，并给出回答评估</span>
      </div>`;
    const ib = $('jd-interview-btn'); if (ib) ib.addEventListener('click', openInterview);
  }

  function buildInterviewQuestions(m, job) {
    const jobTitle = job.title || '该岗位';
    const list = [];
    list.push({ tag: '通用', q: '请用 1 分钟做自我介绍，并说明为什么投递「' + jobTitle + '」。' });
    list.push({ tag: '岗位', q: '你如何理解「' + jobTitle + '」的核心职责与考核指标？' });
    list.push({ tag: '公司', q: '你为什么选择我们公司？对业务方向或技术栈做过哪些了解？' });
    (m.gaps || []).filter((g) => g.readiness < 70).slice(0, 3).forEach((g) => {
      list.push({ tag: '补强·' + g.skill, q: '请描述一次你在「' + g.skill + '」上的实践，遇到过什么难点，又是如何解决的？' });
    });
    (job.required_skills || []).slice(0, 3).forEach((s) => {
      list.push({ tag: '技术·' + s, q: '「' + s + '」你最熟悉的框架/工具是什么？讲一个真实项目用法与踩坑经历。' });
    });
    list.push({ tag: '场景', q: '如果线上接口突然变慢，你会按什么顺序排查？（请结合你的技术栈展开）' });
    list.push({ tag: '项目', q: '讲一个你最有成就感的项目：你的角色、技术难点、结果与复盘。' });
    list.push({ tag: '规划', q: '你未来 1-2 年的职业规划是什么？希望如何成长？' });
    list.push({ tag: '薪资', q: '你的期望薪资范围是多少？说明一下理由。' });
    list.push({ tag: '反问', q: '你还有什么想问我们的？（提前准备 2-3 个高质量反问）' });
    return list;
  }

  /* ---- 能力图谱（SVG） ---- */
  function renderCapabilityGraph(container, m) {
    if (!container) return;
    const skills = (m.gaps || []);
    const W = 360, H = 260;
    // 左列：个人能力；中列：岗位要求；右列：缺口/学习
    const left = skills.map((s) => ({ type: 'cap', name: s.skill, val: s.readiness }));
    const right = skills.map((s) => ({ type: s.readiness < 60 ? 'gap' : 'req', name: s.skill, val: s.readiness }));
    const colX = [70, 180, 290];
    const nodeY = (i) => 40 + i * (180 / Math.max(1, skills.length - 1 || 1));
    let nodes = '';
    let edges = '';
    left.forEach((n, i) => {
      const y = 30 + i * (200 / Math.max(1, left.length));
      const leftKey = 'l_' + n.name;
      nodes += gnode(colX[0], y, n.name, n.type, n.val, false, leftKey);
      const ry = 30 + i * (200 / Math.max(1, right.length));
      const r = right[i];
      const rightKey = 'r_' + r.name;
      edges += `<line class="gedge" data-from="${leftKey}" data-to="${rightKey}" x1="${colX[0] + 22}" y1="${y}" x2="${colX[2] - 22}" y2="${ry}" />`;
      nodes += gnode(colX[2], ry, r.name, r.type, r.val, true, rightKey);
    });
    // 中间岗位要求节点（虚线列）
    nodes += `<text x="${colX[1]}" y="20" text-anchor="middle" class="gnode-meta">岗位要求</text>`;
    container.innerHTML = `<div class="graph-wrap"><svg class="graph-svg" viewBox="0 0 ${W} ${H}" id="cap-graph-svg">${edges}${nodes}</svg></div>`;
    const svg = container.querySelector('svg');
    qsa('.gnode', svg).forEach((g) => g.addEventListener('click', () => {
      const name = g.dataset.name;
      qsa('.gnode', svg).forEach((x) => x.classList.toggle('is-hl', x === g));
      qsa('.gedge', svg).forEach((e) => e.classList.toggle('is-hl', e.dataset.from === g.dataset.idx || e.dataset.to === g.dataset.idx));
      openNodeDrawer(name);
    }));
  }
  function gnode(x, y, name, type, val, isRight, idxKey) {
    const fill = type === 'gap' ? '#f8e9eb' : (isRight ? '#e6f3ec' : '#fff');
    const stroke = type === 'gap' ? '#c84c5a' : (isRight ? '#3f9d6d' : '#202231');
    return `<g class="gnode" data-name="${escapeHtml(name)}" data-idx="${escapeHtml(idxKey)}" data-type="${type}">
      <circle cx="${x}" cy="${y}" r="20" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <text x="${x}" y="${y + 4}" text-anchor="middle">${escapeHtml(shortName(name))}</text>
      <text x="${x}" y="${y + 34}" text-anchor="middle" class="gnode-meta">${val}%</text>
    </g>`;
  }
  function shortName(n) { return n.length > 5 ? n.slice(0, 4) + '…' : n; }

  /* ---- 能力节点 Drawer ---- */
  function bindDrawers() {
    const close = $('node-drawer-close'); if (close) close.addEventListener('click', closeNodeDrawer);
    const mask = $('node-drawer-mask'); if (mask) mask.addEventListener('click', closeNodeDrawer);
  }
  function closeNodeDrawer() {
    const d = $('node-drawer'); const m = $('node-drawer-mask');
    if (d) d.hidden = true; if (m) m.hidden = true;
  }
  function openNodeDrawer(skillName) {
    const res = window.matchState.result || MOCK_RESULT;
    const prof = res.profile; const sk = (prof.skills || []).find((s) => s.name === skillName) || { name: skillName, level: '未掌握', evidence: '未识别到直接证据', readiness: 41, theory: 62, practice: 18 };
    const m = getSelectedJob();
    const title = $('node-drawer-title'); if (title) title.textContent = skillName;
    const body = $('node-drawer-body');
    if (body) body.innerHTML = `
      <div class="dnode-level">
        <span class="big">${sk.readiness}%</span>
        <div class="dnode-prog">
          <div class="aip-metric-row" style="margin:0"><span>理论认知</span><span class="bar"><i style="width:${sk.theory || 60}%"></i></span><span class="v">${sk.theory || 60}</span></div>
          <div class="aip-metric-row" style="margin:8px 0 0"><span>项目实践</span><span class="bar"><i style="width:${sk.practice || 20}%"></i></span><span class="v">${sk.practice || 20}</span></div>
        </div>
      </div>
      <div class="dnode-sec"><div class="aip-kicker">岗位要求</div><div class="aip-p">${(m && m.job.required_skills.indexOf(skillName) >= 0) ? '必须具备' : '非核心要求，建议补充'}</div></div>
      <div class="dnode-sec"><div class="aip-kicker">证据来源</div>
        <div class="dnode-row ok"><span class="mk">✓</span><span>简历出现 ${escapeHtml(skillName)}</span></div>
        <div class="dnode-row ${sk.practice > 40 ? 'ok' : 'no'}"><span class="mk">${sk.practice > 40 ? '✓' : '✕'}</span><span>发现 ${escapeHtml(skillName)} 项目</span></div>
        <div class="dnode-row no"><span class="mk">✕</span><span>未发现相关部署实践</span></div>
      </div>
      <div class="dnode-sec"><div class="aip-kicker">简历证据</div><div class="dnode-evi">"${escapeHtml(sk.evidence || '')}"</div></div>
      <div class="aip-kicker">推荐学习路径</div>
      <div class="dnode-path">
        ${(res.learning_path || []).filter((l) => l.skill === skillName).map((l) => `<div class="dnode-path-step"><span>${escapeHtml(l.title)}</span><span class="arrow">→</span><span class="muted">${escapeHtml(l.schedule)}</span></div>`).join('') || `<div class="dnode-path-step"><span>Linux</span><span class="arrow">→</span><span>${escapeHtml(skillName)} 基础</span></div><div class="dnode-path-step"><span>${escapeHtml(skillName)} 基础</span><span class="arrow">→</span><span>项目实践</span></div>`}
      </div>
      <button class="btn-sm btn-sm--solid dnode-cta" id="drawer-gen-learn" type="button">生成学习路径</button>`;
    const gl = $('drawer-gen-learn'); if (gl) gl.addEventListener('click', () => { closeNodeDrawer(); openLearningProfile(); });
    const d = $('node-drawer'); const mask = $('node-drawer-mask');
    if (d) d.hidden = false; if (mask) mask.hidden = false;
    renderAIPanelNode(sk, m);
  }

  /* ============================================================
   * STATE 6 · 学习路径（垂直 timeline + WhatIf）
   * ============================================================ */
  function bindLearning() { /* 事件在 render 内绑定 */ }

  function renderLearning() {
    const res = window.matchState.result || MOCK_RESULT;
    const m = getSelectedJob();
    const title = $('learn-title'); if (title) title.textContent = m ? (m.job.title + ' · 学习路径') : '学习路径';
    const tl = $('learn-timeline'); if (!tl) return;
    const whatifSkills = Object.keys(window.matchState.whatif).filter((k) => window.matchState.whatif[k]);
    let path = (res.learning_path || []).filter((l) => !whatifSkills.length || whatifSkills.indexOf(l.skill) >= 0 || window.matchState.whatif[l.skill] !== false);
    if (!path.length) path = res.learning_path || [];
    tl.innerHTML = path.map((l) => `
      <div class="learn-node" data-skill="${escapeHtml(l.skill)}">
        <div class="learn-node-top"><span class="learn-node-title">${escapeHtml(l.title)}</span>
          <span class="learn-meta-up">${l.from}% → ${l.to}%</span></div>
        <div class="learn-node-meta">
          <span class="learn-meta-tag">⏱ ${escapeHtml(l.schedule)}</span>
          <span class="learn-meta-tag">难度 ${escapeHtml(l.level)}</span>
          <span class="learn-meta-tag">${escapeHtml(l.way)}</span>
          <span class="learn-meta-tag">${escapeHtml(l.skill)}</span>
        </div>
        <div class="learn-node-desc">${escapeHtml(l.description)}</div>
        <div class="learn-node-actions"><button class="btn-sm btn-sm--solid" type="button">开始学习</button></div>
      </div>`).join('');
    // WhatIf 面板（含尾部 LEARNING IMPACT 块，整体重建避免重复拼接）
    renderWhatIf();
  }

  /* ============================================================
   * 学习画像悬浮窗（知识掌握图谱 + AI 判断）
   * ============================================================ */
  function openLearningProfile() {
    const modal = $('rp-modal'); if (!modal) return;
    const res = window.matchState.result || MOCK_RESULT;
    const m = getSelectedJob();
    if (!m) { if (typeof showToast === 'function') showToast('请先选择一个岗位', 'amber'); return; }
    renderLearningProfile(m, res);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLearningProfile() {
    const modal = $('rp-modal'); if (modal) modal.hidden = true;
    document.body.style.overflow = '';
  }

  function bindLearningProfile() {
    const modal = $('rp-modal'); if (!modal) return;
    const close = $('rp-close'); if (close) close.addEventListener('click', closeLearningProfile);
    const mask = modal.querySelector('.rp-mask'); if (mask) mask.addEventListener('click', closeLearningProfile);
    const plan = $('rp-plan-btn'); if (plan) plan.addEventListener('click', () => { closeLearningProfile(); setView('learn'); });
    document.addEventListener('keydown', (e) => { if (modal && !modal.hidden && e.key === 'Escape') closeLearningProfile(); });
  }

  function renderLearningProfile(m, res) {
    const job = m.job || {};
    const gaps = m.gaps || [];
    const matched = Array.isArray(m.matched) ? m.matched : [];
    const path = res.learning_path || [];

    const allVals = [...matched.map(() => 88), ...gaps.map((g) => g.readiness)];
    const overall = allVals.length ? Math.round(allVals.reduce((a, b) => a + b, 0) / allVals.length) : (m.score || 0);

    const titleEl = $('rp-title'); if (titleEl) titleEl.textContent = (job.title || '岗位') + ' · 学习画像';
    const timeEl = $('rp-ai-time'); if (timeEl) timeEl.textContent = new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const oEl = $('rp-overall'); if (oEl) oEl.textContent = overall + '%';
    const oHint = $('rp-overall-hint'); if (oHint) oHint.textContent = overall >= 80 ? '优秀' : (overall >= 40 ? '中等' : '需加强');
    const cEl = $('rp-confidence'); if (cEl) cEl.textContent = '94%';

    const ev = $('rp-evidence');
    if (ev) ev.innerHTML = '<span class="rp-ev-chip">✓ 提及次数 ' + (path.length || 1) + ' 次</span><span class="rp-ev-chip">✓ 举例深度</span><span class="rp-ev-chip">✓ 已评估 ' + (gaps.length + matched.length) + ' 个知识点</span>';

    const firstGap = gaps[0];
    const evalEl = $('rp-eval');
    const evalSkill = $('rp-evalskill');
    if (evalEl) {
      if (firstGap) {
        const sk = firstGap.skill;
        if (evalSkill) evalSkill.textContent = '薄弱技能评估 · ' + sk;
        evalEl.innerHTML = '「' + escapeHtml(sk) + '」在岗位要求中出现频次较高，但你的简历中缺少项目级实践证据。当前掌握度来自知识图谱诊断，参考学习路径与岗位匹配缺口。';
      } else {
        if (evalSkill) evalSkill.textContent = '薄弱技能评估';
        evalEl.textContent = '暂无明显薄弱点，继续保持练习。';
      }
    }
    const relEl = $('rp-rel');
    if (relEl) {
      if (firstGap) {
        const sk = firstGap.skill;
        relEl.innerHTML = '<div><b>关联</b>：' + escapeHtml(sk) + ' 与 Java / Spring Boot 等核心技能强相关</div><div><b>外联</b>：基于岗位的整体评估，建议按学习路径优先补齐</div>';
      } else {
        relEl.innerHTML = '';
      }
    }

    const nextSkillEl = $('rp-next-skill');
    const nextPctEl = $('rp-next-pct');
    const nextStepsEl = $('rp-next-steps');
    if (firstGap) {
      if (nextSkillEl) nextSkillEl.textContent = firstGap.skill + ' · 基本关系';
      if (nextPctEl) nextPctEl.textContent = firstGap.readiness + '%';
      if (nextStepsEl) {
        const lp = path.filter((l) => l.skill === firstGap.skill);
        const item = lp[0];
        const steps = (item && item.steps) || [
          { name: '概念讲解与例题', min: 60 },
          { name: '针对性练习', min: 30 },
          { name: '错题复盘与关联迁移', min: 30 }
        ];
        nextStepsEl.innerHTML = steps.map((s) => '<div class="rp-next-step"><span class="rp-next-check">✓</span><span class="rp-next-step-name">' + escapeHtml(s.name) + '</span><span class="rp-next-step-time">约 ' + (s.min || 30) + ' 分钟</span></div>').join('');
      }
    } else {
      if (nextSkillEl) nextSkillEl.textContent = '继续保持';
      if (nextPctEl) nextPctEl.textContent = overall + '%';
      if (nextStepsEl) nextStepsEl.innerHTML = '';
    }

    renderLearningGraph($('rp-graph'), job, gaps, matched);
  }

  function renderLearningGraph(container, job, gaps, matched) {
    if (!container) return;
    const allNodes = [];
    gaps.forEach((g) => allNodes.push({ name: g.skill, val: g.readiness, type: 'gap' }));
    matched.forEach((t, i) => allNodes.push({ name: typeof t === 'string' ? t : (t.t || ''), val: 86 + (i % 9), type: 'match' }));
    const group = (val) => val < 40 ? 'tl' : (val < 65 ? 'tr' : (val < 80 ? 'bl' : 'br'));
    const quads = { tl: [], tr: [], bl: [], br: [] };
    allNodes.forEach((n) => quads[group(n.val)].push(n));
    const positions = [];
    const place = (quad, baseX, baseY) => {
      const arr = quads[quad];
      arr.forEach((n, i) => {
        const idx = i - (arr.length - 1) / 2;
        const x = baseX + idx * 110;
        const y = baseY + (i % 2 === 0 ? 0 : 18);
        positions.push({ ...n, x: Math.max(70, Math.min(690, x)), y: Math.max(70, Math.min(470, y)) });
      });
    };
    place('tl', 220, 150);
    place('tr', 540, 150);
    place('bl', 220, 410);
    place('br', 540, 410);

    const color = (val) => val < 40 ? '#c84c5a' : (val < 80 ? '#e8a13a' : '#2faa6a');
    let edges = '';
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i], b = positions[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 260) {
          edges += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="#e8a13a" stroke-width="1" stroke-dasharray="4 3" opacity=".7"/>';
        }
      }
    }

    const nodes = positions.map((n) => {
      const r = n.val >= 90 ? 28 : 24;
      const label = escapeHtml(n.name).slice(0, 6);
      return '<g class="rp-node" data-skill="' + escapeHtml(n.name) + '" transform="translate(' + n.x + ',' + n.y + ')">' +
        '<circle r="' + r + '" fill="' + color(n.val) + '" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/>' +
        '<text text-anchor="middle" dy="-2" fill="#fff" font-size="10" font-weight="600">' + label + '</text>' +
        '<text text-anchor="middle" dy="11" fill="#fff" font-size="9" opacity=".85">' + n.val + '%</text>' +
        '</g>';
    }).join('');

    const centerName = escapeHtml(job.title || '岗位').slice(0, 6);
    const centerSVG = '<g transform="translate(380,270)">' +
      '<circle r="42" fill="#c84c5a" stroke="rgba(255,255,255,.5)" stroke-width="2"/>' +
      '<text text-anchor="middle" dy="-2" fill="#fff" font-size="13" font-weight="700">' + centerName + '</text>' +
      '<text text-anchor="middle" dy="13" fill="#fff" font-size="10" opacity=".9">核心</text>' +
      '</g>';

    container.innerHTML = '<svg viewBox="0 0 760 540" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">' + edges + nodes + centerSVG + '</svg>';
  }

  function renderWhatIf() {
    const res = window.matchState.result || MOCK_RESULT;
    const m = getSelectedJob();
    const aip = $('aip-body');
    if (!aip || !m) return;
    const allSkills = Array.from(new Set((m.gaps || []).map((g) => g.skill)));
    const cur = m.score;
    // 计算预测：勾选的技能按学习路径 to 值提升
    const whatif = window.matchState.whatif;
    let predicted = cur;
    allSkills.forEach((s) => {
      if (whatif[s]) {
        const lp = (res.learning_path || []).filter((l) => l.skill === s);
        if (lp.length) { const last = lp[lp.length - 1]; predicted += Math.round((last.to - (m.gaps.find((g) => g.skill === s) || { readiness: cur }).readiness) * 0.18); }
      }
    });
    predicted = Math.min(99, predicted);
    // 整体重建学习视图 AI 面板（避免重复拼接）
    aip.innerHTML = `<div class="aip-block" id="whatif-block">
      <div class="aip-kicker">WHAT-IF 能力预测</div>
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px">
        <span class="aip-h" style="font-size:22px;color:var(--rose)">${cur}%</span>
        <span style="color:var(--ink-faint)">→</span>
        <span class="aip-h" id="whatif-pred" style="font-size:22px;color:var(--ok)">${predicted}%</span>
      </div>
      <div class="aip-p" style="margin-bottom:8px">勾选你想补齐的能力，实时估算匹配度提升：</div>
      <div id="whatif-chips">${allSkills.map((s) => `<span class="chip ${whatif[s] ? 'is-on' : ''}" data-whatif="${escapeHtml(s)}" style="margin-bottom:5px">${whatif[s] ? '☑' : '☐'} ${escapeHtml(s)}</span>`).join('')}</div>
    </div>
    <div class="aip-block" id="learn-aip-foot">
      <div class="aip-kicker">LEARNING IMPACT</div>
      <div class="aip-p">完成当前路径预计将 <b>${cur}%</b> 的匹配度提升至 <b>${Math.min(99, cur + 8)}%</b>。勾选上方 What-if 可自定义预测。</div>
      <span class="aip-link" id="aip-tocompare">→ 查看优秀简历对比</span>
    </div>`;
    qsa('#whatif-chips .chip', aip).forEach((c) => c.addEventListener('click', () => {
      const s = c.dataset.whatif; window.matchState.whatif[s] = !window.matchState.whatif[s];
      renderLearning();
    }));
    const t = $('aip-tocompare'); if (t) t.addEventListener('click', () => setView('compare'));
  }

  /* ============================================================
   * STATE 7 · 优秀简历对比（纸质版双栏悬浮窗）
   * ============================================================ */
  // 标杆简历中“你缺失的亮点”关键词 → 绿色部分高亮（不整段）
  const GOOD_HL = ['高级', '可一周内到岗', 'GPA 3.7', '一等奖学金', 'Docker', 'Kubernetes', '微服务', '千万级', '分布式', '容器化', 'CI/CD', 'QPS', '性能优化', '大厂', 'Redis', '并发', '上线'];

  function buildGoodResumeSections() {
    return [
      { id: 'basic', label: '个人信息', content: '张三\n高级 Java 后端开发工程师\n电话：138-0000-0000 · 邮箱：zhangsan@corp.com · 现居上海 · 可一周内到岗' },
      { id: 'education', label: '教育经历', content: '某大学 · 计算机科学与技术 · 本科（GPA 3.7/4.0）\n2019.09 - 2023.06\n主修：数据结构、操作系统、数据库、计算机网络；连续三年一等奖学金' },
      { id: 'projects', label: '项目经历', content: '1. 亿级流量交易中台（Java/Spring Boot/Docker/Kubernetes）：主导核心链路开发，完成微服务拆分与容器化上线，支撑日均千万级调用。\n2. Redis 缓存架构改造：设计多级缓存与热点探测，QPS 提升 5 倍，接口 P99 延迟下降 60%。\n3. 分布式任务调度系统：基于分布式锁与消息队列实现海量任务调度，并发处理 10w+ 任务/分钟，月度 0 事故。' },
      { id: 'work', label: '工作经历', content: '某互联网大厂 · Java 后端开发工程师\n2023.07 - 至今\n主导 Docker 容器化与 Kubernetes 编排落地，推动 CI/CD 流水线建设；负责高并发接口性能优化，推动多项 SRE 指标达标。' },
      { id: 'skills', label: '专业技能', content: 'Java（精通）、Spring Boot（精通）、MySQL（熟练）、Redis（熟练）、Docker（熟练）、Kubernetes（熟练）、微服务（熟练）、分布式（熟悉）、并发编程（熟练）' },
      { id: 'summary', label: '自我评价', content: '4 年 Java 后端开发经验，深耕高并发、分布式与微服务架构；主导多个千万级流量系统性能优化与容器化落地，具备从 0 到 1 的分布式系统设计能力。' }
    ];
  }

  function openBenchmark() {
    const modal = $('rb-modal'); if (!modal) return;
    const mine = $('rb-paper-mine');
    const good = $('rb-paper-good');
    const st = window.matchState;
    if (!st.resumeSections) st.resumeSections = buildDefaultResumeSections();
    if (!st.adoptedBenchmark) st.adoptedBenchmark = [];
    const mySecs = st.resumeSections;
    const goodSecs = buildGoodResumeSections();
    if (mine) mine.innerHTML = renderPaperHTML(mySecs, st.adoptedBenchmark);
    if (good) good.innerHTML = renderPaperHTML(goodSecs, GOOD_HL);
    // 点击标杆亮点 → 一键添加到左侧“我的简历”
    qsa('#rb-paper-good mark.hl-good').forEach((mk) => {
      mk.classList.add('is-clickable');
      mk.addEventListener('click', () => {
        const secId = mk.dataset.section;
        const txt = mk.dataset.add;
        if (!secId || !txt || mk.classList.contains('is-adopted')) return;
        const added = adoptBenchmarkTerm(secId, txt);
        if (added) {
          if (!st.adoptedBenchmark.includes(txt)) st.adoptedBenchmark.push(txt);
          if (mine) mine.innerHTML = renderPaperHTML(st.resumeSections, st.adoptedBenchmark);
          mk.classList.add('is-adopted');
          const label = (st.resumeSections.find((s) => s.id === secId) || {}).label || secId;
          showToast('已添加「' + txt.slice(0, 16) + (txt.length > 16 ? '…' : '') + '」到' + label, 'teal');
        } else {
          showToast('该亮点已在你的简历中', 'amber');
        }
      });
    });
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function adoptBenchmarkTerm(sectionId, sentence) {
    const st = window.matchState;
    if (!st.resumeSections) st.resumeSections = buildDefaultResumeSections();
    const sec = st.resumeSections.find((s) => s.id === sectionId);
    if (!sec || !sentence) return false;
    const lines = (sec.content || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.some((l) => l === sentence || l.includes(sentence) || sentence.includes(l))) return false;
    lines.push(sentence);
    sec.content = lines.join('\n');
    return true;
  }

  function closeBenchmark() {
    const modal = $('rb-modal'); if (modal) modal.hidden = true;
    document.body.style.overflow = '';
  }

  function bindBenchmark() {
    const modal = $('rb-modal'); if (!modal) return;
    const close = $('rb-close'); if (close) close.addEventListener('click', closeBenchmark);
    const mask = modal.querySelector('.rb-mask'); if (mask) mask.addEventListener('click', closeBenchmark);
    const learn = $('rb-goto-learn'); if (learn) learn.addEventListener('click', () => { closeBenchmark(); openLearningProfile(); });
    document.addEventListener('keydown', (e) => { if (modal && !modal.hidden && e.key === 'Escape') closeBenchmark(); });
  }

  function bindCompare() {
    const goto = $('compare-goto-gap');
    if (goto) goto.addEventListener('click', () => openLearningProfile());
  }
  function renderCompare() {
    const res = window.matchState.result || MOCK_RESULT;
    const c = res.competitiveness; if (!c) return;
    const grid = $('compare-grid'); if (!grid) return;
    const rows = [
      { label: '项目数量', g: c.good_case.projects, m: c.my_case.projects },
      { label: 'Docker 项目', g: c.good_case.docker, m: c.my_case.docker },
      { label: '微服务项目', g: c.good_case.microservice, m: c.my_case.microservice },
      { label: 'Redis 实践', g: c.good_case.redis, m: c.my_case.redis },
      { label: '量化成果', g: c.good_case.quantified, m: c.my_case.quantified }
    ];
    grid.innerHTML = `<div class="compare-card">
      <div class="compare-card-title">优秀案例 vs 我的简历</div>
      ${rows.map((r) => {
        const goodValue = r.g === true ? '✓' : (r.g === false ? '—' : r.g);
        const mineValue = r.m === true ? '✓' : (r.m === false ? '—' : r.m);
        return `<div class="compare-row"><span>${r.label}</span>
          <span><span class="good">${goodValue}</span> / <span class="${r.m === true || r.m > 0 ? 'good' : 'bad'}">${mineValue}</span></span></div>`;
      }).join('')}
      <button class="aip-link" id="compare-gap-link" type="button" style="margin-top:8px">查看差距 →</button>
    </div>`;
    const link = $('compare-gap-link'); if (link) link.addEventListener('click', () => openLearningProfile());
    renderAIPanelCompare();
  }

  /* ============================================================
   * 右侧 AI 面板（上下文感知）
   * ============================================================ */
  function renderAIPanelDefault() {
    const aip = $('aip-body'); if (!aip) return;
    aip.innerHTML = `<div class="aip-empty">AI 正在等待你的简历。<br>上传后，这里会实时显示能力证据、匹配推理与建议。</div>`;
  }
  function renderAIPanelResume() {
    const aip = $('aip-body'); if (!aip) return;
    const st = window.matchState;
    if (!st.file) { renderAIPanelDefault(); return; }
    const p = st.result ? st.result.profile : MOCK_RESULT.profile;
    aip.innerHTML = `<div class="aip-block"><div class="aip-kicker">RESUME EVIDENCE</div>
      <div class="aip-h">已识别技能</div>
      ${p.skills.map((s) => `<div class="aip-metric-row"><span>${escapeHtml(s.name)}</span><span class="bar"><i style="width:${s.readiness || 60}%"></i></span><span class="v">${s.level}</span></div>`).join('')}
      <div class="aip-kicker mt">AI 建议</div>
      <div class="aip-p">点击「开始匹配」运行 AI 诊断，生成岗位能力图谱与推荐结果。</div>
      <span class="aip-link" id="aip-start">→ 运行匹配</span></div>`;
    const s = $('aip-start'); if (s) s.addEventListener('click', () => setView('match'));
  }
  function renderAIPanelMatch() {
    const aip = $('aip-body'); if (!aip) return;
    const st = window.matchState.preferences;
    aip.innerHTML = `<div class="aip-block"><div class="aip-kicker">MATCH CONTEXT</div>
      <div class="aip-h">当前求职条件</div>
      <div class="aip-p">方向：<b>${escapeHtml(st.direction || '未设置')}</b><br>城市：${st.cities.join('、') || '不限'}<br>薪资：${st.salaryMin || '?'}-${st.salaryMax || '?'}K<br>性质：${labelOf(JOBTYPES, st.jobType) || '不限'}</div>
      <div class="aip-kicker mt">必备技能</div>${st.mustSkills.map((s) => `<span class="chip" style="margin:0 4px 4px 0">${escapeHtml(s)}</span>`).join('')}
      <div class="aip-kicker mt">发展技能</div>${st.preferSkills.map((s) => `<span class="chip" style="margin:0 4px 4px 0">${escapeHtml(s)}</span>`).join('')}
      <div class="aip-p mt">调整条件后点击「运行 AI 匹配」。</div></div>`;
  }
  function renderAIPanelAnalysis() {
    const aip = $('aip-body'); if (!aip) return;
    aip.innerHTML = `<div class="aip-block"><div class="aip-kicker">ANALYSIS COMPLETE</div>
      <div class="aip-h">能力图谱已构建</div>
      <div class="aip-p">共识别 <b>${(MOCK_RESULT.profile.skills || []).length}</b> 项技能，建立与岗位的 <b>7</b> 条能力关系。点击左侧能力线或岗位节点查看证据。</div>
      <span class="aip-link" id="aip-tojobs">→ 查看岗位推荐</span></div>`;
    const t = $('aip-tojobs'); if (t) t.addEventListener('click', () => setView('jobs'));
  }
  function renderAIPanelJobs(m) {
    const aip = $('aip-body'); if (!aip) return;
    if (!m) { aip.innerHTML = `<div class="aip-empty">选择左侧岗位查看 AI 解释。</div>`; return; }
    aip.innerHTML = `<div class="aip-block"><div class="aip-kicker">JOB INSIGHT</div>
      <div class="aip-h">${escapeHtml(m.job.title)} · ${m.score}%</div>
      <div class="aip-p">${escapeHtml(m.job.company)} · ${escapeHtml(m.job.city)}</div>
      <div class="aip-kicker mt">匹配证据</div>
      ${(m.evidences.matched || []).map((e) => `<div class="aip-evi"><b>${escapeHtml(e.t)}</b><br>${escapeHtml(e.d)}</div>`).join('')}
      <div class="aip-kicker mt">能力缺口</div>
      ${(m.evidences.missing || []).map((e) => `<div class="aip-evi" style="background:var(--rose-wash)"><b>${escapeHtml(e.t)}</b><br>${escapeHtml(e.d)}</div>`).join('')}
      <span class="aip-link" id="aip-todetail">→ 进入岗位详情</span></div>`;
    const t = $('aip-todetail'); if (t) t.addEventListener('click', () => { window.matchState.selectedJobId = m.job.id; setView('detail'); });
  }
  function renderAIPanelDetail(m) {
    const aip = $('aip-body'); if (!aip || !m) return;
    aip.innerHTML = `<div class="aip-block"><div class="aip-kicker">AI DIAGNOSIS</div>
      <div class="aip-h">${escapeHtml(m.job.title)}</div>
      <div class="aip-p">综合匹配度 <b>${m.score}%</b>。点击中间图谱节点，查看单能力的证据与学习路径。</div>
      <div class="aip-kicker mt">多维度评分</div>
      ${Object.entries(m.dimensions).map(([k, v]) => `<div class="aip-metric-row"><span>${dimLabel(k)}</span><span class="bar"><i style="width:${v}%"></i></span><span class="v">${v}</span></div>`).join('')}
      <span class="aip-link" id="aip-todrawer">→ 查看能力缺口详情</span></div>`;
    const t = $('aip-todrawer'); if (t) t.addEventListener('click', () => {
      const g = (m.gaps || [])[0]; openNodeDrawer(g ? g.skill : 'Docker');
    });
  }
  function dimLabel(k) { return { skills: '技能匹配', semantics: '语义匹配', projects: '项目经历', experience: '工作经验', graph: '图谱关系' }[k] || k; }
  function renderAIPanelNode(sk, m) {
    const aip = $('aip-body'); if (!aip) return;
    aip.innerHTML = `<div class="aip-block"><div class="aip-kicker">NODE EVIDENCE</div>
      <div class="aip-h">${escapeHtml(sk.name)} · ${sk.readiness}%</div>
      <div class="aip-evi">"${escapeHtml(sk.evidence || '')}"</div>
      <div class="aip-kicker mt">理论 / 实践</div>
      <div class="aip-metric-row"><span>理论认知</span><span class="bar"><i style="width:${sk.theory || 60}%"></i></span><span class="v">${sk.theory || 60}</span></div>
      <div class="aip-metric-row"><span>项目实践</span><span class="bar"><i style="width:${sk.practice || 20}%"></i></span><span class="v">${sk.practice || 20}</span></div>
      <span class="aip-link" id="aip-node-learn">→ 生成学习路径</span></div>`;
    const t = $('aip-node-learn'); if (t) t.addEventListener('click', () => openLearningProfile());
  }
  function renderAIPanelCompare() {
    const aip = $('aip-body'); if (!aip) return;
    aip.innerHTML = `<div class="aip-block"><div class="aip-kicker">BENCHMARK</div>
      <div class="aip-h">差距即机会</div>
      <div class="aip-p">优秀案例在 Docker / 微服务 / 量化成果上明显领先。这些差距可直接转化为学习路径节点。</div>
      <span class="aip-link" id="aip-togap">→ 进入能力补强</span></div>`;
    const t = $('aip-togap'); if (t) t.addEventListener('click', () => openLearningProfile());
  }

  /* ============================================================
   * 沉浸式模拟面试
   * ============================================================ */
  function bindInterview() {
    const exit = $('int-exit'); if (exit) exit.addEventListener('click', closeInterview);
    const next = $('int-next'); if (next) next.addEventListener('click', () => {
      const st = window.matchState.interview;
      if (!st) return;
      if (st.index + 1 >= INTERVIEW_Q.length) { closeInterview(); return; }
      askQuestion(st.index + 1);
    });
    const mic = $('btn-mic'), cam = $('btn-cam'), spk = $('btn-speaker');
    if (mic) mic.addEventListener('click', () => toggleCtrl(mic));
    if (cam) cam.addEventListener('click', () => toggleCtrl(cam));
    if (spk) spk.addEventListener('click', () => toggleCtrl(spk));
  }
  function toggleCtrl(btn) {
    const on = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', on ? 'false' : 'true');
  }
  const INTERVIEW_Q = [
    { topic: 'Java 基础', q: '请介绍一下你在简历中提到的项目，并说明你在其中的技术角色。', base: 'strong' },
    { topic: '项目介绍', q: '你提到用 Spring Boot 搭建了营销平台，能讲讲你如何处理高并发场景吗？', base: 'mid' },
    { topic: 'Redis', q: '为什么在项目中引入 Redis？如果缓存与数据库不一致，你会怎么处理？', base: 'weak' },
    { topic: '系统设计', q: '如果要设计一个日均千万级的订单系统，你会怎么做分库分表？', base: 'mid' },
    { topic: '微服务', q: '你如何理解服务拆分？能否举例说明一个不适合拆分的场景？', base: 'weak' },
    { topic: 'Docker', q: '你的项目是否做过容器化部署？如果让你写 Dockerfile 你会注意什么？', base: 'weak' },
    { topic: 'MySQL', q: '讲讲你对索引最左前缀原则的理解，以及一次你做过的慢查询优化。', base: 'mid' },
    { topic: '综合能力', q: '回顾这次面试，你认为自己最需要在哪方面补强？', base: 'mid' }
  ];
  function openInterview() {
    const m = getSelectedJob();
    const jobLabel = $('int-job-label'); if (jobLabel) jobLabel.textContent = m ? (m.job.title + ' · ' + m.job.company) : '模拟面试';
    const inter = $('md-interview'); if (inter) inter.hidden = false;
    window.matchState.interview = { index: 0, answers: [], questions: [] };
    startCamera();
    askQuestion(0);
    setView('interview');
  }
  function closeInterview() {
    const inter = $('md-interview'); if (inter) inter.hidden = true;
    stopCamera();
    showReport();
  }
  function askQuestion(idx) {
    const st = window.matchState.interview;
    const item = INTERVIEW_Q[idx];
    if (!item) { closeInterview(); return; }
    st.index = idx;
    const prog = $('int-progress'); if (prog) prog.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(INTERVIEW_Q.length).padStart(2, '0');
    const label = $('int-q-label'); if (label) label.textContent = '当前考察：' + item.topic;
    const qt = $('int-question-text'); if (qt) qt.textContent = item.q;
    st.questions[idx] = item;
    // 最后一题按钮文案切换为"查看报告"
    const next = $('int-next'); if (next) next.textContent = (idx + 1 >= INTERVIEW_Q.length) ? '查看报告 →' : '下一问 →';
    // 模拟 AI 语音波
    setTimeout(() => { const w = $('int-ai-wave'); if (w) w.style.opacity = '1'; }, 300);
  }
  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then((stream) => {
      window.matchState._mediaStream = stream;
      const v = $('int-user-video'); const ph = $('int-user-placeholder');
      if (v) { v.srcObject = stream; if (ph) ph.style.display = 'none'; }
    }).catch(() => {});
  }
  function stopCamera() {
    if (window.matchState._mediaStream) { window.matchState._mediaStream.getTracks().forEach((t) => t.stop()); window.matchState._mediaStream = null; }
  }

  /* ============================================================
   * 面试报告
   * ============================================================ */
  function bindReport() {
    const back = $('report-back'); if (back) back.addEventListener('click', () => { const r = $('md-report'); if (r) r.hidden = true; setView('jobs'); });
    const restart = $('report-restart'); if (restart) restart.addEventListener('click', () => { const r = $('md-report'); if (r) r.hidden = true; openInterview(); });
  }
  function showReport() {
    const score = 78;
    const dims = { '技术基础': 86, '项目理解': 73, '表达能力': 68, '逻辑分析': 79, '岗位匹配': 81 };
    const meta = $('report-meta'); if (meta) meta.textContent = (getSelectedJob() ? getSelectedJob().job.title : '模拟面试') + ' · 8 题';
    const sc = $('report-score'); if (sc) animateNumber(sc, score, 1000);
    const dimsBox = $('report-dims');
    if (dimsBox) dimsBox.innerHTML = Object.entries(dims).map(([k, v]) =>
      `<div class="dim-row"><span class="nm">${k}</span><span class="bar"><i style="width:${v}%"></i></span><span class="v">${v}</span></div>`).join('');
    const issues = $('report-issues');
    if (issues) {
      const rows = INTERVIEW_Q.map((it, i) => {
        const lvl = it.base === 'strong' ? 'strong' : (it.base === 'mid' ? 'mid' : 'weak');
        const lvlTxt = it.base === 'strong' ? '强' : (it.base === 'mid' ? '中' : '弱');
        const analysis = it.base === 'weak' ? `知识准确性 ${40 + i}, 完整性偏低。主要问题：缺少系统性处理方案。` :
          (it.base === 'mid' ? '回答基本到位，可补充更多量化细节。' : '回答扎实，有项目佐证。');
        return `<div class="issue-row" data-issue="${i}"><span class="issue-rank">${String(i + 1).padStart(2, '0')}</span>
          <span class="issue-name">${escapeHtml(it.topic)}</span><span class="issue-lvl ${lvl}">${lvlTxt}</span></div>
          <div class="issue-detail" data-detail="${i}"><b>问题：</b>${escapeHtml(it.q)}<br><b>AI 分析：</b>${escapeHtml(analysis)}<br><b>建议：</b>${it.base === 'weak' ? '加入学习路径补强' : '保持并深化'}</div>`;
      }).join('');
      issues.innerHTML = rows;
      qsa('.issue-row', issues).forEach((row) => row.addEventListener('click', () => {
        const d = issues.querySelector('[data-detail="' + row.dataset.issue + '"]');
        if (d) d.classList.toggle('is-open');
      }));
    }
    const r = $('md-report'); if (r) r.hidden = false;
  }

  /* ---------------- 暴露入口 ---------------- */
  // match.html 末尾通过 window.initMatch() 启动；必须显式挂到 window，
  // 否则 initMatch 仍为 IIFE 内局部函数，bootstrap 中的
  // `window.initMatch && window.initMatch()` 会短链成 no-op，导致中央工作区永不渲染。
  window.initMatch = initMatch;

})();
