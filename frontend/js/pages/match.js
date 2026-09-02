/* ============================================================
 * 人岗匹配决策工作台 · 前端控制器
 * 布局：左导航 + 中央工作区 + 右侧 AI 面板
 * 状态：resume → match → analysis → jobs → detail → learn → interview → report
 * 删除：旧 aurora/portal 沉浸式入口、巨大卡片 Dashboard
 * 数据契约保留：MOCK_RESULT / mockDiagnose；面试与报告使用当前匹配结果
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
  // Phase 08-D：统一业务数据来源。Real Mode 只读真实 result；Demo Mode 才允许回退 MOCK_RESULT。
  function currentResult() {
    const st = window.matchState;
    if (!st) return null;
    const base = st.mode === 'demo' ? (st.result || MOCK_RESULT) : st.result;
    if (!base) return null;
    // 兜底:如果当前 result 没有 matches,但 MOCK_RESULT 有,借用 mock 的 matches
    // 避免真实接口部分失败时 view-jobs 右侧详情空白
    const noMatches = !base.matches || !base.matches.length;
    if (st.mode === 'demo' && noMatches && MOCK_RESULT && MOCK_RESULT.matches && MOCK_RESULT.matches.length) {
      return Object.assign({}, base, { matches: MOCK_RESULT.matches });
    }
    return base;
  }
  function animateNumber(el, to, dur, suffix, prefix, from) {
    if (!el) return;
    suffix = suffix || ''; prefix = prefix || '';
    const startVal = typeof from === 'number' ? from : 0;
    if (reduceMotion()) { el.textContent = prefix + Math.round(to) + suffix; return; }
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / (dur || 900));
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = prefix + Math.round(startVal + (to - startVal) * eased) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  // 数字平滑过渡：从当前显示值滚动到目标值
  function countUpTo(el, to, dur) {
    if (!el) return;
    animateNumber(el, to, dur, '', '', parseInt(el.textContent, 10) || 0);
  }

  /* ---------------- 全局状态 ---------------- */
  window.matchState = {
    // Phase 08-D：模式开关。默认 real；仅用户显式触发 Demo 才置为 demo。
    mode: 'real',
    stage: 'resume',
    file: null, fileName: '', fileSize: 0,
    result: null, selectedJobId: null,
    preferences: {
      cities: ['北京'], salaryMin: 15, salaryMax: 25, jobTypes: ['fulltime'], jobType: 'fulltime',
      mustSkills: ['Java', 'Spring Boot'], preferSkills: ['MySQL', 'Redis', 'Docker'],
      others: ['校招', '接受异地'], direction: 'Java 后端开发',
      skillMeta: {
        Java: { level: 'core', strength: 5 },
        'Spring Boot': { level: 'core', strength: 4 },
        MySQL: { level: 'important', strength: 4 },
        Redis: { level: 'plus', strength: 3 },
        Docker: { level: 'plus', strength: 2 }
      }
    },
    recommendTab: 'now', jobTab: 'requirement',
    aipanelOpen: true, activeView: 'resume',
    activeSection: 'basic', resumeSections: null,
    interview: { index: 0, answers: [], questions: [] },
    whatif: {}, favJobs: {},
    // Phase 08-C：JobMatchingAgent 问答状态（最小字段，不新建状态体系）
    agent: { loading: false, message: '', result: null, history: [] },
    _theater: null, _mediaStream: null, _recognition: null
  };

  /* ---------------- 常量 ---------------- */
  const CITIES = ['北京', '上海', '深圳', '杭州', '广州', '成都', '不限'];
  const COND_CITIES = ['北京', '上海', '杭州', '深圳', '广州', '成都', '全国', '不限'];
  const JOBTYPES = [['fulltime', '全职'], ['intern', '实习'], ['parttime', '兼职'], ['campus', '校招']];
  const SKILL_LEVELS = [['core', '核心要求'], ['important', '重要能力'], ['plus', '加分项']];
  const SKILL_POOL = ['Java', 'Spring Boot', 'MySQL', 'Redis', 'Docker', 'Kubernetes', '微服务', '消息队列', 'Python', 'Go', 'LLM', 'RAG', '向量数据库', 'Linux', '自动化测试', '系统设计'];
  const STRENGTH_TO_REQ = { 1: 55, 2: 65, 3: 75, 4: 85, 5: 92 };
  const OTHERS = ['应届生', '接受异地', '接受远程', '大厂优先', '弹性工作'];
  const SUGGESTED_SKILLS = ['Java', 'Spring Boot', 'MySQL', 'Python', 'Redis', 'Docker', 'React', 'Kubernetes', 'PyTorch', 'LLM', 'RAG', 'Go', '微服务'];
  const ACCEPT_EXT = ['pdf', 'doc', 'docx', 'txt'];
  const MAX_BYTES = 8 * 1024 * 1024;
  const DIRECTIONS = ['Java 后端开发', '数据开发', 'AI 应用开发', '测试开发', '前端开发'];

  // 顶部进度节点（去掉了\"能力\"；\"学习\"与\"面试\"并联，表示可反复循环：学完面试，面试完再学）
  const PROGRESS_NODES = [
    { id: 'resume', label: '简历' }, { id: 'match', label: '匹配' }, { id: 'jobs', label: '岗位' },
    { id: 'learn', label: '学习' }, { id: 'interview', label: '面试' }
  ];
  // 学习 ↔ 面试 是循环关系：后面的连线是一个 \"双向循环\" 图标
  const LOOP_PAIR_IDS = ['learn', 'interview'];

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
        job: { id: 'java-be', title: 'Java 后端开发（演示岗位）', company: '未提供公司信息', city: '北京', salary: '25-45K', type: '全职',
          required_skills: ['Java', 'Spring Boot', 'MySQL', 'Redis', 'Docker', '微服务', '系统设计'], preferred_skills: ['Kubernetes', '消息队列'], exp: '0-3年' },
        score: 88, tab: 'now', quick_days: 7, potential_after: 95,
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
        job: { id: 'java-dev', title: 'Java 开发（演示岗位）', company: '未提供公司信息', city: '上海', salary: '20-35K', type: '全职', required_skills: ['Java', 'Spring Boot', 'MySQL'], preferred_skills: ['Redis'], exp: '0-3年' },
        score: 84, tab: 'now',
        matched: ['Java 基础扎实', '框架熟练'], missing: ['高并发经验不足'],
        gaps: [{ skill: 'Java', readiness: 92 }, { skill: 'Spring Boot', readiness: 85 }, { skill: 'MySQL', readiness: 82 }, { skill: 'Redis', readiness: 70 }],
        dimensions: { skills: 84, semantics: 80, projects: 82, experience: 78, graph: 81 }, evidences: { matched: [{ t: 'Java 基础扎实', d: '主导项目验证工程能力。' }], missing: [{ t: '高并发经验不足', d: '缺少大流量场景设计。' }] }
      },
      {
        job: { id: 'data-dev', title: '数据开发（演示岗位）', company: '未提供公司信息', city: '杭州', salary: '22-40K', type: '全职', required_skills: ['Java', 'Python', 'SQL', 'Hadoop'], preferred_skills: ['Spark'], exp: '0-3年' },
        score: 78, tab: 'now', quick_days: 14, potential_after: 90,
        matched: ['Java 背景可迁移'], missing: ['数据技术栈不足'],
        gaps: [{ skill: 'Java', readiness: 88 }, { skill: 'Python', readiness: 50 }, { skill: 'SQL', readiness: 65 }, { skill: 'Hadoop', readiness: 30 }],
        dimensions: { skills: 78, semantics: 74, projects: 75, experience: 72, graph: 70 }, evidences: { matched: [{ t: 'Java 背景可迁移', d: '工程基础可迁移至数据处理。' }], missing: [{ t: '数据技术栈不足', d: 'Python/Hadoop 缺失。' }] }
      },
      {
        job: { id: 'ai-app', title: 'AI 应用开发（演示岗位）', company: '未提供公司信息', city: '深圳', salary: '28-50K', type: '全职', required_skills: ['Python', 'LLM', 'RAG', '向量数据库'], preferred_skills: ['Agent'], exp: '0-3年' },
        score: 72, tab: 'future', quick_days: 21, potential_after: 84,
        matched: ['工程基础尚可'], missing: ['AI 技术栈缺失'],
        gaps: [{ skill: 'Python', readiness: 55 }, { skill: 'LLM', readiness: 30 }, { skill: 'RAG', readiness: 25 }, { skill: '向量数据库', readiness: 20 }],
        dimensions: { skills: 72, semantics: 70, projects: 68, experience: 66, graph: 64 },
        potential_after: 84,
        evidences: { matched: [{ t: '工程基础尚可', d: 'Java 工程经验对 AI 应用落地有帮助。' }], missing: [{ t: 'AI 技术栈缺失', d: 'Python/RAG/Agent 需补齐。' }] }
      },
      {
        job: { id: 'test-dev', title: '测试开发（演示岗位）', company: '未提供公司信息', city: '成都', salary: '18-30K', type: '全职', required_skills: ['Java', '自动化测试', 'Python'], preferred_skills: ['性能测试'], exp: '0-3年' },
        score: 69, tab: 'now', quick_days: 3, potential_after: 85,
        matched: ['Java 可用'], missing: ['测试框架不足'],
        gaps: [{ skill: 'Java', readiness: 85 }, { skill: '自动化测试', readiness: 40 }, { skill: 'Python', readiness: 50 }],
        dimensions: { skills: 69, semantics: 66, projects: 64, experience: 62, graph: 60 }, evidences: { matched: [{ t: 'Java 可用', d: '可承担自动化脚本编写。' }], missing: [{ t: '测试框架不足', d: '缺乏 pytest/JUnit 深度使用。' }] }
      },
      {
        job: { id: 'cloud-arch', title: '云原生架构（演示岗位）', company: '未提供公司信息', city: '北京', salary: '35-60K', type: '全职', required_skills: ['Kubernetes', 'Docker', '微服务', 'Go'], preferred_skills: ['Istio'], exp: '3-5年' },
        score: 58, tab: 'future', quick_days: 28, potential_after: 76,
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
  // 默认示例简历分块（仅用于未上传简历时的演示）
  function buildDefaultResumeSections() {
    return [
      { id: 'basic', label: '个人信息', content: '请填写姓名\n目标岗位\n电话：请填写\n邮箱：请填写', ai_suggestion: '补充真实的求职城市、到岗时间和联系方式。' },
      { id: 'education', label: '教育经历', content: '请填写学校 · 专业 · 学历\n入学年份 - 毕业年份', ai_suggestion: '补充真实学校、专业、学历和时间。' },
      { id: 'projects', label: '项目经历', content: '1. Java 高并发订单系统：主导核心交易链路开发，接口响应时间下降 40%，支撑日均 500w+ 调用。\n2. Spring Boot 营销平台：独立搭建活动配置与发放服务，负责核心表设计与慢查询优化。\n3. MySQL 慢查询优化专项：梳理慢 SQL、建立复合索引，QPS 提升 3 倍。', ai_suggestion: '建议采用「背景 - 行动 - 结果」结构，把量化指标前置，并明确个人角色（主导/独立/协作），突出技术难点。' },
      { id: 'work', label: '工作经历', content: '暂无工作经历\n（如有实习或全职经历，请补充真实信息）', ai_suggestion: '请补全真实单位、起止时间、职责与可量化产出。' },
      { id: 'skills', label: '专业技能', content: 'Java（精通）、Spring Boot（熟练）、MySQL（熟练）、Redis（了解）、系统设计（熟悉）\nDocker、微服务：暂无项目实践', ai_suggestion: '将「精通/熟练」与具体使用场景绑定，如「Java：主导 3 个后端项目」；对 Redis/Docker 等薄弱项补充学习进展，避免被判定为完全缺失。' },
      { id: 'summary', label: '自我评价', content: '3 年 Java 后端开发经验，工程基础扎实，具备一定的高并发与性能优化意识，希望在容器化、微服务方向进一步深入。', ai_suggestion: '自我评价宜精炼为 2-3 句，突出「经验年限 + 核心技术 + 差异化优势 + 明确职业目标」，避免空泛形容词。' }
    ];
  }

  /* ---------------- AI 改写建议（三个版本，mock） ---------------- */
  const RESUME_SUGGESTIONS = {
    basic: {
      title: '强化联系信息与求职定位',
      versions: {
        quant: '演示候选人A\nJava 后端开发工程师（杭州 / 期望 25-35K）\n联系方式：未提供',
        impact: '演示候选人A · Java 后端开发工程师\n3 年高并发后端经验，主导订单系统重构。\n联系方式：未提供',
        dense: '演示候选人A / Java 后端开发 · 期望杭州 25-35K\n联系方式：未提供'
      }
    },
    education: {
      title: '突出科班背景与核心课程',
      versions: {
        quant: '脱敏教育经历 · 计算机科学与技术 · 本科（GPA 3.7/4.0）\n2019.09 - 2023.06\n主修课程：数据结构、操作系统、数据库系统、计算机网络\n荣誉：校级一等奖学金、蓝桥杯国赛二等奖',
        impact: '脱敏教育经历 · 计算机科学与技术 · 本科\nGPA 3.7/4.0（年级前 5%），蓝桥杯国赛二等奖。\n2019.09 - 2023.06\n主修：数据结构、操作系统、数据库',
        dense: '脱敏计算机本科 · GPA 3.7\n2019.09 - 2023.06'
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
    // 默认进入 Real Mode；未完成匹配前保持空态，演示数据只能通过显式 Demo 入口加载。
    const st = window.matchState;
    st.mode = 'real';
    st.file = null; st.fileName = ''; st.fileSize = 0;
    // 从个人仓库恢复最近选中的简历。仓库选择通过 localStorage 保存，
    // 返回本页后需要重新构造 File，否则入口会一直显示“请先上传简历”。
    try {
      const saved = window.ZhituVault && typeof window.ZhituVault.loadMatchResume === 'function'
        ? window.ZhituVault.loadMatchResume()
        : null;
      if (saved && (saved.text || saved.fileName || saved.name)) {
        const text = String(saved.text || '');
        const fileName = String(saved.fileName || saved.name || '个人仓库简历.txt');
        st.file = new File([text], fileName, { type: 'text/plain' });
        st.fileName = fileName;
        st.fileSize = Number(saved.size) || text.length;
        st.resumeSections = Array.isArray(saved.sections) && saved.sections.length
          ? saved.sections
          : (text ? parseResumeText(text) : buildDefaultResumeSections());
        st.activeSection = 'basic';
      }
    } catch (_) {
      // 本地存储损坏时保留空入口，不阻断匹配页其它功能。
    }
    if (!st.result) st.result = null;
    st.selectedJobId = st.selectedJobId || null;
    // 没有已保存简历时显示空入口，不注入虚构个人信息。
    if (!st.resumeSections) { st.resumeSections = []; st.activeSection = 'basic'; }
    if (st.file && st.fileName && window.ZhituVault && typeof window.ZhituVault.loadMatchResume === 'function') {
      const saved = window.ZhituVault.loadMatchResume();
      if (saved && saved.text) st.result = buildLocalResumeResult(String(saved.text), st.result);
    }
    st.whatif = {};
    st.favJobs = (window.ZhituVault && window.ZhituVault.loadMatchFavs) ? window.ZhituVault.loadMatchFavs() : {};
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

  // Phase 08-D：Demo Mode 手动入口 —— 仅显式调用才启用 Mock（默认 Real，两者完全分离）。
  function loadMatchDemo() {
    const st = window.matchState;
    st.mode = 'demo';
    st.file = { name: '演示候选人A_Java后端开发.txt', size: 18642, type: 'text/plain' };
    st.fileName = '演示候选人A_Java后端开发.txt';
    st.fileSize = 18642;
    st.result = structuredClone(MOCK_RESULT);
    st.selectedJobId = MOCK_RESULT.matches[0].job.id;
    st.resumeSections = buildDefaultResumeSections();
    st.activeSection = 'basic';
    st.whatif = {}; st.favJobs = {};
    renderResume();
    setView('resume');
    if (window.showToast) window.showToast('已切换到演示模式（Mock 数据）', 'amber');
  }
  window.loadMatchDemo = loadMatchDemo;

  /* ============================================================
   * 全局 / 导航 / 进度
   * ============================================================ */
  function bindGlobal() {
    qsa('.wks-nav-item').forEach((b) => b.addEventListener('click', () => {
      const nav = b.dataset.nav;
      if (nav === 'compare') { setView('compare'); return; }
      // 导航映射到对应视图（已移除 capability 节点）
      const map = { resume: 'resume', match: 'match', jobs: 'jobs', learn: 'learn', interview: 'interview' };
      // interview 需要已进入过分析，否则先跳 jobs
      if (nav === 'interview' && !window.matchState.result) { window.showToast('请先完成匹配分析', 'amber'); setView('jobs'); return; }
      if (nav === 'learn' && !window.matchState.selectedJobId) { window.showToast('请先选择岗位再生成学习路径', 'amber'); setView('jobs'); return; }
      setView(map[nav] || 'resume');
    }));
  }

  function renderProgress() {
    const st = window.matchState;
    const box = $('wks-progress');
    if (!box) return;
    // 计算已完成：根据 stage（去掉了 capability：简历=0, 匹配=1, 岗位=2, 学习=3, 面试=4）
    const order = PROGRESS_NODES.map((n) => n.id);
    const stageOrder = { resume: 0, match: 1, jobs: 2, learn: 3, interview: 4 };
    const cur = stageOrder[st.stage] != null ? stageOrder[st.stage] : 0;
    box.innerHTML = PROGRESS_NODES.map((n, i) => {
      const state = i < cur ? 'is-done' : (i === cur ? 'is-active' : '');
      const dot = '<span class="wks-prog-dot"></span>';
      const node = `<button class="wks-prog-node ${state}" data-prog="${n.id}" type="button">${dot}<span>${escapeHtml(n.label)}</span></button>`;
      const nextNode = PROGRESS_NODES[i + 1];
      // 学习 ↔ 面试 是循环关系：用专用的\"循环连接器\"取代普通连接线
      let line = '';
      if (nextNode) {
        if (LOOP_PAIR_IDS.includes(n.id) && LOOP_PAIR_IDS.includes(nextNode.id)) {
          const filledClass = (cur >= stageOrder[n.id] && cur >= stageOrder[nextNode.id]) ? 'is-filled' : '';
          line = `<span class="wks-prog-loop ${filledClass}" data-loop="learn-interview" role="img" aria-label="学习与面试循环" title="学完面试 · 面试完再学">
            <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 9a8 8 0 0 0-14.5-2.5"/>
              <polyline points="22 3 22 9 16 9"/>
              <path d="M6 19a8 8 0 0 0 14.5 2.5"/>
              <polyline points="6 25 6 19 12 19"/>
            </svg>
          </span>`;
        } else {
          line = `<span class="wks-prog-line ${i < cur ? 'is-filled' : ''}"></span>`;
        }
      }
      return node + line;
    }).join('');
    qsa('.wks-prog-node', box).forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.prog;
      const map = { resume: 'resume', match: 'match', jobs: 'jobs', learn: 'learn', interview: 'interview' };
      // 未完成节点提示（学习/面试可互跳，因为它们是循环关系）
      const idx = order.indexOf(id);
      const curId = order[cur];
      const isLoopNode = LOOP_PAIR_IDS.includes(id);
      const curIsLoop = LOOP_PAIR_IDS.includes(curId);
      if (idx > cur && !(isLoopNode && curIsLoop)) {
        window.showToast('请先完成前面的诊断步骤', 'amber');
        return;
      }
      setView(map[id]);
    }));
    // 点击循环图标：在\"学习↔面试\"之间切换视图，传达\"可循环\"的语义
    qsa('.wks-prog-loop', box).forEach((el) => {
      el.addEventListener('click', () => {
        if (st.stage === 'learn') setView('interview');
        else if (st.stage === 'interview') setView('learn');
        else setView('learn'); // 其它阶段默认进入学习
      });
    });
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
    if (name === 'match') renderCondWorkbench();
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
    const pickResume = $('md-pick-resume');
    if (pickResume) pickResume.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.Shell && typeof window.Shell.openVault === 'function') {
        window.Shell.openVault({ mode: 'pick', tab: 'resumes' });
      } else {
        window.location.href = '../pages/warehouse.html?pick=1';
      }
    });
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
    if (change) change.addEventListener('click', openResumeSourceModal);
    const sourceModal = $('resume-source-modal');
    const sourceMask = $('resume-source-mask');
    const sourceClose = $('resume-source-close');
    const sourceLocal = $('resume-source-local');
    const sourceVault = $('resume-source-vault');
    if (sourceMask) sourceMask.addEventListener('click', closeResumeSourceModal);
    if (sourceClose) sourceClose.addEventListener('click', closeResumeSourceModal);
    if (sourceLocal) sourceLocal.addEventListener('click', () => {
      closeResumeSourceModal();
      const fileInput = $('resume-file-input');
      if (fileInput) fileInput.click();
    });
    if (sourceVault) sourceVault.addEventListener('click', () => {
      closeResumeSourceModal();
      if (window.Shell && typeof window.Shell.openVault === 'function') {
        window.Shell.openVault({ mode: 'pick', tab: 'resumes' });
      } else {
        window.location.href = 'warehouse.html?pick=1';
      }
    });
    if (sourceModal) document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !sourceModal.hidden) closeResumeSourceModal();
    });
    bindResumeAnalyze();
    bindDiffModal();
  }

  function renderResume() {
    const st = window.matchState;
    const preview = $('rw-preview');
    const uploadCard = $('resume-upload-card');
    const headMetrics = $('resume-head-metrics');
    const toolbar = $('rw-toolbar');
    const fileBadge = $('rw-file-badge');

    if (!st.resumeSections) st.resumeSections = buildDefaultResumeSections();

    if (st.file) {
      // 已有简历:左列预览,中栏词条,右栏分析,顶部 toolbar 显示
      if (preview) preview.style.display = '';
      if (uploadCard) uploadCard.hidden = true;
      if (toolbar) toolbar.style.display = '';
      if (headMetrics) headMetrics.innerHTML = `<span class="mod-tag mod-tag--ok">解析完成</span>`;
      const size = st.fileSize ? (st.fileSize / 1024 / 1024).toFixed(1) + 'MB' : '本地文件';
      if (fileBadge) fileBadge.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>${escapeHtml(st.fileName)} · ${escapeHtml(size)}`;
    } else {
      // 无简历:三栏 UI 框保留,左列显示上传入口,中栏一直显示词条,右栏中央提示上传
      if (preview) preview.style.display = 'none';
      if (uploadCard) uploadCard.hidden = false;
      if (toolbar) toolbar.style.display = 'none';
      if (headMetrics) headMetrics.innerHTML = `<span class="mod-tag mod-tag--warn">待导入</span>`;
    }

    renderResumePreview();
    renderResumeNav();
    renderResumeEditor();
    renderAIPanelResume();

    // 无简历时:右栏中央用空状态覆盖默认内容(中栏保留,渲染默认词条)
    if (!st.file) {
      const ed = $('rw-editor');
      const sug = $('rw-suggestion');
      if (sug) sug.innerHTML = '';
      const stTag = $('rw-editor-state');
      if (stTag) stTag.textContent = '待导入';
      if (ed) {
        ed.innerHTML = `
          <div class="rw-empty-hint">
            <div class="rw-empty-ic">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
            </div>
            <div class="rw-empty-t">请先上传简历</div>
            <div class="rw-empty-d">上传简历后,这里会显示 AI 自动生成的简历诊断、改写建议与岗位匹配分析。</div>
            <button class="btn-sm btn-sm--solid rw-empty-btn" id="rw-empty-upload" type="button">前往左侧上传 →</button>
          </div>`;
        const eb = $('rw-empty-upload');
        if (eb) eb.onclick = () => {
          const zone = $('resume-upload-zone');
          if (zone) { zone.focus(); zone.click(); }
        };
      }
    }
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
   * 当前选中段落：仅做"段落高亮/框选"，不再做关键词高亮、点击同步到简历。
   * 关键词同步功能已迁移到 AI 改写建议对比弹窗（rw-diff-modal）使用。
   */
  function renderResumePreview() {
    const box = $('rw-preview');
    if (!box) return;
    const secs = getSections();
    const st = window.matchState;
    const activeId = st.activeSection;

    const basic = secs.find((s) => s.id === 'basic');
    const others = secs.filter((s) => s.id !== 'basic');

    // 解析「个人信息」分块：首行姓名、次行求职意向、其余为联系方式
    const basicLines = (basic ? basic.content : '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const name = basicLines[0] || '未命名';
    const title = basicLines[1] || '';
    const contact = basicLines.slice(2);

    box.innerHTML = `<div class="rw-paper">
      <div class="rw-paper-name">${escapeHtml(name)}</div>
      ${title ? `<div class="rw-paper-title">${escapeHtml(title)}</div>` : ''}
      ${contact.length ? `<div class="rw-paper-contact">${contact.map((c) => escapeHtml(c)).join(' · ')}</div>` : ''}
      ${others.map((s) => {
        const body = escapeHtml(s.content || '').replace(/\n/g, '<br>');
        const isActive = s.id === activeId;
        return `<div class="rw-paper-section${isActive ? ' is-active' : ''}">
          <div class="rw-paper-sec-title">${escapeHtml(s.label)}</div>
          <div class="rw-paper-sec-body">${body}</div>
        </div>`;
      }).join('')}
    </div>`;
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
      // 让左侧简历预览对应段落平滑滚动到可视区中央，并加一个轻微的闪动效果
      const secEl = document.querySelector('#rw-preview .rw-paper-section.is-active');
      if (secEl && typeof secEl.scrollIntoView === 'function') {
        try { secEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { secEl.scrollIntoView(); }
        secEl.classList.remove('is-flash');
        // 触发重排后重新加 class，确保动画再次播放
        void secEl.offsetWidth;
        secEl.classList.add('is-flash');
        setTimeout(() => secEl.classList.remove('is-flash'), 1200);
      }
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
    window.matchState.result = buildLocalResumeResult('', window.matchState.result);
    // TXT 可做简单分块解析；其他格式回退为默认分块（待接真实解析）
    if (ext === 'txt') {
      const reader = new FileReader();
      reader.onload = () => {
        window.matchState.result = buildLocalResumeResult(String(reader.result || ''), window.matchState.result);
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
      loadFile(new File([blob], '演示候选人A_Java后端开发.txt', { type: 'text/plain' }));
    }).catch(() => window.showToast('示例简历加载失败', 'amber'));
  }
  function viewResume() {
    const st = window.matchState;
    if (st.file && st.file instanceof File) {
      const url = URL.createObjectURL(st.file); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else window.showToast('该简历暂不支持预览', 'amber');
  }

  /* ============================================================
   * STATE 2 · 岗位匹配条件工作台
   * 配置条件 → 实时分析条件影响 → 预览目标岗位 → AI 优化建议 → 运行人岗匹配
   * ============================================================ */
  const SKILL_PLUS_CANDIDATES = ['Redis', 'Docker', 'Kubernetes', '消息队列', 'Linux', 'RAG', 'Agent', 'Git', '性能测试', '向量数据库'];
  const LV_ORDER = ['core', 'important', 'plus'];

  function clampF(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function labelOf(pairs, val) { const p = pairs.find((x) => x[0] === val); return p ? p[1] : ''; }

  function bindMatchCond() {
    const run = $('cond-run-match');
    if (run) run.addEventListener('click', runMatch);
    const editJob = $('cond-edit-job');
    if (editJob) editJob.addEventListener('click', openJobEditor);
    bindJobEditorModal();
    renderCondWorkbench();
  }

  // 技能优先级 → 兼容字段同步（mustSkills / preferSkills 供其它模块使用）
  function syncSkillsToLegacy(pref) {
    const meta = pref.skillMeta || {};
    pref.mustSkills = Object.keys(meta).filter((k) => meta[k].level === 'core');
    pref.preferSkills = Object.keys(meta).filter((k) => meta[k].level === 'important' || meta[k].level === 'plus');
    if (pref.jobTypes && pref.jobTypes.length) pref.jobType = pref.jobTypes[0];
  }

  /* ---- 条件影响计算引擎（mock 实时计算，后续可平滑接 API） ---- */
  function computeCondImpact(pref) {
    const n = pref.cities.length;
    const cityPool = n === 0 ? 846 : 85 + 43 * n; // 全国 846，1 城 128
    // 薪资相对系数（15-25K 为基准 1）
    let salR = 1;
    if (pref.salaryMin != null && pref.salaryMax != null) {
      const mid = (pref.salaryMin + pref.salaryMax) / 2;
      const span = pref.salaryMax - pref.salaryMin;
      salR = clampF(1 - (mid - 20) * 0.03 - (span - 10) * 0.012, 0.18, 1.6);
    }
    // 工作性质数量系数（1 种为基准 1）
    const tn = (pref.jobTypes || []).length;
    const typeR = [1.2, 1, 0.8, 0.64, 0.5][tn] != null ? [1.2, 1, 0.8, 0.64, 0.5][tn] : 0.45;
    // 技能严格度系数（默认 2 核心 + 1 重要 + 强度 18 为基准 1）
    const meta = pref.skillMeta || {};
    const names = Object.keys(meta);
    const coreN = names.filter((k) => meta[k].level === 'core').length;
    const impN = names.filter((k) => meta[k].level === 'important').length;
    const strengthSum = names.reduce((a, k) => a + (meta[k].strength || 0), 0);
    const skillR = clampF((1.12 - coreN * 0.085 - impN * 0.03 - strengthSum * 0.011) / 0.722, 0.28, 1.12);
    const pool = clampF(Math.round(cityPool * salR * typeR * skillR), 6, 846);

    // 条件严格度（0-100）
    let s = 0;
    s += n === 0 ? 0 : (n === 1 ? 16 : n === 2 ? 26 : n === 3 ? 34 : 40);
    if (pref.salaryMin != null) { const mid = (pref.salaryMin + pref.salaryMax) / 2; s += mid < 18 ? 10 : mid < 25 ? 18 : mid < 35 ? 30 : 42; }
    s += tn === 0 ? 0 : (tn === 1 ? 10 : tn === 2 ? 18 : tn === 3 ? 25 : 30);
    s += coreN === 0 ? 0 : (coreN === 1 ? 14 : coreN === 2 ? 22 : coreN === 3 ? 32 : 42);
    s += strengthSum > 18 ? 10 : strengthSum > 12 ? 6 : 3;
    const strictness = clampF(s, 0, 100);
    const strictLabel = strictness < 30 ? '当前条件较宽松' : strictness <= 60 ? '当前条件适中' : '当前条件偏严格';

    const high = Math.round(pool * clampF(0.42 - (strictness - 40) / 400, 0.18, 0.5));
    const normal = Math.max(0, pool - high);
    const matchRate = Math.round(clampF(88 - Math.max(0, coreN - 2) * 4 - Math.max(0, strictness - 72) * 0.3 + impN * 1.5, 55, 96));

    return { pool, high, normal, strictness, strictLabel, matchRate, cityPool, coreN, impN, strengthSum };
  }

  /* ---- AI 条件优化建议 ---- */
  function buildAiSuggestions(pref, impact) {
    const meta = pref.skillMeta || {};
    const list = [];
    const plusCore = Object.keys(meta).filter((k) => meta[k].level === 'core' && SKILL_PLUS_CANDIDATES.indexOf(k) >= 0);
    if (plusCore.length) {
      const sk = plusCore[0];
      const p2 = computeCondImpact(Object.assign({}, pref, { skillMeta: Object.assign({}, meta, { [sk]: Object.assign({}, meta[sk], { level: 'plus' }) }) }));
      const gain = p2.pool - impact.pool;
      const gainPct = impact.pool ? Math.round((gain / impact.pool) * 100) : 0;
      list.push({
        title: `「${sk}」被设置为「核心要求」`,
        suggest: `调整为「加分项」`,
        body: `预计岗位覆盖 ${impact.pool} → ${p2.pool}，岗位池 ${gain > 0 ? '+' : ''}${gainPct}%`,
        reason: `${sk} 在当前目标岗位中更常作为加分技能，不建议作为硬性筛选条件。`,
        apply: () => { meta[sk].level = 'plus'; }
      });
    } else if (impact.coreN >= 4) {
      const weak = Object.keys(meta).filter((k) => meta[k].level === 'core').sort((a, b) => meta[a].strength - meta[b].strength)[0];
      list.push({
        title: `核心要求过多（${impact.coreN} 项）`,
        suggest: `将「${weak}」调整为重要能力`,
        body: '降低硬性门槛有助于扩大岗位池，同时保留匹配倾向。',
        reason: '硬性核心要求过多会显著缩小岗位覆盖，建议保留真正关键的 1-3 项。',
        apply: () => { if (weak) meta[weak].level = 'important'; }
      });
    } else if (pref.salaryMin != null && pref.salaryMax != null && (pref.salaryMax - pref.salaryMin) <= 10 && pref.salaryMin >= 20) {
      list.push({
        title: `薪资范围偏窄（${pref.salaryMin}-${pref.salaryMax}K）`,
        suggest: '放宽至 15-30K',
        body: '略放宽薪资区间即可显著扩大岗位覆盖范围。',
        reason: '该区间的岗位数量有限，建议保留弹性，优先保证岗位池质量。',
        apply: () => { pref.salaryMin = 15; pref.salaryMax = 30; }
      });
    } else if (pref.cities.length === 1) {
      list.push({
        title: '城市限定为单一城市',
        suggest: '增加至 2-3 个城市',
        body: '跨城市搜索可显著扩大岗位覆盖范围。',
        reason: '单一城市岗位池有限，开放 2-3 个一线城市可提升高匹配岗位数量。',
        apply: () => { pref.cities = ['北京', '上海', '杭州']; }
      });
    }
    return list;
  }

  /* ---- 整体渲染入口 ---- */
  function renderCondWorkbench() {
    const pref = window.matchState.preferences;
    syncSkillsToLegacy(pref);
    const impact = computeCondImpact(pref);
    const last = window.matchState._lastCondImpact;
    impact.delta = (last && last.pool != null) ? impact.pool - last.pool : 0;
    impact.deltaPct = (last && last.pool) ? Math.round((impact.delta / last.pool) * 100) : 0;
    window.matchState._lastCondImpact = { pool: impact.pool };

    renderCondEditor(pref, impact);
    renderCondImpactPanel(pref, impact);
    renderCondTarget(pref, impact);
    renderCondChecks(pref, impact);
    renderCondCompleteness(pref);
    renderAIPanelMatch();
  }

  /* ================= 左栏 · 条件编辑器 ================= */
  function renderCondEditor(pref, impact) {
    const box = $('cond-editor'); if (!box) return;
    const meta = pref.skillMeta || {};
    const skillNames = Object.keys(meta);
    const allCities = pref.cities.length === 0;
    const salFree = pref.salaryMin == null || pref.salaryMax == null;
    const cityPotential = computeCondImpact(Object.assign({}, pref, { cities: [] })).pool - impact.pool;
    const salPotential = salFree ? 0 : computeCondImpact(Object.assign({}, pref, { salaryMin: null, salaryMax: null })).pool - impact.pool;
    const typePotential = computeCondImpact(Object.assign({}, pref, { jobTypes: [] })).pool - impact.pool;
    const skillPotential = impact.coreN > 2 ? Math.round(impact.pool * 0.16) : 0;

    box.innerHTML = `
      <div class="cond-section">
        <div class="cond-section-title">基础条件</div>
        <div class="cond-row">
          <span class="cond-row-label">城市<span class="cond-row-pot ${cityPotential > 0 ? 'is-up' : ''}" data-focus="city">+${cityPotential}</span></span>
          <div class="cond-row-body">
            <div class="cond-chips">
              ${allCities ? '<span class="cond-chip cond-chip--all">全国 <i data-clear="city" title="移除">×</i></span>' : pref.cities.map((c) => `<span class="cond-chip">${escapeHtml(c)} <i data-city="${escapeHtml(c)}" title="移除">×</i></span>`).join('')}
            </div>
            <div class="cond-addbox">
              <button class="cond-addbtn" id="cond-add-city" type="button">+ 添加城市</button>
              <div class="cond-picker" id="cond-city-picker" hidden>
                ${COND_CITIES.map((c) => (c === '全国' || c === '不限' || pref.cities.indexOf(c) < 0) ? `<button class="cond-pick-item" data-city="${escapeHtml(c)}" type="button">${escapeHtml(c)}</button>` : '').join('')}
              </div>
            </div>
          </div>
        </div>
        <div class="cond-row">
          <span class="cond-row-label">薪资<span class="cond-row-pot ${salPotential > 0 ? 'is-up' : ''}" data-focus="salary">${salPotential > 0 ? '+' + salPotential : ''}</span></span>
          <div class="cond-row-body">${renderSalaryControl(pref)}</div>
        </div>
        <div class="cond-row">
          <span class="cond-row-label">工作性质<span class="cond-row-pot ${typePotential > 0 ? 'is-up' : ''}" data-focus="type">+${typePotential}</span></span>
          <div class="cond-row-body">
            <div class="cond-opt-chips">
              ${JOBTYPES.map(([v, l]) => `<button class="cond-opt-chip ${(pref.jobTypes || []).indexOf(v) >= 0 ? 'is-on' : ''}" data-type="${v}" type="button">${l}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="cond-section">
        <div class="cond-section-title">技能条件 <small>点击优先级标签切换 · 点击星星设置强度</small></div>
        <div class="cond-skill-list">
          ${skillNames.length ? skillNames.map((s) => renderSkillItem(s, meta[s])).join('') : '<div class="cond-empty">尚未配置技能条件，点击下方「+ 添加技能」</div>'}
        </div>
        <div class="cond-addbox">
          <button class="cond-addbtn" id="cond-add-skill" type="button">+ 添加技能</button>
          <div class="cond-picker cond-picker--skill" id="cond-skill-picker" hidden>
            ${SKILL_POOL.filter((s) => skillNames.indexOf(s) < 0).map((s) => `<button class="cond-pick-item" data-skill="${escapeHtml(s)}" type="button">${escapeHtml(s)}</button>`).join('') || '<div class="cond-pick-empty">技能已全部添加</div>'}
          </div>
        </div>
      </div>`;
    bindCondEditorEvents(box, pref);
  }

  function renderSalaryControl(pref) {
    const free = pref.salaryMin == null || pref.salaryMax == null;
    const min = free ? 15 : pref.salaryMin;
    const max = free ? 25 : pref.salaryMax;
    return `
      <div class="cond-salary">
        <div class="cond-range">
          <div class="cond-range-bar"><i id="cond-range-fill" style="left:${pctOf(min)}%;right:${100 - pctOf(max)}%"></i></div>
          <input type="range" class="cond-rmin" id="cond-salary-min" min="5" max="80" step="1" value="${min}" ${free ? 'disabled' : ''}>
          <input type="range" class="cond-rmax" id="cond-salary-max" min="5" max="80" step="1" value="${max}" ${free ? 'disabled' : ''}>
        </div>
        <div class="cond-salary-inputs">
          <label>最低 <input type="number" id="cond-salary-min-n" min="5" max="80" value="${min}" ${free ? 'disabled' : ''}>K</label>
          <label>最高 <input type="number" id="cond-salary-max-n" min="5" max="80" value="${max}" ${free ? 'disabled' : ''}>K</label>
          <label class="cond-check"><input type="checkbox" id="cond-salary-free" ${free ? 'checked' : ''}> 面议</label>
        </div>
      </div>`;
  }
  function pctOf(v) { return clampF(((v - 5) / 75) * 100, 0, 100); }

  function renderSkillItem(name, cfg) {
    return `
      <div class="cond-skill-item" data-skill="${escapeHtml(name)}">
        <div class="cond-skill-row">
          <span class="cond-skill-name">${escapeHtml(name)}</span>
          <button class="cond-skill-lv cond-lv--${cfg.level}" data-lv-toggle="${escapeHtml(name)}" type="button" title="点击切换优先级">${labelOf(SKILL_LEVELS, cfg.level)}</button>
          <button class="cond-skill-rm" data-skill-rm="${escapeHtml(name)}" type="button" title="移除技能">×</button>
        </div>
        <div class="cond-skill-str">
          <span class="cond-skill-str-label">要求强度</span>
          <span class="cond-stars" data-stars="${escapeHtml(name)}">
            ${[1, 2, 3, 4, 5].map((i) => `<i class="cond-star ${i <= cfg.strength ? 'on' : ''}" data-v="${i}"></i>`).join('')}
          </span>
          <b class="cond-skill-str-val">${cfg.strength}/5</b>
        </div>
      </div>`;
  }

  /* ================= 中栏 · 条件影响分析 ================= */
  function renderCondImpactPanel(pref, impact) {
    const box = $('cond-impact'); if (!box) return;
    const aiList = buildAiSuggestions(pref, impact);
    const d = impact.delta;
    const deltaHtml = d === 0
      ? '<span class="cond-delta cond-delta--none">条件未变化</span>'
      : d > 0
        ? `<span class="cond-delta cond-delta--up">+${d} 个岗位</span><span class="cond-delta-note">覆盖范围扩大 ${impact.deltaPct}%</span>`
        : `<span class="cond-delta cond-delta--down">${d} 个岗位</span><span class="cond-delta-note">岗位范围减少 ${Math.abs(impact.deltaPct)}%</span>`;
    box.innerHTML = `
      <div class="cond-strict">
        <div class="cond-strict-head"><span>条件严格度</span><b id="cond-strict-num">0</b><small>/ 100</small></div>
        <div class="cond-strict-bar"><i id="cond-strict-fill"></i><span class="cond-strict-dot" id="cond-strict-dot"></span></div>
        <div class="cond-strict-scale"><span>低</span><b id="cond-strict-label">${escapeHtml(impact.strictLabel)}</b><span>高</span></div>
      </div>
      <div class="cond-impact-section">
        <div class="cond-impact-title">岗位覆盖范围</div>
        <div class="cond-pool-row">
          <b id="cond-pool-num">0</b><span>个岗位</span>${deltaHtml}
        </div>
        <div class="cond-pool-bar"><i id="cond-pool-high"></i><i id="cond-pool-normal"></i></div>
        <div class="cond-pool-legend">
          <span><i class="lg-high"></i>高匹配 <b id="cond-high-num">0</b></span>
          <span><i class="lg-normal"></i>普通匹配 <b id="cond-normal-num">0</b></span>
        </div>
      </div>
      <div class="cond-impact-section" id="cond-factor-box">
        <div class="cond-impact-title">条件影响 <small>放宽该项可增加的岗位</small></div>
        <div class="cond-factor-list">
          ${[['city', '城市', pref.cities.length ? pref.cities.length + ' 城' : '全国', impact.cityPool >= 400 ? 100 : Math.round(impact.cityPool / 8.46)], ['salary', '薪资', pref.salaryMin == null ? '面议' : pref.salaryMin + '-' + pref.salaryMax + 'K', Math.round(impact.pool / 8.46)], ['type', '性质', (pref.jobTypes || []).length + ' 种', Math.round(impact.pool / 8.46)], ['skill', '技能', impact.coreN + ' 核心', Math.round(impact.pool / 8.46)]].map((f) => `
            <div class="cond-factor" data-factor="${f[0]}">
              <span class="cond-factor-label">${f[1]}</span>
              <div class="cond-factor-track"><i style="width:${clampF(f[3], 4, 100)}%"></i></div>
              <span class="cond-factor-cur">${escapeHtml(f[2])}</span>
            </div>`).join('')}
        </div>
      </div>
      <div class="cond-ai" id="cond-ai-box">
        ${aiList.length ? `
          <div class="cond-ai-head"><span class="cond-ai-ico">💡</span><b>AI 条件优化建议</b></div>
          <div class="cond-ai-title">当前：${escapeHtml(aiList[0].title)}</div>
          <div class="cond-ai-suggest">建议：${escapeHtml(aiList[0].suggest)}</div>
          <div class="cond-ai-meta">${escapeHtml(aiList[0].body)}</div>
          <div class="cond-ai-reason">推荐理由：${escapeHtml(aiList[0].reason)}</div>
          <button class="btn-sm btn-sm--solid cond-ai-apply" type="button">应用建议</button>`
        : '<div class="cond-ai-empty">当前条件下暂无需优化，条件较为均衡。</div>'}
      </div>`;
    // 动画（从当前值平滑过渡到新值）
    countUpTo($('cond-strict-num'), impact.strictness, 900);
    countUpTo($('cond-pool-num'), impact.pool, 1000);
    countUpTo($('cond-high-num'), impact.high, 1000);
    countUpTo($('cond-normal-num'), impact.normal, 1000);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const sf = $('cond-strict-fill'); if (sf) sf.style.width = impact.strictness + '%';
      const sd = $('cond-strict-dot'); if (sd) sd.style.left = impact.strictness + '%';
      const ph = $('cond-pool-high'); if (ph) ph.style.width = Math.round((impact.high / Math.max(1, impact.pool)) * 100) + '%';
      const pn = $('cond-pool-normal'); if (pn) pn.style.width = Math.round((impact.normal / Math.max(1, impact.pool)) * 100) + '%';
    }));
    // AI 建议应用
    const aiApply = qs('.cond-ai-apply', box);
    if (aiApply) aiApply.addEventListener('click', () => {
      const list = buildAiSuggestions(pref, impact);
      if (list[0]) { list[0].apply(); hidePickers(); renderCondWorkbench(); }
    });
    // 条件影响行点击高亮
    qsa('.cond-factor', box).forEach((f) => f.addEventListener('click', () => {
      qsa('.cond-factor', box).forEach((x) => x.classList.remove('is-hl'));
      f.classList.add('is-hl');
    }));
  }

  /* ================= 右栏 · 目标岗位画像 ================= */
  function renderCondTarget(pref, impact) {
    const box = $('cond-target'); if (!box) return;
    const meta = pref.skillMeta || {};
    const core = Object.keys(meta).filter((k) => meta[k].level === 'core');
    const imp = Object.keys(meta).filter((k) => meta[k].level === 'important');
    const plus = Object.keys(meta).filter((k) => meta[k].level === 'plus');
    const reqVal = (s) => (STRENGTH_TO_REQ[meta[s].strength] != null ? STRENGTH_TO_REQ[meta[s].strength] : 75);
    const cityTxt = pref.cities.length ? pref.cities.join(' · ') : '全国';
    const salaryTxt = pref.salaryMin == null ? '面议' : pref.salaryMin + '-' + pref.salaryMax + 'K';
    const typeTxt = (pref.jobTypes || []).map((t) => labelOf(JOBTYPES, t)).filter(Boolean).join(' / ') || '不限';
    const reqRows = (list, cls) => list.map((s) => `<div class="cond-skill-req"><span>${escapeHtml(s)}</span><div class="cond-skill-req-bar"><i data-w="${reqVal(s)}"></i></div><b>${reqVal(s)}</b></div>`).join('');
    box.innerHTML = `
      <div class="cond-target-name">${escapeHtml(pref.direction || '目标岗位')}</div>
      <div class="cond-target-co">公司信息以岗位接口返回为准 · 校招优先</div>
      <div class="cond-target-meta">
        <span>${escapeHtml(cityTxt)}</span><span>${escapeHtml(salaryTxt)}</span><span>${escapeHtml(typeTxt)}</span>
      </div>
      <div class="cond-target-rate">
        <svg class="cond-rate-ring" viewBox="0 0 48 48">
          <circle class="ring-bg" cx="24" cy="24" r="19" pathLength="100"></circle>
          <circle class="ring-fg" id="cond-rate-fg" cx="24" cy="24" r="19" pathLength="100" data-rate="${impact.matchRate}"></circle>
        </svg>
        <div class="cond-rate-num"><b id="cond-rate-num">0</b><span>%</span></div>
        <div class="cond-rate-label">当前预计匹配</div>
      </div>
      <div class="cond-target-sec"><span>核心技能</span>${core.length ? reqRows(core) : '<div class="cond-empty">未配置</div>'}</div>
      ${imp.length ? `<div class="cond-target-sec"><span>重要能力</span>${reqRows(imp)}</div>` : ''}
      ${plus.length ? `<div class="cond-target-sec cond-target-sec--plus"><span>加分技能</span>${reqRows(plus)}</div>` : ''}
      <div class="cond-target-foot">
        <div><b id="cond-tpool">0</b><span>可匹配岗位</span></div>
        <div><b id="cond-thigh">0</b><span>高匹配岗位</span></div>
      </div>`;
    countUpTo($('cond-rate-num'), impact.matchRate, 1000);
    countUpTo($('cond-tpool'), impact.pool, 1000);
    countUpTo($('cond-thigh'), impact.high, 1000);
    const fg = $('cond-rate-fg');
    if (fg) fg.style.strokeDashoffset = 100 - (parseFloat(fg.dataset.rate || 0) || 0);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      box.querySelectorAll('.cond-skill-req-bar i').forEach((el) => { el.style.width = el.dataset.w + '%'; });
    }));
  }

  /* ================= 底部状态栏 ================= */
  function renderCondChecks(pref, impact) {
    const box = $('cond-checks'); if (!box) return;
    const meta = pref.skillMeta || {};
    const complete = !!pref.direction && pref.cities.length > 0 && (pref.salaryMin != null || pref.salaryMax != null) && (pref.jobTypes || []).length > 0 && Object.keys(meta).length > 0;
    const checks = [
      { ok: complete, text: '条件完整' },
      { ok: impact.pool > 0, text: '岗位有效' }
    ];
    if (impact.strictness > 65) checks.push({ warn: true, text: '1 项条件可能限制岗位范围' });
    box.innerHTML = checks.map((c) => c.warn
      ? '<span class="cond-check cond-check--warn"><i>⚠</i>' + c.text + '</span>'
      : `<span class="cond-check ${c.ok ? 'cond-check--ok' : 'cond-check--no'}"><i>${c.ok ? '✓' : '·'}</i>${c.text}</span>`).join('');
  }

  function renderCondCompleteness(pref) {
    const el = $('cond-completeness'); if (!el) return;
    const meta = pref.skillMeta || {};
    const filled = [!!pref.direction, pref.cities.length > 0, pref.salaryMin != null || pref.salaryMax != null, (pref.jobTypes || []).length > 0, Object.keys(meta).length > 0].filter(Boolean).length;
    countUpTo(el, Math.round(filled / 5 * 100), 900);
  }

  // 轻量刷新（滑块拖动等高频场景：不重建左栏编辑器，只更新影响/画像/状态）
  function refreshImpact() {
    const pref = window.matchState.preferences;
    const impact = computeCondImpact(pref);
    const last = window.matchState._lastCondImpact;
    impact.delta = (last && last.pool != null) ? impact.pool - last.pool : 0;
    impact.deltaPct = (last && last.pool) ? Math.round((impact.delta / last.pool) * 100) : 0;
    window.matchState._lastCondImpact = { pool: impact.pool };
    renderCondImpactPanel(pref, impact);
    renderCondTarget(pref, impact);
    renderCondChecks(pref, impact);
    renderCondCompleteness(pref);
  }

  /* ================= 左栏交互 ================= */
  function bindCondEditorEvents(root, pref) {
    root.querySelectorAll('[data-city]').forEach((i) => i.addEventListener('click', (e) => {
      e.stopPropagation();
      pref.cities = pref.cities.filter((c) => c !== i.dataset.city);
      renderCondWorkbench();
    }));
    root.querySelectorAll('[data-clear="city"]').forEach((i) => i.addEventListener('click', (e) => {
      e.stopPropagation(); pref.cities = []; renderCondWorkbench();
    }));
    const addCity = $('cond-add-city');
    if (addCity) addCity.addEventListener('click', () => togglePicker('cond-city-picker'));
    root.querySelectorAll('#cond-city-picker [data-city]').forEach((b) => b.addEventListener('click', () => {
      const c = b.dataset.city;
      if (c === '全国' || c === '不限') pref.cities = [];
      else if (pref.cities.indexOf(c) < 0) pref.cities.push(c);
      hidePickers(); renderCondWorkbench();
    }));
    root.querySelectorAll('.cond-opt-chip[data-type]').forEach((b) => b.addEventListener('click', () => {
      if (!pref.jobTypes) pref.jobTypes = [];
      const i = pref.jobTypes.indexOf(b.dataset.type);
      if (i >= 0) pref.jobTypes.splice(i, 1); else pref.jobTypes.push(b.dataset.type);
      renderCondWorkbench();
    }));
    bindSalaryEvents(pref);
    const addSkill = $('cond-add-skill');
    if (addSkill) addSkill.addEventListener('click', () => togglePicker('cond-skill-picker'));
    root.querySelectorAll('#cond-skill-picker [data-skill]').forEach((b) => b.addEventListener('click', () => {
      const s = b.dataset.skill;
      if (!pref.skillMeta[s]) pref.skillMeta[s] = { level: 'important', strength: 3 };
      hidePickers(); renderCondWorkbench();
    }));
    root.querySelectorAll('.cond-skill-lv[data-lv-toggle]').forEach((b) => b.addEventListener('click', () => {
      const s = b.dataset.lvToggle;
      const cur = pref.skillMeta[s] ? pref.skillMeta[s].level : 'important';
      pref.skillMeta[s].level = LV_ORDER[(LV_ORDER.indexOf(cur) + 1) % LV_ORDER.length];
      renderCondWorkbench();
    }));
    root.querySelectorAll('.cond-stars[data-stars]').forEach((wrap) => wrap.addEventListener('click', (e) => {
      const star = e.target.closest('.cond-star'); if (!star) return;
      const s = wrap.dataset.stars;
      pref.skillMeta[s].strength = parseInt(star.dataset.v, 10);
      renderCondWorkbench();
    }));
    root.querySelectorAll('.cond-skill-rm[data-skill-rm]').forEach((b) => b.addEventListener('click', () => {
      delete pref.skillMeta[b.dataset.skillRm];
      renderCondWorkbench();
    }));
    // 点击条件影响潜力标签 → 高亮中栏对应维度
    root.querySelectorAll('.cond-row-pot[data-focus]').forEach((el) => el.addEventListener('click', (e) => {
      e.stopPropagation();
      const box = $('cond-impact'); if (!box) return;
      const item = qs('.cond-factor[data-factor="' + el.dataset.focus + '"]', box);
      qsa('.cond-factor', box).forEach((x) => x.classList.remove('is-hl'));
      if (item) { item.classList.add('is-hl'); item.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }));
  }

  function bindSalaryEvents(pref) {
    const rmin = $('cond-salary-min'); const rmax = $('cond-salary-max');
    const nmin = $('cond-salary-min-n'); const nmax = $('cond-salary-max-n');
    const free = $('cond-salary-free');
    const sync = () => {
      if (!rmin || !rmax) return;
      let lo = parseInt(rmin.value, 10); let hi = parseInt(rmax.value, 10);
      if (lo > hi) { if (document.activeElement === rmin) { hi = lo; rmax.value = hi; } else { lo = hi; rmin.value = lo; } }
      pref.salaryMin = lo; pref.salaryMax = hi;
      if (nmin) nmin.value = lo; if (nmax) nmax.value = hi;
      const fill = $('cond-range-fill');
      if (fill) { fill.style.left = pctOf(lo) + '%'; fill.style.right = (100 - pctOf(hi)) + '%'; }
      refreshImpact();
    };
    if (rmin) rmin.addEventListener('input', sync);
    if (rmax) rmax.addEventListener('input', sync);
    if (rmin) rmin.addEventListener('change', renderCondWorkbench);
    if (rmax) rmax.addEventListener('change', renderCondWorkbench);
    if (nmin) nmin.addEventListener('change', () => {
      const hi = rmax ? parseInt(rmax.value, 10) : 80;
      pref.salaryMin = clampF(parseInt(nmin.value, 10) || 5, 5, hi); renderCondWorkbench();
    });
    if (nmax) nmax.addEventListener('change', () => {
      const lo = rmin ? parseInt(rmin.value, 10) : 5;
      pref.salaryMax = clampF(parseInt(nmax.value, 10) || 80, lo, 80); renderCondWorkbench();
    });
    if (free) free.addEventListener('change', () => {
      if (free.checked) { pref.salaryMin = null; pref.salaryMax = null; }
      else { pref.salaryMin = 15; pref.salaryMax = 25; }
      renderCondWorkbench();
    });
  }

  function togglePicker(id) {
    const p = $(id); if (!p) return;
    const willShow = p.hidden;
    hidePickers();
    p.hidden = !willShow;
  }
  function hidePickers() { qsa('.cond-picker').forEach((x) => { x.hidden = true; }); }

  /* ================= 岗位画像编辑浮层 ================= */
  function openJobEditor() {
    const modal = $('cond-job-modal'); if (!modal) return;
    const pref = window.matchState.preferences;
    const body = $('cond-job-body'); if (!body) return;
    body.innerHTML = `
      <div class="cond-job-field"><label>岗位名称</label><input type="text" id="cjob-name" value="${escapeHtml(pref.direction || '')}"></div>
      <div class="cond-job-field"><label>城市</label>
        <select id="cjob-city">
          ${COND_CITIES.map((c) => `<option value="${escapeHtml(c)}" ${pref.cities.length === 1 && pref.cities[0] === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>
      <div class="cond-job-field"><label>薪资范围</label>
        <div class="cond-job-salary">
          <input type="number" id="cjob-smin" min="5" max="80" value="${pref.salaryMin == null ? 15 : pref.salaryMin}">
          <span>—</span>
          <input type="number" id="cjob-smax" min="5" max="80" value="${pref.salaryMax == null ? 25 : pref.salaryMax}">
          <span>K</span>
        </div>
      </div>
      <div class="cond-job-field"><label>工作性质</label>
        <div class="cond-opt-chips" id="cjob-types">
          ${JOBTYPES.map(([v, l]) => `<button class="cond-opt-chip ${(pref.jobTypes || []).indexOf(v) >= 0 ? 'is-on' : ''}" data-type="${v}" type="button">${l}</button>`).join('')}
        </div>
      </div>
      <div class="cond-job-field"><label>技能要求</label>
        <div class="cond-job-skills" id="cjob-skills">${renderJobSkillChips(pref)}</div>
        <div class="cond-job-addskill">
          <select id="cjob-skill-add"><option value="">+ 添加技能…</option>${SKILL_POOL.filter((s) => !pref.skillMeta[s]).map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}</select>
        </div>
      </div>`;
    modal.hidden = false;
  }
  function renderJobSkillChips(pref) {
    return Object.keys(pref.skillMeta || {}).map((s) => `<span class="cond-chip">${escapeHtml(s)} <i data-skill="${escapeHtml(s)}">×</i></span>`).join('') || '<span class="cond-job-skill-empty">暂无技能</span>';
  }
  function bindJobEditorModal() {
    const modal = $('cond-job-modal'); if (!modal) return;
    const close = $('cond-job-close'); if (close) close.addEventListener('click', () => { modal.hidden = true; });
    const cancel = $('cond-job-cancel'); if (cancel) cancel.addEventListener('click', () => { modal.hidden = true; });
    const mask = modal.querySelector('.cond-job-mask'); if (mask) mask.addEventListener('click', () => { modal.hidden = true; });
    const save = $('cond-job-save'); if (save) save.addEventListener('click', () => {
      const pref = window.matchState.preferences;
      const name = $('cjob-name'); if (name && name.value.trim()) pref.direction = name.value.trim();
      const city = $('cjob-city');
      if (city) { const v = city.value; pref.cities = (v === '全国' || v === '不限') ? [] : [v]; }
      const smin = $('cjob-smin'); const smax = $('cjob-smax');
      if (smin && smax) {
        const lo = clampF(parseInt(smin.value, 10) || 15, 5, 80);
        const hi = clampF(parseInt(smax.value, 10) || 25, lo, 80);
        pref.salaryMin = lo; pref.salaryMax = hi;
      }
      modal.hidden = true;
      renderCondWorkbench();
    });
    modal.addEventListener('click', (e) => {
      const tb = e.target.closest('#cjob-types .cond-opt-chip');
      if (tb) {
        const pref = window.matchState.preferences;
        if (!pref.jobTypes) pref.jobTypes = [];
        const i = pref.jobTypes.indexOf(tb.dataset.type);
        if (i >= 0) pref.jobTypes.splice(i, 1); else pref.jobTypes.push(tb.dataset.type);
        tb.classList.toggle('is-on');
        return;
      }
      const del = e.target.closest('#cjob-skills [data-skill]');
      if (del) {
        delete window.matchState.preferences.skillMeta[del.dataset.skill];
        const box = $('cjob-skills'); if (box) box.innerHTML = renderJobSkillChips(window.matchState.preferences);
        const sel = $('cjob-skill-add');
        if (sel) sel.innerHTML = '<option value="">+ 添加技能…</option>' + SKILL_POOL.filter((s) => !window.matchState.preferences.skillMeta[s]).map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
        return;
      }
      const sel = e.target.closest('#cjob-skill-add');
      if (sel && sel.value) {
        const pref = window.matchState.preferences;
        if (!pref.skillMeta[sel.value]) pref.skillMeta[sel.value] = { level: 'important', strength: 3 };
        sel.value = '';
        const box = $('cjob-skills'); if (box) box.innerHTML = renderJobSkillChips(pref);
        sel.innerHTML = '<option value="">+ 添加技能…</option>' + SKILL_POOL.filter((s) => !pref.skillMeta[s]).map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
      }
    });
  }

  /* ============================================================
   * AI 分析 · 简历解析引擎（AI Processing）
   * 中央 AI 能量球 + 环形任务节点 + 实时识别流 + 生成内容预览
   * ============================================================ */
  const RP_STEPS = [
    { t: '简历结构解析', d: '解析 PDF / 文本，分离教育、经历、项目、技能区块', icon: '📄' },
    { t: '技术技能识别', d: '归一化技能名称，识别掌握程度与项目证据', icon: '⚙️' },
    { t: '项目经验分析', d: '定位核心项目与你在其中的技术角色', icon: '🗂️' },
    { t: '职业能力建模', d: '将能力节点构建为六维职业画像', icon: '◉' },
    { t: '岗位匹配计算', d: '与目标岗位要求比对，计算多维匹配度', icon: '⌁' }
  ];
  const RP_KEYWORDS = ['Java', 'Spring Boot', 'Redis', 'MySQL', '微服务', 'Docker', 'JVM', '并发编程', 'Nacos', 'Kubernetes', 'Maven', 'Git', 'Linux', 'RESTful'];
  const RP_RING_C = 251.2;
  let _rpsKw = 0;

  function runMatch() {
    if (!window.matchState || !window.matchState.file) {
      window.showToast('请先上传简历', 'amber');
      try { setView('entry'); } catch (e) {}
      return;
    }
    setView('analysis');
    startTheater();
    // 保证分析动画至少展示 4.6s，给用户完整的“AI 正在阅读”体验
    const minShow = new Promise((r) => setTimeout(r, reduceMotion() ? 400 : 4600));
    Promise.all([diagnoseResume(window.matchState.file), minShow]).then((arr) => {
      window.matchState.result = arr[0];
      finishTheater();
      setTimeout(() => { setView('jobs'); }, reduceMotion() ? 200 : 700);
    }).catch((err) => {
      stopTheater();
      window.showToast('匹配失败：' + (err && err.message ? err.message : '请重试'), 'amber');
    });
  }

  function diagnoseResume(file) {
    // Phase 03：真实后端 /api/match/diagnose；失败或空结果时降级演示数据，保证流程可通
    const api = (window.API_BASE || ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') ? 'http://127.0.0.1:5000' : location.origin));
    const fd = new FormData();
    fd.append('file', file);
    return fetch(api + '/api/match/diagnose', { method: 'POST', body: fd })
      .then((r) => r.json().catch(() => null).then((p) => ({ ok: r.ok, status: r.status, payload: p })))
      .then((res) => {
        const p = res.payload;
        if (p && p.code === 0 && p.data && Array.isArray(p.data.matches) && p.data.matches.length) {
          const st = window.matchState;
          if (st) {
            const mode = (p.data.model && p.data.model.mode) || '';
            st.mode = (mode === 'demo-jobs') ? 'demo' : 'real';
          }
          return p.data;
        }
        // 空结果 / 协议异常 → 演示数据
        return mockDiagnose().then((demo) => {
          const st = window.matchState;
          if (st) st.mode = 'demo';
          if (window.showToast) {
            const reason = (p && (p.detail || p.message || (p.data && p.data.model && p.data.model.error))) || ('HTTP ' + res.status);
            window.showToast('真实匹配暂不可用，已切换演示岗位：' + reason, 'amber');
          }
          demo.model = Object.assign({}, demo.model || {}, { mode: 'demo-fallback', used: false });
          return demo;
        });
      })
      .catch((err) => mockDiagnose().then((demo) => {
        const st = window.matchState;
        if (st) st.mode = 'demo';
        if (window.showToast) {
          window.showToast('匹配服务异常，已使用演示数据：' + (err && err.message ? err.message : '网络错误'), 'amber');
        }
        demo.model = Object.assign({}, demo.model || {}, { mode: 'demo-fallback', used: false });
        return demo;
      }));
  }
  function mockDiagnose() { return new Promise((resolve) => setTimeout(() => resolve(structuredClone(MOCK_RESULT)), reduceMotion() ? 180 : 900)); }

  /* ---- Phase 08-C：JobMatchingAgent 问答（/api/match/agent） ---- */
  function agentContext() {
    const st = window.matchState;
    const res = st.result;
    if (!res || !res.matches || !res.matches.length) return {};
    return {
      profile: res.profile,
      matches: (res.matches || []).map((m) => ({
        job: m.job, score: m.score, matched: m.matched, missing: m.missing,
        gaps: m.gaps, gap_paths: m.gap_paths, dimensions: m.dimensions,
        match_reasons: m.match_reasons,
        evidence: (m.evidence || []).slice(0, 3),
        confidence: m.confidence, sources: m.sources
      })),
      gap_graph: res.gap_graph,
      learning_path: res.learning_path
    };
  }

  async function callJobMatchingAgent(message, selectedJobId) {
    const st = window.matchState;
    const api = (window.API_BASE || ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') ? 'http://127.0.0.1:5000' : location.origin));
    const context = agentContext();
    const body = {
      message: message || '',
      context,
      selected_job_id: selectedJobId != null ? String(selectedJobId)
        : (st.selectedJobId != null ? String(st.selectedJobId) : null),
      filename: st.fileName || 'resume.txt'
    };
    // 仅当无画像时才回传简历原文（避免重复传递大文本）
    if (!context.profile && st.file && typeof st.file.text === 'function') {
      try { body.resume_text = await st.file.text(); } catch (e) {}
    }
    const r = await fetch(api + '/api/match/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const p = await r.json().catch(() => null);
    if (!p || p.code !== 0) throw new Error((p && (p.detail || p.message)) || 'AI 顾问调用失败');
    st.agent.result = p.data;
    st.agent.message = message || '';
    return p.data;
  }

  function renderAgentResult(d, el) {
    if (!el) return;
    const answer = (d && (d.answer || d.summary)) || '';
    let html = `<div class="jd-agent-answer">${escapeHtml(answer)}</div>`;
    if (d && d.intent === 'WHAT_IF' && d.skill) {
      const before = d.before && d.before.score != null ? d.before.score : '—';
      const after = d.after && d.after.score != null ? d.after.score : '—';
      const changes = (d.changes || []).map(escapeHtml).join('、');
      html += `<div class="aip-p">技能 <b>${escapeHtml(d.skill)}</b>：匹配度 ${before} → ${after}${changes ? '；可补齐缺口：' + changes : ''}</div>`;
    }
    if (d && d.confidence) html += `<div class="aip-p" style="opacity:.75">置信度：${escapeHtml(d.confidence)}</div>`;
    const evs = (d && d.evidence) || [];
    if (evs.length) {
      html += `<div class="detail-section-title" style="margin-top:10px">Evidence</div>` +
        evs.slice(0, 3).map((e) => `<div class="jd-evidence">“${escapeHtml((e.snippet || '').slice(0, 160))}”${e.source_url ? `<br><a href="${escapeHtml(e.source_url)}" target="_blank" rel="noreferrer">来源链接 ↗</a>` : ''}</div>`).join('');
    }
    el.innerHTML = html;
  }

  function renderJobAgentPanel(m) {
    const el = $('jd-agent-panel'); if (!el || !m) return;
    el.innerHTML = `
      <div class="jd-agent">
        <div class="detail-section-title mt">AI 顾问 · 人岗匹配问答</div>
        <div class="jd-agent-actions">
          <button class="btn-sm btn-sm--ghost" type="button" data-agent-intent="EXPLAIN">为什么推荐</button>
          <button class="btn-sm btn-sm--ghost" type="button" data-agent-intent="GAP">缺什么技能</button>
          <button class="btn-sm btn-sm--ghost" type="button" data-agent-intent="JOB_ANALYSIS">分析岗位</button>
          <button class="btn-sm btn-sm--ghost" type="button" data-agent-intent="LEARNING">如何提升</button>
        </div>
        <div class="jd-agent-input">
          <input id="jd-agent-q" type="text" placeholder="向 AI 顾问提问（如：如果我增加 Redis 能力会怎样？）" autocomplete="off" />
          <button class="btn-sm btn-sm--solid" id="jd-agent-send" type="button">提问</button>
        </div>
        <div class="jd-agent-result" id="jd-agent-result"></div>
      </div>`;
    const INTENT_MSGS = {
      EXPLAIN: '为什么推荐这个岗位？',
      GAP: '我与这个岗位相比缺少哪些技能？',
      JOB_ANALYSIS: '分析这个岗位。',
      LEARNING: '为了达到这个岗位要求，我应该如何提升？'
    };
    qsa('[data-agent-intent]', el).forEach((b) => b.addEventListener('click', () => {
      const msg = INTENT_MSGS[b.dataset.agentIntent];
      if (msg) runAgentAsk(msg, m, el);
    }));
    const send = $('jd-agent-send'); const q = $('jd-agent-q');
    if (send && q) {
      send.addEventListener('click', () => { const v = q.value.trim(); if (v) runAgentAsk(v, m, el); });
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const v = q.value.trim(); if (v) runAgentAsk(v, m, el); } });
    }
  }

  function runAgentAsk(message, m, panel) {
    const st = window.matchState;
    const resEl = panel && panel.querySelector('#jd-agent-result');
    if (!resEl) return;
    // Phase 08-D：Agent 只服务真实结果（Real Mode + 已诊断），Demo 模式不调用 Agent。
    if (st.mode !== 'real' || !st.result || !st.result.matches || !st.result.matches.length) {
      resEl.innerHTML = '<div class="aip-p">请先完成一次人岗匹配。</div>';
      return;
    }
    st.agent.loading = true;
    st.agent.message = message;
    resEl.innerHTML = '<div class="aip-p">AI 分析中…</div>';
    const jobId = m && m.job ? m.job.id : undefined;
    callJobMatchingAgent(message, jobId)
      .then((d) => { st.agent.loading = false; renderAgentResult(d, resEl); })
      .catch((err) => {
        st.agent.loading = false;
        // Agent 失败不阻塞主流程：展示兜底提示，保留上方匹配结果/证据
        resEl.innerHTML = '<div class="aip-p">暂时无法生成 AI 解释，请参考上方匹配结果与证据。</div>';
      });
  }

  /* ---- 环形任务节点 ---- */
  function renderRpsRing() {
    const ring = $('rps-ring'); if (!ring) return;
    const stage = $('rps-stage');
    const w = Math.max(620, stage ? stage.clientWidth : 900);
    const h = Math.max(420, stage ? stage.clientHeight : 520);
    const cx = w / 2, cy = h / 2;
    const rx = Math.min(w * 0.36, 320);
    const ry = Math.min(h * 0.3, 150);
    const N = RP_STEPS.length;
    let nodes = '', lines = '';
    const pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry;
      pts.push({ x, y });
      lines += `<line class="rps-node-line" data-step="${i}" x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" />`;
      nodes += `<div class="rps-node is-todo" data-step="${i}" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px">
        <span class="rps-node-icon">${RP_STEPS[i].icon}</span>
        <span class="rps-node-name">${escapeHtml(RP_STEPS[i].t)}</span>
        <span class="rps-node-state"><i></i><em>等待</em></span>
      </div>`;
    }
    ring.innerHTML = `<svg class="rps-node-svg" viewBox="0 0 ${w} ${h}" aria-hidden="true">${lines}</svg>` + nodes;
    // 进度环补足中心圆点
    const p = document.createElement('div');
    p.className = 'rps-node-center';
    p.style.cssText = `left:${cx.toFixed(1)}px;top:${cy.toFixed(1)}px;`;
    ring.appendChild(p);
  }

  function setRpsStepState(i, state) {
    const node = document.querySelector('.rps-node[data-step="' + i + '"]');
    const line = document.querySelector('.rps-node-line[data-step="' + i + '"]');
    if (node) {
      node.classList.remove('is-done', 'is-doing', 'is-todo');
      node.classList.add(state);
      const em = node.querySelector('.rps-node-state em');
      if (em) em.textContent = state === 'is-done' ? '已完成' : (state === 'is-doing' ? '进行中' : '等待');
    }
    if (line) {
      line.classList.remove('is-live', 'is-done');
      if (state === 'is-doing') line.classList.add('is-live');
      else if (state === 'is-done') line.classList.add('is-done');
    }
  }

  function setRpsProgress(pct) {
    const bar = $('rps-ring-bar');
    const num = $('analysis-pct');
    if (bar) {
      bar.style.strokeDashoffset = (RP_RING_C * (1 - pct / 100)).toFixed(1);
      bar.style.stroke = pct >= 86 ? '#f0b429' : (pct >= 42 ? '#f7c948' : '#35e0c8');
    }
    if (num) num.textContent = pct;
  }

  function updateRpsLog(step) {
    const log = $('rps-dyn-log'); if (!log) return;
    if (step >= RP_STEPS.length) { log.textContent = '已生成职业画像，正在进入岗位推荐…'; return; }
    log.textContent = '正在进行 · ' + RP_STEPS[step].t;
  }

  function addRpsKeyword(kw) {
    const chips = $('rps-find-chips'); if (!chips) return;
    const c = document.createElement('span');
    c.className = 'rps-kw';
    c.textContent = kw;
    chips.appendChild(c);
    if (chips.scrollWidth > chips.clientWidth + 10) chips.scrollLeft = chips.scrollWidth;
  }

  function renderRpsMarquee() {
    const track = $('rps-marquee-track'); if (!track) return;
    const seq = RP_KEYWORDS.concat(RP_KEYWORDS, RP_KEYWORDS);
    track.innerHTML = seq.map((k) => `<span class="rps-mq-kw">${escapeHtml(k)}</span>`).join('<span class="rps-mq-sep">◆</span>');
  }

  function updateRpsCounts(el) {
    const t = Math.min(1, el * 1.3);
    const ease = 1 - Math.pow(1 - t, 3);
    qsa('.rps-count b').forEach((b) => {
      const target = parseInt(b.dataset.count, 10) || 0;
      b.textContent = Math.round(ease * target);
    });
  }

  function startTheater() {
    const root = $('rps'); if (!root) return;
    const title = $('analysis-title'); if (title) title.textContent = '正在分析你的简历';
    const m = getSelectedJob();
    const dir = $('analysis-direction');
    if (dir) dir.innerHTML = (m && m.job && m.job.title) ? escapeHtml(m.job.title) + ' 方向' : 'Java 后端开发方向';
    renderRpsRing();
    renderRpsMarquee();
    const chips = $('rps-find-chips'); if (chips) chips.innerHTML = '';
    _rpsKw = 0;
    qsa('.rps-count b').forEach((b) => { b.textContent = '0'; });
    setRpsProgress(0);
    qsa('.rps-node').forEach((n) => setRpsStepState(parseInt(n.dataset.step, 10), 'is-todo'));
    qsa('.rps-preview-card').forEach((c) => c.classList.remove('is-ready'));
    if (window.matchState._theater) { clearInterval(window.matchState._theater); window.matchState._theater = null; }

    const DUR = reduceMotion() ? 700 : 4600;
    const t0 = performance.now();
    const total = RP_STEPS.length;
    const N = RP_KEYWORDS.length;
    let lastStep = -1;
    const tick = () => {
      const el = Math.min(1, (performance.now() - t0) / DUR);
      setRpsProgress(Math.round(el * 100));
      // 环形节点逐个激活
      const s = Math.min(total, Math.floor(el * total));
      if (s !== lastStep) {
        lastStep = s;
        for (let j = 0; j < total; j++) setRpsStepState(j, j < s ? 'is-done' : (j === s ? 'is-doing' : 'is-todo'));
        updateRpsLog(s);
      }
      // 技能关键词自动浮现
      const kw = Math.min(N, Math.floor(el * N * 1.2));
      while (_rpsKw < kw) { addRpsKeyword(RP_KEYWORDS[_rpsKw]); _rpsKw++; }
      // 计数滚动
      updateRpsCounts(el);
      if (el >= 1) { clearInterval(window.matchState._theater); window.matchState._theater = null; }
    };
    window.matchState._theater = setInterval(tick, 50);
    tick();
  }

  function stopTheater() {
    if (window.matchState._theater) { clearInterval(window.matchState._theater); window.matchState._theater = null; }
  }

  function finishTheater() {
    stopTheater();
    setRpsProgress(100);
    for (let j = 0; j < RP_STEPS.length; j++) setRpsStepState(j, 'is-done');
    const log = $('rps-dyn-log'); if (log) log.textContent = '分析完成 · 职业画像构建完毕';
    // 补齐未浮现的关键词
    while (_rpsKw < RP_KEYWORDS.length) { addRpsKeyword(RP_KEYWORDS[_rpsKw]); _rpsKw++; }
    qsa('.rps-count b').forEach((b) => { b.textContent = b.dataset.count; });
    qsa('.rps-preview-card').forEach((c) => c.classList.add('is-ready'));
    renderAIPanelAnalysis();
  }

  /* ============================================================
   * STATE 4 · 岗位推荐（高密度列表）
   * ============================================================ */
  function bindJobs() {
    const sort = $('jobs-sort');
    if (sort) sort.addEventListener('click', (e) => {
      const chip = e.target.closest('.jobs-sort-chip');
      if (!chip) return;
      qsa('.jobs-sort-chip', sort).forEach((c) => c.classList.toggle('is-active', c === chip));
      window.matchState.jobSort = chip.dataset.sort;
      renderJobs();
    });
  }

  function setJobsTab(tab) {
    const st = window.matchState;
    if (tab === 'now') st.recommendTab = 'now';
    else if (tab === 'future') st.recommendTab = 'future';
    else if (tab === 'top') st.recommendTab = 'top';
    else if (tab === 'high') st.recommendTab = 'high';
    renderJobs();
  }

  function salaryNum(s) { const m = String(s || '').match(/(\d+)/g); return m ? parseInt(m[m.length - 1], 10) : 0; }
  // 最快到岗排序因子：数值越小越快
  function quickNum(m) { return typeof m.quick_days === 'number' ? m.quick_days : 14; }

  function getFilteredJobs() {
    const st = window.matchState; const res = currentResult();
    const list = ((res && res.matches) || []).slice();
    const sort = st.jobSort || 'match';
    // Phase 06：后端无 quick_days/potential_after 真实字段，
    // quick/growth 一律降级为 match_score（不生成/不读取假字段）
    const sorters = {
      match: (a, b) => (b.score || 0) - (a.score || 0),
      salary: (a, b) => salaryNum(b.job.salary) - salaryNum(a.job.salary) || (b.score || 0) - (a.score || 0),
      quick: (a, b) => (b.score || 0) - (a.score || 0),
      growth: (a, b) => (b.score || 0) - (a.score || 0)
    };
    return list.slice().sort(sorters[sort] || sorters.match);
  }

  /* ---- 岗位卡片：匹配标签 ---- */
  function jobMatchTags(m, pref) {
    const tags = [];
    if ((m.score || 0) >= 85) tags.push({ t: '高匹配', c: 'high' });
    if ((m.matched || []).length >= 3) tags.push({ t: '技能覆盖', c: 'cover' });
    const smin = (pref && pref.salaryMin) || 0;
    const smax = (pref && pref.salaryMax) || 99;
    const hi = salaryNum(m.job.salary);
    if (hi >= smin && hi <= smax * 1.4) tags.push({ t: '薪资符合', c: 'salary' });
    if ((m.missing || []).length) tags.push({ t: m.missing.length + ' 项缺口', c: 'gap' });
    return tags;
  }

  /* ---- 岗位卡片：精简版 · 仅岗位名称与基础信息 ---- */
  function renderJobCard(m, pref) {
    const job = m.job || {};
    const vaultFavs = window.ZhituVault && window.ZhituVault.loadMatchFavs ? window.ZhituVault.loadMatchFavs() : {};
    const isFav = !!window.matchState.favJobs[job.id] || !!vaultFavs[String(job.id)];
    const score = m.score || 0;
    return `<div class="job-card job-card--simple" data-job="${job.id}">
      <div class="job-card-logo">${escapeHtml((job.company || '岗').charAt(0))}</div>
      <div class="job-card-main">
        <b class="job-card-title-name">${escapeHtml(job.title || '')}</b>
        <span class="job-card-meta">${escapeHtml(job.company || '')} · ${escapeHtml(job.city || '')}</span>
        <span class="job-card-salary">${escapeHtml(job.salary || '')}</span>
      </div>
      <div class="job-card-score" title="匹配度"><b>${score}</b><small>%</small></div>
      <button class="job-fav ${isFav ? 'is-fav' : ''}" data-fav="${job.id}" title="收藏">${isFav ? '★' : '☆'}</button>
    </div>`;
  }

  /* ---- 匹配圆环动态增长 + 技能条动画 ---- */
  function animateJobCardFX(list) {
    qsa('.match-ring', list).forEach((ring) => {
      const p = parseFloat(ring.dataset.p || 0);
      const b = ring.querySelector('.match-ring-num b');
      if (b) animateNumber(b, p, 1100, '%');
      requestAnimationFrame(() => requestAnimationFrame(() => ring.style.setProperty('--p', p)));
    });
    qsa('.job-card-skill .bar i', list).forEach((bar) => {
      bar.style.width = (parseFloat(bar.dataset.w || 0) || 0) + '%';
    });
    qsa('.job-card-skill .v', list).forEach((v) => animateNumber(v, parseFloat(v.dataset.w || 0) || 0, 900, '%'));
  }

  function renderJobs() {
    const res = currentResult();
    const list = $('jobs-list'); if (!list) return;
    const jobs = getFilteredJobs();
    const pref = window.matchState.preferences;
    renderRecProfile(pref, res);

    list.innerHTML = jobs.map((m) => renderJobCard(m, pref)).join('') || `<div class="aip-empty">该筛选下暂无岗位</div>`;
    animateJobCardFX(list);

    qsa('.job-card', list).forEach((row) => {
      const select = () => {
        window.matchState.selectedJobId = row.dataset.job;
        qsa('.job-card', list).forEach((r) => r.classList.remove('is-selected'));
        row.classList.add('is-selected');
        if (typeof renderDetail === 'function') renderDetail();
      };
      row.addEventListener('click', (e) => {
        if (e.target.closest('.job-fav') || e.target.closest('.job-card-go')) return;
        if (e.target.closest('.job-card-skill')) { openNodeDrawer(e.target.closest('.job-card-skill').dataset.skill); return; }
        select();
      });
      const go = row.querySelector('.job-card-go');
      if (go) go.addEventListener('click', (e) => { e.stopPropagation(); select(); });
    });
    qsa('.job-fav', list).forEach((f) => f.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = f.dataset.fav;
      const row = f.closest('.job-card');
      const match = jobs.find((m) => String(m.job && m.job.id) === String(id));
      const job = (match && match.job) || { id: id, title: row && row.querySelector('.job-card-title-name')?.textContent || '' };
      const added = window.ZhituVault && window.ZhituVault.toggleMatchFav
        ? window.ZhituVault.toggleMatchFav({ id: job.id, title: job.title, company: job.company, city: job.city, salary: job.salary, match_score: match && match.score })
        : toggleMatchFavFallback(job, match && match.score);
      window.matchState.favJobs[id] = added;
      f.classList.toggle('is-fav', added);
      f.textContent = added ? '★' : '☆';
      if (window.showToast) window.showToast(added ? '已收藏，已加入个人仓库' : '已取消收藏', added ? 'teal' : 'amber');
    }));
    // 按 selectedJobId 高亮（若在当前过滤列表中）
    const targetId = window.matchState.selectedJobId;
    if (targetId) {
      const hit = qs('.job-card[data-job="' + (window.CSS && CSS.escape ? CSS.escape(targetId) : String(targetId).replace(/"/g, '\\"')) + '"]', list);
      if (hit) hit.classList.add('is-selected');
    }
    renderAIPanelJobs(jobs[0]);
    if (typeof renderDetail === 'function') renderDetail();
  }

  function buildLocalResumeResult(text, base) {
    const source = String(text || '');
    const names = ['Java', 'Spring Boot', 'MySQL', 'Redis', 'Docker', 'Python', 'Go', 'React', 'Vue', 'Linux', 'Git', 'Kubernetes', 'RAG', 'Agent'];
    const found = names.filter((name) => source.toLowerCase().includes(name.toLowerCase()));
    const skills = (found.length ? found : ['待从简历中识别技能']).map((name) => ({ name, level: found.length ? '已识别' : '待识别', readiness: found.length ? 72 : 35 }));
    const result = Object.assign({}, base || MOCK_RESULT);
    result.profile = Object.assign({}, (base && base.profile) || {}, { skills, summary: source.slice(0, 180) });
    return result;
  }

  function openResumeSourceModal() {
    const modal = $('resume-source-modal');
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeResumeSourceModal() {
    const modal = $('resume-source-modal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
  }

  function toggleMatchFavFallback(job, score) {
    const key = 'zhitu_match_favs_v1';
    let map = {};
    try { map = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) {}
    const id = String(job.id);
    if (map[id]) { delete map[id]; try { localStorage.setItem(key, JSON.stringify(map)); } catch (_) {} return false; }
    map[id] = { id, title: job.title || '收藏岗位', company: job.company || '', city: job.city || '', salary: job.salary || '', match: score || null, savedAt: Date.now(), source: 'match' };
    try { localStorage.setItem(key, JSON.stringify(map)); window.dispatchEvent(new CustomEvent('zhitu-vault-changed', { detail: { type: 'match-fav', id, added: true } })); } catch (_) {}
    return true;
  }

  /* ---- 左栏顶部：你的画像 ---- */
  function renderRecProfile(pref, res) {
    const el = $('rec-profile'); if (!el) return;
    const role = (pref.direction) || (res && res.profile && res.profile.target_role) || 'Java 后端工程师';
    // Phase 06：当前能力优先取真实 competitiveness.competitiveness，
    // 否则用 profile.skills 平均掌握度（readiness/confidence）估算，不再硬编码 82%。
    const comp = res ? res.competitiveness : null;
    let cap = 0;
    if (comp && typeof comp.competitiveness === 'number') {
      cap = Math.round(comp.competitiveness);
    } else {
      const skills = (res && res.profile && res.profile.skills) || [];
      if (skills.length) {
        cap = Math.round(skills.reduce((a, s) => a + (typeof s.readiness === 'number' ? s.readiness : (typeof s.confidence === 'number' ? s.confidence * 100 : 60)), 0) / skills.length);
      }
    }
    if (!cap) cap = 60;
    cap = Math.max(30, Math.min(99, cap));
    const smin = pref.salaryMin != null ? pref.salaryMin : 15;
    const smax = pref.salaryMax != null ? pref.salaryMax : 25;
    // AI 推荐理由：真实 top match 的 match_reasons / reason
    const top = ((res && res.matches) || [])[0] || {};
    const reason = ((top.match_reasons || []).join('；')) || (top.reason || '基于真实匹配结果生成推荐。');
    el.innerHTML = `
      <div class="rec-profile-head"><span>你的画像</span><button class="rec-profile-edit" id="rec-profile-edit" type="button">编辑画像</button></div>
      <div class="rec-profile-row">
        <div class="rec-profile-avatar">${escapeHtml((role || 'J').charAt(0))}</div>
        <div class="rec-profile-main">
          <b class="rec-profile-role">${escapeHtml(role)}</b>
          <div class="rec-profile-meta">
            <span>当前能力 <b class="gold" data-cap="${cap}">0</b></span>
            <span>期望薪资 <b>${smin}-${smax}K</b></span>
          </div>
        </div>
      </div>
      <div class="rec-profile-reason">
        <span class="rec-ai-badge">AI 推荐理由</span>
        <p>"${escapeHtml(reason)}"</p>
      </div>`;
    const capEl = el.querySelector('[data-cap]');
    if (capEl) animateNumber(capEl, cap, 900, '%');
    const edit = $('rec-profile-edit');
    if (edit) edit.addEventListener('click', () => setView('match'));
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
    // AI Interview Coach 浮窗
    const cc = $('interview-coach-close');
    if (cc) cc.addEventListener('click', () => { const c = $('interview-coach'); if (c) c.hidden = true; });
    const cs = $('interview-coach-start');
    if (cs) cs.addEventListener('click', openInterview);
  }

  function getSelectedJob() {
    const res = currentResult();
    const matches = (res && res.matches) || [];
    return matches.find((m) => m.job.id === window.matchState.selectedJobId) || matches[0];
  }

  /* ---- 推荐指数星级 ---- */
  function starOf(score) {
    if (score >= 92) return '★★★★★';
    if (score >= 85) return '★★★★☆';
    if (score >= 75) return '★★★☆☆';
    if (score >= 65) return '★★☆☆☆';
    return '★☆☆☆☆';
  }
  /* ---- 预计提升后匹配度 ---- */
  function boostTarget(m) {
    return Math.min(95, Math.round((m.score || 0) + (m.potential_after ? (m.potential_after - m.score) : Math.min(7, 3 + (m.gaps || []).filter((g) => g.readiness < 70).length * 2))));
  }

  /* ---- 右侧岗位 Header ---- */
  function renderJobHeader(m) {
    const el = $('jd-header'); if (!el) return;
    const job = m.job || {};
    const score = m.score || 0;
    el.innerHTML = `
      <div class="jd-header-logo">${escapeHtml((job.company || '岗').charAt(0))}</div>
      <div class="jd-header-main">
        <div class="jd-header-title-row">
          <h2>${escapeHtml(job.title || '')}</h2>
          <span class="jd-header-score"><b data-score="${score}">0</b><small>%</small></span>
        </div>
        <div class="jd-header-meta">
          <span class="jd-meta-item"><i>公司</i><b>${escapeHtml(job.company || '—')}</b></span>
          <span class="jd-meta-item"><i>城市</i><b>${escapeHtml(job.city || '—')}</b></span>
          <span class="jd-meta-item"><i>薪资</i><b>${escapeHtml(job.salary || '—')}</b></span>
          <span class="jd-meta-item"><i>经验</i><b>${escapeHtml(job.exp || '0-3年')}</b></span>
          <span class="jd-meta-item"><i>推荐指数</i><b class="jd-stars">${starOf(score)}</b></span>
        </div>
      </div>
      <button class="btn-sm btn-sm--solid jd-prepare-btn" id="jd-prepare-btn" type="button">⚡ 立即准备面试</button>`;
    const nb = el.querySelector('.jd-header-score b');
    if (nb) animateNumber(nb, score, 1000, '%');
    const pb = $('jd-prepare-btn');
    if (pb) pb.addEventListener('click', openInterview);
  }

  /* ---- AI 匹配分析卡：为什么推荐这个岗位？ ---- */
  function renderAIMatchCard(m) {
    const ev = m.evidences || {};
    const matched = (ev.matched || []).map((x) => x.t);
    const missing = (ev.missing || []).map((x) => x.t);
    const gaps = (m.gaps || []).filter((g) => g.readiness < 70);
    const up = gaps.map((g) => g.skill).join(' + ') || '分布式架构';
    const target = boostTarget(m);
    return `
      <div class="ai-match-card">
        <div class="ai-match-head">
          <span class="ai-orb">AI</span>
          <div class="ai-match-title"><b>为什么推荐这个岗位？</b><small>基于能力图谱 · 项目经历 · 薪资偏好 的多维推理</small></div>
          <div class="ai-match-badge"><b data-score="${m.score || 0}">0</b><small>%</small></div>
        </div>
        <div class="ai-match-cols">
          <div class="ai-match-col is-good">
            <div class="ai-match-col-head"><span>✓</span>优势</div>
            <div class="ai-match-list">
              ${(matched.length ? matched : m.matched || []).slice(0, 4).map((t) => `<div class="ai-match-li"><i class="ai-ok">✓</i>${escapeHtml(t)}</div>`).join('') || '<div class="ai-match-li ai-muted">暂无优势数据</div>'}
            </div>
          </div>
          <div class="ai-match-col is-gap">
            <div class="ai-match-col-head"><span>⚠</span>差距</div>
            <div class="ai-match-list">
              ${(missing.length ? missing : m.missing || []).slice(0, 3).map((t) => `<div class="ai-match-li"><i class="ai-warn">⚠</i>${escapeHtml(t)}</div>`).join('') || '<div class="ai-match-li ai-muted">✓ 核心能力已覆盖</div>'}
            </div>
          </div>
          <div class="ai-match-col is-up">
            <div class="ai-match-col-head"><span>↗</span>提升</div>
            <p class="ai-match-up-text">学习 <b>${escapeHtml(up)}</b></p>
            <div class="ai-match-up-bar">
              <span>${m.score || 0}%</span>
              <span class="bar"><i data-w="${Math.round(((m.score || 0) / target) * 100)}"></i></span>
              <b class="gold">${target}%</b>
            </div>
            <p class="ai-match-up-hint">补齐短板后预计提升 <b>${target - (m.score || 0)}%</b> 匹配度</p>
          </div>
        </div>
      </div>`;
  }

  function renderDetail() {
    const m = getSelectedJob(); if (!m) return;
    const job = m.job || {};
    renderJobHeader(m);
    renderDetailInfoPane(m, job);
    renderDetailResumePane(m, job);
    renderDetailInterviewPane(m, job);
    renderDecisionPath(m);
    renderCoach(m);
    renderAIPanelDetail(m);
  }

  function renderDetailInfoPane(m, job) {
    const el = $('jd-pane-info'); if (!el) return;
    const res = currentResult();
    const summary = (res.job_analysis && res.job_analysis.job_summary) || '暂无岗位摘要。';
    const reqs = (job.required_skills || []).concat((job.preferred_skills || []).map((s) => s + '（优先）'));
    // Phase 06：岗位职责/描述优先使用真实数据（job.description = 后端 job_description+job_requirement）
    const duty = job.description || '';
    const welfare = job.benefits && job.benefits.length ? job.benefits : [];
    const reqList = reqs.length ? reqs : [];
    el.innerHTML = `
      <div class="jd-info-scroll">
        ${renderAIMatchCard(m)}
        <div id="jd-agent-panel"></div>
        <div class="jd-info-grid">
          <div class="jd-info-col jd-info-col--text">
            <div class="detail-section-title">岗位基本信息</div>
            <div class="detail-kv"><span class="k">公司</span><span>${escapeHtml(job.company || '—')}</span></div>
            <div class="detail-kv"><span class="k">地区</span><span>${escapeHtml(job.city || '—')}</span></div>
            <div class="detail-kv"><span class="k">薪资</span><span>${escapeHtml(job.salary || '—')}</span></div>
            <div class="detail-kv"><span class="k">行业</span><span>${escapeHtml(job.industry || '—')}</span></div>
            <div class="detail-kv"><span class="k">经验</span><span>${escapeHtml(job.experience || '—')}</span></div>
            <div class="detail-kv"><span class="k">学历</span><span>${escapeHtml(job.education || '—')}</span></div>

            <div class="detail-section-title mt">岗位要求</div>
            <div class="detail-req">${reqList.map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join('') || '<span class="jd-sub">暂无结构化技能要求</span>'}</div>
            <p class="jd-req-hint">优先项已标注「（优先）」，面试前可针对性准备对应场景题。</p>

            <div class="detail-section-title mt">岗位职责</div>
            <div class="jd-duty">${duty.split('\n').filter((l) => l.trim()).map((l) => `<div class="jd-duty-li">· ${escapeHtml(l)}</div>`).join('') || '<div class="jd-sub">暂无岗位职责信息</div>'}</div>

            <div class="detail-section-title mt">JD 摘要</div>
            <div class="aip-p">${escapeHtml(summary)}</div>

            <div class="detail-section-title mt">数据来源与证据</div>
            <div class="jd-source-line">
              <div class="detail-kv"><span class="k">置信度</span><span>${escapeHtml((m.confidence || '—'))}${(m.confidence ? ' · ' + ((m.evidence || []).length) + ' 条证据' : '')}</span></div>
              <div class="jd-sub">${job.source_url ? '<a href="' + escapeHtml(job.source_url) + '" target="_blank" rel="noreferrer">' + escapeHtml(job.source_url) + '</a>' : '暂无原始链接'}</div>
              <div class="jd-sub">${job.source ? '来源：' + escapeHtml(job.source) + '　' : ''}${((m.match_reasons || []).join('；') || '—')}</div>
            </div>

            <div class="detail-section-title mt">福利待遇</div>
            <div class="jd-welfare">${welfare.map((b) => escapeHtml(b)).join(' · ') || '暂无福利信息'}</div>

            <div class="jd-pane-actions">
              <button class="btn-sm btn-sm--ghost" id="jd-learn-btn" type="button">生成学习路径 →</button>
            </div>
          </div>
          <div class="jd-info-col jd-info-col--graph">
            <div id="detail-graph"></div>
          </div>
        </div>
      </div>`;
    const badge = el.querySelector('.ai-match-badge b');
    if (badge) animateNumber(badge, m.score || 0, 1000, '%');
    const bar = el.querySelector('.ai-match-up-bar .bar i');
    if (bar) requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = (bar.dataset.w || 0) + '%'; }));
    renderCapabilityGapAnalysis($('detail-graph'), m);
    const lb = $('jd-learn-btn'); if (lb) lb.addEventListener('click', () => openLearningProfile());
    renderJobAgentPanel(m);
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

  /* ============================================================
   * 面试训练地图
   * 分类：基础能力 / 工程能力 / 综合能力
   * 每个模块：问题数量 · 完成率 · 难度；点击展开问题卡
   * ============================================================ */
  const TRAIN_MAP = [
    {
      group: '基础能力',
      modules: [
        {
          skill: 'Java', icon: 'J', total: 8, done: 6, level: '中级',
          questions: [
            { tag: 'Java', level: '中级', q: '谈谈 JVM 内存模型，堆、栈、方法区分别存放什么？', targets: ['JVM 原理', '内存模型', 'GC 机制'] },
            { tag: 'Java', level: '中级', q: 'synchronized 与 volatile 的区别是什么？volatile 能保证原子性吗？', targets: ['并发编程', '内存可见性'] },
            { tag: 'Java', level: '高级', q: 'ConcurrentHashMap 在 JDK8 中如何保证线程安全？', targets: ['并发容器', '锁机制'] }
          ]
        },
        {
          skill: 'Spring Boot', icon: 'S', total: 6, done: 3, level: '中级',
          questions: [
            { tag: 'Spring Boot', level: '中级', q: 'Spring Boot 自动配置的原理是什么？如何自定义一个 Starter？', targets: ['自动配置', 'Starter 机制'] },
            { tag: 'Spring Boot', level: '中级', q: 'Spring Bean 的生命周期是怎样的？AOP 底层如何实现？', targets: ['Bean 生命周期', 'AOP'] }
          ]
        },
        {
          skill: 'MySQL', icon: 'M', total: 7, done: 5, level: '初级',
          questions: [
            { tag: 'MySQL', level: '初级', q: '讲讲索引最左前缀原则，以及一次你做过的慢查询优化。', targets: ['索引优化', '慢查询'] },
            { tag: 'MySQL', level: '中级', q: '事务隔离级别有哪些？MVCC 如何解决幻读？', targets: ['事务隔离', 'MVCC'] }
          ]
        }
      ]
    },
    {
      group: '工程能力',
      modules: [
        {
          skill: 'Docker', icon: 'D', total: 5, done: 1, level: '初级',
          questions: [
            { tag: 'Docker', level: '初级', q: '镜像与容器的区别是什么？Dockerfile 分层优化的要点？', targets: ['镜像分层', 'Dockerfile'] }
          ]
        },
        {
          skill: '微服务', icon: 'μ', total: 6, done: 0, level: '高级',
          questions: [
            { tag: '微服务', level: '高级', q: '服务拆分的原则是什么？注册中心与配置中心如何选型？', targets: ['服务拆分', '注册发现'] },
            { tag: '微服务', level: '高级', q: '分布式事务如何落地？Seata 的 AT / TCC 模式区别？', targets: ['分布式事务', 'Seata'] }
          ]
        },
        {
          skill: '系统设计', icon: 'Σ', total: 8, done: 5, level: '高级',
          questions: [
            { tag: '系统设计', level: '高级', q: '如何设计百万级订单系统？考虑存储、缓存、异步与容灾。', targets: ['架构能力', '数据库设计', '扩展能力'] },
            { tag: '系统设计', level: '高级', q: '高并发场景下如何做限流、降级与熔断？', targets: ['限流', '降级', '熔断'] }
          ]
        }
      ]
    },
    {
      group: '综合能力',
      modules: [
        {
          skill: '项目经验', icon: 'P', total: 4, done: 4, level: '中级',
          questions: [
            { tag: '项目经验', level: '中级', q: '讲一个你最有成就感的项目：角色、技术难点、结果与复盘。', targets: ['表达逻辑', '项目复盘', '量化结果'] }
          ]
        },
        {
          skill: '架构设计', icon: 'A', total: 6, done: 2, level: '高级',
          questions: [
            { tag: '架构设计', level: '高级', q: '如何评估一个系统的容量？从 QPS、存储、带宽角度给出方案。', targets: ['容量评估', '扩展能力'] },
            { tag: '架构设计', level: '高级', q: '缓存与数据库一致性如何保证？说说你的取舍与降级策略。', targets: ['缓存一致性', '降级策略'] }
          ]
        }
      ]
    }
  ];

  function trainModuleOf(skill) {
    for (const g of TRAIN_MAP) {
      const hit = g.modules.find((x) => x.skill === skill);
      if (hit) return hit;
    }
    return null;
  }

  function renderDetailInterviewPane(m) {
    const el = $('jd-pane-interview'); if (!el) return;
    const gaps = (m.gaps || []).filter((g) => g.readiness < 70);
    el.innerHTML = `
      <div class="train-scroll">
        <div class="train-hero">
          <div class="train-hero-head"><span class="ai-orb sm">AI</span><div><b>面试训练地图</b><small>按能力维度拆解，逐项补齐面试必考题</small></div></div>
          <div class="train-hero-stat"><b>${gaps.length || 2}</b><span>个待补强模块</span></div>
        </div>
        <div class="train-groups" id="train-groups"></div>
        <div class="train-questions" id="train-questions"></div>
        <div class="jd-iv-cta">
          <button class="btn-sm btn-sm--solid btn-lg" id="jd-interview-btn" type="button">▶ 立即开始模拟面试</button>
          <span class="jd-iv-hint">AI 面试官将基于岗位要求实时提问并给出评估</span>
        </div>
      </div>`;
    renderTrainGroups(m);
    const ib = $('jd-interview-btn'); if (ib) ib.addEventListener('click', openInterview);
  }

  function renderTrainGroups(m) {
    const box = $('train-groups'); if (!box) return;
    const gapSet = new Set((m.gaps || []).filter((g) => g.readiness < 70).map((g) => g.skill));
    box.innerHTML = TRAIN_MAP.map((g) => `
      <div class="train-group">
        <div class="train-group-head"><b>${g.group}</b><span>${g.modules.length} 个模块 · ${g.modules.reduce((a, x) => a + x.total, 0)} 题</span></div>
        <div class="train-modules">
          ${g.modules.map((mod) => {
            const pct = Math.round((mod.done / mod.total) * 100);
            const weak = gapSet.has(mod.skill);
            return `<button class="train-module${weak ? ' is-weak' : ''}" data-skill="${escapeHtml(mod.skill)}" type="button">
              <span class="train-module-icon">${escapeHtml(mod.icon)}</span>
              <span class="train-module-name">${escapeHtml(mod.skill)}</span>
              <span class="train-module-level${mod.level === '高级' ? ' is-hard' : ''}">${escapeHtml(mod.level)}</span>
              <span class="train-module-meta"><i>${mod.total}题</i><i>完成 ${pct}%</i></span>
              <span class="train-module-prog"><i style="width:${pct}%"></i></span>
              <span class="train-module-go">展开问题 ▾</span>
            </button>`;
          }).join('')}
        </div>
      </div>`).join('');
    qsa('.train-module', box).forEach((btn) => btn.addEventListener('click', () => {
      const skill = btn.dataset.skill;
      qsa('.train-module', box).forEach((b) => b.classList.toggle('is-open', b === btn));
      renderTrainQuestions(m, skill);
    }));
  }

  function renderTrainQuestions(m, skill) {
    const box = $('train-questions'); if (!box) return;
    const mod = trainModuleOf(skill);
    if (!mod) { box.innerHTML = ''; return; }
    const qs = mod.questions || [];
    box.innerHTML = `
      <div class="train-q-head"><span>${escapeHtml(mod.skill)} 专项训练</span><small>${qs.length} 道高频题</small></div>
      <div class="train-q-list">
        ${qs.map((q) => `
          <div class="train-question">
            <div class="train-q-tags"><span>${escapeHtml(q.tag)}</span><span class="lv${q.level === '高级' ? ' lv-hard' : ''}">${escapeHtml(q.level)}</span></div>
            <p class="train-q-text">${escapeHtml(q.q)}</p>
            <div class="train-q-targets"><span>考察：</span>${q.targets.map((t) => `<i>${escapeHtml(t)}</i>`).join('')}</div>
            <button class="train-q-btn" type="button">开始练习 →</button>
          </div>`).join('')}
      </div>`;
    qsa('.train-q-btn', box).forEach((btn) => btn.addEventListener('click', () => openInterview()));
  }

  /* ---- 底部：职业决策路径 ---- */
  function renderDecisionPath(m) {
    const el = $('jd-decision'); if (!el) return;
    const score = m.score || 0;
    const target = boostTarget(m);
    const gaps = (m.gaps || []).filter((g) => g.readiness < 70);
    const firstGap = (gaps[0] && gaps[0].skill) || 'Redis';
    el.innerHTML = `
      <div class="jd-decision-head"><span class="mod-label">CAREER DECISION PATH</span><b>职业决策路径</b></div>
      <div class="jd-decision-steps">
        <div class="jd-decision-step is-current">
          <span class="jd-decision-dot"></span><b>当前匹配</b><em class="gold">${score}%</em>
        </div>
        <span class="jd-decision-arrow">↓</span>
        <div class="jd-decision-step">
          <span class="jd-decision-dot"></span><b>补齐 ${escapeHtml(firstGap)}</b><em>学习 + 项目实践</em>
        </div>
        <span class="jd-decision-arrow">↓</span>
        <div class="jd-decision-step">
          <span class="jd-decision-dot"></span><b>完成模拟面试</b><em>AI 面试官陪练</em>
        </div>
        <span class="jd-decision-arrow">↓</span>
        <div class="jd-decision-step is-target">
          <span class="jd-decision-dot"></span><b>匹配提升</b><em class="gold">${target}%</em>
        </div>
      </div>`;
  }

  /* ---- AI Interview Coach 浮窗 ---- */
  function renderCoach(m) {
    const el = $('interview-coach'); if (!el) return;
    const gaps = (m.gaps || []).filter((g) => g.readiness < 70);
    const focus = gaps[0] || { skill: 'Redis' };
    const boost = Math.min(8, Math.max(3, 3 + (gaps.length || 1)));
    const body = $('interview-coach-body');
    if (body) body.innerHTML = `
      <div class="interview-coach-today">今日推荐</div>
      <p class="interview-coach-rec">练习 <b>${escapeHtml(focus.skill)}</b> 高并发问题</p>
      <div class="interview-coach-up">预计提升 <b>+${boost}%</b> 岗位匹配度</div>`;
    el.hidden = false;
  }

  /* ============================================================
   * 能力差距分析（双轨能力差距条）
   * 语义：岗位要求强度(required) / 当前能力掌握度(current) / 差距(delta=current-required)
   * 状态：>=0 已达标 / -1~-5 轻度缺口 / -6~-10 中度缺口 / <=-11 重点提升
   * 交互：点击能力项内联展开「能力诊断」面板；顶部极简雷达辅助概览
   * ============================================================ */
  let cgRadarChart = null;

  // 岗位要求强度基准（技能 → 该岗位通常要求达到的强度）
  const SKILL_REQ_BASE = {
    Java: 92, 'Spring Boot': 88, MySQL: 93, Redis: 85,
    Docker: 78, 微服务: 82, 系统设计: 70,
    Kubernetes: 88, Go: 80, 消息队列: 72,
    Python: 80, SQL: 74, Hadoop: 82, Spark: 78,
    LLM: 88, RAG: 85, 向量数据库: 80, Agent: 78, 'Prompt工程': 72,
    自动化测试: 72, 性能测试: 70
  };

  // 能力诊断知识库：可能缺失的能力 + 推荐提升路径
  const SKILL_DIAGNOSIS = {
    Java: { missing: ['JVM 原理', '并发编程', 'Spring 底层机制', '集合与锁源码'], path: ['JVM 原理', '并发编程', 'Spring 底层机制', '项目实战'] },
    'Spring Boot': { missing: ['自动配置原理', 'Spring IoC / AOP', '事务与隔离', '安全认证'], path: ['Spring 核心', '自动配置', '事务与安全', '微服务实战'] },
    MySQL: { missing: ['索引优化', '事务隔离级别', '分库分表', '慢查询分析'], path: ['SQL 与索引', '事务与锁', '分库分表', '性能优化实战'] },
    Redis: { missing: ['缓存一致性', '持久化机制', '分布式锁', '过期淘汰策略'], path: ['Redis 数据结构', '缓存一致性', '分布式锁', '高可用集群'] },
    Docker: { missing: ['镜像分层原理', 'Dockerfile 优化', 'Compose 编排', '容器网络'], path: ['Docker 基础', 'Dockerfile', 'Compose 编排', '容器化部署'] },
    微服务: { missing: ['服务拆分', '服务注册与发现', '配置中心', '链路追踪'], path: ['Spring Cloud 基础', '注册与发现', '配置中心', '微服务实战'] },
    系统设计: { missing: ['高并发架构', '缓存与限流', '消息队列', '容量评估'], path: ['高并发设计', '缓存与限流', '消息队列', '架构评审'] },
    Kubernetes: { missing: ['Pod / Deployment', '服务网格', '存储与调度', '集群运维'], path: ['K8s 基础', 'Pod 与编排', '服务网格', '集群实战'] },
    Go: { missing: ['goroutine 并发', 'channel 通信', '内存模型'], path: ['Go 基础', '并发编程', '工程实践'] },
    Python: { missing: ['异步编程', '类型标注', '性能优化'], path: ['Python 基础', '异步与并发', '工程实战'] },
    SQL: { missing: ['复杂查询', '窗口函数', '执行计划'], path: ['SQL 基础', '窗口函数', '执行计划优化'] },
    Hadoop: { missing: ['HDFS 原理', 'MapReduce', 'YARN 调度'], path: ['HDFS', 'MapReduce', 'YARN 与调度'] },
    LLM: { missing: ['Transformer 原理', 'Prompt 工程', '微调与评测'], path: ['Transformer', 'Prompt 工程', '微调与部署'] },
    RAG: { missing: ['向量检索', '切片策略', '重排序', '幻觉抑制'], path: ['嵌入与向量', '检索链路', '重排序', 'RAG 落地'] },
    向量数据库: { missing: ['向量索引', '相似度检索', '混合检索'], path: ['向量索引', '相似度检索', '混合检索实战'] },
    自动化测试: { missing: ['用例设计', '测试框架', 'CI 集成'], path: ['测试理论', '框架实战', 'CI 流水线'] }
  };

  // 计算岗位要求强度：核心技能高要求，优先技能中要求，其余为补充要求
  function jobRequirement(skill, job) {
    const base = SKILL_REQ_BASE[skill];
    const required = (job.required_skills || job.requiredSkills || []);
    const preferred = (job.preferred_skills || job.preferredSkills || []);
    if (required.indexOf(skill) >= 0) return base != null ? base : 85;
    if (preferred.indexOf(skill) >= 0) return base != null ? Math.min(base, 78) : 72;
    return base != null ? Math.min(base, 68) : 62;
  }

  // 差距状态判定
  function gapStatusOf(delta) {
    if (delta >= 0) return { key: 'ok', label: '已达标' };
    if (delta >= -5) return { key: 'light', label: '轻度缺口' };
    if (delta >= -10) return { key: 'mid', label: '中度缺口' };
    return { key: 'high', label: '重点提升' };
  }

  // 构建能力差距数据行（按岗位要求优先级排序，核心技能排最前）
  function buildGapRows(m) {
    const job = m.job || {};
    const order = (job.required_skills || job.requiredSkills || []).concat(job.preferred_skills || job.preferredSkills || []);
    let skills = (m.gaps || []).slice();
    // 兜底：gaps 缺失时用岗位核心技能 + 简历能力构造
    if (!skills.length) {
      const res = currentResult();
      const prof = (res && res.profile && res.profile.skills) || [];
      skills = (job.required_skills || job.requiredSkills || []).map((sk) => {
        const p = prof.find((s) => s.name === sk) || {};
        return { skill: sk, readiness: p.readiness != null ? p.readiness : 40 };
      });
    }
    const scoreOf = (s) => { const i = order.indexOf(s.skill); return i < 0 ? 999 + skills.indexOf(s) : i; };
    skills.sort((a, b) => scoreOf(a) - scoreOf(b));
    return skills.map((g) => {
      const required = typeof g.required === 'number' ? g.required : jobRequirement(g.skill, job);
      const current = g.readiness;
      const delta = current - required;
      return { skill: g.skill, required: required, current: current, delta: delta, status: gapStatusOf(delta), reason: g.reason || '' };
    });
  }

  function renderCapabilityGapAnalysis(container, m) {
    if (!container || !m) return;
    const rows = buildGapRows(m);
    const gaps = rows.filter((r) => r.delta < 0);
    const keyGaps = gaps.slice().sort((a, b) => a.delta - b.delta).slice(0, 3);
    const score = m.score || 0;
    const trend = Math.min(8, Math.max(2, Math.round(gaps.length * 1.5)));

    container.innerHTML = `
      <div class="cg-wrap">
        <div class="cg-head">
          <div class="cg-title">
            <div class="cg-title-main">能力差距分析</div>
            <div class="cg-title-sub">你的能力 × 岗位要求</div>
          </div>
          <div class="cg-head-right">
            <div class="cg-radar" id="cg-radar"></div>
            <div class="cg-overall">
              <div class="cg-overall-label">综合匹配</div>
              <div class="cg-overall-val"><span id="cg-overall-num">0</span><span class="cg-overall-pct">%</span></div>
              <div class="cg-overall-trend">▲ 提升潜力 +${trend}%</div>
            </div>
          </div>
        </div>
        <div class="cg-list" id="cg-list">
          ${rows.map((r) => renderGapItem(r)).join('')}
        </div>
        <div class="cg-summary">
          <div class="cg-summary-left">
            <span class="cg-summary-ico">⚠</span>
            <div>
              <b>${gaps.length} 项能力存在提升空间</b>
              <small>${keyGaps.length ? '重点缺口：' + keyGaps.map((g) => g.skill + ' ' + (g.delta > 0 ? '+' : '') + g.delta).join(' · ') : '核心能力已覆盖岗位要求'}</small>
            </div>
          </div>
          <button class="cg-summary-btn" id="cg-goto-full" type="button">查看完整诊断 →</button>
        </div>
      </div>`;

    renderMiniRadar($('cg-radar'), rows);
    animateNumber($('cg-overall-num'), score, 900);
    bindGapInteractions(container, m, rows);
  }

  function renderGapItem(r) {
    const st = r.status;
    const sign = r.delta > 0 ? '+' : '';
    const flag = r.delta < 0 ? (st.key === 'high' ? '⚠' : '') : '✓';
    return `
      <div class="cg-item" data-skill="${escapeHtml(r.skill)}">
        <div class="cg-item-head">
          <span class="cg-name">${escapeHtml(r.skill)}</span>
          <span class="cg-status cg-status--${st.key}">${st.label}</span>
          <span class="cg-gap cg-gap--${st.key}"><span class="cg-gap-num" data-w="${r.delta}">0</span><span class="cg-gap-flag">${flag}</span></span>
        </div>
        <div class="cg-track">
          <div class="cg-track-row">
            <span class="cg-track-label">岗位要求</span>
            <div class="cg-track-bar"><i class="cg-track-fill cg-fill--req" data-w="${r.required}"></i><span class="cg-dot cg-dot--req" data-w="${r.required}"></span></div>
            <span class="cg-track-val" data-w="${r.required}">0</span>
          </div>
          <div class="cg-track-row">
            <span class="cg-track-label">当前能力</span>
            <div class="cg-track-bar"><i class="cg-track-fill cg-fill--cur" data-w="${r.current}"></i></div>
            <span class="cg-track-val" data-w="${r.current}">0</span>
          </div>
        </div>
        <div class="cg-diag" hidden>${renderGapDiag(r)}</div>
      </div>`;
  }

  function renderGapDiag(r) {
    const info = SKILL_DIAGNOSIS[r.skill] || { missing: ['领域知识基础'], path: ['基础巩固', '项目实战'] };
    const sign = r.delta > 0 ? '+' : '';
    const neg = r.delta < 0;
    return `
      <div class="cg-diag-metrics">
        <div class="cg-diag-metric"><div class="cg-diag-metric-label">当前能力</div><div class="cg-diag-metric-val" style="color:var(--cg-signal,#1FC8D9)">${r.current}</div></div>
        <div class="cg-diag-metric"><div class="cg-diag-metric-label">岗位要求</div><div class="cg-diag-metric-val" style="color:var(--cg-gold,#F0B429)">${r.required}</div></div>
        <div class="cg-diag-metric"><div class="cg-diag-metric-label">能力缺口</div><div class="cg-diag-metric-val ${neg ? 'neg' : 'pos'}">${sign}${r.delta}</div></div>
      </div>
      <div class="cg-diag-sec">可能缺失的能力</div>
      <div class="cg-diag-missing">${info.missing.map((x) => `<span class="cg-diag-chip">${escapeHtml(x)}</span>`).join('')}</div>
      <div class="cg-diag-sec">推荐提升路径</div>
      <div class="cg-diag-path">${info.path.map((p, i) => `
        <div class="cg-diag-path-step"><span class="cg-idx">${i + 1}</span><b>${escapeHtml(p)}</b>${i < info.path.length - 1 ? '<span class="arr">↓</span>' : ''}</div>`).join('')}</div>
      <button class="btn-sm btn-sm--solid cg-diag-cta" type="button">生成学习路径 →</button>`;
  }

  // 顶部极简雷达：能力结构概览（辅助视觉，主体仍为双轨能力差距条）
  function renderMiniRadar(container, rows) {
    if (!container || typeof echarts === 'undefined' || !rows || !rows.length) return;
    if (cgRadarChart) { cgRadarChart.dispose(); cgRadarChart = null; }
    try {
      const chart = echarts.init(container);
      cgRadarChart = chart;
      const show = rows.slice(0, 5);
      chart.setOption({
        radar: {
          indicator: show.map((r) => ({ name: r.skill, max: 100 })),
          radius: '66%', center: ['50%', '54%'], splitNumber: 3,
          axisName: { color: 'rgba(169,189,203,.8)', fontSize: 9 },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,.09)' } },
          splitArea: { show: false },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,.14)' } }
        },
        series: [{
          type: 'radar', symbol: 'none', lineStyle: { width: 1.4 },
          data: [
            { value: show.map((r) => r.required), name: '岗位要求', lineStyle: { color: '#F0B429' }, itemStyle: { color: '#F0B429' }, areaStyle: { color: 'rgba(240,180,41,.10)' } },
            { value: show.map((r) => r.current), name: '当前能力', lineStyle: { color: '#1FC8D9' }, itemStyle: { color: '#1FC8D9' }, areaStyle: { color: 'rgba(31,200,217,.16)' } }
          ]
        }],
        tooltip: { trigger: 'item' }, legend: { show: false }
      });
    } catch (e) { /* 雷达仅为辅助，失败不影响主模块 */ }
  }

  function bindGapInteractions(container, m, rows) {
    // 首次进入：进度条 0 → 实际值，数字 0 → 实际值
    const fills = container.querySelectorAll('.cg-track-fill, .cg-dot');
    const vals = container.querySelectorAll('.cg-track-val');
    const gaps = container.querySelectorAll('.cg-gap-num');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fills.forEach((el) => { el.style.width = (el.dataset.w || 0) + '%'; });
        vals.forEach((el) => animateNumber(el, parseFloat(el.dataset.w || 0), 1000));
        gaps.forEach((el) => {
          const v = parseFloat(el.dataset.w || 0);
          animateNumber(el, v, 1100, '', v > 0 ? '+' : '');
        });
      });
    });

    // 点击能力项：展开/收起内联诊断面板
    container.querySelectorAll('.cg-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.cg-diag-cta')) return;
        const willOpen = !item.classList.contains('is-open');
        container.querySelectorAll('.cg-item.is-open').forEach((x) => x.classList.remove('is-open'));
        container.querySelectorAll('.cg-item .cg-diag').forEach((d) => { d.hidden = true; });
        if (willOpen) {
          item.classList.add('is-open');
          const diag = item.querySelector('.cg-diag');
          if (diag) diag.hidden = false;
        }
      });
    });

    // 生成学习路径
    container.querySelectorAll('.cg-diag-cta').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openLearningProfile(); });
    });

    // 查看完整诊断
    const full = $('cg-goto-full');
    if (full) full.addEventListener('click', () => openLearningProfile());
  }

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
    const res = currentResult();
    const prof = (res && res.profile) || { skills: [] }; const sk = (prof.skills || []).find((s) => s.name === skillName) || { name: skillName, level: '未掌握', evidence: '未识别到直接证据', readiness: 41, theory: 62, practice: 18 };
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
   * STATE 6 · 学习路径 · AI Career OS（职业成长操作系统）
   * 结构：成长概览 Dashboard / Timeline + Skill Cards /
   *       岗位能力地图 / 能力提升预测 / AI Career Coach 浮窗
   * ============================================================ */

  /* ---------- 学习路径数据模型（演示态，字段预留后端 API） ---------- */
  const LEARN_OS_DEFAULT_TITLE = 'Java 后端开发工程师成长路线';
  const LEARN_OS = {
    career: {
      levelFrom: '初级', levelTo: '中级',
      match: 67, mastered: 18, total: 42, eta: '3 个月',
      matchDelta: '+6% 较上次诊断',
      radar: {
        indicators: ['Java 基础', 'Spring 生态', '数据库', '微服务', '云原生', '工程实践'],
        values: [82, 74, 78, 42, 28, 55]
      },
      advice: '你的 Spring Cloud 能力不足，影响高级岗位匹配度，建议优先学习微服务治理。',
      tags: ['微服务治理', 'Spring Cloud', '服务容错']
    },
    stages: [
      { id: 's1', name: 'Java 基础强化', en: 'JAVA FUNDAMENTALS', progress: 92, count: 8, value: '+12%', desc: '语言核心 · 并发 · JVM' },
      { id: 's2', name: '企业级开发能力', en: 'ENTERPRISE DEV', progress: 74, count: 10, value: '+10%', desc: 'Spring 生态 · 数据访问 · 缓存' },
      { id: 's3', name: '微服务架构', en: 'MICROSERVICES', progress: 35, count: 9, value: '+9%', desc: '服务拆分 · 注册中心 · 网关' },
      { id: 's4', name: '云原生部署', en: 'CLOUD NATIVE', progress: 18, count: 7, value: '+8%', desc: '容器化 · 编排 · CI/CD' },
      { id: 's5', name: '高级工程实践', en: 'ENGINEERING', progress: 12, count: 8, value: '+7%', desc: '系统设计 · 高并发 · 调优' }
    ],
    skills: [
      { id: 'java-core', name: 'Java 核心', icon: '☕', stage: 's1', tags: ['基础', '核心技能'], status: 'mastered', from: 92, to: 96, hours: 6, level: '入门', impact: '+4% 匹配度', desc: '主导 3 个 Java 项目，日均 50w+ 请求', deliverable: '高并发订单系统' },
      { id: 'jvm', name: 'JVM 虚拟机', icon: '⚙️', stage: 's1', tags: ['进阶', '岗位必备'], status: 'learning', from: 62, to: 80, hours: 8, level: '进阶', impact: '+7% 匹配度', desc: 'GC 与类加载是性能调优关键', deliverable: 'GC 调优实践' },
      { id: 'concurrency', name: '并发编程', icon: '⇶', stage: 's1', tags: ['核心', '能力缺口'], status: 'gap', from: 20, to: 60, hours: 12, level: '进阶', impact: '+6% 匹配度', desc: 'JUC 工具链是后端面试必考', deliverable: 'JUC 并发实战' },
      { id: 'collection', name: '集合框架', icon: '▣', stage: 's1', tags: ['基础'], status: 'mastered', from: 90, to: 96, hours: 4, level: '入门', impact: '+3% 匹配度', desc: 'HashMap 与并发容器底层原理', deliverable: '集合源码分析' },
      { id: 'spring-boot', name: 'Spring Boot', icon: '⚡', stage: 's2', tags: ['核心', '企业必备'], status: 'mastered', from: 90, to: 94, hours: 10, level: '熟练', impact: '+5% 匹配度', desc: '自动装配与 Starter 落地生产', deliverable: '营销平台服务端' },
      { id: 'mybatis', name: 'MyBatis', icon: '⛁', stage: 's2', tags: ['数据访问', '企业必备'], status: 'learning', from: 68, to: 82, hours: 6, level: '熟练', impact: '+4% 匹配度', desc: '动态 SQL 与二级缓存机制', deliverable: 'ORM 项目实战' },
      { id: 'mysql', name: 'MySQL 调优', icon: '▤', stage: 's2', tags: ['数据库', '核心'], status: 'mastered', from: 87, to: 92, hours: 8, level: '熟练', impact: '+5% 匹配度', desc: '索引优化与慢查询排查', deliverable: '慢查询优化专项' },
      { id: 'redis', name: 'Redis 缓存', icon: '♦', stage: 's2', tags: ['缓存', '企业必备'], status: 'learning', from: 72, to: 88, hours: 8, level: '进阶', impact: '+6% 匹配度', desc: '缓存一致性是高频考察点', deliverable: '缓存一致性方案' },
      { id: 'spring-cloud', name: 'Spring Cloud', icon: '☁️', stage: 's3', tags: ['微服务', '能力缺口'], status: 'gap', from: 30, to: 70, hours: 16, level: '高级', impact: '+8% 匹配度', desc: '微服务治理能力直接影响高级岗位', deliverable: '微服务治理 demo' },
      { id: 'nacos', name: 'Nacos 注册中心', icon: '✺', stage: 's3', tags: ['微服务', '能力缺口'], status: 'gap', from: 25, to: 65, hours: 8, level: '进阶', impact: '+6% 匹配度', desc: '服务注册与配置中心', deliverable: '服务注册与发现' },
      { id: 'gateway', name: 'API 网关', icon: '⇄', stage: 's3', tags: ['微服务', '能力缺口'], status: 'gap', from: 22, to: 60, hours: 6, level: '进阶', impact: '+5% 匹配度', desc: '统一鉴权与流量治理入口', deliverable: '统一网关接入' },
      { id: 'feign', name: '服务调用', icon: '⇌', stage: 's3', tags: ['微服务'], status: 'gap', from: 40, to: 68, hours: 4, level: '进阶', impact: '+4% 匹配度', desc: '声明式 HTTP 客户端与负载均衡', deliverable: '声明式调用链路' },
      { id: 'docker', name: 'Docker 容器化', icon: '🐳', stage: 's4', tags: ['基础', '工程实践', '企业必备'], status: 'learning', from: 41, to: 67, hours: 6, level: '入门', impact: '+8% 匹配度', desc: '容器化是云原生第一步', deliverable: '构建第一个镜像', reco: true },
      { id: 'kubernetes', name: 'Kubernetes', icon: '☸', stage: 's4', tags: ['编排', '能力缺口'], status: 'gap', from: 20, to: 60, hours: 14, level: '高级', impact: '+9% 匹配度', desc: '集群编排决定运维竞争力', deliverable: 'K8s 集群部署' },
      { id: 'cicd', name: 'CI/CD 流水线', icon: '⇢', stage: 's4', tags: ['工程实践', '能力缺口'], status: 'gap', from: 15, to: 55, hours: 8, level: '进阶', impact: '+7% 匹配度', desc: '自动化部署提升交付效率', deliverable: '自动化流水线' },
      { id: 'linux', name: 'Linux 基础', icon: '⌨', stage: 's4', tags: ['基础'], status: 'mastered', from: 88, to: 92, hours: 5, level: '入门', impact: '+3% 匹配度', desc: '服务器环境是后端基本功', deliverable: '线上环境运维' },
      { id: 'system-design', name: '高并发系统设计', icon: '⌬', stage: 's5', tags: ['系统设计', '高级'], status: 'learning', from: 55, to: 75, hours: 12, level: '高级', impact: '+7% 匹配度', desc: '架构设计是资深工程师分水岭', deliverable: '架构设计文档' },
      { id: 'mq', name: '消息队列', icon: '≈', stage: 's5', tags: ['中间件', '能力缺口'], status: 'gap', from: 18, to: 58, hours: 10, level: '高级', impact: '+6% 匹配度', desc: '削峰填谷与异步解耦', deliverable: 'MQ 削峰方案' },
      { id: 'es', name: 'Elasticsearch', icon: '⌗', stage: 's5', tags: ['搜索', '能力缺口'], status: 'gap', from: 12, to: 50, hours: 8, level: '进阶', impact: '+5% 匹配度', desc: '全文检索与日志分析', deliverable: '搜索服务落地' },
      { id: 'arch', name: '微服务架构治理', icon: '⎔', stage: 's5', tags: ['架构', '高级'], status: 'gap', from: 30, to: 65, hours: 10, level: '高级', impact: '+6% 匹配度', desc: '拆分、容错与可观测性', deliverable: '架构治理方案' }
    ],
    graph: {
      nodes: [
        { id: 'java', name: 'Java', sub: '已掌握', x: 95, y: 205, status: 'mastered', info: '语言核心能力已达标，是整条能力链的地基。', learn: '保持输出，深入 JMM 与并发模型。' },
        { id: 'spring-boot', name: 'Spring Boot', sub: '已掌握', x: 255, y: 88, status: 'mastered', info: '企业级开发框架，项目落地充分。', learn: '向自动装配原理与 Starter 机制深化。' },
        { id: 'mybatis', name: 'MyBatis', sub: '学习中', x: 415, y: 205, status: 'learning', info: '数据访问层桥梁，链接框架与数据库。', learn: '掌握动态 SQL、插件机制与二级缓存。' },
        { id: 'redis', name: 'Redis', sub: '学习中', x: 575, y: 88, status: 'learning', info: '缓存与高并发表现的关键中间件。', learn: '完善缓存一致性方案与防穿透击穿。' },
        { id: 'docker', name: 'Docker', sub: '学习中', x: 720, y: 205, status: 'learning', info: '容器化是云原生与 DevOps 的起点。', learn: '编写规范 Dockerfile 并完成项目容器化。' },
        { id: 'kubernetes', name: 'Kubernetes', sub: '能力缺口', x: 875, y: 88, status: 'gap', info: '核心缺口：编排能力决定高级岗位竞争力。', learn: '掌握 Pod/Deployment 与弹性伸缩。' },
        { id: 'microservice', name: '微服务架构', sub: '能力缺口', x: 990, y: 205, status: 'gap', info: '最终目标：把单体拆分为可治理的微服务体系。', learn: '结合 Spring Cloud 落地注册中心与网关。' }
      ],
      chain: ['java', 'spring-boot', 'mybatis', 'redis', 'docker', 'kubernetes', 'microservice']
    },
    forecast: [
      { label: '现在', value: 67, note: '当前匹配度' },
      { label: '完成 Spring Cloud', value: 78, note: '微服务治理' },
      { label: '完成 Kubernetes', value: 86, note: '云原生部署' },
      { label: '完成项目实战', value: 92, note: '工程实践' }
    ],
    coach: { task: '完成 Docker 基础', reason: '该技能可提升你的 DevOps 岗位匹配概率', progress: 41, to: 67 }
  };

  const LOS_RING_CIRC = 125.6;
  let _losObserver = null;

  function getLearnStage() {
    if (!window.matchState.learnOS) window.matchState.learnOS = { stage: 'all', active: 's1' };
    return window.matchState.learnOS;
  }

  function renderLearning() {
    const wrap = $('los'); if (!wrap) return;
    const res = currentResult();
    const m = getSelectedJob();
    // Phase 08-D：Real Mode 无真实结果时显示空态，不展示演示学习路径
    if (window.matchState.mode !== 'demo' && !isRealLearningPath(res)) {
      wrap.innerHTML = '<div class="los-empty">请先完成一次真实人岗匹配，生成你的学习路径。</div>';
      return;
    }
    renderLearnHero(m, res);
    renderLearnStages();
    renderLearnCards();
    applyLearnStageFilter(getLearnStage().stage);
    renderLearnGraph();
    renderLearnForecast();
    renderLearnCoach(m, res);
    observeLosStages();
  }

  function bindLearning() {
    const wrap = $('los'); if (!wrap) return;
    // 事件委托：阶段筛选 / 卡片操作 / 图谱节点 / 教练浮窗
    wrap.addEventListener('click', (e) => {
      const stageEl = e.target.closest('.los-stage');
      if (stageEl) { setLearnStage(stageEl.dataset.stage); return; }
      const allBtn = e.target.closest('#los-filter-all');
      if (allBtn) { setLearnStage('all'); return; }
      const card = e.target.closest('.los-card');
      if (card) {
        const action = e.target.closest('[data-action]');
        if (action) {
          const act = action.dataset.action;
          if (act === 'start') startLearnSkill(card);
          else if (act === 'graph') focusLearnGraph(card.dataset.skill);
          else if (act === 'qa') { if (window.Shell && window.Shell.openQA) window.Shell.openQA(); else if (window.showToast) window.showToast('AI 问答即将打开', 'info'); }
        } else {
          card.classList.toggle('is-expanded');
        }
        return;
      }
      const node = e.target.closest('.los-gnode');
      if (node) { showLearnGraphInfo(node.dataset.skill); return; }
      const coachBtn = e.target.closest('#los-coach-start');
      if (coachBtn) {
        const c = document.querySelector('.los-card[data-skill="docker"]');
        if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => startLearnSkill(c), 450); }
        return;
      }
    });
    // 图谱节点 hover 联动（明暗）
    wrap.addEventListener('mouseover', (e) => {
      const node = e.target.closest('.los-gnode');
      if (!node) return;
      qsa('.los-gnode').forEach((g) => g.classList.toggle('is-dim', g !== node));
      qsa('.los-gedge').forEach((ed) => ed.classList.toggle('is-live', ed.dataset.skill === node.dataset.skill));
    });
    wrap.addEventListener('mouseout', (e) => {
      if (!e.target.closest('.los-gnode')) return;
      qsa('.los-gnode').forEach((g) => g.classList.remove('is-dim'));
      qsa('.los-gedge').forEach((ed) => ed.classList.remove('is-live'));
    });
    bindLosChartsResize();
  }

  function bindLosChartsResize() {
    if (window.__losResizeBound) return;
    window.__losResizeBound = true;
    window.addEventListener('resize', () => {
      [['los-radar-canvas'], ['los-forecast-canvas']].forEach(([id]) => {
        const el = $(id); if (el && el._losChart) el._losChart.resize();
      });
    });
  }

  function losChart(id, option) {
    if (!window.echarts) return null;
    const el = $(id); if (!el) return null;
    if (el._losChart) { try { el._losChart.dispose(); } catch (_) {} }
    const chart = echarts.init(el);
    el._losChart = chart;
    chart.setOption(option);
    return chart;
  }

  /* ---------- Phase 06：Learn OS 数据源（真实优先，demo 兜底） ---------- */
  function isRealLearningPath(res) {
    const lp = res && res.learning_path;
    // 真实后端 build_learning_path 输出含 resource 字段；Mock MOCK_RESULT 无
    return Array.isArray(lp) && lp.length > 0 && lp[0].resource !== undefined;
  }
  function learningProgressKey(res) {
    const m = (res && res.matches || [])[0] || {};
    const jobId = m.job && m.job.id || window.matchState.selectedJobId || 'unknown';
    const userId = (window.currentUser && (window.currentUser.id || window.currentUser.user_id)) || 'local';
    return `match-learning-progress:${userId}:${jobId}`;
  }
  function loadLearningProgress(res) {
    try { return JSON.parse(localStorage.getItem(learningProgressKey(res)) || '{}') || {}; } catch (_) { return {}; }
  }
  function saveLearningProgress(res, progress) {
    try { localStorage.setItem(learningProgressKey(res), JSON.stringify(progress || {})); } catch (_) {}
  }
  function getLearnOS(res) {
    res = res || window.matchState.result;
    if (!isRealLearningPath(res)) return LEARN_OS; // demo / 无真实结果
    const lp = res.learning_path;
    const completed = loadLearningProgress(res);
    const skills = lp.map((l, i) => ({
      id: 'lp-' + i,
      name: l.skill || l.title || ('学习步骤' + (i + 1)),
      icon: '📘',
      stage: 's1',
      tags: ['学习路径', '能力缺口'],
      status: completed['lp-' + i] ? 'mastered' : 'gap',
      from: completed['lp-' + i] ? 100 : (typeof l.from === 'number' ? l.from : 30),
      to: completed['lp-' + i] ? 100 : (typeof l.to === 'number' ? l.to : 70),
      hours: Math.max(1, Math.round((l.weeks || 1) * 8)),
      level: l.level || '入门',
      impact: '+匹配度',
      desc: l.description || '',
      deliverable: l.deliverable || ''
    }));
    const m = (res.matches || [])[0] || {};
    const dims = m.dimensions || {};
    const radarValues = ['skills', 'semantics', 'projects', 'experience', 'graph']
      .map((k) => (typeof dims[k] === 'number' ? dims[k] : 50));
    const profile = res.profile || {};
    const mastered = (profile.skills || []).length;
    const match = Math.round(typeof m.score === 'number' ? m.score : 0);
    return {
      career: {
        levelFrom: (typeof profile.experience_years === 'number' && profile.experience_years > 3) ? '中级' : '初级',
        levelTo: (m.job && m.job.title) || '目标岗位',
        match: match,
        mastered: mastered,
        total: skills.length + mastered,
        eta: (skills[0] && skills[0].hours ? Math.ceil(skills[0].hours / 8) + ' 天' : '—'),
        matchDelta: '+基于真实匹配',
        radar: { indicators: ['技能', '语义', '项目', '经验', '图谱'], values: radarValues },
        advice: ((m.match_reasons || [])[0]) || (m.reason || '基于真实匹配结果生成学习建议。'),
        tags: skills.slice(0, 3).map((s) => s.name)
      },
      stages: [{ id: 's1', name: '学习路径', en: 'LEARNING PATH', progress: skills.length ? Math.round(skills.filter((s) => s.status === 'mastered').length / skills.length * 100) : 0, count: skills.length, value: '按需学习' }],
      skills: skills
    };
  }

  /* ---------- ① 顶部职业成长概览 Dashboard ---------- */
  function renderLearnHero(m, res) {
    const hero = $('los-hero'); if (!hero) return;
    const os = getLearnOS(res);
    const c = os.career;
    const title = (m && m.job && m.job.title) ? (m.job.title + ' · 成长路线') : LEARN_OS_DEFAULT_TITLE;
    const skills = (res && res.profile && res.profile.skills) || [];
    hero.innerHTML = `
      <div class="los-hero-left los-glass los-glow">
        <div class="los-hero-title-row">
          <h2 class="los-hero-title">${escapeHtml(title)}</h2>
          <span class="los-hero-live"><i></i>基于本次匹配</span>
        </div>
        <div class="los-level">
          <div class="los-level-tag"><small>当前等级</small><b>${escapeHtml(c.levelFrom)}</b></div>
          <span class="los-level-arrow">→</span>
          <div class="los-level-tag"><small>目标等级</small><b>${escapeHtml(c.levelTo)}</b></div>
          <div class="los-level-eta"><b>${escapeHtml(c.eta)}</b><small>预计达成</small></div>
        </div>
        <div class="los-stats">
          <div class="los-stat">
            <div class="los-stat-label">岗位匹配度</div>
            <div class="los-stat-value"><b class="hot" data-count="${c.match}">0</b><small>%</small></div>
            <div class="los-stat-sub"><span class="up">${escapeHtml(c.matchDelta)}</span></div>
            <div class="los-stat-meter"><i style="width:${c.match}%"></i></div>
          </div>
          <div class="los-stat">
            <div class="los-stat-label">已掌握技能</div>
            <div class="los-stat-value"><b>${c.mastered}</b><small> / ${c.total}</small></div>
            <div class="los-stat-sub">${skills.length ? '覆盖 ' + skills.length + ' 项核心技能' : '基于简历分析'}</div>
            <div class="los-stat-meter"><i style="width:${Math.round(c.mastered / c.total * 100)}%"></i></div>
          </div>
          <div class="los-stat">
            <div class="los-stat-label">学习目标</div>
            <div class="los-stat-value"><b class="gold">${escapeHtml(c.levelTo)}</b></div>
            <div class="los-stat-sub">下一阶段 · ${escapeHtml(c.eta)}</div>
            <div class="los-stat-meter"><i style="width:42%"></i></div>
          </div>
        </div>
      </div>

      <div class="los-radar los-glass">
        <div class="los-radar-head">
          <div class="los-radar-title">能力雷达<small>六维职业能力画像</small></div>
          <span class="los-radar-badge">基于简历 + 项目证据</span>
        </div>
        <div class="los-radar-canvas" id="los-radar-canvas"></div>
      </div>

      <div class="los-advice los-glass los-glow">
        <div class="los-advice-head">
          <div class="los-ai-orb">AI</div>
          <div class="los-advice-title"><b>AI 职业建议</b><small>基于岗位差距生成</small></div>
          <span class="los-advice-state"><i></i>已生成 · ${isRealLearningPath(res) ? '真实结果' : '演示'}</span>
        </div>
        <p class="los-advice-text">"${escapeHtml(c.advice)}"</p>
        <div class="los-advice-tags">
          ${c.tags.map((t) => `<span class="los-tag los-tag--gap">${escapeHtml(t)}</span>`).join('')}
        </div>
        <button class="los-btn los-btn--gold" id="los-plan-btn" type="button">查看学习路径 →</button>
      </div>`;

    // 数字动画
    const cnt = hero.querySelector('[data-count]');
    if (cnt) animateNumber(cnt, c.match, 1100, '%', '');
    // 雷达图
    const option = {
      tooltip: { show: false },
      radar: {
        indicator: c.radar.indicators.map((n) => ({ name: n, max: 100 })),
        radius: '66%',
        center: ['50%', '54%'],
        splitNumber: 4,
        axisName: { color: '#9db2c6', fontSize: 11, fontFamily: '"Outfit","Noto Sans SC",sans-serif' },
        splitArea: { areaStyle: { color: ['rgba(255,255,255,0.015)', 'rgba(255,255,255,0.03)'] } },
        splitLine: { lineStyle: { color: 'rgba(140,190,255,0.14)' } },
        axisLine: { lineStyle: { color: 'rgba(140,190,255,0.18)' } }
      },
      series: [{
        type: 'radar',
        data: [{ value: c.radar.values, name: '当前能力' }],
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 2, color: '#35e0c8' },
        itemStyle: { color: '#f0b429', borderColor: '#f0b429', borderWidth: 2 },
        areaStyle: { color: 'rgba(53,224,200,0.22)' }
      }]
    };
    requestAnimationFrame(() => losChart('los-radar-canvas', option));
    // 生成计划按钮
    const planBtn = $('los-plan-btn');
    if (planBtn) planBtn.addEventListener('click', () => {
      if (window.showToast) window.showToast('正在基于能力差距生成学习计划…', 'info');
      setTimeout(() => {
        const firstGap = document.querySelector('.los-card.is-gap');
        if (firstGap) { firstGap.scrollIntoView({ behavior: 'smooth', block: 'center' }); firstGap.classList.add('is-expanded'); }
        if (window.showToast) window.showToast('已生成：优先补齐微服务治理 → 云原生部署', 'ok');
      }, 700);
    });
  }

  /* ---------- ② 时间轴 ---------- */
  function renderLearnStages() {
    const tl = $('los-timeline'); if (!tl) return;
    const st = getLearnStage();
    const os = getLearnOS();
    tl.innerHTML = os.stages.map((s, i) => `
      <div class="los-stage ${st.active === s.id ? 'is-active' : ''} ${st.stage === s.id ? 'is-selected' : ''}" data-stage="${s.id}">
        <div class="los-stage-top">
          <div>
            <div class="los-stage-name">阶段 ${i + 1} · ${escapeHtml(s.name)}</div>
            <div class="los-stage-en">${escapeHtml(s.en)}</div>
          </div>
          <span class="los-stage-value">${escapeHtml(s.value)}</span>
        </div>
        <div class="los-stage-meta">
          <span>完成 <b>${s.progress}%</b></span>
          <span>技能 <b>${s.count}</b> 项</span>
        </div>
        <div class="los-stage-bar"><i style="width:${s.progress}%"></i></div>
      </div>`).join('');
  }

  function observeLosStages() {
    if (!window.IntersectionObserver) return;
    if (_losObserver) _losObserver.disconnect();
    _losObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          const st = getLearnStage();
          st.active = en.target.dataset.stage;
          qsa('.los-stage').forEach((s) => s.classList.toggle('is-active', s.dataset.stage === st.active));
        }
      });
    }, { root: $('wks-center') || null, rootMargin: '-15% 0px -55% 0px' });
    qsa('.los-stage').forEach((s) => _losObserver.observe(s));
  }

  function applyLearnStageFilter(stageId) {
    qsa('.los-stage').forEach((s) => s.classList.toggle('is-selected', s.dataset.stage === stageId));
    qsa('.los-card').forEach((card) => {
      const show = stageId === 'all' || card.dataset.stage === stageId;
      if (show) { card.classList.remove('is-hidden'); card.style.animation = 'none'; void card.offsetWidth; card.style.animation = ''; }
      else card.classList.add('is-hidden');
    });
    const os = getLearnOS();
    const cnt = $('los-cards-count');
    if (cnt) {
      const visible = qsa('.los-card').filter((c) => !c.classList.contains('is-hidden')).length;
      cnt.innerHTML = `当前展示 <b>${visible}</b> / ${os.skills.length} 个技能模块`;
    }
    const allBtn = $('los-filter-all');
    if (allBtn) {
      const stageObj = os.stages.find((s) => s.id === stageId);
      allBtn.textContent = stageObj ? '回到全部阶段' : '显示全部阶段';
    }
  }

  function setLearnStage(stageId) {
    const st = getLearnStage();
    st.stage = stageId;
    applyLearnStageFilter(stageId);
  }

  /* ---------- ② 技能模块卡片 ---------- */
  function skillCardHtml(s) {
    const ring = s.status === 'mastered' ? s.to : s.from;
    const offset = LOS_RING_CIRC * (1 - ring / 100);
    const statusClass = s.status === 'mastered' ? 'is-mastered' : (s.status === 'gap' ? 'is-gap' : 'is-learning');
    const reco = s.reco ? '<span class="los-card-reco">AI 推荐下一技能<i></i></span>' : '';
    const btnLabel = s.status === 'mastered' ? '已完成 ✓' : '开始学习';
    const tags = s.tags.map((t) => {
      let cls = '';
      if (t.indexOf('缺口') >= 0) cls = 'los-tag--gap';
      else if (t.indexOf('必备') >= 0 || t.indexOf('核心') >= 0) cls = 'los-tag--teal';
      else if (t === '基础') cls = 'los-tag--mastered';
      return `<span class="los-tag los-tag--s ${cls}">${escapeHtml(t)}</span>`;
    }).join('');
    return `<article class="los-card ${statusClass}" data-skill="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}" data-stage="${s.stage}" data-from="${s.from}" data-to="${s.to}">
      ${reco}
      <div class="los-card-head">
        <div class="los-card-icon">${s.icon}</div>
        <div class="los-card-title">
          <h3>${escapeHtml(s.name)}</h3>
          <div class="los-card-tags">${tags}</div>
        </div>
        <div class="los-ring-wrap">
          <svg class="los-ring" viewBox="0 0 48 48" aria-hidden="true">
            <circle class="los-ring-track" cx="24" cy="24" r="20"></circle>
            <circle class="los-ring-bar" cx="24" cy="24" r="20" stroke-dasharray="${LOS_RING_CIRC.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"></circle>
          </svg>
          <span class="los-ring-num"><b class="los-ring-val">${ring}</b><small>%</small></span>
        </div>
      </div>
      <div class="los-card-value">
        <span class="los-card-value-label">技能价值</span>
        <b>${escapeHtml(s.impact)}</b>
      </div>
      <div class="los-card-progress">
        <div class="los-card-progress-row"><span>学习进度 · ${escapeHtml(s.level)} · ${s.hours} 小时</span><b>${s.from}% → ${s.to}%</b></div>
        <div class="los-progress-bar"><i style="width:${ring}%"></i></div>
      </div>
      <div class="los-card-actions">
        <button class="los-btn los-btn--solid" data-action="start" type="button">${btnLabel}</button>
        <button class="los-btn los-btn--ghost" data-action="graph" type="button">知识图谱</button>
        <button class="los-btn los-btn--ghost" data-action="qa" type="button">AI 问答</button>
      </div>
      <div class="los-card-detail">
        <div class="los-card-detail-row"><span class="k">交付成果</span><span>${escapeHtml(s.deliverable)}</span></div>
        <div class="los-card-detail-row"><span class="k">岗位价值</span><span>${escapeHtml(s.desc)}</span></div>
      </div>
    </article>`;
  }

  function renderLearnCards() {
    const box = $('los-cards'); if (!box) return;
    const os = getLearnOS();
    const all = os.skills;
    box.innerHTML = `<div class="los-cards-head">
        <div class="los-cards-count" id="los-cards-count">当前展示 <b>${all.length}</b> / ${all.length} 个技能模块</div>
        <span class="los-cards-count">点击卡片展开详情</span>
      </div>` + all.map((s, i) => skillCardHtml(s)).join('');
  }

  function startLearnSkill(card) {
    if (!card || card.classList.contains('is-mastered')) return;
    const res = currentResult();
    const progress = loadLearningProgress(res);
    progress[card.dataset.skill] = { completed: true, completedAt: new Date().toISOString() };
    saveLearningProgress(res, progress);
    if (window.showToast) window.showToast('已标记完成 · ' + (card.dataset.name || '技能'), 'ok');
    renderLearning();
  }

  function burstUnlock(card) {
    const burst = document.createElement('div');
    burst.className = 'los-unlock-burst';
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('span');
      const ang = (i / 10) * Math.PI * 2;
      p.style.setProperty('--dx', (Math.cos(ang) * (38 + Math.random() * 30)) + 'px');
      p.style.setProperty('--dy', (Math.sin(ang) * (38 + Math.random() * 30)) + 'px');
      burst.appendChild(p);
    }
    card.appendChild(burst);
    setTimeout(() => burst.remove(), 800);
  }

  function unlockNextSkill(skillId) {
    const chain = LEARN_OS.graph.chain;
    const idx = chain.indexOf(skillId);
    if (idx < 0 || idx >= chain.length - 1) return;
    const next = chain[idx + 1];
    const node = document.querySelector('.los-gnode[data-skill="' + next + '"]');
    if (node && node.classList.contains('is-gap')) {
      node.classList.add('is-live');
      setTimeout(() => node.classList.remove('is-live'), 1600);
      if (window.showToast) window.showToast('已解锁下一技能：' + (LEARN_OS.graph.nodes.find((n) => n.id === next) || {}).name, 'info');
    }
  }

  /* ---------- ③ 岗位能力地图 ---------- */
  function renderLearnGraph() {
    const box = $('los-graph'); if (!box) return;
    // Phase 06：真实差距图谱（gap_graph）优先，demo 才用 LEARN_OS.graph
    const _res = window.matchState.result;
    if (isRealLearningPath(_res)) {
      const gg = _res.gap_graph || {};
      const nodes = (gg.nodes || []).filter((n) => n && n.label);
      const edges = gg.edges || [];
      box.innerHTML = `
        <div class="los-graph-legend">
          <span><i class="d-mastered"></i>已掌握</span>
          <span><i class="d-gap"></i>能力缺口</span>
          <span class="hint">基于真实差距图谱（gap_graph）</span>
        </div>
        <div style="padding:16px 20px;display:flex;flex-wrap:wrap;gap:8px">
          ${nodes.map((n) => `<span class="los-tag los-tag--s ${(n.status === 'matched' || n.status === 'candidate') ? 'los-tag--mastered' : 'los-tag--gap'}">${escapeHtml(n.label)}</span>`).join('')}
        </div>
        ${edges.length ? `<div class="jd-sub" style="padding:0 20px 16px">${edges.slice(0, 8).map((e) => `<span>${escapeHtml(e.source)} → ${escapeHtml(e.target)}</span>`).join('　')}</div>` : ''}`;
      return;
    }
    const g = LEARN_OS.graph;
    const pos = {};
    g.nodes.forEach((n) => { pos[n.id] = n; });
    const edges = [];
    for (let i = 0; i < g.chain.length - 1; i++) {
      const a = pos[g.chain[i]], b = pos[g.chain[i + 1]];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 26;
      edges.push({ a, b, d: `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}` });
    }
    box.innerHTML = `
      <div class="los-graph-legend">
        <span><i class="d-mastered"></i>已掌握</span>
        <span><i class="d-learning"></i>学习中</span>
        <span><i class="d-gap"></i>能力缺口</span>
        <span class="hint">点击节点查看能力说明</span>
      </div>
      <svg class="los-graph-svg" viewBox="0 0 1060 285" role="img" aria-label="岗位能力地图">
        ${edges.map((ed) => `<path class="los-gedge" data-skill="${escapeHtml(ed.b.id)}" d="${ed.d}" />`).join('')}
        ${g.nodes.map((n) => `
          <g class="los-gnode is-${n.status}" data-skill="${escapeHtml(n.id)}" transform="translate(${n.x},${n.y})">
            <circle class="los-gnode-halo" r="42"></circle>
            <circle class="los-gnode-core" r="24" stroke-width="1.8"></circle>
            <text class="los-gnode-label" y="4">${escapeHtml(n.name)}</text>
            <text class="los-gnode-sub" y="19">${escapeHtml(n.sub)}</text>
          </g>`).join('')}
      </svg>
      <div class="los-graph-info" id="los-graph-info"></div>`;
  }

  function showLearnGraphInfo(skillId) {
    const info = $('los-graph-info'); if (!info) return;
    const g = LEARN_OS.graph;
    const node = g.nodes.find((n) => n.id === skillId);
    if (!node) return;
    const idx = g.chain.indexOf(skillId);
    const next = idx >= 0 && idx < g.chain.length - 1 ? g.nodes.find((n) => n.id === g.chain[idx + 1]) : null;
    const chainLen = g.chain.length;
    const statusMap = { mastered: ['已掌握', '#34d399'], learning: ['学习中', '#fbbf24'], gap: ['能力缺口', '#fb7185'] };
    const [statusLabel, statusColor] = statusMap[node.status];
    info.innerHTML = `
      <div class="lg-title">
        <span class="dot" style="background:${statusColor};box-shadow:0 0 10px ${statusColor}"></span>
        <strong>${escapeHtml(node.name)}</strong>
        <span class="los-tag los-tag--s ${node.status === 'mastered' ? 'los-tag--mastered' : (node.status === 'learning' ? 'los-tag--learning' : 'los-tag--gap')}">${statusLabel}</span>
        <span style="margin-left:auto;font-size:10.5px;color:var(--los-ink-faint)">能力链第 ${idx + 1} / ${chainLen} 环</span>
      </div>
      <div class="lg-row"><span class="k">为什么学习</span><span>${escapeHtml(node.info)}</span></div>
      <div class="lg-row"><span class="k">学习建议</span><span>${escapeHtml(node.learn)}</span></div>
      ${next ? `<div class="lg-row"><span class="k">下一环节</span><span>→ ${escapeHtml(next.name)}（${statusMap[next.status][0]}）</span></div>` : '<div class="lg-row"><span class="k">下一环节</span><span>✅ 已到达能力链终点</span></div>'}
      <div class="lg-cta">
        <button class="los-btn los-btn--ghost" data-action="qa" type="button">向 AI 咨询此技能</button>
      </div>`;
    const qa = info.querySelector('[data-action="qa"]');
    if (qa) qa.addEventListener('click', () => { if (window.Shell && window.Shell.openQA) window.Shell.openQA(); });
  }

  /* ---------- ④ 能力提升预测 ---------- */
  function renderLearnForecast() {
    const box = $('los-forecast'); if (!box) return;
    box.innerHTML = `<div class="los-forecast-canvas" id="los-forecast-canvas"></div>`;
    if (!window.echarts) {
      box.innerHTML = `<div style="padding:20px;color:var(--los-ink-soft);font-size:12.5px">图表库加载中，请稍候…</div>`;
      return;
    }
    // Phase 06：真实模式下用真实匹配度 + learning_path 生成预测点（demo 才用 LEARN_OS.forecast）
    let points = LEARN_OS.forecast;
    const _resF = window.matchState.result;
    if (isRealLearningPath(_resF)) {
      const _m = (_resF.matches || [])[0] || {};
      const _cur = Math.round(_m.score || 0);
      const _lp = _resF.learning_path || [];
      const _n = Math.max(1, _lp.length);
      const _target = Math.min(98, Math.max(_cur + 12, 88));
      points = [];
      for (let i = 0; i <= _n; i++) {
        points.push({
          label: i === 0 ? '当前' : ('完成 ' + i + ' 项'),
          value: Math.min(98, _cur + Math.round(i * ((_target - _cur) / _n))),
          note: i === 0 ? '当前匹配度（真实）' : '按推荐路径推进'
        });
      }
    }
    const option = {
      grid: { left: 48, right: 30, top: 40, bottom: 40 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10,18,36,0.92)',
        borderColor: 'rgba(53,224,200,0.35)',
        textStyle: { color: '#e8f2f8', fontSize: 12 },
        formatter: (params) => {
          const p = points[params[0].dataIndex];
          return `<b>${escapeHtml(p.label)}</b><br/>岗位匹配度 <b style="color:#35e0c8">${p.value}%</b><br/><span style="color:#9db2c6">${escapeHtml(p.note)}</span>`;
        }
      },
      xAxis: {
        type: 'category',
        data: points.map((p) => p.label),
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(140,190,255,0.18)' } },
        axisTick: { show: false },
        axisLabel: { color: '#9db2c6', fontSize: 11, interval: 0 }
      },
      yAxis: {
        type: 'value',
        min: 55,
        max: 100,
        splitLine: { lineStyle: { color: 'rgba(140,190,255,0.08)', type: 'dashed' } },
        axisLabel: { color: '#5d738c', fontSize: 11, formatter: '{value}%' }
      },
      series: [{
        type: 'line',
        data: points.map((p) => p.value),
        smooth: true,
        symbol: 'circle',
        symbolSize: 9,
        lineStyle: { width: 3, color: '#35e0c8', shadowColor: 'rgba(53,224,200,0.5)', shadowBlur: 14 },
        itemStyle: { color: '#f0b429', borderColor: '#0a1224', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(53,224,200,0.35)' },
              { offset: 1, color: 'rgba(53,224,200,0.02)' }
            ]
          }
        },
        markPoint: {
          data: points.map((p, i) => ({
            coord: [i, p.value],
            value: '',
            symbol: 'roundRect',
            symbolSize: 0,
            itemStyle: { color: 'transparent' },
            label: {
              formatter: p.value + '%',
              color: '#f5ddb0',
              fontSize: 11,
              fontWeight: 700,
              position: 'top',
              distance: 8
            }
          }))
        }
      }]
    };
    requestAnimationFrame(() => losChart('los-forecast-canvas', option));
  }

  /* ---------- AI Career Coach 浮窗 ---------- */
  function renderLearnCoach(m, res) {
    const coach = $('los-coach'); if (!coach) return;
    // Phase 06：真实 learning_path 驱动的教练任务（demo 才用 LEARN_OS.coach）
    let c = LEARN_OS.coach;
    if (isRealLearningPath(res)) {
      const os = getLearnOS(res);
      const career = os.career;
      const first = (os.skills || [])[0] || {};
      c = {
        task: first.name ? ('补齐「' + first.name + '」' + (first.deliverable ? ' · ' + first.deliverable : '')) : '按推荐学习路径推进',
        reason: career.advice || '基于真实匹配结果生成建议。',
        progress: first.from || 30,
        to: first.to || 70
      };
    }
    const jobName = (m && m.job && m.job.title) || 'Java 后端开发工程师';
    coach.innerHTML = `
      <div class="los-coach-head">
        <div class="los-coach-orb">AI</div>
        <div class="los-coach-title"><b>AI Career Coach</b><small>职业教练 · ${escapeHtml(jobName)}</small></div>
        <span class="los-coach-live"><i></i>基于当前路径</span>
      </div>
      <div class="los-coach-body">
        <div class="los-coach-task-label">TODAY'S TASK · 今日任务</div>
        <div class="los-coach-task"><span class="tick">◆</span>${escapeHtml(c.task)}</div>
        <div class="los-coach-reason">"${escapeHtml(c.reason)}"</div>
        <div class="los-coach-progress">
          <div class="row"><span>当前进度</span><b>${c.progress}% → ${c.to}%</b></div>
          <div class="los-progress-bar"><i style="width:${c.progress}%"></i></div>
        </div>
      </div>
      <div style="padding:0 16px 16px">
        <button class="los-coach-cta" id="los-coach-start" type="button">开始学习 →</button>
      </div>`;
  }

  /* ============================================================
   * AI 人岗能力诊断工作台（学习画像重构版）
   * 数据契约：PROFILE_MODEL —— 字段预留后端 API：
   *   id / name / currentScore / requiredScore / gap / priority /
   *   status / evidence / jobImpact / relatedSkills / learningPath
   * 交互闭环：能力地图 → 点击能力 → AI 诊断 → 证据 → 岗位影响 →
   *           能力提升模拟 → 预计匹配度 → 生成学习路径 → 进入学习
   * ============================================================ */
  const PROFILE_LAYOUT = {
    center: [{ x: 500, y: 300 }],
    core: [{ x: 290, y: 225 }, { x: 620, y: 180 }, { x: 620, y: 440 }],
    extension: [{ x: 150, y: 120 }, { x: 150, y: 340 }, { x: 830, y: 120 }, { x: 830, y: 310 }, { x: 830, y: 470 }, { x: 290, y: 440 }]
  };

  const PROFILE_MODEL = {
    job: {
      id: 'java-be', name: 'Java 后端开发', centerLabel: 'Java 后端',
      overallScore: 76, overallDelta: 6,
      matchScore: 88, matchDelta: 4,
      gapCount: 3, highPriorityGaps: 2,
      dataUpdatedAt: '08/24 23:36',
      dataSources: {
        overview: [
          { label: '简历分析', value: '3 年经验' },
          { label: '项目证据', value: '3 项' },
          { label: '练习记录', value: '86 次' },
          { label: '对话记录', value: '12 次' }
        ],
        categories: [
          { name: '简历', desc: '技能、经历、量化成果' },
          { name: '项目', desc: '项目经历与代码证据' },
          { name: '练习', desc: '练习记录与正确率' },
          { name: '对话', desc: 'AI 辅导对话中的表现' },
          { name: '测验', desc: '阶段测评与诊断结果' }
        ],
        updates: [
          { label: '简历分析', time: '今天' },
          { label: '练习记录', time: '今天' },
          { label: '知识点掌握', time: '今天' },
          { label: '项目证据', time: '昨天' },
          { label: '对话记录', time: '昨天' }
        ]
      }
    },
    skills: [
      {
        id: 'java', name: 'Java', layer: 'core', currentScore: 96, requiredScore: 92, gap: 4,
        priority: 'low', status: 'strong',
        summary: '核心技能，已达岗位要求',
        evidence: {
          projectCount: 3, exerciseCount: 26, knowledgeCount: 18, accuracy: 94,
          project: [
            { title: '高并发订单系统', desc: '主导核心链路开发，日均 500w+ 调用', skills: ['Java', 'Spring Boot', 'MySQL'] },
            { title: 'Spring Boot 营销平台', desc: '负责服务端接口与限流设计', skills: ['Java', 'Spring Boot'] }
          ],
          learn: [{ title: '完成 Java 集合框架与 JMM 内存模型章节', time: '近 30 天' }],
          practice: [{ title: 'Java 相关题目 26 道', accuracy: 94 }],
          dialogue: [{ title: 'AI 对话中能解释 volatile 与 synchronized 的区别' }],
          mastered: ['集合框架', 'JMM 基础', '并发工具类'], weak: []
        },
        jobImpact: { role: '核心能力', matchImpact: 0, potentialImprovement: 0, suggestion: '已达标，保持输出', newJobs: 0 },
        relatedSkills: ['jvm', 'concurrency', 'springboot', 'mysql'],
        learningPath: []
      },
      {
        id: 'springboot', name: 'Spring Boot', layer: 'core', currentScore: 90, requiredScore: 85, gap: 5,
        priority: 'low', status: 'strong',
        summary: '主流后端框架，项目落地充分',
        evidence: {
          projectCount: 2, exerciseCount: 15, knowledgeCount: 12, accuracy: 92,
          project: [{ title: 'Spring Boot 营销平台', desc: '使用 Spring Boot 搭建服务并落地生产', skills: ['Spring Boot', 'Java'] }],
          learn: [{ title: '完成 Spring Boot 自动装配与 Starter 章节', time: '近 30 天' }],
          practice: [{ title: 'Spring Boot 相关题目 15 道', accuracy: 92 }],
          dialogue: [{ title: 'AI 对话中能解释 Bean 生命周期' }],
          mastered: ['自动装配', 'Web 开发', '数据访问'], weak: []
        },
        jobImpact: { role: '核心能力', matchImpact: 0, potentialImprovement: 0, suggestion: '已达标，可加深微服务方向', newJobs: 0 },
        relatedSkills: ['microservice', 'redis', 'java'],
        learningPath: []
      },
      {
        id: 'mysql', name: 'MySQL', layer: 'core', currentScore: 87, requiredScore: 80, gap: 7,
        priority: 'low', status: 'strong',
        summary: '核心技能，含慢查询优化实践',
        evidence: {
          projectCount: 2, exerciseCount: 14, knowledgeCount: 10, accuracy: 90,
          project: [{ title: 'MySQL 慢查询优化专项', desc: '负责核心表设计与慢查询优化', skills: ['MySQL', 'Java'] }],
          learn: [{ title: '完成索引与执行计划章节', time: '近 30 天' }],
          practice: [{ title: 'MySQL 相关题目 14 道', accuracy: 90 }],
          dialogue: [{ title: 'AI 对话中能解释最左前缀原则' }],
          mastered: ['索引优化', '事务控制', '慢查询排查'], weak: []
        },
        jobImpact: { role: '核心能力', matchImpact: 0, potentialImprovement: 0, suggestion: '已达标，可补充分库分表', newJobs: 0 },
        relatedSkills: ['systemdesign', 'redis'],
        learningPath: []
      },
      {
        id: 'jvm', name: 'JVM', layer: 'extension', currentScore: 62, requiredScore: 80, gap: -18,
        priority: 'high', status: 'weak',
        summary: '内存模型有基础，GC 与类加载薄弱',
        evidence: {
          projectCount: 1, exerciseCount: 18, knowledgeCount: 11, accuracy: 71,
          project: [{ title: '参与 Spring Boot 后端项目', desc: '性能调优过程中涉及 JVM 参数与堆栈分析', skills: ['JVM', 'Java', 'Spring Boot'] }],
          learn: [{ title: '完成 JVM 内存管理章节（GC 部分未深入）', time: '近 30 天' }],
          practice: [{ title: 'JVM 相关题目 18 道', accuracy: 71 }],
          dialogue: [{ title: 'AI 对话中能够解释堆 / 栈区别' }],
          mastered: ['内存模型', '堆 / 栈'], weak: ['GC', '类加载机制']
        },
        jobImpact: { role: '核心能力', matchImpact: -7, potentialImprovement: 7, suggestion: '优先提升', newJobs: 17 },
        relatedSkills: ['java', 'concurrency', 'springboot'],
        learningPath: [
          { title: 'JVM 内存结构与堆栈分析', hours: 1.5, target: 72 },
          { title: 'GC 原理与调优实践', hours: 1.2, target: 78 },
          { title: '类加载机制与实战排查', hours: 0.8, target: 80 }
        ]
      },
      {
        id: 'microservice', name: '微服务', layer: 'extension', currentScore: 45, requiredScore: 55, gap: -10,
        priority: 'high', status: 'weak',
        summary: '了解概念，缺少服务拆分落地经验',
        evidence: {
          projectCount: 0, exerciseCount: 8, knowledgeCount: 6, accuracy: 60,
          project: [],
          learn: [{ title: '完成微服务拆分概念章节', time: '近 30 天' }],
          practice: [{ title: '微服务相关题目 8 道', accuracy: 60 }],
          dialogue: [{ title: 'AI 对话中能描述服务注册与发现' }],
          mastered: ['服务拆分概念'], weak: ['Spring Cloud 组件', '注册中心实践']
        },
        jobImpact: { role: '加分能力', matchImpact: -4, potentialImprovement: 4, suggestion: '重点提升', newJobs: 9 },
        relatedSkills: ['springboot', 'systemdesign', 'docker', 'concurrency'],
        learningPath: [
          { title: 'Spring Cloud 核心组件', hours: 1.5, target: 58 },
          { title: '服务拆分与注册中心实践', hours: 1.5, target: 65 },
          { title: '分布式链路与容错', hours: 1, target: 70 }
        ]
      },
      {
        id: 'systemdesign', name: '系统设计', layer: 'extension', currentScore: 55, requiredScore: 62, gap: -7,
        priority: 'medium', status: 'weak',
        summary: '参与过架构评审，方案输出待深化',
        evidence: {
          projectCount: 1, exerciseCount: 6, knowledgeCount: 7, accuracy: 66,
          project: [{ title: '高并发系统设计评审', desc: '参与高并发系统设计评审并输出方案', skills: ['系统设计', 'MySQL'] }],
          learn: [{ title: '完成高并发架构模式章节', time: '近 30 天' }],
          practice: [{ title: '系统设计相关题目 6 道', accuracy: 66 }],
          dialogue: [{ title: 'AI 对话中能描述分库分表思路' }],
          mastered: ['高并发模式'], weak: ['分库分表', '缓存一致性']
        },
        jobImpact: { role: '核心能力', matchImpact: -3, potentialImprovement: 3, suggestion: '按路径提升', newJobs: 6 },
        relatedSkills: ['mysql', 'microservice'],
        learningPath: [
          { title: '高并发架构模式', hours: 0.8, target: 62 },
          { title: '分库分表与缓存设计', hours: 0.7, target: 68 },
          { title: '架构评审与复盘', hours: 0.5, target: 75 }
        ]
      },
      {
        id: 'concurrency', name: '并发编程', layer: 'extension', currentScore: 20, requiredScore: 60, gap: -40,
        priority: 'high', status: 'unlearned',
        summary: '尚未建立有效能力证据',
        evidence: {
          projectCount: 0, exerciseCount: 0, knowledgeCount: 2, accuracy: 0,
          project: [], learn: [], practice: [], dialogue: [],
          mastered: [], weak: ['线程模型', 'JUC 工具']
        },
        jobImpact: { role: '核心能力', matchImpact: -3, potentialImprovement: 3, suggestion: '建议系统学习', newJobs: 8 },
        relatedSkills: ['jvm', 'java', 'microservice'],
        learningPath: [
          { title: '并发基础与线程模型', hours: 1.2, target: 40 },
          { title: 'JUC 并发工具', hours: 1, target: 50 },
          { title: '并发实战与问题排查', hours: 0.8, target: 60 }
        ]
      },
      {
        id: 'docker', name: 'Docker', layer: 'extension', currentScore: 25, requiredScore: 50, gap: -25,
        priority: 'medium', status: 'unlearned',
        summary: '尚未建立有效能力证据',
        evidence: {
          projectCount: 0, exerciseCount: 4, knowledgeCount: 3, accuracy: 50,
          project: [], learn: [{ title: '了解容器与镜像概念', time: '近 30 天' }],
          practice: [{ title: 'Docker 基础题 4 道', accuracy: 50 }], dialogue: [],
          mastered: [], weak: ['Dockerfile', '容器编排']
        },
        jobImpact: { role: '加分能力', matchImpact: -2, potentialImprovement: 2, suggestion: '建议补充', newJobs: 5 },
        relatedSkills: ['microservice'],
        learningPath: [
          { title: '镜像与容器基础', hours: 1, target: 40 },
          { title: 'Dockerfile 编写', hours: 0.8, target: 50 }
        ]
      },
      {
        id: 'redis', name: 'Redis', layer: 'extension', currentScore: 76, requiredScore: 75, gap: 1,
        priority: 'low', status: 'strong',
        summary: '缓存场景已有基础实践',
        evidence: {
          projectCount: 1, exerciseCount: 9, knowledgeCount: 8, accuracy: 85,
          project: [{ title: '营销平台缓存改造', desc: '缓存场景中的基础使用与失效处理', skills: ['Redis', 'Spring Boot'] }],
          learn: [{ title: '完成缓存设计与一致性章节', time: '近 30 天' }],
          practice: [{ title: 'Redis 相关题目 9 道', accuracy: 85 }],
          dialogue: [{ title: 'AI 对话中能解释缓存穿透与击穿' }],
          mastered: ['基础数据结构', '缓存失效'], weak: []
        },
        jobImpact: { role: '核心能力', matchImpact: 0, potentialImprovement: 0, suggestion: '已达标', newJobs: 0 },
        relatedSkills: ['springboot', 'mysql', 'systemdesign'],
        learningPath: []
      }
    ],
    edges: [
      ['java-be', 'java'], ['java-be', 'springboot'], ['java-be', 'mysql'],
      ['java', 'jvm'], ['java', 'concurrency'], ['jvm', 'concurrency'],
      ['springboot', 'microservice'], ['springboot', 'redis'],
      ['mysql', 'redis'], ['mysql', 'systemdesign'],
      ['microservice', 'systemdesign'], ['microservice', 'docker']
    ],
    recommendedPath: {
      skillIds: ['jvm', 'concurrency', 'microservice', 'systemdesign'],
      steps: [
        { skillId: 'jvm', target: 80, hours: 3.5 },
        { skillId: 'concurrency', target: 60, hours: 3 },
        { skillId: 'microservice', target: 70, hours: 4 },
        { skillId: 'systemdesign', target: 75, hours: 2 }
      ],
      hours: 12.5, matchFrom: 88, matchTo: 96
    }
  };

  function getProfileState() {
    if (!window.matchState.profile) {
      window.matchState.profile = { selectedId: null, filter: 'all', sort: 'impact', search: '', searchHitId: null, simId: null, simVal: null, pathOn: false, entered: false };
    }
    return window.matchState.profile;
  }

  function resetProfileState() {
    const st = getProfileState();
    st.selectedId = null; st.simId = null; st.simVal = null;
    st.search = ''; st.searchHitId = null; st.pathOn = false; st.entered = false;
    st.filter = 'all'; st.sort = 'impact';
    const search = $('rp-search-input'); if (search) search.value = '';
    const hint = $('rp-search-hint'); if (hint) hint.hidden = true;
    const btn = $('rp-path-btn'); if (btn) { btn.disabled = false; btn.textContent = '生成学习路径 →'; }
  }

  function openLearningProfile() {
    const modal = $('rp-modal'); if (!modal) return;
    const m = getSelectedJob();
    if (!m) { if (typeof showToast === 'function') showToast('请先选择一个岗位', 'amber'); return; }
    resetProfileState();
    renderLearningProfile();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLearningProfile() {
    const modal = $('rp-modal'); if (modal) modal.hidden = true;
    document.body.style.overflow = '';
    profileClosePops();
    profileCloseEvidence();
  }

  function bindLearningProfile() {
    const modal = $('rp-modal'); if (!modal) return;
    const close = $('rp-close'); if (close) close.addEventListener('click', closeLearningProfile);
    const mask = modal.querySelector('.rp-mask'); if (mask) mask.addEventListener('click', closeLearningProfile);
    const evClose = $('rp-ev-close'); if (evClose) evClose.addEventListener('click', profileCloseEvidence);

    // 统一事件委托：浮层开关、节点、筛选、缺口、操作按钮、时间选项
    modal.addEventListener('click', (e) => {
      const toggle = e.target.closest('.rp-pop-toggle');
      if (toggle) {
        profileClosePops();
        const pop = $(toggle.dataset.pop);
        if (pop && pop.hidden) {
          if (toggle.dataset.pop === 'rp-source-pop') pop.innerHTML = profileSourcePopHTML();
          else if (toggle.dataset.pop === 'rp-updated-pop') pop.innerHTML = profileUpdatedPopHTML();
          else pop.innerHTML = '<div class="rp-pop-title">时间范围</div><div class="rp-pop-item" data-time="7">近 7 天</div><div class="rp-pop-item" data-time="30">近 30 天</div><div class="rp-pop-item" data-time="all">全部</div>';
          pop.hidden = false;
        }
        return;
      }
      if (e.target.closest('.rp-pop')) {
        const t = e.target.closest('[data-time]');
        if (t) { const lbl = $('rp-time-label'); if (lbl) lbl.textContent = t.textContent.trim(); profileClosePops(); }
        return;
      }
      profileClosePops();

      const node = e.target.closest('.rp-node');
      if (node) { profileSelectSkill(node.dataset.id); return; }
      const cat = e.target.closest('.rp-cat');
      if (cat) { profileSetFilter(cat.dataset.filter); return; }
      const chip = e.target.closest('.rp-gap-chip');
      if (chip) { profileSelectSkill(chip.dataset.id); return; }
      const gapRow = e.target.closest('.rp-gap-row');
      if (gapRow) { profileSelectSkill(gapRow.dataset.id); return; }
      if (e.target.closest('#rp-evidence-btn') || e.target.closest('#rp-see-evidence')) { profileOpenEvidence(); return; }
      if (e.target.closest('#rp-impact-btn')) { profileScrollToImpact(); return; }
      if (e.target.closest('#rp-path-btn') || e.target.closest('#rp-path-cta')) { profileGeneratePath(); return; }
    });

    // 搜索：定位节点 + 高亮 + 自动打开诊断
    const search = $('rp-search-input');
    if (search) {
      let timer = null;
      search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => profileSearch(search.value), 220); });
      search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(timer); profileSearch(search.value); } });
    }

    // 排序
    const sort = $('rp-sort');
    if (sort) sort.addEventListener('change', () => { getProfileState().sort = sort.value; renderProfileGraph(); });

    // 能力提升模拟滑块（只局部更新，不重绘整面板）
    modal.addEventListener('input', (e) => {
      const r = e.target.closest('.rp-sim-range');
      if (r) profileSimulate(r.dataset.id, parseInt(r.value, 10));
    });

    document.addEventListener('keydown', (e) => {
      if (modal && !modal.hidden && e.key === 'Escape') { profileClosePops(); profileCloseEvidence(); closeLearningProfile(); }
    });
  }

  function renderLearningProfile() {
    const model = PROFILE_MODEL;
    const titleEl = $('rp-title'); if (titleEl) titleEl.textContent = model.job.name + ' · 学习画像';
    const updEl = $('rp-updated-time'); if (updEl) updEl.textContent = model.job.dataUpdatedAt;
    renderProfileKpis();
    renderProfileGraph();
    renderProfileAIPanel();
    renderProfileGapBar();
  }

  /* ---------- 顶部 KPI ---------- */
  function renderProfileKpis() {
    const j = PROFILE_MODEL.job;
    const o = $('rp-kpi-overall'); if (o) animateNumber(o, j.overallScore, 700, '%');
    const od = $('rp-kpi-overall-delta'); if (od) od.textContent = '↑ 较上次 +' + j.overallDelta + '%';
    const m = $('rp-kpi-match'); if (m) animateNumber(m, j.matchScore, 700, '%');
    const md = $('rp-kpi-match-delta'); if (md) md.textContent = '↑ 核心能力匹配';
    const g = $('rp-kpi-gaps'); if (g) g.textContent = j.gapCount + ' 项';
    const gd = $('rp-kpi-gaps-delta'); if (gd) gd.textContent = j.highPriorityGaps + ' 项高优先级';
  }

  /* ---------- 能力地图（层级布局 + 筛选 + 排序） ---------- */
  function profileSkillVisible(s, filter) {
    if (filter === 'all') return true;
    if (filter === 'core') return s.layer === 'core';
    if (filter === 'gap') return s.status === 'weak';
    if (filter === 'mastered') return s.status === 'strong';
    if (filter === 'unlearned') return s.status === 'unlearned';
    return true;
  }

  function profileSortFn(kind) {
    if (kind === 'gap') return (a, b) => (a.gap - b.gap) || (a.requiredScore - b.requiredScore);
    if (kind === 'alpha') return (a, b) => a.name.localeCompare(b.name, 'zh');
    return (a, b) => (a.jobImpact.matchImpact - b.jobImpact.matchImpact) || (a.gap - b.gap);
  }

  function renderProfileGraph() {
    const cont = $('rp-graph'); if (!cont) return;
    const st = getProfileState();
    const model = PROFILE_MODEL;

    const visible = model.skills.filter((s) => profileSkillVisible(s, st.filter));
    const sortFn = profileSortFn(st.sort);
    const byLayer = { core: [], extension: [] };
    visible.forEach((s) => byLayer[s.layer].push(s));
    byLayer.core.sort(sortFn);
    byLayer.extension.sort(sortFn);

    const pos = {};
    byLayer.core.forEach((s, i) => { pos[s.id] = PROFILE_LAYOUT.core[i] || PROFILE_LAYOUT.core[PROFILE_LAYOUT.core.length - 1]; });
    byLayer.extension.forEach((s, i) => { pos[s.id] = PROFILE_LAYOUT.extension[i] || PROFILE_LAYOUT.extension[PROFILE_LAYOUT.extension.length - 1]; });

    const sel = st.selectedId ? model.skills.find((s) => s.id === st.selectedId) : null;
    const linked = new Set();
    if (sel) { linked.add(sel.id); (sel.relatedSkills || []).forEach((r) => linked.add(r)); }
    const pathIds = st.pathOn ? model.recommendedPath.skillIds : [];

    let edgesSvg = '';
    model.edges.forEach(([a, b], i) => {
      const pa = pos[a], pb = pos[b];
      if (!pa || !pb) return;
      // 中心节点恒为高亮；连线只在两端均与选中能力相关时保持亮度
      const aLink = a === 'java-be' ? true : linked.has(a);
      const bLink = b === 'java-be' ? true : linked.has(b);
      const dim = sel ? !(aLink && bLink) : false;
      const isPath = st.pathOn && pathIds.indexOf(a) >= 0 && pathIds.indexOf(b) >= 0;
      edgesSvg += '<line class="rp-edge' + (dim ? ' is-dimmed' : '') + (isPath ? ' is-path' : '') + '" x1="' + pa.x + '" y1="' + pa.y + '" x2="' + pb.x + '" y2="' + pb.y + '" style="animation-delay:' + (120 + i * 70) + 'ms"/>';
    });

    const c = PROFILE_LAYOUT.center[0];
    let nodesSvg = '';
    ['core', 'extension'].forEach((layer) => {
      byLayer[layer].forEach((s, i) => { nodesSvg += profileNodeSVG(s, pos[s.id], sel, linked, pathIds, i + 1); });
    });
    const centerSvg = profileNodeSVG(null, c, sel, linked, pathIds, 0);

    cont.innerHTML = '<svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet">' + edgesSvg + centerSvg + nodesSvg + '</svg>';
    if (!st.entered) st.entered = true;
  }

  function profileNodeSVG(s, p, sel, linked, pathIds, idx) {
    const st = getProfileState();
    const isCenter = !s;
    const id = isCenter ? 'java-be' : s.id;
    const name = isCenter ? PROFILE_MODEL.job.centerLabel : s.name;
    const r = isCenter ? 48 : (s.layer === 'core' ? 40 : 34);

    const classes = ['rp-node'];
    if (isCenter) classes.push('is-center');
    else if (s.status === 'strong') classes.push('is-strong');
    else if (s.status === 'weak') classes.push('is-weak');
    else classes.push('is-unlearned');

    if (!isCenter && sel) {
      if (sel.id === id) classes.push('is-selected');
      else if (!linked.has(id)) classes.push('is-dimmed');
      else classes.push('is-linked');
    } else if (!isCenter && !sel) {
      classes.push('is-linked');
    }
    if (st.searchHitId === id) classes.push('is-search-hit');
    if (st.pathOn && pathIds.indexOf(id) >= 0) classes.push('is-path', 'rp-path-in');
    if (!st.entered) classes.push('rp-enter');

    let inner;
    if (isCenter) {
      inner = '<text class="rp-node-name" y="-6">' + escapeHtml(name) + '</text>' +
        '<text class="rp-node-score" y="14">核心</text>' +
        '<text class="rp-node-req" y="27">目标岗位</text>';
    } else if (s.status === 'unlearned') {
      inner = '<text class="rp-node-name" y="-2">' + escapeHtml(name) + '</text>' +
        '<text class="rp-node-req" y="13">未学习</text>';
    } else {
      const g = s.gap > 0 ? '+' + s.gap : String(s.gap);
      inner = '<text class="rp-node-name" y="-7">' + escapeHtml(name) + '</text>' +
        '<text class="rp-node-score" y="9">' + s.currentScore + '%</text>' +
        '<text class="rp-node-req" y="22">岗位要求 ' + s.requiredScore + '</text>' +
        '<text class="rp-node-gap" y="33">' + g + '</text>';
    }

    const delay = isCenter ? 40 : (60 + idx * 45);
    const pathDelay = st.pathOn ? 400 + pathIds.indexOf(id) * 220 : 0;
    const animDelay = st.pathOn && pathIds.indexOf(id) >= 0 ? pathDelay : delay;
    return '<g class="' + classes.join(' ') + '" data-id="' + id + '" transform="translate(' + p.x + ',' + p.y + ')" style="animation-delay:' + animDelay + 'ms">' +
      '<circle class="rp-node-core" r="' + r + '"/>' + inner + '</g>';
  }

  function profileSetFilter(filter) {
    const st = getProfileState();
    st.filter = filter; st.entered = true;
    syncProfileFilterButtons();
    renderProfileGraph();
  }

  function syncProfileFilterButtons() {
    const st = getProfileState();
    qsa('#rp-filters .rp-cat').forEach((b) => b.classList.toggle('is-active', b.dataset.filter === st.filter));
  }

  function profileSelectSkill(id) {
    const st = getProfileState();
    if (id === 'java-be') {
      st.selectedId = null; st.simId = null;
    } else {
      st.filter = 'all';
      st.selectedId = (st.selectedId === id) ? null : id;
      st.simId = st.selectedId;
    }
    st.searchHitId = null; st.entered = true;
    syncProfileFilterButtons();
    renderProfileGraph();
    renderProfileAIPanel();
    renderProfileGapBar();
  }

  /* ---------- 搜索 ---------- */
  function profileSearch(term) {
    const st = getProfileState();
    const model = PROFILE_MODEL;
    const hint = $('rp-search-hint');
    term = (term || '').trim().toLowerCase();
    if (!term) {
      st.searchHitId = null;
      if (hint) hint.hidden = true;
      return;
    }
    const hit = model.skills.find((s) =>
      s.name.toLowerCase().indexOf(term) >= 0 ||
      (s.summary && s.summary.toLowerCase().indexOf(term) >= 0) ||
      JSON.stringify(s.evidence || {}).toLowerCase().indexOf(term) >= 0 ||
      (s.relatedSkills || []).some((r) => { const rs = model.skills.find((x) => x.id === r); return rs && rs.name.toLowerCase().indexOf(term) >= 0; })
    );
    if (hit) {
      st.filter = 'all'; st.selectedId = hit.id; st.simId = hit.id; st.searchHitId = hit.id; st.entered = true;
      syncProfileFilterButtons();
      renderProfileGraph();
      renderProfileAIPanel();
      renderProfileGapBar();
      if (hint) hint.hidden = true;
    } else if (hint) {
      hint.textContent = '未找到与「' + term + '」相关的能力';
      hint.hidden = false;
    }
  }

  /* ---------- 右侧 AI 能力诊断 ---------- */
  function renderProfileAIPanel() {
    const pane = $('rp-ai-pane'); if (!pane) return;
    const st = getProfileState();
    const model = PROFILE_MODEL;
    const sk = st.selectedId ? model.skills.find((s) => s.id === st.selectedId) : null;
    pane.innerHTML = sk ? profileAISkillHTML(model, sk) : profileAIOverallHTML(model);
    pane.style.animation = 'none'; void pane.offsetWidth; pane.style.animation = '';
  }

  function profileStatusMeta(sk) {
    if (sk.status === 'strong') return { label: '已达标', cls: 'ok' };
    if (sk.status === 'weak') return { label: sk.priority === 'high' ? '重点提升' : '建议提升', cls: 'bad' };
    return { label: '未学习', cls: 'none' };
  }

  function profileAIOverallHTML(model) {
    const j = model.job;
    const gaps = model.skills.filter((s) => s.status === 'weak').sort(profileSortFn('impact'));
    const path = model.recommendedPath;
    return `
      <div class="rp-ai-block">
        <div class="rp-ai-kicker">AI 能力诊断 · 整体概览</div>
        <div class="rp-ai-note" style="margin-top:0">当前岗位匹配 <b style="color:var(--ok)">${j.matchScore}%</b>，核心能力扎实；${j.gapCount} 项能力存在缺口，建议按优先级补强 <b style="color:var(--rose)">${gaps.map((g) => escapeHtml(g.name)).join(' / ')}</b>。</div>
      </div>
      <div class="rp-ai-block">
        <div class="rp-ai-kicker">判断依据</div>
        <div class="rp-ev-grid">
          ${j.dataSources.overview.map((d) => `<div class="rp-ev-cell"><div class="v">${escapeHtml(d.value)}</div><div class="l">${escapeHtml(d.label)}</div></div>`).join('')}
        </div>
        <div class="rp-ai-note">证据来自简历 / 项目 / 练习 / 对话 / 测验数据源，点击顶部「数据来源」可查看明细。</div>
      </div>
      <div class="rp-ai-block">
        <div class="rp-ai-kicker">优先提升</div>
        ${gaps.map((g) => `<div class="rp-gap-row" data-id="${g.id}">
          <span class="nm">${escapeHtml(g.name)}</span>
          <span class="bar"><i style="width:${Math.max(4, Math.round(g.currentScore / g.requiredScore * 100))}%"></i></span>
          <span class="gap-v">${g.currentScore}% / ${g.requiredScore}%</span></div>`).join('')}
      </div>
      <div class="rp-ai-block">
        <div class="rp-ai-kicker">推荐学习路径</div>
        ${profilePathStepsHTML(model, path.steps)}
        <div class="rp-lp-total"><span>预计 <b>${path.hours} 小时</b></span><span>匹配度 <b>${path.matchFrom}% → ${path.matchTo}%</b></span></div>
      </div>
      <div class="rp-ai-block">
        <button class="btn-sm btn-sm--solid btn-block" id="rp-path-cta" type="button">生成学习路径 →</button>
      </div>`;
  }

  function profileAISkillHTML(model, sk) {
    const st = getProfileState();
    const j = model.job;
    const meta = profileStatusMeta(sk);
    const isStrong = sk.status === 'strong';
    const ev = sk.evidence || {};
    const simVal = st.simId === sk.id && st.simVal != null ? st.simVal : sk.currentScore;
    const simMatch = profileSimMatch(model, sk, simVal);
    return `
      <div class="rp-ai-block rp-dg">
        <div class="rp-dg-head">
          <span class="rp-dg-name">${escapeHtml(sk.name)}</span>
          <span class="rp-dg-badge ${meta.cls}">${meta.label}</span>
        </div>
        <div class="rp-dg-stats">
          <div class="rp-dg-stat"><b>${sk.currentScore}%</b><span>当前掌握</span></div>
          <div class="rp-dg-stat req"><b>${sk.requiredScore}%</b><span>岗位要求</span></div>
          <div class="rp-dg-stat ${sk.gap < 0 ? 'gap' : 'okg'}"><b>${sk.gap > 0 ? '+' + sk.gap : sk.gap}</b><span>能力差距</span></div>
        </div>
        ${sk.status === 'unlearned' ? '<div class="rp-ai-note">该能力尚未建立有效证据，无法准确评估，建议系统学习并积累练习记录。</div>' : ''}
      </div>
      <div class="rp-ai-block">
        <div class="rp-ai-kicker">能力证据</div>
        <div class="rp-ev-grid">
          <div class="rp-ev-cell"><div class="v">${ev.projectCount || 0} 项</div><div class="l">项目经历</div></div>
          <div class="rp-ev-cell"><div class="v">${ev.exerciseCount || 0} 次</div><div class="l">练习记录</div></div>
          <div class="rp-ev-cell"><div class="v">${ev.knowledgeCount || 0} 个</div><div class="l">知识点</div></div>
          <div class="rp-ev-cell"><div class="v">${ev.accuracy || 0}%</div><div class="l">正确率</div></div>
        </div>
        ${profileMasteredWeakHTML(ev)}
        <button class="rp-link-btn" id="rp-see-evidence" type="button">查看完整能力证据 →</button>
      </div>
      <div class="rp-ai-block" id="rp-sec-impact">
        <div class="rp-ai-kicker">岗位影响</div>
        ${isStrong ? `
        <div class="rp-impact ok-style">
          <div class="rp-impact-row"><span class="k">岗位角色</span><span class="v">${sk.jobImpact.role}</span></div>
          <div class="rp-impact-row"><span class="k">当前状态</span><span class="v okv">已达标</span></div>
          <div class="rp-impact-row"><span class="k">建议</span><span class="v">${sk.jobImpact.suggestion}</span></div>
          <div class="rp-impact-forecast">${escapeHtml(sk.name)} 已超过岗位要求，不会成为匹配瓶颈，继续保持即可。</div>
        </div>` : `
        <div class="rp-impact">
          <div class="rp-impact-row"><span class="k">岗位角色</span><span class="v">${sk.jobImpact.role}</span></div>
          <div class="rp-impact-row"><span class="k">当前缺口</span><span class="v gapv">${sk.gap}</span></div>
          <div class="rp-impact-row"><span class="k">预计匹配影响</span><span class="v gapv">${sk.jobImpact.matchImpact > 0 ? '+' + sk.jobImpact.matchImpact : sk.jobImpact.matchImpact}%</span></div>
          <div class="rp-impact-row"><span class="k">建议</span><span class="v">${sk.jobImpact.suggestion}</span></div>
          <div class="rp-impact-forecast">若 ${escapeHtml(sk.name)} ${sk.currentScore} → ${sk.requiredScore}，预计岗位匹配 <b>${j.matchScore}%</b> → <b>${profileSkillMatchAt(model, sk, sk.requiredScore)}%</b></div>
        </div>`}
      </div>
      ${isStrong ? '' : `
      <div class="rp-ai-block">
        <div class="rp-ai-kicker">能力提升模拟</div>
        <div class="rp-sim">
          <div class="rp-sim-head"><span>拖动调整当前掌握度</span><span>岗位要求 ${sk.requiredScore}</span></div>
          <input type="range" class="rp-sim-range" min="${sk.currentScore}" max="100" value="${simVal}" data-id="${sk.id}"/>
          <div class="rp-sim-match">
            <span class="from">${simVal}%</span>
            <span class="arr">→</span>
            <span class="to">${simMatch}%</span>
            <span class="lbl">岗位匹配</span>
          </div>
          ${simVal >= sk.requiredScore
            ? `<div class="rp-sim-gain">提升 ${escapeHtml(sk.name)} 至岗位要求后，预计可新增 ${sk.jobImpact.newJobs || 0} 个高匹配岗位。</div>`
            : `<div class="rp-sim-hint">将 ${escapeHtml(sk.name)} 提升至岗位要求，预计匹配度可达 ${profileSkillMatchAt(model, sk, sk.requiredScore)}%</div>`}
        </div>
      </div>`}
      <div class="rp-ai-block">
        <div class="rp-ai-kicker">推荐学习路径</div>
        ${sk.learningPath && sk.learningPath.length ? profileSkillPathHTML(model, sk) : '<div class="rp-ai-note">该能力已达标，暂无优先补强路径；可将精力用于核心缺口的提升。</div>'}
      </div>`;
  }

  function profileMasteredWeakHTML(ev) {
    let h = '';
    if (ev.mastered && ev.mastered.length) h += '<div class="rp-mw">' + ev.mastered.map((m) => '<span class="rp-mw-chip ok">✓ ' + escapeHtml(m) + '</span>').join('') + '</div>';
    if (ev.weak && ev.weak.length) h += '<div class="rp-mw">' + ev.weak.map((m) => '<span class="rp-mw-chip bad">⚠ ' + escapeHtml(m) + '</span>').join('') + '</div>';
    return h;
  }

  function profilePathStepsHTML(model, steps) {
    return `<div class="rp-lp">` + steps.map((t, i) => {
      const sk = model.skills.find((s) => s.id === t.skillId);
      return `<div class="rp-lp-step"><span class="idx">${i + 1}</span><span class="nm">${sk ? escapeHtml(sk.name) : ''}</span><span class="target">→ ${t.target}%</span><span class="h">${t.hours}h</span></div>`;
    }).join('') + `</div>`;
  }

  function profileSkillPathHTML(model, sk) {
    const steps = sk.learningPath || [];
    const totalH = steps.reduce((a, b) => a + (b.hours || 0), 0);
    return `<div class="rp-lp">` + steps.map((t, i) =>
      `<div class="rp-lp-step"><span class="idx">${i + 1}</span><span class="nm">${escapeHtml(t.title)}</span><span class="target">→ ${t.target}%</span><span class="h">${t.hours}h</span></div>`).join('') + `</div>
      <div class="rp-lp-total"><span>预计耗时 <b>${totalH} 小时</b></span><span>预计匹配提升 <b>+${sk.jobImpact.potentialImprovement || 0}%</b></span></div>`;
  }

  /* ---------- 能力提升模拟（实时局部更新） ---------- */
  function profileSimMatch(model, sk, val) {
    const j = model.job;
    const cur = sk.currentScore, req = sk.requiredScore, pot = sk.jobImpact.potentialImprovement || 0;
    if (val <= cur) return j.matchScore;
    if (val >= req) return Math.min(99, j.matchScore + pot);
    return Math.round(j.matchScore + pot * (val - cur) / (req - cur));
  }

  function profileSkillMatchAt(model, sk, target) {
    if (target >= sk.requiredScore) return Math.min(99, model.job.matchScore + (sk.jobImpact.potentialImprovement || 0));
    return profileSimMatch(model, sk, target);
  }

  function profileSimulate(id, val) {
    const st = getProfileState();
    const model = PROFILE_MODEL;
    const sk = model.skills.find((s) => s.id === id);
    st.simId = id; st.simVal = val;
    if (!sk) return;
    const match = profileSimMatch(model, sk, val);
    const sim = qs('.rp-sim', $('rp-ai-pane'));
    if (!sim) return;
    const from = sim.querySelector('.rp-sim-match .from');
    const to = sim.querySelector('.rp-sim-match .to');
    if (from) from.textContent = val + '%';
    if (to) { to.textContent = match + '%'; to.classList.toggle('hot', match > model.job.matchScore); }
    const old = sim.querySelector('.rp-sim-gain, .rp-sim-hint');
    if (old) old.remove();
    const extra = document.createElement('div');
    if (val >= sk.requiredScore) {
      extra.className = 'rp-sim-gain';
      extra.textContent = `提升 ${sk.name} 至岗位要求后，预计可新增 ${sk.jobImpact.newJobs || 0} 个高匹配岗位。`;
    } else {
      extra.className = 'rp-sim-hint';
      extra.textContent = `将 ${sk.name} 提升至岗位要求，预计匹配度可达 ${profileSkillMatchAt(model, sk, sk.requiredScore)}%`;
    }
    sim.appendChild(extra);
  }

  /* ---------- 岗位影响聚焦 ---------- */
  function profileScrollToImpact() {
    const st = getProfileState();
    if (!st.selectedId) {
      const g = PROFILE_MODEL.skills.find((s) => s.status === 'weak');
      if (g) profileSelectSkill(g.id);
    }
    const pane = $('rp-ai-pane'); const sec = $('rp-sec-impact');
    if (!pane || !sec) return;
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    sec.classList.add('is-flash');
    setTimeout(() => sec.classList.remove('is-flash'), 1200);
  }

  /* ---------- 能力证据 Drawer ---------- */
  function profileOpenEvidence() {
    const model = PROFILE_MODEL;
    const st = getProfileState();
    const sk = st.selectedId ? model.skills.find((s) => s.id === st.selectedId) : null;
    const target = sk || model.skills.find((s) => s.id === 'jvm');
    const drawer = $('rp-ev-drawer'); const body = $('rp-ev-body'); const title = $('rp-ev-title');
    if (!drawer || !body || !target) return;
    if (title) title.textContent = (sk ? '' : '重点能力 · ') + target.name + ' · 能力证据';
    body.innerHTML = profileEvidenceHTML(target);
    drawer.hidden = false;
  }

  function profileCloseEvidence() {
    const drawer = $('rp-ev-drawer'); if (drawer) drawer.hidden = true;
  }

  function profileEvidenceHTML(sk) {
    const ev = sk.evidence || {};
    const card = (it) => `<div class="rp-ev-card">${escapeHtml(it.title)}${it.desc ? '<div class="ev-desc">' + escapeHtml(it.desc) + '</div>' : ''}${it.skills && it.skills.length ? '<div class="ev-tags">' + it.skills.map((t) => '<span class="rp-ev-tag">' + escapeHtml(t) + '</span>').join('') + '</div>' : ''}${it.accuracy != null ? '<div class="ev-meta">正确率 ' + it.accuracy + '%</div>' : ''}${it.time ? '<div class="ev-meta">' + escapeHtml(it.time) + '</div>' : ''}</div>`;
    const sec = (label, items) => items && items.length ? `<div class="rp-ev-sec"><h4>${label}</h4>${items.map(card).join('')}</div>` : '';
    let h = sec('项目证据', ev.project) + sec('学习证据', ev.learn) + sec('练习证据', ev.practice) + sec('对话证据', ev.dialogue);
    if (ev.mastered && ev.mastered.length) h += `<div class="rp-ev-sec"><h4>已掌握</h4><div class="rp-mw">${ev.mastered.map((m) => '<span class="rp-mw-chip ok">✓ ' + escapeHtml(m) + '</span>').join('')}</div></div>`;
    if (ev.weak && ev.weak.length) h += `<div class="rp-ev-sec"><h4>薄弱点</h4><div class="rp-mw">${ev.weak.map((m) => '<span class="rp-mw-chip bad">⚠ ' + escapeHtml(m) + '</span>').join('')}</div></div>`;
    return h || '<div class="rp-ai-note">暂无该能力的直接证据，建议先完成学习与练习后重新评估。</div>';
  }

  /* ---------- 底部缺口栏 ---------- */
  function renderProfileGapBar() {
    const el = $('rp-gaps'); if (!el) return;
    const model = PROFILE_MODEL;
    const hi = model.skills.filter((s) => s.status === 'weak' && s.priority === 'high').sort(profileSortFn('gap'));
    const mid = model.skills.filter((s) => s.status === 'weak' && s.priority !== 'high').sort(profileSortFn('gap'));
    const ok = model.skills.filter((s) => s.status === 'strong').sort((a, b) => b.gap - a.gap);
    const chip = (s, cls) => `<button class="rp-gap-chip ${cls}" data-id="${s.id}" type="button">${escapeHtml(s.name)} <b>${s.gap > 0 ? '+' + s.gap : s.gap}</b></button>`;
    const group = (label, arr, cls) => arr.length ? `<div class="rp-gap-group"><span class="rp-gap-group-label">${label}</span>${arr.map((s) => chip(s, cls)).join('')}</div>` : '';
    el.innerHTML = group('高优先级', hi, 'hi') + group('中优先级', mid, '') + group('已达标', ok, 'ok');
  }

  /* ---------- 生成学习路径：路径节点逐个点亮 → 进入学习视图 ---------- */
  function profileGeneratePath() {
    const st = getProfileState();
    const model = PROFILE_MODEL;
    st.filter = 'all'; st.selectedId = null; st.simId = null;
    st.pathOn = true; st.entered = true;
    syncProfileFilterButtons();
    renderProfileGraph();
    renderProfileAIPanel();
    const btn = $('rp-path-btn');
    if (btn) { btn.disabled = true; btn.textContent = '已生成学习路径，正在进入学习…'; }
    const path = model.recommendedPath;
    setTimeout(() => {
      closeLearningProfile();
      setView('learn');
      if (typeof showToast === 'function') showToast('学习路径已生成：预计 ' + path.hours + ' 小时，匹配度 ' + path.matchFrom + '% → ' + path.matchTo + '%', 'teal');
    }, 1500);
  }

  /* ---------- 浮层（数据来源 / 更新时间 / 时间范围） ---------- */
  function profileClosePops() {
    ['rp-source-pop', 'rp-updated-pop', 'rp-time-pop'].forEach((id) => { const p = $(id); if (p) p.hidden = true; });
  }

  function profileSourcePopHTML() {
    const cats = PROFILE_MODEL.job.dataSources.categories;
    return `<div class="rp-pop-title">AI 判断数据来源</div>` + cats.map((c) => `<div class="rp-pop-item"><span>${c.name}</span><small>${escapeHtml(c.desc)}</small></div>`).join('');
  }

  function profileUpdatedPopHTML() {
    const ups = PROFILE_MODEL.job.dataSources.updates;
    return `<div class="rp-pop-title">最近更新</div>` + ups.map((u) => `<div class="rp-pop-item"><span>${u.label}</span><b>${u.time}</b></div>`).join('');
  }

  function renderWhatIf() {
    const res = currentResult();
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
      { id: 'basic', label: '个人信息', content: '标杆样例候选人\n高级 Java 后端开发工程师\n联系方式：未提供 · 现居城市：未提供' },
      { id: 'education', label: '教育经历', content: '教育经历（脱敏样例） · 计算机科学与技术 · 本科（GPA 3.7/4.0）\n2019.09 - 2023.06\n主修：数据结构、操作系统、数据库、计算机网络；连续三年一等奖学金' },
      { id: 'projects', label: '项目经历', content: '1. 亿级流量交易中台（Java/Spring Boot/Docker/Kubernetes）：主导核心链路开发，完成微服务拆分与容器化上线，支撑日均千万级调用。\n2. Redis 缓存架构改造：设计多级缓存与热点探测，QPS 提升 5 倍，接口 P99 延迟下降 60%。\n3. 分布式任务调度系统：基于分布式锁与消息队列实现海量任务调度，并发处理 10w+ 任务/分钟，月度 0 事故。' },
      { id: 'work', label: '工作经历', content: '互联网业务团队（脱敏样例） · Java 后端开发工程师\n2023.07 - 至今\n主导 Docker 容器化与 Kubernetes 编排落地，推动 CI/CD 流水线建设；负责高并发接口性能优化，推动多项 SRE 指标达标。' },
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
    const res = currentResult();
    const c = res ? res.competitiveness : null; if (!c) return;
    const grid = $('compare-grid'); if (!grid) return;
    // Phase 06：真实后端返回 competitiveness/dimension_scores/strengths/weaknesses/
    // skill_comparison/improvement_suggestions —— 直接渲染真实数据，不伪造 good_case/my_case
    if (!c.good_case || !c.my_case) {
      const dims = Object.entries(c.dimension_scores || {}).map(([k, v]) => {
        const label = { skill_coverage: '技能覆盖', experience_match: '经验匹配', summary_quality: '简历质量', education_match: '学历匹配' }[k] || k;
        return `<div class="compare-row"><span>${label}</span><b>${escapeHtml(String(v))}</b></div>`;
      }).join('');
      const skillRows = (c.skill_comparison || []).slice(0, 8).map((s) => {
        const ok = s.gap === 'matched';
        return `<div class="compare-row"><span>${escapeHtml(s.skill)}</span><span><span class="${ok ? 'good' : 'bad'}">${ok ? '✓ 已掌握' : '✗ ' + escapeHtml(s.user_level || '未掌握')}</span></span></div>`;
      }).join('');
      grid.innerHTML = `<div class="compare-card">
        <div class="compare-card-title">竞争力对比（真实数据）</div>
        <div class="compare-row"><span>综合竞争力</span><b class="gold">${c.competitiveness != null ? escapeHtml(String(c.competitiveness)) + ' 分' : '--'}</b></div>
        ${dims}
        ${(c.strengths || []).slice(0, 4).map((s) => `<div class="compare-row"><span>优势</span><span class="good">${escapeHtml(s)}</span></div>`).join('')}
        ${(c.weaknesses || []).slice(0, 4).map((s) => `<div class="compare-row"><span>不足</span><span class="bad">${escapeHtml(s)}</span></div>`).join('')}
        ${skillRows ? '<div class="detail-section-title mt">技能对比</div>' + skillRows : ''}
      </div>`;
      renderAIPanelCompare();
      return;
    }
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
    const p = currentResult() ? currentResult().profile : null;
    if (!p) { renderAIPanelDefault(); return; }
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
    const impact = computeCondImpact(st);
    const core = Object.keys(st.skillMeta || {}).filter((k) => st.skillMeta[k].level === 'core');
    aip.innerHTML = `<div class="aip-block"><div class="aip-kicker">MATCH CONTEXT</div>
      <div class="aip-h">岗位匹配条件</div>
      <div class="aip-p">方向：<b>${escapeHtml(st.direction || '未设置')}</b><br>城市：${st.cities.join('、') || '全国'}<br>薪资：${st.salaryMin == null ? '面议' : st.salaryMin + '-' + st.salaryMax + 'K'}<br>性质：${(st.jobTypes || []).map((t) => labelOf(JOBTYPES, t)).filter(Boolean).join(' / ') || '不限'}</div>
      <div class="aip-kicker mt">岗位覆盖</div>
      <div class="aip-metric-row"><span>可匹配岗位</span><span class="bar"><i style="width:${Math.round(impact.pool / 8.46)}%"></i></span><span class="v">${impact.pool}</span></div>
      <div class="aip-metric-row"><span>高匹配</span><span class="bar"><i style="width:${Math.round((impact.high / Math.max(1, impact.pool)) * 100)}%"></i></span><span class="v">${impact.high}</span></div>
      <div class="aip-kicker mt">核心技能</div>${core.map((s) => `<span class="chip" style="margin:0 4px 4px 0">${escapeHtml(s)}</span>`).join('')}
      <div class="aip-p mt">修改条件时，覆盖范围与匹配度将实时更新。就绪后点击「运行 AI 人岗匹配」。</div></div>`;
  }
  function renderAIPanelAnalysis() {
    const aip = $('aip-body'); if (!aip) return;
    // Phase 06：使用真实结果计数，禁止从 MOCK_RESULT 读业务数据
    const res = window.matchState.result;
    const skillCount = (res && res.profile && res.profile.skills ? res.profile.skills.length : 0);
    const relCount = (res && res.gap_graph && res.gap_graph.edges ? res.gap_graph.edges.length : 0);
    aip.innerHTML = `<div class="aip-block"><div class="aip-kicker">ANALYSIS COMPLETE</div>
      <div class="aip-h">能力图谱已构建</div>
      <div class="aip-p">共识别 <b>${skillCount || '--'}</b> 项技能${relCount ? '，建立与岗位的 <b>' + relCount + '</b> 条能力关系' : ''}。点击左侧能力线或岗位节点查看证据。</div>
      <span class="aip-link" id="aip-tojobs">→ 查看岗位推荐</span></div>`;
    const t = $('aip-tojobs'); if (t) t.addEventListener('click', () => setView('jobs'));
  }
  function renderAIPanelJobs(m) {
    const aip = $('aip-body'); if (!aip) return;
    if (!m) { aip.innerHTML = `<div class="aip-empty">选择左侧岗位查看 AI 解释。</div>`; return; }
    // Phase 06：真实数据 m.matched/m.missing/m.evidence；历史 Mock 兼容 m.evidences
    const asPairs = (arr) => (arr || []).map((t) => (typeof t === 'string' ? { t: t, d: '' } : t));
    const matched = asPairs(m.matched && m.matched.length ? m.matched : (m.evidences || {}).matched);
    const missing = asPairs(m.missing && m.missing.length ? m.missing : (m.evidences || {}).missing);
    const evSnippets = (m.evidence || []).map((e) => e.snippet).filter(Boolean).slice(0, 2);
    const reasons = (m.match_reasons || []).filter(Boolean).slice(0, 1);
    aip.innerHTML = `<div class="aip-block"><div class="aip-kicker">JOB INSIGHT</div>
      <div class="aip-h">${escapeHtml(m.job.title)} · ${m.score}%</div>
      <div class="aip-p">${escapeHtml(m.job.company)} · ${escapeHtml(m.job.city)}</div>
      ${reasons.length ? `<div class="aip-kicker mt">推荐理由</div><div class="aip-p">${escapeHtml(reasons[0])}</div>` : ''}
      <div class="aip-kicker mt">匹配证据</div>
      ${matched.map((e) => `<div class="aip-evi"><b>${escapeHtml(e.t || '')}</b>${e.d ? '<br>' + escapeHtml(e.d) : ''}</div>`).join('') || '<div class="aip-p">暂无匹配证据</div>'}
      <div class="aip-kicker mt">能力缺口</div>
      ${missing.map((e) => `<div class="aip-evi" style="background:var(--rose-wash)"><b>${escapeHtml(e.t || '')}</b>${e.d ? '<br>' + escapeHtml(e.d) : ''}</div>`).join('') || '<div class="aip-p">暂无能力缺口</div>'}
      ${evSnippets.length ? `<div class="aip-kicker mt">Evidence</div>${evSnippets.map((s) => `<div class="aip-evi">"${escapeHtml(s)}"</div>`).join('')}` : ''}
      <span class="aip-link" id="aip-todetail">→ 进入岗位详情</span></div>`;
    const t = $('aip-todetail'); if (t) t.addEventListener('click', () => { window.matchState.selectedJobId = m.job.id; setView('detail'); });
  }
  function renderAIPanelDetail(m) {
    const aip = $('aip-body'); if (!aip || !m) return;
    aip.innerHTML = `<div class="aip-block"><div class="aip-kicker">AI DIAGNOSIS</div>
      <div class="aip-h">${escapeHtml(m.job.title)}</div>
      <div class="aip-p">综合匹配度 <b>${m.score}%</b>。右侧「能力差距分析」中点击任意能力条，可查看缺口详情与提升路径。</div>
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
      submitInterviewAnswer().then((submitted) => {
        if (!submitted) return;
        if (st.index + 1 >= st.questions.length) { closeInterview(); return; }
        askQuestion(st.index + 1);
      });
    });
    const mic = $('btn-mic'), cam = $('btn-cam'), spk = $('btn-speaker');
    if (mic) mic.addEventListener('click', () => toggleCtrl(mic));
    if (cam) cam.addEventListener('click', () => toggleCtrl(cam));
    if (spk) spk.addEventListener('click', () => toggleCtrl(spk));
    // 查看回答建议 → 打开 AI 面试助手抽屉
    const hint = $('int-hint');
    if (hint) hint.addEventListener('click', () => toggleIntDrawer(true));
    const tog = $('int-assistant-toggle');
    if (tog) tog.addEventListener('click', () => toggleIntDrawer());
    const dc = $('int-drawer-close');
    if (dc) dc.addEventListener('click', () => toggleIntDrawer(false));
    const answer = $('int-answer');
    if (answer) answer.addEventListener('input', () => {
      const count = $('int-answer-count'); if (count) count.textContent = String(answer.value.length);
      const state = $('int-answer-state'); if (state) state.textContent = '未提交';
    });
  }
  function toggleCtrl(btn) {
    const on = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', on ? 'false' : 'true');
  }
  function toggleIntDrawer(forceOpen) {
    const d = $('int-drawer'); if (!d) return;
    const willOpen = typeof forceOpen === 'boolean' ? forceOpen : d.hidden;
    d.hidden = !willOpen;
  }

  const INTERVIEW_Q = [
    { topic: 'Java 基础', q: '请介绍一下你在简历中提到的项目，并说明你在其中的技术角色。', base: 'strong',
      keywords: ['JVM', '集合', '内存模型'], detect: ['技术表达', '基础扎实'], metric: { tech: 82, expr: 74, proj: 86 }, score: 81,
      good: ['技术基础扎实，项目表述清晰'], bad: ['缺少量化指标'], advise: '用「背景-行动-结果」结构，补充 1-2 个量化数据。' },
    { topic: '项目介绍', q: '你提到用 Spring Boot 搭建了营销平台，能讲讲你如何处理高并发场景吗？', base: 'mid',
      keywords: ['Spring Boot', '高并发', 'Redis'], detect: ['项目真实性', '技术表达'], metric: { tech: 78, expr: 70, proj: 85 }, score: 76,
      good: ['有真实项目作为支撑'], bad: ['高并发方案不完整'], advise: '补充限流、缓存、异步的完整链路设计。' },
    { topic: 'Redis', q: '为什么在项目中引入 Redis？如果缓存与数据库不一致，你会怎么处理？', base: 'weak',
      keywords: ['Redis', '缓存一致性', '持久化'], detect: ['架构理解', '技术表达'], metric: { tech: 72, expr: 66, proj: 80 }, score: 74,
      good: ['理解缓存基本使用'], bad: ['缓存一致性方案不足'], advise: '掌握 Cache-Aside 模式与延迟双删等一致性方案。' },
    { topic: '系统设计', q: '如果要设计一个日均千万级的订单系统，你会怎么做分库分表？', base: 'mid',
      keywords: ['订单系统', '分库分表', '缓存'], detect: ['架构理解', '扩展能力'], metric: { tech: 70, expr: 68, proj: 82 }, score: 73,
      good: ['有系统设计的基本思路'], bad: ['缺少高并发经验'], advise: '系统学习分库分表、容量评估与高可用架构。' },
    { topic: '微服务', q: '你如何理解服务拆分？能否举例说明一个不适合拆分的场景？', base: 'weak',
      keywords: ['服务拆分', '注册中心', '配置中心'], detect: ['架构理解', '系统设计'], metric: { tech: 66, expr: 64, proj: 78 }, score: 72,
      good: ['了解微服务核心概念'], bad: ['缺少拆分落地经验'], advise: '用 Spring Cloud 落地一个微服务 demo 并补充拆分原则。' },
    { topic: 'Docker', q: '你的项目是否做过容器化部署？如果让你写 Dockerfile 你会注意什么？', base: 'weak',
      keywords: ['Dockerfile', '镜像', '容器编排'], detect: ['工程实践', '技术表达'], metric: { tech: 62, expr: 66, proj: 75 }, score: 71,
      good: ['具备基础容器概念'], bad: ['无部署实践'], advise: '为现有项目编写 Dockerfile 并完成本地容器化部署。' },
    { topic: 'MySQL', q: '讲讲你对索引最左前缀原则的理解，以及一次你做过的慢查询优化。', base: 'mid',
      keywords: ['索引', '执行计划', '事务'], detect: ['技术表达', '数据库'], metric: { tech: 80, expr: 72, proj: 84 }, score: 79,
      good: ['有慢查询优化实践经验'], bad: ['事务隔离细节不深'], advise: '深化事务隔离级别与 MVCC，补齐分库分表知识。' },
    { topic: '综合能力', q: '回顾这次面试，你认为自己最需要在哪方面补强？', base: 'mid',
      keywords: ['成长规划', '学习路径', '复盘'], detect: ['表达能力', '岗位匹配'], metric: { tech: 75, expr: 78, proj: 80 }, score: 78,
      good: ['职业规划清晰，复盘意识好'], bad: ['补强优先级不明确'], advise: '按「岗位缺口 → 学习路径 → 项目验证」闭环推进。' }
  ];

  /* ---- 面试进度步骤条 ---- */
  function renderIntSteps() {
    const box = $('int-steps'); if (!box) return;
    const questions = (window.matchState.interview || {}).questions || [];
    box.innerHTML = questions.map((it, i) => `<span class="md-int-step" data-step="${i}">${i + 1}</span>`).join('');
  }
  function setIntStep(idx) {
    const box = $('int-steps'); if (!box) return;
    qsa('.md-int-step', box).forEach((s) => {
      const i = parseInt(s.dataset.step, 10);
      s.className = 'md-int-step' + (i < idx ? ' is-done' : (i === idx ? ' is-active' : ''));
    });
  }

  /* ---- 当前能力评估（左栏 AI 面试官） ---- */
  function renderIntMetrics(metric) {
    const box = $('int-ai-metrics'); if (!box) return;
    qsa('.md-int-metric', box).forEach((m) => {
      const k = m.dataset.k;
      const v = metric ? metric[k] : 0;
      const bar = m.querySelector('.bar i');
      const num = m.querySelector('b');
      if (bar) bar.style.width = v + '%';
      if (num) animateNumber(num, v, 700, '%');
    });
  }

  /* ---- 实时分析层（关键词 / 检测能力 / 评分） ---- */
  function renderIntAnalysis(item) {
    const kw = $('int-keywords'); if (kw) kw.innerHTML = (item.keywords || []).map((k) => `<span>${escapeHtml(k)}</span>`).join('');
    const det = $('int-detect'); if (det) det.innerHTML = (item.detect || []).map((d) => `<span>✓ ${escapeHtml(d)}</span>`).join('');
    const score = item.evaluation ? item.evaluation.score : 0;
    const sc = $('int-analysis-score'); if (sc) animateNumber(sc, score, 500);
    const gauge = $('int-analysis-gauge'); if (gauge) requestAnimationFrame(() => requestAnimationFrame(() => { gauge.style.width = score + '%'; }));
  }

  /* ---- AI 面试助手抽屉内容 ---- */
  function renderIntDrawerContent(item) {
    const body = $('int-drawer-body'); if (!body) return;
    body.innerHTML = `
      <div class="md-int-drawer-sec">
        <div class="md-int-drawer-sec-label ok">优势</div>
        ${(item.evaluation && item.evaluation.strengths || []).map((g) => `<div class="md-int-drawer-li"><i class="ai-ok">✓</i>${escapeHtml(g)}</div>`).join('') || '<div class="md-int-drawer-li">提交回答后生成</div>'}
      </div>
      <div class="md-int-drawer-sec">
        <div class="md-int-drawer-sec-label warn">不足</div>
        ${(item.evaluation && item.evaluation.gaps || []).map((g) => `<div class="md-int-drawer-li"><i class="ai-warn">⚠</i>${escapeHtml(g)}</div>`).join('') || '<div class="md-int-drawer-li">暂无评估</div>'}
      </div>
      <div class="md-int-drawer-sec">
        <div class="md-int-drawer-sec-label">建议</div>
        <div class="md-int-drawer-li"><i class="ai-gold">↗</i>${escapeHtml(item.evaluation && item.evaluation.next_action || '提交回答后生成建议')}</div>
      </div>
      <div class="md-int-drawer-hint">分数来自规则评估；AI 仅生成文字点评。</div>`;
  }

  /* ---- 模拟 AI 实时分析：评分滚动 / 字幕 / 状态流转 ---- */
  function startIntAnalysis(item) {
    stopIntAnalysis();
    const score = item.evaluation ? item.evaluation.score : 0;
    const liveEl = $('int-live-score'); if (liveEl) liveEl.textContent = String(score);
    const stateEl = $('int-live-state'); if (stateEl) stateEl.innerHTML = item.evaluation ? '<i></i>已评估' : '<i></i>等待回答';
    const capEl = $('int-live-caption'); if (capEl) capEl.textContent = item.evaluation ? (item.evaluation.feedback || '已生成回答点评') : '请在下方输入回答，提交后生成评估';
  }
  function stopIntAnalysis() {
    const st = window.matchState.interview;
    if (st && st._intTimer) { clearInterval(st._intTimer); st._intTimer = null; }
  }

  function openInterview() {
    const m = getSelectedJob();
    const jobLabel = $('int-job-text'); if (jobLabel) jobLabel.textContent = m ? (m.job.title + ' · 模拟面试') : '模拟面试';
    const inter = $('md-interview'); if (inter) inter.hidden = false;
    window.matchState.interview = { index: 0, answers: [], questions: buildInterviewQuestions(m), _liveScore: 0, _intTimer: null };
    renderIntSteps();
    toggleIntDrawer(false);
    startCamera();
    askQuestion(0);
    setView('interview');
  }
  function closeInterview() {
    const inter = $('md-interview'); if (inter) inter.hidden = true;
    stopCamera();
    stopIntAnalysis();
    showReport();
  }
  function askQuestion(idx) {
    const st = window.matchState.interview;
    const item = st.questions[idx];
    if (!item) { closeInterview(); return; }
    st.index = idx;
    const prog = $('int-progress'); if (prog) prog.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(st.questions.length).padStart(2, '0');
    const label = $('int-q-label'); if (label) label.textContent = 'AI 正在提问 · 第 ' + (idx + 1) + ' 题';
    const qt = $('int-question-text'); if (qt) qt.textContent = item.q;
    st.questions[idx] = item;
    setIntStep(idx);
    const answer = st.answers[idx];
    const input = $('int-answer'); if (input) { input.value = answer ? answer.text : ''; input.dispatchEvent(new Event('input')); }
    renderIntMetrics(answer && answer.evaluation ? { tech: answer.evaluation.metrics.technical, expr: answer.evaluation.metrics.structure, proj: answer.evaluation.metrics.evidence } : null);
    renderIntAnalysis(item);
    renderIntDrawerContent(item);
    startIntAnalysis(item);
    // 最后一题按钮文案切换为"查看报告"
    const next = $('int-next'); if (next) next.textContent = (idx + 1 >= st.questions.length) ? '查看报告 →' : '提交并下一题 →';
    // 模拟 AI 语音波
    setTimeout(() => { const w = $('int-ai-wave'); if (w) w.style.opacity = '1'; }, 300);
  }

  function buildInterviewQuestions(match) {
    const job = match && match.job || {};
    const skills = (job.required_skills || job.requiredSkills || []).slice(0, 6);
    const gaps = ((match && match.gaps) || []).map((g) => g.skill).filter(Boolean).slice(0, 3);
    const focus = skills.length ? skills : ['项目实践', '问题分析'];
    const questions = [
      { topic: '项目经历', q: '请介绍一个与你目标岗位最相关的项目，并说明你的技术角色和结果。', keywords: ['项目', '负责', '结果'] },
      ...focus.slice(0, 4).map((skill) => ({ topic: skill, q: `请结合项目说明你如何使用或理解 ${skill}，遇到过什么问题？`, keywords: [skill, '项目', '问题'] })),
      { topic: '岗位差距', q: gaps.length ? `针对 ${gaps.join('、')} 等岗位要求，你准备如何补齐？` : '回顾这次面试，你认为自己最需要在哪方面补强？', keywords: [...gaps, '计划', '实践'] }
    ];
    return questions.slice(0, 8);
  }

  function evaluateInterviewAnswerLocal(answer, keywords) {
    const text = String(answer || '').trim();
    const compact = text.replace(/\s/g, '');
    const completeness = compact ? Math.min(100, Math.round(compact.length / 180 * 100)) : 0;
    const matched = (keywords || []).filter((k) => k && text.toLowerCase().includes(String(k).toLowerCase()));
    const technical = Math.round(matched.length / Math.max(1, (keywords || []).length) * 100);
    const evidence = Math.min(100, ['项目','负责','实现','优化','提升','%','结果'].filter((x) => text.includes(x)).length * 14);
    const structure = Math.min(100, ['背景','目标','行动','结果','STAR'].filter((x) => text.toLowerCase().includes(x.toLowerCase())).length * 20);
    return { score: Math.round(completeness * .3 + technical * .3 + evidence * .25 + structure * .15), metrics: { completeness, technical, evidence, structure }, matched_keywords: matched, strengths: [], gaps: [] };
  }

  async function submitInterviewAnswer() {
    const st = window.matchState.interview; if (!st) return null;
    const item = st.questions[st.index]; const input = $('int-answer'); const text = input ? input.value.trim() : '';
    if (!text) { if (window.showToast) window.showToast('请先输入回答，再继续', 'amber'); if (input) input.focus(); return null; }
    const local = evaluateInterviewAnswerLocal(text, item.keywords);
    const answer = { text, evaluation: local };
    st.answers[st.index] = answer;
    const state = $('int-answer-state'); if (state) state.textContent = '已提交 · 规则评估';
    renderIntMetrics({ tech: local.metrics.technical, expr: local.metrics.structure, proj: local.metrics.evidence });
    try {
      const api = window.API_BASE || ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') ? 'http://127.0.0.1:5000' : location.origin);
      const m = getSelectedJob();
      const r = await fetch(api + '/api/match/interview/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: item.q, answer: text, keywords: item.keywords, job_title: m && m.job && m.job.title || '', resume_context: (currentResult() || {}).profile && JSON.stringify((currentResult() || {}).profile) || '' }) });
      const payload = await r.json(); const remote = payload && payload.data;
      if (remote) answer.evaluation = Object.assign(local, remote);
    } catch (_) { /* 规则评估已完成，网络失败不阻断面试 */ }
    item.evaluation = answer.evaluation;
    renderIntAnalysis(item); renderIntDrawerContent(item);
    const live = $('int-live-score'); if (live) animateNumber(live, answer.evaluation.score, 450);
    return answer;
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
   * AI 面试分析报告 · 职业能力分析 Dashboard
   * ============================================================ */
  const REPORT_SKILLS = [
    { idx: 1, name: 'Java 基础', score: 86, status: '优秀', cls: 'ok',
      ev: '基础扎实，能够理解 JVM 内存模型与集合原理，并发工具使用熟练。', detail: '证据：JVM 内存模型 / 集合框架 / 并发工具类回答准确率 94%' },
    { idx: 2, name: 'Spring 生态', score: 82, status: '优秀', cls: 'ok',
      ev: '熟悉 Spring Boot 自动装配原理，能讲清 Bean 生命周期与 AOP 应用。', detail: '证据：自动装配 / Bean 生命周期 / 事务与安全章节完成' },
    { idx: 3, name: '数据库', score: 79, status: '良好', cls: 'good',
      ev: '掌握索引优化与事务隔离级别，有慢查询优化实践，分库分表待深化。', detail: '证据：慢查询优化专项 / 索引与执行计划章节完成' },
    { idx: 4, name: '系统设计', score: 73, status: '需要提升', cls: 'warn',
      ev: '能够完成基本系统设计，缺少高并发与大规模数据场景的落地经验。', detail: '建议：学习高并发架构模式 / 分库分表 / 容量评估' },
    { idx: 5, name: '工程实践', score: 68, status: '需要提升', cls: 'warn',
      ev: '容器化与 CI/CD 实践不足，Docker 停留在概念阶段，微服务无落地。', detail: '建议：为项目编写 Dockerfile / 用 Spring Cloud 落地微服务' },
    { idx: 6, name: '沟通表达', score: 74, status: '良好', cls: 'good',
      ev: '回答条理清晰、结论先行；可补充更多量化数据与结构化输出。', detail: '建议：用 STAR 法则组织项目描述，结尾准备高质量反问' }
  ];
  const REPORT_RADAR = { dims: ['Java 基础', 'Spring 生态', '数据库', '系统设计', '工程实践', '沟通表达'], vals: [86, 82, 79, 73, 68, 74] };
  const REPORT_INSIGHT = {
    strong: ['Spring Boot', 'Redis', '项目实践'],
    risk: ['系统设计', '分布式经验'],
    learn: ['Spring Cloud', 'Docker', 'Kafka'],
    from: 78, to: 90
  };
  const REPORT_CAREER = {
    current: 'Java 后端工程师',
    next: '高级 Java 工程师',
    need: ['微服务', '架构设计', '云原生']
  };
  let reportRadarChart = null;

  function bindReport() {
    const back = $('report-back'); if (back) back.addEventListener('click', () => { const r = $('md-report'); if (r) r.hidden = true; setView('jobs'); });
    const restart = $('report-restart'); if (restart) restart.addEventListener('click', () => { const r = $('md-report'); if (r) r.hidden = true; openInterview(); });
    const pathBtn = $('report-path-btn');
    if (pathBtn) pathBtn.addEventListener('click', () => { const r = $('md-report'); if (r) r.hidden = true; openLearningProfile(); });
  }

  function showReport() {
    const st = window.matchState.interview || {};
    const answers = (st.answers || []).filter(Boolean);
    const scores = answers.map((a) => Number(a.evaluation && a.evaluation.score) || 0);
    const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const match = Math.round((((getSelectedJob() || {}).score) || 0));
    const summary = answers.length ? `已完成 ${answers.length} 题，综合得分基于回答完整度、关键词覆盖、项目证据和结构化表达。` : '尚未提交有效回答，暂无面试评估结果。';
    // 先显示报告容器，再渲染图表（确保 echarts 读取到正确的容器尺寸）
    const r = $('md-report'); if (r) r.hidden = false;
    const sc = $('report-score'); if (sc) animateNumber(sc, score, 1100);
    const mt = $('report-match'); if (mt) animateNumber(mt, match, 1100, '%');
    const lvl = $('report-level'); if (lvl) lvl.textContent = ((getSelectedJob() || {}).job || {}).title || '目标岗位';
    const tag = $('report-score-tag'); if (tag) tag.textContent = answers.length ? '规则评估 · 基于已提交回答' : '暂无数据';
    const sum = $('report-summary'); if (sum) sum.textContent = summary;
    renderReportRadar(answers);
    renderReportSkills(answers);
    renderReportInsights(answers);
    renderReportCareer();
  }

  function renderReportRadar(answers) {
    const cont = $('report-radar'); if (!cont) return;
    if (reportRadarChart) { reportRadarChart.dispose(); reportRadarChart = null; }
    if (typeof echarts === 'undefined') return;
    try {
      const chart = echarts.init(cont);
      reportRadarChart = chart;
      chart.setOption({
        radar: {
          indicator: ['完整度', '技术关键词', '项目证据', '结构表达'].map((d) => ({ name: d, max: 100 })),
          radius: '66%', center: ['50%', '52%'], splitNumber: 4,
          axisName: { color: 'rgba(169,189,203,.85)', fontSize: 11 },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,.10)' } },
          splitArea: { show: false },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,.16)' } }
        },
        series: [{
          type: 'radar', symbolSize: 4,
          data: [{
            value: [0, 1, 2, 3].map((i) => answers.length ? Math.round(answers.reduce((sum, a) => sum + Number(a.evaluation && a.evaluation.metrics && Object.values(a.evaluation.metrics)[i] || 0), 0) / answers.length) : 0), name: '当前能力',
            lineStyle: { color: '#1FC8D9', width: 2 },
            itemStyle: { color: '#1FC8D9' },
            areaStyle: { color: 'rgba(31,200,217,.22)' }
          }]
        }],
        tooltip: { trigger: 'item' }, animationDuration: 1200
      });
    } catch (e) { /* 雷达失败不影响报告展示 */ }
  }

  function renderReportSkills(answers) {
    const box = $('report-skills'); if (!box) return;
    const rows = answers.length ? answers.map((a, i) => ({ idx: i + 1, name: (window.matchState.interview.questions[i] || {}).topic || `问题 ${i + 1}`, score: Number(a.evaluation && a.evaluation.score) || 0, status: Number(a.evaluation && a.evaluation.score) >= 70 ? '达标' : '需提升', cls: Number(a.evaluation && a.evaluation.score) >= 70 ? 'ok' : 'warn', ev: a.evaluation && a.evaluation.feedback || '规则评估已完成', detail: a.evaluation && a.evaluation.next_action || '' })) : [];
    box.innerHTML = rows.map((s) => `
      <div class="rpt-skill is-${s.cls}" data-idx="${s.idx}">
        <div class="rpt-skill-top">
          <span class="rpt-skill-idx">${String(s.idx).padStart(2, '0')}</span>
          <b class="rpt-skill-name">${escapeHtml(s.name)}</b>
          <span class="rpt-skill-status is-${s.cls}">${s.status}</span>
        </div>
        <div class="rpt-skill-score"><b data-w="${s.score}">0</b><small>分</small></div>
        <div class="rpt-skill-bar"><i data-w="${s.score}"></i></div>
        <p class="rpt-skill-eval">${s.ev}</p>
        <div class="rpt-skill-detail" hidden><div class="rpt-skill-detail-inner">${escapeHtml(s.detail)}</div></div>
      </div>`).join('');
    qsa('.rpt-skill-score b', box).forEach((b) => animateNumber(b, parseFloat(b.dataset.w || 0), 1000));
    qsa('.rpt-skill-bar i', box).forEach((i) => requestAnimationFrame(() => requestAnimationFrame(() => { i.style.width = (i.dataset.w || 0) + '%'; })));
    qsa('.rpt-skill', box).forEach((card) => card.addEventListener('click', () => {
      const detail = card.querySelector('.rpt-skill-detail');
      if (!detail) return;
      const isOpen = !detail.hidden;
      qsa('.rpt-skill', box).forEach((c) => { c.classList.remove('is-open'); const d = c.querySelector('.rpt-skill-detail'); if (d) d.hidden = true; });
      if (!isOpen) { card.classList.add('is-open'); detail.hidden = false; }
    }));
  }

  function renderReportInsights(answers) {
    const box = $('report-insights'); if (!box) return;
    const strong = answers.flatMap((a) => a.evaluation && a.evaluation.strengths || []).slice(0, 4);
    const risk = answers.flatMap((a) => a.evaluation && a.evaluation.gaps || []).slice(0, 4);
    const learn = risk.length ? risk.slice(0, 3) : ['继续补充项目量化结果'];
    box.innerHTML = `
      <div class="rpt-insight is-strong">
        <div class="rpt-insight-head"><span>★★★★★</span>优势能力</div>
        <div class="rpt-insight-tags">${strong.map((t) => `<span>${escapeHtml(t)}</span>`).join('') || '<span>提交回答后显示</span>'}</div>
      </div>
      <div class="rpt-insight is-risk">
        <div class="rpt-insight-head"><span>⚠</span>风险项</div>
        <div class="rpt-insight-tags">${risk.map((t) => `<span>${escapeHtml(t)}</span>`).join('') || '<span>暂无风险项</span>'}</div>
      </div>
      <div class="rpt-insight is-learn">
        <div class="rpt-insight-head"><span>↗</span>提升建议</div>
        <div class="rpt-insight-tags">${learn.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>
        <div class="rpt-insight-up"><span>评估来源</span><b>规则</b><small>分数不由 AI 生成</small></div>
      </div>`;
  }

  function renderReportCareer() {
    const box = $('report-career'); if (!box) return;
    const m = getSelectedJob() || {};
    const title = m.job && m.job.title || '目标岗位';
    const gaps = (m.gaps || []).map((g) => g.skill).filter(Boolean).slice(0, 4);
    const current = ((currentResult() || {}).profile || {}).target_role || '当前求职方向';
    const next = title + ' · 可持续提升';
    box.innerHTML = `
      <div class="rpt-career-step is-cur">
        <span class="rpt-career-dot"></span>
        <div class="rpt-career-card"><b>${escapeHtml(current)}</b><small>当前定位</small></div>
      </div>
      <span class="rpt-career-arrow">→</span>
      <div class="rpt-career-step is-next">
        <span class="rpt-career-dot"></span>
        <div class="rpt-career-card"><b>${escapeHtml(next)}</b><small>下一阶段</small></div>
      </div>
      <div class="rpt-career-need">
        <span class="rpt-career-need-lbl">需要补齐</span>
        <div class="rpt-career-tags">${(gaps.length ? gaps : ['根据面试回答补充项目证据']).map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>
      </div>`;
  }

  /* ---------------- 暴露入口 ---------------- */
  // match.html 末尾通过 window.initMatch() 启动；必须显式挂到 window，
  // 否则 initMatch 仍为 IIFE 内局部函数，bootstrap 中的
  // `window.initMatch && window.initMatch()` 会短链成 no-op，导致中央工作区永不渲染。
  window.initMatch = initMatch;

})();
