/* Shared mock payload for discovery list + detail pages */
window.buildMockScanPayload = function () {
  const now = new Date().toISOString();
  const mkDisc = (i, title, cat, conf, skills, city) => ({
    id: 'disc_mock_' + i,
    title,
    category: cat,
    level: '中高级',
    confidence: conf,
    growth_rate: 20 + i * 3,
    status: 'pending',
    discovered_at: now,
    core_skills: skills,
    preferred_skills: [],
    definition: '基于本地招聘库聚类启发式生成，并经证据链交叉校验。',
    typical_scenarios: ['企业内场景', '技术中台', '数字化转型'],
    evidence_sources: [
      {
        source_name: '智联招聘 · 岗位样本',
        company: ['字节跳动', '阿里云', '腾讯云', '华为云', '美团', '京东', '商汤', '科大讯飞'][i % 8],
        city: city,
        industry: cat,
        posted_at: '2026-0' + ((i % 6) + 1) + '-12',
        snippet:
          '岗位要求熟悉 ' +
          (skills[0] || 'LLM') +
          ' 与 ' +
          (skills[1] || 'Agent') +
          '，能独立完成方案设计与落地评测。'
      },
      {
        source_name: 'BOSS直聘 · 同步样本',
        company: ['蚂蚁集团', '网易', '百度', '小红书', '拼多多', '滴滴', '携程', 'B站'][i % 8],
        city: city === '远程' ? '上海' : city,
        industry: cat,
        posted_at: '2026-0' + ((i % 5) + 2) + '-03',
        snippet: '负责相关系统架构、工具调用链路与 RAG / 检索质量治理，强调可观测与成本可控。'
      },
      {
        source_name: '企业官网 · 校招/社招',
        company: ['中兴', '联想', '用友', '金蝶', '浪潮', '海康', '大华', '深信服'][i % 8],
        city: ['深圳', '杭州', '北京', '南京'][i % 4],
        industry: '数字化转型',
        posted_at: '2025-12-' + String(10 + i).padStart(2, '0'),
        snippet: '跨团队推进智能体场景落地，需具备评测集设计与上线验收经验。'
      },
      {
        source_name: '行业研报 · 岗位映射',
        company: ['艾瑞咨询', 'IDC', '高德纳', '麦肯锡', '德勤', '普华永道', '埃森哲', 'IBM'][i % 8],
        city: '全国',
        industry: cat,
        posted_at: '2026-0' + ((i % 4) + 1) + '-22',
        snippet:
          '报告将「' +
          (skills[0] || 'LLM 应用') +
          '」与编排治理并列为高增长能力组合，并标注可迁移自传统后端/算法路径。'
      },
      {
        source_name: '高校就业 · 新职业口径',
        company: ['教育部', '人社部', '地方人才办', '高校就业中心'][i % 4],
        city: ['北京', '上海', '广州', '成都'][i % 4],
        industry: '人才培养',
        posted_at: '2026-02-' + String(8 + (i % 10)).padStart(2, '0'),
        snippet: '新职业口径强调可验证项目与评测闭环，避免仅凭标题词汇判定岗位真实性。'
      }
    ],
    responsibilities: ['参与需求分析与方案设计', '完成核心功能开发', '配合测试与上线运维'],
    trend: [],
    quality: {
      evidence_count: 3 + i,
      source_count: 2 + (i % 3),
      city_count: 1 + (i % 3),
      freshness_score: 70 + i * 2
    },
    source: '多源招聘库',
    city,
    salary: '20-40K',
    requiredSkills: skills,
    description: '基于本地招聘库聚类启发式生成，并经证据链交叉校验。',
    discoveredAt: now,
    reasoning: '标题新颖度+技能组合熵+跨行业溢出 = 综合置信度 ' + conf + '%'
  });
  const discoveries = [
    mkDisc(1, 'AI Agent 架构师', '人工智能', 88, ['LangChain', 'Function Calling', 'RAG', 'Python'], '北京'),
    mkDisc(2, '大模型微调工程师', '人工智能', 84, ['LoRA', 'QLoRA', 'PyTorch', 'SFT'], '上海'),
    mkDisc(3, 'RAG 知识工程师', '人工智能', 80, ['向量数据库', 'Embedding', '检索增强'], '深圳'),
    mkDisc(4, '多模态算法工程师', '人工智能', 78, ['CLIP', 'Diffusion', '多模态'], '杭州'),
    mkDisc(5, 'Prompt 工程师', '人工智能', 72, ['Prompt设计', 'LLM', '评测'], '成都'),
    mkDisc(6, 'AI Infra 工程师', '人工智能', 70, ['Triton', 'CUDA', 'AI编译器'], '北京'),
    mkDisc(7, 'AIGC 内容工程师', '人工智能', 68, ['Stable Diffusion', '生成式', 'PyTorch'], '广州'),
    mkDisc(8, 'LLM 应用开发工程师', '人工智能', 66, ['LangChain', 'API', 'Agent'], '远程')
  ];
  const mkFc = (i, title, cat, conf, eta, skills) => ({
    id: 'forecast_mock_' + i,
    title,
    category: cat,
    confidence: conf,
    eta_months: eta,
    drivers: ['趋势外推', '技能信号累积'],
    skills,
    definition: 'Mock 预测岗位，基于新兴技能时序外推。',
    status: 'forecast',
    source: '趋势预测模型(Mock)',
    city: '全国',
    salary: '面议(新兴岗位)',
    level: '专家',
    requiredSkills: skills,
    description: 'Mock 预测岗位。',
    discoveredAt: now,
    is_forecast: true
  });
  // 预测岗位均为趋势外推产生、当前招聘市场上尚不存在的全新岗位
  const forecasts = [
    mkFc(1, '世界模型对齐工程师', '人工智能', 74, 12, ['World Model', '对齐训练', '时序预测']),
    mkFc(2, '神经符号推理架构师', '安全', 78, 9, ['Neuro-Symbolic', '知识图谱', '定理证明']),
    mkFc(3, '具身智能伦理审计师', '人工智能', 80, 6, ['VLA', '伦理框架', '行为审计']),
    mkFc(4, '自主智能体仿真工程师', '数据科学', 75, 8, ['Agent Society', '仿真推演', '博弈论']),
    mkFc(5, '量子机器学习编译工程师', '人工智能', 70, 15, ['QML', '量子门', '混合编程']),
    mkFc(6, '数字孪生城市治理官', '智慧城市', 73, 10, ['Digital Twin', '城市计算', '政策仿真'])
  ];
  const chain = [
    {
      step: 1,
      title: '🌐 多源数据接入',
      detail: 'Mock：连接本地 PostgreSQL 招聘库，抽取最近 5000 条 IT 岗位记录。',
      status: 'done',
      metrics: '数据规模: 5000 条 | 覆盖 320 家企业',
      elapsed_ms: 420
    },
    {
      step: 2,
      title: '🧠 语义消歧与实体归一化',
      detail: 'Mock：标题字符级归一化，构建 N-gram 特征向量，识别语义聚类。',
      status: 'done',
      metrics: '聚类压缩比: 6.2x | 技能词典: 480 词',
      elapsed_ms: 510
    },
    {
      step: 3,
      title: '📈 多维度新兴度评分',
      detail: 'Mock：三维度加权(标题0.5+技能0.3+溢出0.2)，扫描语义簇。',
      status: 'done',
      metrics: '新兴候选 8 | 传统 IT 12 | 总簇 24',
      elapsed_ms: 600
    },
    {
      step: 4,
      title: '📝 岗位定义生成与职责推理',
      detail: 'Mock：基于真实 JD 摘要生成岗位定义、核心职责与典型场景。',
      status: 'done',
      metrics: '输出 8 个岗位定义',
      elapsed_ms: 520
    },
    {
      step: 5,
      title: '🔮 时序趋势外推',
      detail: 'Mock：指数平滑+线性回归外推 6-18 个月技能需求变化。',
      status: 'done',
      metrics: '预测跨度: 6-18 个月 | 置信区间: 65%-80%',
      elapsed_ms: 610
    },
    {
      step: 6,
      title: '🛡️ 幻觉检测与质量审计',
      detail: 'Mock：交叉校验证据来源，检测定义-技能一致性，标记低证据项目。',
      status: 'done',
      metrics: '审计通过 8 | 弱证据 2',
      elapsed_ms: 330
    }
  ];
  return {
    reasoning_chain: chain,
    discoveries,
    forecasts,
    summary:
      'Mock 扫描完毕：5000 条 → 24 簇 → 8 个发现 + 6 个预测。推理引擎: DiscoveryAgent (Mock)。',
    stats: {
      total_scanned: 5000,
      title_clusters: 24,
      discoveries: 8,
      forecasts: 6,
      total_elapsed_ms: 2990,
      avg_confidence: 75.5
    },
    model: {
      engine: 'DiscoveryAgent v2.0 (Mock)',
      backed_by: '启发式(Mock)',
      llm: 'none',
      llm_enriched: 0,
      llm_error: null,
      knowledge_base: 'PostgreSQL mock'
    }
  };
};
