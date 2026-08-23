/* Discovery job detail — unified black-gold board */
(function () {
  let trendChart = null;
  let graphChart = null;
  let graphSourceCache = [];
  let fcProbChart = null;
  let fcSupplyChart = null;
  let currentJob = null;
  const dutyLanes = {
    fc: { timer: null, expanded: false, slideIndex: 0, rowHeight: 32, visibleRows: 3, data: { duties: [], scores: [] } },
    found: { timer: null, expanded: false, slideIndex: 0, rowHeight: 32, visibleRows: 3, data: { duties: [], scores: [] } }
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function qs(name) {
    try {
      return new URLSearchParams(location.search).get(name);
    } catch (_) {
      return null;
    }
  }

  function toast(msg, tone) {
    if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, tone || 'mint');
  }

  function readFavs() {
    return window.DiscoveryFavs ? window.DiscoveryFavs.readFavs() : [];
  }

  function isFav(id) {
    return window.DiscoveryFavs ? window.DiscoveryFavs.isFav(id) : false;
  }

  function toggleFav(id, meta) {
    if (window.DiscoveryFavs) return window.DiscoveryFavs.toggleFav(id, meta);
    return false;
  }

  function syncFavButtons(job) {
    if (window.DiscoveryFavs) window.DiscoveryFavs.syncFavButtons(job);
  }

  function fillVerdict(job) {
    const top = (job.skillScores || []).slice(0, 3).map((s) => s.name);
    if (job.isForecast) {
      const kicker = document.getElementById('dd-fc-verdict-kicker');
      const text = document.getElementById('dd-fc-verdict-text');
      const chips = document.getElementById('dd-fc-verdict-chips');
      const trust = document.getElementById('dd-fc-trust');
      if (kicker) kicker.textContent = job.conf >= 80 ? '建议提前准备' : '建议持续观察';
      if (text) {
        text.textContent =
          '预计在「' +
          (job.windowLabel || job.etaDisplay) +
          '」窗口内成型（置信 ' +
          job.conf +
          '%）。先对照简历缺口，再决定是否投入准备。';
      }
      if (chips) {
        chips.innerHTML = top
          .map((n) => '<span class="dd-chip-mini">' + esc(n) + '</span>')
          .join('');
      }
      if (trust) {
        trust.innerHTML =
          '<span>推演示意</span><span>·</span><span>' +
          esc(job.alliance || '执图破局预测') +
          '</span><span>·</span><span>非招聘承诺</span>';
      }
      return;
    }

    const kicker = document.getElementById('dd-found-verdict-kicker');
    const text = document.getElementById('dd-found-verdict-text');
    const chips = document.getElementById('dd-found-verdict-chips');
    const trust = document.getElementById('dd-found-trust');
    if (kicker) kicker.textContent = job.growth >= 80 ? '建议关注' : '可以了解';
    if (text) {
      text.textContent =
        '该岗位已在真实招聘中稳定出现，近半年需求 ↑' +
        job.growth +
        '%。优先核对你是否具备核心能力，再决定收藏或深挖。';
    }
    if (chips) {
      chips.innerHTML = top
        .map((n) => '<span class="dd-chip-mini">' + esc(n) + '</span>')
        .join('');
    }
    if (trust) {
      trust.innerHTML =
        '<span>样本 ' +
        Number(job.sampleCount || 0).toLocaleString('zh-CN') +
        '</span><span>·</span><span>' +
        esc(job.source || '多源招聘库') +
        '</span><span>·</span><span>仅供参考</span>';
    }
  }

  function findJobInMock(id) {
    if (!id || !window.buildMockScanPayload) return null;
    const mock = window.buildMockScanPayload();
    const all = [...(mock.discoveries || []), ...(mock.forecasts || [])];
    return all.find((j) => j.id === id) || null;
  }

  function loadJob() {
    const id = qs('id');
    let job = null;

    if (id) job = findJobInMock(id);

    if (!job) {
      try {
        const raw = sessionStorage.getItem('zhitu_disc_job');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (!id || parsed.id === id) job = parsed;
        }
      } catch (_) {}
    }

    if (!job && window.buildMockScanPayload) {
      const mock = window.buildMockScanPayload();
      const all = [...(mock.discoveries || []), ...(mock.forecasts || [])];
      job = (id && all.find((j) => j.id === id)) || all[0];
    }

    if (!job) {
      job = {
        id: 'disc_mock_1',
        title: 'AI Agent 架构师',
        category: '人工智能',
        confidence: 88,
        city: '北京',
        level: '中高级',
        requiredSkills: [
          'LLM 应用与工程化',
          'Agent 设计与开发',
          'RAG 体系构建',
          'Prompt Engineering',
          '工具调用 (Tool Use)'
        ],
        definition:
          '负责设计与规划基于大模型的 Agent 系统架构，打通工具调用、知识检索与多模型协同，支撑企业级智能应用落地。',
        reasoning: '标题新颖度 + 技能组合熵 + 跨行业外溢'
      };
    }
    return enrichJob(job);
  }

  function enrichJob(job) {
    const isForecast = !!(job.is_forecast || job.status === 'forecast');
    const conf = job.confidence || 72;
    const growth =
      job.growth != null
        ? Number(job.growth)
        : conf >= 85
          ? 125
          : Math.max(48, Math.round((conf - 30) * 2.4));
    const skills = job.requiredSkills || job.core_skills || [];
    const first =
      job.freshness ||
      (job.discoveredAt || job.discovered_at
        ? String(job.discoveredAt || job.discovered_at).slice(0, 7)
        : '2024-Q4');

    const etaDisplay = job.eta_months
      ? String(job.eta_months).indexOf('月') >= 0
        ? String(job.eta_months)
        : String(job.eta_months) + ' 个月'
      : '6–12 个月';

    const defaultTop10 = [
      { name: 'LLM 应用与工程化', score: 92 },
      { name: 'Agent 设计与开发', score: 88 },
      { name: 'RAG 体系构建', score: 85 },
      { name: 'Prompt Engineering', score: 82 },
      { name: '工具调用 (Tool Use)', score: 78 },
      { name: '多智能体协作', score: 72 },
      { name: '向量数据库', score: 68 },
      { name: '系统架构设计', score: 65 },
      { name: 'Python 开发', score: 64 },
      { name: 'API 设计与集成', score: 61 }
    ];

    // Prefer curated TOP10 for found board; merge job skills only when names differ
    let skillScores = defaultTop10.map((d) => ({ ...d }));
    if (skills.length && !isForecast) {
      skills.forEach((s, i) => {
        const hit = skillScores.find((x) => x.name === s || s.indexOf(x.name.slice(0, 4)) === 0);
        if (!hit && skillScores.length < 10) {
          skillScores.push({
            name: s,
            score: Math.max(61, Math.min(92, conf + 4 - i * 4))
          });
        }
      });
      skillScores = skillScores.slice(0, 10);
    } else if (isForecast) {
      const fcTop10 = [
        { name: 'AI 工作流编排', score: 94 },
        { name: '多智能体协同', score: 90 },
        { name: 'LLMOps', score: 87 },
        { name: '安全与治理', score: 84 },
        { name: '企业系统集成', score: 81 },
        { name: '可观测与评测', score: 78 },
        { name: '成本与配额管理', score: 74 },
        { name: '权限与审计', score: 71 },
        { name: 'Prompt / 策略设计', score: 68 },
        { name: '跨团队落地推动', score: 65 }
      ];
      skillScores = fcTop10.map((d) => ({ ...d }));
      (job.skills || skills || []).forEach((s, i) => {
        const name = typeof s === 'string' ? s : s.name;
        if (!skillScores.some((x) => x.name === name) && skillScores.length < 10) {
          skillScores.push({ name, score: Math.max(65, conf + 6 - i * 4) });
        }
      });
      skillScores = skillScores.slice(0, 10);
    }

    const title = job.title || (isForecast ? '新兴岗位方向' : '新兴岗位');
    const basePos = job.definition || job.description || '';

    const defaultFoundDuties = [
      '负责 AI Agent 系统的整体架构设计与落地',
      '设计 Agent 工作流、任务规划与工具调用逻辑',
      '构建 RAG 检索增强与知识管理体系',
      '评估与优化 Agent 性能、效果与安全性',
      '推动 Agent 技术在业务场景中的应用落地',
      '编写技术方案与接口文档',
      '参与跨团队评审与上线验收',
      '沉淀可复用 Agent 场景模板'
    ];
    const rawDuties = (job.duties || job.responsibilities || []).filter(Boolean);
    const foundDuties =
      !isForecast && rawDuties.length < 5 ? defaultFoundDuties : rawDuties.length ? rawDuties : defaultFoundDuties;

    const foundPortrait = {
      positioning:
        basePos ||
        title +
          '负责把复杂智能体系统从方案推进到可上线、可运维的工程形态，明确模块边界、工具链路与评测标准。',
      brief:
        '这是一个已经在真实招聘文本中稳定出现的岗位。它不是单纯的模型调用角色，而是要把规划、工具调用、知识检索与执行闭环串成可交付系统。',
      duties: foundDuties,
      who: [
        '有后端或平台工程经验，能把服务边界画清楚',
        '接触过大模型应用或 RAG / 工具调用链路',
        '习惯用指标与评测说话，而不是只看 Demo',
        '能跨产品、算法、运维推进联调与上线'
      ],
      day: [
        '梳理业务场景，拆成可编排的任务与工具集',
        '设计 Agent 架构、上下文与失败回退路径',
        '联调检索、工具、权限与观测链路',
        '制定评测集，跟踪成功率、时延与成本'
      ],
      outputs: ['架构说明与接口契约', '工具目录与权限矩阵', '评测报告与回归清单', '上线与灰度方案'],
      collab:
        '对上对齐产品与业务目标，对内协同大模型、后端、数据与安全同学，对外对接运维与 SRE。',
      scenes: [
        { name: '企业知识助手', desc: '制度与资料接到可追问、可引用的问答链路。' },
        { name: '智能客服编排', desc: '多轮对话中调用工单、CRM、知识库。' },
        { name: '研发效能工具', desc: '代码检索、变更分析与发布检查。' },
        { name: '运营流程助手', desc: '审批、巡检、报表等流程任务链。' }
      ],
      note: '本页一次性呈现岗位画像、能力、趋势与供需，便于整体阅读。'
    };

    const forecastPortrait = {
      positioning:
        basePos && basePos.indexOf('Mock') === -1
          ? basePos
          : title +
            '面向企业级 AI 编排：把多 Agent、工具链与治理要求收成可交付的架构岗位方向。',
      brief: '窗口期内更可能成型，关注出现时间、演化来源与简历缺口。',
      duties: job.responsibilities || job.duties || [
        '设计企业级 AI 编排架构与多 Agent 协作边界',
        '建立 LLMOps、评测与灰度发布机制',
        '制定安全治理、权限审计与成本配额策略',
        '打通业务系统集成与工具调用链路',
        '推动试点编制走向常规岗位与交付标准',
        '编写架构规范与跨团队接口契约',
        '主导试点复盘并沉淀岗位能力模型',
        '对接合规与安全团队完成上线评审'
      ],
      who: [
        '已有相邻岗位经验，希望提前布局下一跳能力',
        '负责试点项目，需要预判编制与分工变化',
        '做人才规划，关注 6–18 个月岗位结构变化'
      ],
      day: [
        '把试点场景拆成可协作的角色与接口',
        '设计多 Agent / 编排与回退',
        '补齐观测、权限、成本与评测短板'
      ],
      outputs: ['方向说明与能力清单', '试点方案与角色分工表', '风险清单', '能力准备路径'],
      collab: '与业务共定场景，与工程岗位共定边界，与组织侧同步编制变化。',
      scenes: [
        { name: '多 Agent 业务试点', desc: '客服、运营、研效等场景协作。' },
        { name: '企业智能体运维', desc: '稳定性、配额、权限与事故响应。' }
      ],
      note: '预测存在不确定性，请结合窗口与能力准备阅读。'
    };

    const portrait = isForecast ? forecastPortrait : foundPortrait;
    const dutyScores = portrait.duties.map((_, i) =>
      isForecast ? Math.max(66, 91 - i * 3) : Math.max(62, 92 - i * 4)
    );

    const fromRoles = job.from || job.evolution_from || [
      'AI Agent 架构师',
      '大模型工程师',
      '平台架构师',
      'RAG 工程师',
      '自动化工程师',
      '智能体产品经理',
      '后端架构师'
    ];

    const related = isForecast
      ? fromRoles.slice(0, 4).map((name, i) => ({
          name,
          score: 90 - i * 5,
          note: '演化来源'
        }))
      : fromRoles.map((name, i) => {
          const notes = [
            '模型与编排能力直接延续',
            '检索与知识链路可迁移',
            '平台架构经验可复用',
            '多 Agent 协作背景',
            '自动化流水线经验',
            '产品化场景理解',
            '分布式系统底座'
          ];
          const weight = Math.max(36, 96 - i * 8 - (i % 2) * 4);
          return {
            name,
            score: weight,
            note: notes[i % notes.length] || '常见跃迁来源',
            count: Math.round(95 + weight * 3.8 - i * 12)
          };
        });

    const skillBoard = skillScores.map((s) => ({
      ...s,
      why: '招聘文本中与该岗位共现较高，是履职的重要支撑能力。',
      level: s.score >= 85 ? '必备' : s.score >= 72 ? '重要' : '加分'
    }));

    const windowLabel =
      job.eta ||
      job.etaDisplay ||
      (job.eta_months
        ? String(job.eta_months).indexOf('月') >= 0
          ? String(job.eta_months)
          : String(job.eta_months) + ' 个月'
        : isForecast
          ? '2025-Q3 – 2026-Q1'
          : first);

    return {
      ...job,
      isForecast,
      conf,
      growth,
      firstSeen: first,
      etaDisplay: isForecast ? windowLabel : etaDisplay,
      windowLabel,
      dataConf: Math.min(96, conf + 4),
      sampleCount: job.sample_count || job.sampleCount || 2356,
      industry: isForecast
        ? job.industry_label || '互联网 / 金融 / 制造 / 政企'
        : job.industry || '互联网 / 科技 / 金融',
      direction: '技术研发类',
      subtype: job.category || '软件与系统架构',
      levelDisplay: isForecast
        ? job.level_display || '高级 / 专家级'
        : job.level_display ||
          (job.level === '中高级' || job.level === '中/高级' ? '中级 / 高级' : job.level) ||
          '中级 / 高级',
      locationDisplay: '一线 / 新一线城市为主',
      salaryDisplay: isForecast ? job.salary || '35-60K · 16薪' : job.salary || '25-45K · 16薪',
      salaryPeak: isForecast ? 62 : 72,
      fromRoles,
      evolveCount: fromRoles.length,
      alliance: job.alliance || '执图破局 AI 预测联盟 v2.1',
      positioning: portrait.positioning,
      brief: portrait.brief,
      who: portrait.who,
      day: portrait.day,
      duties: portrait.duties,
      dutyScores,
      outputs: portrait.outputs,
      collab: portrait.collab,
      portraitNote: portrait.note,
      scenes: portrait.scenes,
      skillScores,
      skillBoard,
      skillsBrief: isForecast
        ? '若该预测方向在窗口内成型，履职最依赖的能力组合。'
        : '这些能力来自该岗位招聘文本与职责描述的共现分析。',
      skillsTiers: ['必备：岗位 JD 反复出现', '重要：影响上线与协作', '加分：拉开资深差距'],
      skillsPrep: [
        '选一个可上线的小场景，跑通工具/知识/评测闭环',
        '写清架构边界、失败回退与权限矩阵',
        '建立最小评测集：成功率、时延、成本'
      ],
      skillsGaps: ['Demo 很炫但接口/权限/观测缺失', '只会单点技术，串不起端到端', '缺少评测习惯'],
      skillsMap: [
        { duty: '架构与边界设计', skills: '系统架构设计 / API 编排' },
        { duty: '工具与知识集成', skills: 'Tool Use / RAG / 向量库' },
        { duty: '可靠性与评测', skills: '可观测性 / 成本优化' },
        { duty: '安全可控', skills: '安全与权限控制' }
      ],
      related,
      derived: [
        { name: '多智能体系统架构师', score: 86, eta: '12–18 月', note: '高潜力' },
        { name: '智能体产品经理', score: 78, eta: '9–15 月', note: '跨职能' }
      ],
      radarAxes: ['AI 应用开发', '大模型工程化', '系统设计', '数据处理', '业务理解'],
      radarJob: [92, 88, 78, 70, 74],
      radarAvg: [68, 62, 72, 66, 70],
      supply: {
        demandGrowth: growth,
        supplyGrowth: job.supply_growth != null ? Number(job.supply_growth) : 45,
        ratio:
          job.supply_ratio != null ? String(job.supply_ratio) : (growth / 45).toFixed(2)
      },
      skillDev: isForecast
        ? [
            { name: 'AI 工作流编排', now: '中', m6: '高', m12: '极高', m24: '极高' },
            { name: '多智能体协同', now: '中', m6: '高', m12: '高', m24: '极高' },
            { name: 'LLMOps', now: '中', m6: '中', m12: '高', m24: '极高' },
            { name: '安全与治理', now: '低', m6: '中', m12: '高', m24: '高' },
            { name: '企业系统集成', now: '中', m6: '高', m12: '高', m24: '极高' }
          ]
        : [],
      industries: [
        { name: '互联网', value: 32 },
        { name: '金融', value: 22 },
        { name: '制造', value: 16 },
        { name: '政企', value: 14 },
        { name: '医疗', value: 8 },
        { name: '其他', value: 8 }
      ],
      fusionSkills: ['多智能体编排', 'LLMOps', '安全治理', '企业集成'],
      riskLead:
        '本预测基于历史岗位演化、能力共现与行业试点信号推演，结果会随技术迭代与企业采纳节奏变化。',
      risks: ['技术路线迭代加快', '行业需求阶段性波动', '企业采纳与编制节奏', '政策与合规约束变化'],
      evidence: {
        reasons: isForecast
          ? ['相邻岗位能力密度上升', '业务场景开始试点', '招聘文本出现近义描述']
          : ['大模型能力成熟', '工具调用需求上升', 'Agent 场景扩张'],
        fusion: ['大模型工程师', '后端架构师', '自动化工程师'],
        industries: ['互联网', '金融', '教育', '企业服务'],
        future: isForecast
          ? '预计在窗口期内从试点岗位描述走向更稳定的招聘标题。'
          : '该岗位处于高速增长期，人才缺口较大；核心能力集中在 LLM、Agent 架构与 RAG。'
      },
      trendInsights: [
        first + ' 前后，相关招聘表述开始稳定出现',
        '近周期需求抬升，覆盖互联网、金融、企业服务等行业',
        '未来 6–12 个月仍可能保持较高增长区间'
      ]
    };
  }

  function seriesForRange(months) {
    const n = months;
    const heat = [];
    const demand = [];
    const supplyIdx = [];
    const labels = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
      const t = (n - i) / n;
      const base = 18 + t * 48 + Math.sin(i * 0.75) * 4;
      const h = Math.round(base + (currentJob?.conf || 70) * 0.1);
      heat.push(h);
      demand.push(Math.round(h * 0.78 + 8 + Math.cos(i * 0.5) * 3));
      supplyIdx.push(Math.round(h * 0.52 + 8 + i * 2.2));
    }
    const growthPct =
      heat.length > 1 ? Math.round(((heat[heat.length - 1] - heat[0]) / Math.max(heat[0], 1)) * 100) : 0;
    let peakIdx = 0;
    let peakVal = heat[0] || 0;
    heat.forEach((v, i) => {
      if (v >= peakVal) {
        peakVal = v;
        peakIdx = i;
      }
    });
    const pressure = heat.map((h, i) => Math.max(0, h - supplyIdx[i]));
    const accelStart = Math.max(0, n - 3);
    return {
      labels,
      heat,
      demand,
      supplyIdx,
      growthPct,
      peakIdx,
      peakVal,
      pressure,
      accelStart
    };
  }

  function chartTheme() {
    return { real: '#d4b07a', demand: '#8a7355' };
  }

  /* ---------- Found unified board ---------- */
  function renderFoundBoard(job) {
    clearDutyTimers();
    disposeFcCharts();
    const found = document.getElementById('dd-found');
    const forecast = document.getElementById('dd-forecast-shell');
    if (found) found.hidden = false;
    if (forecast) forecast.hidden = true;

    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('dd-found-title', job.title || '岗位详情');
    set('dd-found-heat', String(job.conf));
    fillVerdict(job);
    syncFavButtons(job);

    const meta = document.getElementById('dd-found-meta');
    if (meta) {
      meta.innerHTML =
        '<span><em>初次出现</em> ' +
        esc(job.firstSeen) +
        '</span>' +
        '<span class="sep" aria-hidden="true">|</span>' +
        '<span><em>样本数量</em> ' +
        esc(Number(job.sampleCount).toLocaleString('zh-CN')) +
        '</span>' +
        '<span class="sep" aria-hidden="true">|</span>' +
        '<span class="is-up"><em>增长趋势</em> ↑ ' +
        job.growth +
        '% <small>(近6个月)</small></span>';
    }

    const basics = document.getElementById('dd-found-basics');
    if (basics) {
      basics.innerHTML = [
        ['岗位类别', job.direction],
        ['所属行业', job.industry],
        ['岗位层级', job.levelDisplay],
        ['工作地点', job.locationDisplay],
        ['薪资范围', job.salaryDisplay]
      ]
        .map(
          (row) =>
            '<div><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>'
        )
        .join('');
    }
    set('dd-found-brief', job.brief || job.positioning || '');

    renderFoundSkills(job);

    mountDuties('found', job);
    bindDutiesOnce();

    renderFoundSupply(job);

    renderFoundTrend();
    renderFoundRadar();
    renderFoundGraph();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        layoutFoundRow();
        runFoundMotion();
        startDutyCarousel('found');
      });
    });
  }

  function layoutFoundRow() {
    const st = dutyLanes.found;
    const prevRows = st.visibleRows;
    const prevRowH = st.rowHeight;
    syncDutyViewportHeight('found');
    if (!st.expanded && (st.visibleRows !== prevRows || st.rowHeight !== prevRowH)) {
      buildDutyCarousel('found');
      st.slideIndex = 0;
      applyDutySlide('found', false);
    }
    resizeFoundCharts();
  }

  function runFoundMotion() {
    if (!window.gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      window.gsap.from('.dd-back-bubble', {
        opacity: 0,
        x: -14,
        duration: 0.58,
        ease: 'power2.out',
        clearProps: 'opacity,transform'
      });
      window.gsap.from('.dd-found-hero, #dd-found-verdict, #dd-found-board .dd-panel', {
        opacity: 0,
        y: 16,
        duration: 0.72,
        stagger: 0.045,
        ease: 'power3.out',
        clearProps: 'opacity,transform'
      });
      const board = document.getElementById('dd-found-board');
      if (board) {
        const inner = board.querySelectorAll(
          '.dd-fc-duty-item, .dd-ind-row, .dd-ladder-item, .dd-supply-gauge, .dd-supply-beam-track span, .dd-trend-badge'
        );
        if (inner.length) {
          window.gsap.from(inner, {
            opacity: 0,
            x: -10,
            duration: 0.48,
            stagger: 0.03,
            delay: 0.18,
            ease: 'power2.out',
            clearProps: 'opacity,transform'
          });
        }
      }
      animateSkillConstellation();
      animateCmpLanes();
      animateTrendChart();
    } catch (_) {}
  }

  function animateCmpLanes() {
    const bars = document.querySelectorAll('#dd-found-radar .dd-cmp-lane .bar.is-job[data-w]');
    const indBars = document.querySelectorAll('#dd-found-radar .dd-cmp-lane .bar.is-ind[data-w]');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap) {
      bars.forEach((b) => {
        b.style.width = b.getAttribute('data-w');
      });
      indBars.forEach((b) => {
        b.style.width = b.getAttribute('data-w');
      });
      return;
    }
    indBars.forEach((b, i) => {
      window.gsap.fromTo(
        b,
        { width: '0%' },
        { width: b.getAttribute('data-w'), duration: 0.62, ease: 'power2.out', delay: 0.12 + i * 0.04 }
      );
    });
    bars.forEach((b, i) => {
      window.gsap.fromTo(
        b,
        { width: '0%' },
        { width: b.getAttribute('data-w'), duration: 0.82, ease: 'power2.out', delay: 0.18 + i * 0.05 }
      );
    });
  }

  function graphSourceData() {
    const related = (currentJob?.related || []).slice().sort((a, b) => b.score - a.score);
    const total = related.reduce((s, r) => s + (Number(r.score) || 0), 0) || 1;
    const items = related.map((r, i) => ({
      name: r.name,
      value: Math.round(((Number(r.score) || 0) / total) * 100),
      note: r.note || '能力路径重叠',
      count: r.count || Math.round(80 + (Number(r.score) || 0) * 2.5),
      overlap: Number(r.score) || 0,
      rank: i + 1
    }));
    const sum = items.reduce((s, x) => s + x.value, 0);
    if (items.length && sum !== 100) items[items.length - 1].value += 100 - sum;
    return items;
  }

  const GRAPH_PIE_COLORS = [
    '#f5d478',
    '#5cb8e8',
    '#e8925a',
    '#6ecf9a',
    '#c49af5',
    '#f07898',
    '#8ab8f5'
  ];

  function dutyVisibleRows(lane) {
    const st = dutyLanes[lane];
    if (st.visibleRows) return st.visibleRows;
    return 3;
  }

  function resizeFoundCharts() {
    requestAnimationFrame(() => {
      try {
        applyGraphPieLayout();
        trendChart && trendChart.resize();
        graphChart && graphChart.resize();
        applyGraphPieLayout();
      } catch (_) {}
    });
  }

  function animateTrendChart() {
    /* 趋势图仅保留入场动画与 CSS 光效，不做持续数据浮动 */
  }

  function renderFoundTrend() {
    const el = document.getElementById('dd-found-trend');
    if (!el || !window.echarts) return;
    const series = seriesForRange(6);
    const badge = document.getElementById('dd-found-trend-badge');
    if (badge) {
      badge.textContent = '强劲 ↑' + series.growthPct + '%';
      badge.classList.toggle('is-surge', series.growthPct >= 80);
    }
    const { labels, heat, demand } = series;
    const lastIdx = heat.length - 1;
    const yMaxL = Math.ceil(Math.max(...heat, 1) / 10) * 10 + 8;
    const yMaxR = Math.ceil(Math.max(...demand, 1) / 10) * 10 + 8;
    if (!trendChart) trendChart = window.echarts.init(el);
    trendChart.setOption({
      backgroundColor: 'transparent',
      animationDuration: 980,
      animationEasing: 'elasticOut',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: { color: 'rgba(212,176,122,0.35)' },
          lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.12)' }
        },
        backgroundColor: 'rgba(10,14,20,0.94)',
        borderColor: 'rgba(212,176,122,0.25)',
        textStyle: { color: '#e8f2f8', fontSize: 11 },
        formatter(params) {
          if (!params || !params.length) return '';
          const idx = params[0].dataIndex;
          return (
            labels[idx] +
            '<br/><span style="color:#e8c988">● 发布量 ' +
            heat[idx] +
            '</span><br/><span style="color:#7ec8f0">● 搜索热度 ' +
            demand[idx] +
            '</span>'
          );
        }
      },
      legend: { show: false },
      grid: { left: 34, right: 34, top: 10, bottom: 16 },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: true,
        axisLine: { lineStyle: { color: 'rgba(212,176,122,0.22)' } },
        axisLabel: {
          color: 'rgba(232,242,248,0.58)',
          fontSize: 10,
          margin: 6,
          formatter(v) {
            return String(v).slice(5);
          }
        },
        axisTick: { show: false }
      },
      yAxis: [
        {
          type: 'value',
          position: 'left',
          min: 0,
          max: yMaxL,
          splitNumber: 3,
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } },
          axisLabel: {
            color: 'rgba(232,201,136,0.62)',
            fontSize: 9,
            margin: 6,
            formatter: '{value}'
          },
          axisLine: { show: false },
          axisTick: { show: false }
        },
        {
          type: 'value',
          position: 'right',
          min: 0,
          max: yMaxR,
          splitNumber: 3,
          splitLine: { show: false },
          axisLabel: {
            color: 'rgba(126,200,240,0.62)',
            fontSize: 9,
            margin: 6,
            formatter: '{value}'
          },
          axisLine: { show: false },
          axisTick: { show: false }
        }
      ],
      series: [
        {
          name: '发布量',
          type: 'bar',
          yAxisIndex: 0,
          data: heat,
          barWidth: '46%',
          barCategoryGap: '28%',
          animationDelay(idx) {
            return idx * 85 + 280;
          },
          itemStyle: {
            borderRadius: [6, 6, 2, 2],
            borderWidth: 1,
            borderColor: 'rgba(255,240,200,0.38)',
            color(p) {
              const isLast = p.dataIndex === lastIdx;
              return {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: isLast
                  ? [
                      { offset: 0, color: '#fff8dc' },
                      { offset: 0.45, color: '#f0d080' },
                      { offset: 1, color: '#a87830' }
                    ]
                  : [
                      { offset: 0, color: '#f5e0a8' },
                      { offset: 0.55, color: '#d4a858' },
                      { offset: 1, color: '#8a6530' }
                    ]
              };
            },
            shadowBlur: 0,
            shadowColor: 'transparent',
            shadowOffsetY: 0
          },
          emphasis: {
            itemStyle: {
              borderColor: 'rgba(255,248,220,0.9)',
              shadowBlur: 8,
              shadowColor: 'rgba(240,208,128,0.35)'
            }
          },
          z: 2
        },
        {
          name: '搜索热度',
          type: 'line',
          yAxisIndex: 1,
          data: demand,
          smooth: 0.42,
          animationDuration: 1100,
          animationDelay: 420,
          animationEasing: 'cubicOut',
          symbol: 'circle',
          symbolSize(_v, p) {
            return p.dataIndex === lastIdx ? 8 : 0;
          },
          showSymbol: true,
          lineStyle: {
            width: 2.2,
            color: '#7ec8f0'
          },
          itemStyle: {
            color: '#0c1218',
            borderColor: '#c8eeff',
            borderWidth: 2
          },
          z: 4
        }
      ]
    }, true);
  }

  function supplyVerdict(ratio) {
    const r = Number(ratio);
    if (r >= 2.5) return { label: '供不应求', tone: 'is-hot', hint: '需求增速显著高于人才供给，招聘竞争偏激烈。' };
    if (r >= 1.6) return { label: '偏紧', tone: 'is-warm', hint: '需求仍在扩张，供给跟进略慢，需提前储备。' };
    return { label: '相对均衡', tone: 'is-ok', hint: '供需节奏接近，可关注结构性缺口而非总量。' };
  }

  function renderFoundSupply(job) {
    const el = document.getElementById('dd-found-supply');
    if (!el || !job.supply) return;
    const ratio = Number(job.supply.ratio) || 1;
    const verdict = supplyVerdict(ratio);
    const gaugePct = Math.min(100, Math.round((ratio / 3.2) * 100));
    const dG = Number(job.supply.demandGrowth) || 0;
    const sG = Number(job.supply.supplyGrowth) || 0;
    const sum = Math.max(dG + sG, 1);
    const dShare = Math.round((dG / sum) * 100);
    const sShare = 100 - dShare;
    const foot = job.evidence?.future
      ? '<p class="dd-supply-foot">' + esc(job.evidence.future) + '</p>'
      : '';
    el.innerHTML =
      '<div class="dd-supply-focus-inner">' +
      '<div class="dd-supply-top">' +
      '<div class="dd-supply-gauge is-compact is-live" style="--gauge:' +
      gaugePct +
      '%" aria-hidden="true">' +
      '<div class="dd-supply-gauge-aura"></div>' +
      '<div class="dd-supply-gauge-aura is-hot"></div>' +
      '<div class="dd-supply-gauge-orbit"></div>' +
      '<div class="dd-supply-gauge-orbit is-reverse"></div>' +
      '<div class="dd-supply-gauge-ring"></div>' +
      '<div class="dd-supply-gauge-sweep"></div>' +
      '<div class="dd-supply-gauge-core">' +
      '<strong class="dd-supply-gauge-num" data-val="' +
      esc(String(job.supply.ratio)) +
      '">0</strong>' +
      '<span>供需比</span></div></div>' +
      '<div class="dd-supply-state">' +
      '<strong class="' +
      verdict.tone +
      '">' +
      esc(verdict.label) +
      '</strong>' +
      '<span class="dd-supply-ratio">需求增速是供给的 ' +
      (sG > 0 ? (dG / sG).toFixed(1) : '—') +
      ' 倍</span></div></div>' +
      '<div class="dd-supply-beam" aria-label="需求与供给增长对比">' +
      '<div class="dd-supply-beam-labels">' +
      '<span>需求 ↑' +
      dG +
      '%</span>' +
      '<span>供给 ↑' +
      sG +
      '%</span></div>' +
      '<div class="dd-supply-beam-track">' +
      '<span class="is-demand" data-w="' +
      dShare +
      '"></span>' +
      '<span class="is-supply" data-w="' +
      sShare +
      '"></span></div></div>' +
      '<p class="dd-supply-read">' +
      esc(verdict.hint) +
      '</p>' +
      foot +
      '</div>';
    animateSupplyBeam(el);
    animateSupplyGauge(el);
  }

  function animateSupplyGauge(root) {
    if (!root) return;
    const num = root.querySelector('.dd-supply-gauge-num');
    const gauge = root.querySelector('.dd-supply-gauge.is-live');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (num) {
      const target = parseFloat(num.getAttribute('data-val')) || 0;
      if (reduced || !window.gsap) {
        num.textContent = num.getAttribute('data-val');
      } else {
        const proxy = { v: 0 };
        window.gsap.to(proxy, {
          v: target,
          duration: 1.1,
          ease: 'power2.out',
          delay: 0.15,
          onUpdate: function () {
            num.textContent = proxy.v.toFixed(2).replace(/\.?0+$/, '');
          },
          onComplete: function () {
            num.textContent = num.getAttribute('data-val');
          }
        });
      }
    }
    if (gauge && !reduced && window.gsap) {
      window.gsap.fromTo(
        gauge,
        { scale: 0.88, opacity: 0.6 },
        { scale: 1, opacity: 1, duration: 0.75, ease: 'back.out(1.4)', delay: 0.08 }
      );
    }
  }

  function animateSupplyBeam(root) {
    if (!root) return;
    const spans = root.querySelectorAll('.dd-supply-beam-track span[data-w]');
    if (!spans.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    spans.forEach((s, i) => {
      const w = s.getAttribute('data-w') + '%';
      if (reduced || !window.gsap) {
        s.style.width = w;
        return;
      }
      window.gsap.fromTo(
        s,
        { width: '0%' },
        { width: w, duration: 0.85, ease: 'power2.out', delay: 0.2 + i * 0.06 }
      );
    });
  }

  function renderFoundRadar() {
    const el = document.getElementById('dd-found-radar');
    if (!el || !currentJob) return;
    const axes = currentJob.radarAxes || [];
    const job = currentJob.radarJob || [];
    const avg = currentJob.radarAvg || [];
    if (!axes.length) {
      el.innerHTML = '<p class="dd-ind-empty">暂无能力对照数据</p>';
      return;
    }
    let leadCount = 0;
    let deltaSum = 0;
    let maxDelta = -999;
    let maxDeltaName = '';
    axes.forEach((name, i) => {
      const d = (Number(job[i]) || 0) - (Number(avg[i]) || 0);
      if (d > 0) leadCount++;
      deltaSum += d;
      if (d > maxDelta) {
        maxDelta = d;
        maxDeltaName = name;
      }
    });
    const avgDelta = Math.round(deltaSum / axes.length);
    const diffIdx = avgDelta >= 12 ? '高' : avgDelta >= 6 ? '中' : '低';
    const diffCls = avgDelta >= 12 ? 'is-high' : avgDelta >= 6 ? 'is-mid' : 'is-low';
    const maxLabel =
      maxDeltaName.length > 9 ? maxDeltaName.slice(0, 8) + '…' : maxDeltaName;
    const order = axes
      .map((name, i) => ({
        name,
        job: Number(job[i]) || 0,
        avg: Number(avg[i]) || 0,
        delta: (Number(job[i]) || 0) - (Number(avg[i]) || 0)
      }))
      .sort((a, b) => b.delta - a.delta);
    const lanes = order
      .map((row, idx) => {
        const deltaCls = row.delta >= 10 ? 'is-strong' : row.delta >= 4 ? 'is-mid' : 'is-flat';
        const deltaTxt = row.delta > 0 ? '+' + row.delta : String(row.delta);
        const leadCls = idx === 0 && row.delta >= 10 ? ' is-lead' : '';
        return (
          '<div class="dd-cmp-lane' +
          leadCls +
          '" role="listitem">' +
          '<span class="dd-cmp-lane-name" title="' +
          esc(row.name) +
          '">' +
          esc(row.name) +
          '</span>' +
          '<div class="dd-cmp-lane-track" aria-hidden="true">' +
          '<span class="dd-cmp-lane-grid"></span>' +
          '<span class="bar is-ind" data-w="' +
          row.avg +
          '%"></span>' +
          '<span class="bar is-job" data-w="' +
          row.job +
          '%"></span></div>' +
          '<div class="dd-cmp-lane-meta">' +
          '<span class="score is-ind"><em>业</em><b>' +
          row.avg +
          '</b></span>' +
          '<span class="score is-job"><em>本</em><b>' +
          row.job +
          '</b></span>' +
          '<span class="delta ' +
          deltaCls +
          '">' +
          deltaTxt +
          '</span></div></div>'
        );
      })
      .join('');
    el.innerHTML =
      '<div class="dd-ind-cmp">' +
      '<div class="dd-ind-summary">' +
      '<div class="dd-ind-kpi"><span>领先维度</span><strong>' +
      leadCount +
      '/' +
      axes.length +
      '</strong></div>' +
      '<div class="dd-ind-kpi"><span>平均领先</span><strong class="is-gold">+' +
      avgDelta +
      '</strong></div>' +
      '<div class="dd-ind-kpi"><span>最强差值</span><strong>' +
      esc(maxLabel) +
      ' +' +
      maxDelta +
      '</strong></div>' +
      '<div class="dd-ind-kpi ' +
      diffCls +
      '"><span>差异化</span><strong>' +
      diffIdx +
      '</strong></div></div>' +
      '<div class="dd-cmp-lanes-wrap" aria-label="蓝条行业均值，金条本岗位，按领先幅度排序">' +
      '<div class="dd-cmp-lanes" role="list" data-count="' +
      order.length +
      '" style="--cmp-count:' +
      order.length +
      '">' +
      lanes +
      '</div></div></div>';
    requestAnimationFrame(() => {
      animateCmpLanes();
      resizeFoundCharts();
    });
  }

  function paintGraphDetail(item) {
    const detailEl = document.getElementById('dd-found-graph-detail');
    if (!detailEl || !item) return;
    detailEl.classList.add('is-active');
    detailEl.innerHTML =
      '<div class="dd-graph-detail-inner">' +
      '<p class="dd-graph-detail-note">' +
      esc(item.note || '能力路径重叠') +
      '</p>' +
      '<p class="dd-graph-detail-stats">' +
      '跃迁样本 <b>' +
      item.count +
      '</b> 人 · 能力重叠 <b>' +
      item.overlap +
      '</b> · 排名 <b>#' +
      String(item.rank).padStart(2, '0') +
      '</b></p></div>';
  }

  function selectGraphSlice(idx) {
    const data = graphSourceCache;
    if (!data[idx]) return;
    highlightGraphSlice(idx);
    paintGraphDetail(data[idx]);
    const listEl = document.getElementById('dd-found-graph-legend');
    if (listEl) {
      listEl.querySelectorAll('.dd-graph-leg-item').forEach((btn, i) => {
        btn.classList.toggle('is-active', i === idx);
      });
    }
  }

  function renderGraphLegend(data) {
    const listEl = document.getElementById('dd-found-graph-legend');
    if (!listEl) return;
    listEl.style.setProperty('--graph-count', String(data.length || 1));
    listEl.innerHTML = data
      .map(
        (d, i) =>
          '<li><button type="button" class="dd-graph-leg-item' +
          (i === 0 ? ' is-active' : '') +
          '" data-idx="' +
          i +
          '">' +
          '<i class="sw" style="background:' +
          GRAPH_PIE_COLORS[i % GRAPH_PIE_COLORS.length] +
          '"></i>' +
          '<span class="name">' +
          esc(d.name) +
          '</span>' +
          '<span class="pct">' +
          d.value +
          '%</span></button></li>'
      )
      .join('');
    if (!listEl.dataset.bound) {
      listEl.dataset.bound = '1';
      listEl.addEventListener('mouseover', (e) => {
        const btn = e.target.closest('.dd-graph-leg-item');
        if (!btn) return;
        selectGraphSlice(+btn.dataset.idx);
      });
    }
  }

  function graphPieLayout() {
    const el = document.getElementById('dd-found-graph');
    if (!el) return { center: [54, 54], radius: 46 };
    const w = el.clientWidth || 108;
    const h = el.clientHeight || 108;
    const pad = 3;
    const maxR = Math.max(36, Math.min(w - pad * 2, h - pad * 2) / 2);
    return { center: [w / 2, h / 2], radius: maxR };
  }

  function applyGraphPieLayout() {
    const el = document.getElementById('dd-found-graph');
    const host = el && el.closest('.dd-graph-pie-host');
    if (host && el) {
      const size = Math.floor(Math.min(host.clientWidth - 10, host.clientHeight - 10, 152));
      if (size >= 88) {
        el.style.width = size + 'px';
        el.style.height = size + 'px';
      }
    }
    if (!graphChart) return;
    graphChart.resize();
    const layout = graphPieLayout();
    graphChart.setOption({
      series: [{ center: layout.center, radius: layout.radius }]
    });
  }

  function highlightGraphSlice(idx) {
    if (!graphChart) return;
    graphChart.dispatchAction({ type: 'downplay', seriesIndex: 0 });
    graphChart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: idx });
  }

  function bindGraphChartEvents() {
    if (!graphChart) return;
    graphChart.off('mouseover');
    graphChart.on('mouseover', (p) => {
      if (p.seriesType !== 'pie') return;
      selectGraphSlice(p.dataIndex);
    });
  }

  function renderFoundGraph() {
    const el = document.getElementById('dd-found-graph');
    const detailEl = document.getElementById('dd-found-graph-detail');
    const listEl = document.getElementById('dd-found-graph-legend');
    if (!el || !window.echarts || !currentJob) return;
    const data = graphSourceData();
    graphSourceCache = data;
    if (!data.length) {
      el.innerHTML = '<p class="dd-graph-empty">暂无来源路径数据</p>';
      if (listEl) listEl.innerHTML = '';
      if (detailEl) {
        detailEl.classList.remove('is-active');
        detailEl.innerHTML = '<p class="dd-graph-detail-hint">暂无来源数据</p>';
      }
      return;
    }
    renderGraphLegend(data);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!graphChart) graphChart = window.echarts.init(el);
    const layout = graphPieLayout();
    graphChart.setOption({
      backgroundColor: 'transparent',
      color: GRAPH_PIE_COLORS,
      animationDuration: reduced ? 0 : 680,
      animationEasing: 'cubicOut',
      tooltip: { show: false },
      legend: { show: false },
      series: [
        {
          name: '来源占比',
          type: 'pie',
          center: layout.center,
          radius: layout.radius,
          padAngle: 2,
          itemStyle: {
            borderRadius: 3,
            borderColor: 'rgba(6,10,16,0.95)',
            borderWidth: 2
          },
          label: { show: false },
          labelLine: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 4,
            itemStyle: {
              shadowBlur: 12,
              shadowColor: 'rgba(212,176,122,0.38)'
            }
          },
          data: data
        }
      ]
    }, true);
    bindGraphChartEvents();
    selectGraphSlice(0);
    resizeFoundCharts();
  }

  /* ---------- Forecast unified gold board ---------- */
  function levelTone(lv) {
    if (lv === '极高') return 'is-extreme';
    if (lv === '高') return 'is-high';
    if (lv === '中') return 'is-mid';
    return 'is-low';
  }

  function dutyEls(lane) {
    const p = lane === 'fc' ? 'dd-fc' : 'dd-found';
    return {
      shell: document.getElementById(p + '-duties-shell'),
      viewport: document.getElementById(p + '-duties-viewport'),
      track: document.getElementById(p + '-duties'),
      toggle: document.getElementById(p + '-duties-toggle')
    };
  }

  function clearDutyTimers() {
    ['fc', 'found'].forEach((lane) => {
      const st = dutyLanes[lane];
      if (st.timer) {
        clearInterval(st.timer);
        st.timer = null;
      }
    });
  }

  function dutyScore(lane, i) {
    const d = dutyLanes[lane].data;
    return d.scores[i] != null ? d.scores[i] : Math.max(62, 91 - i * 3);
  }

  function dutyItemHtml(lane, d, rankIndex) {
    return (
      '<li class="dd-fc-duty-item">' +
      '<span class="num">' +
      String(rankIndex + 1).padStart(2, '0') +
      '</span>' +
      '<span class="txt">' +
      esc(d) +
      '</span>' +
      '<span class="pct">' +
      dutyScore(lane, rankIndex) +
      '%</span></li>'
    );
  }

  function resetDutyTrackMotion(lane) {
    const { track } = dutyEls(lane);
    if (track && window.gsap) window.gsap.killTweensOf(track);
    if (track) {
      track.style.transform = '';
      if (window.gsap) window.gsap.set(track, { y: 0 });
    }
  }

  function syncDutyViewportHeight(lane) {
    const { viewport, shell } = dutyEls(lane);
    const st = dutyLanes[lane];
    if (!viewport) return;
    const gap = 4;
    st.rowHeight = 28 + gap;
    if (st.expanded) {
      viewport.style.removeProperty('height');
      viewport.style.maxHeight = 'min(176px, 30vh)';
    } else if ((lane === 'found' || lane === 'fc') && shell) {
      const { toggle } = dutyEls(lane);
      const toggleH =
        toggle && !toggle.hidden && !st.expanded
          ? Math.max(16, toggle.offsetHeight) + 4
          : 0;
      if (lane === 'fc') {
        viewport.style.removeProperty('height');
        viewport.style.removeProperty('max-height');
        viewport.style.flex = '1 1 0';
        void shell.offsetHeight;
      }
      const avail = Math.max(
        92,
        lane === 'fc' ? viewport.clientHeight || shell.clientHeight - toggleH : shell.clientHeight - toggleH
      );
      const minRow = lane === 'fc' ? 30 : 28;
      const maxVis = lane === 'fc' ? 5 : 3;
      const vis = Math.max(3, Math.min(maxVis, Math.floor((avail + gap) / (minRow + gap))));
      st.visibleRows = vis;
      const rowH = Math.max(minRow, Math.floor((avail - gap * (vis - 1)) / vis));
      st.rowHeight = rowH + gap;
      shell.style.setProperty('--dd-duty-row-h', rowH + 'px');
      if (lane !== 'fc') {
        const exactH = rowH * vis + gap * (vis - 1);
        viewport.style.height = exactH + 'px';
        viewport.style.maxHeight = exactH + 'px';
      }
      const track = viewport.querySelector('.dd-fc-duties-track');
      if (track) {
        track.querySelectorAll('.dd-fc-duty-item').forEach((el) => {
          el.style.setProperty('height', rowH + 'px', 'important');
          el.style.setProperty('min-height', rowH + 'px', 'important');
          el.style.setProperty('max-height', rowH + 'px', 'important');
        });
      }
    } else {
      viewport.style.height = '92px';
      viewport.style.maxHeight = '92px';
      st.visibleRows = 3;
    }
  }

  function layoutFcRow() {
    const st = dutyLanes.fc;
    const prevRows = st.visibleRows;
    const prevRowH = st.rowHeight;
    syncDutyViewportHeight('fc');
    if (!st.expanded && (st.visibleRows !== prevRows || st.rowHeight !== prevRowH)) {
      buildDutyCarousel('fc');
      st.slideIndex = 0;
      applyDutySlide('fc', false);
    }
    resizeFcCharts();
  }

  function applyDutySlide(lane, animate) {
    const st = dutyLanes[lane];
    const { track } = dutyEls(lane);
    if (!track || st.expanded) return;
    const n = st.data.duties.length;
    if (n <= dutyVisibleRows(lane)) return;
    const y = -st.slideIndex * st.rowHeight;
    if (animate && window.gsap) {
      window.gsap.to(track, {
        y: y,
        duration: 0.62,
        ease: 'power2.inOut',
        onComplete: () => {
          if (st.slideIndex >= n) {
            st.slideIndex = 0;
            window.gsap.set(track, { y: 0 });
          }
        }
      });
    } else if (window.gsap) {
      window.gsap.set(track, { y: y });
    } else {
      track.style.transform = 'translate3d(0,' + y + 'px,0)';
    }
  }

  function buildDutyCarousel(lane) {
    const st = dutyLanes[lane];
    const { track, viewport } = dutyEls(lane);
    if (!track) return;
    resetDutyTrackMotion(lane);
    const n = st.data.duties.length;
    const vis = dutyVisibleRows(lane);
    const main = st.data.duties.map((d, i) => dutyItemHtml(lane, d, i)).join('');
    const clone =
      n > vis
        ? st.data.duties
            .slice(0, vis)
            .map((d, i) => dutyItemHtml(lane, d, i))
            .join('')
        : '';
    track.innerHTML = main + clone;
    st.slideIndex = 0;
    if (viewport) {
      viewport.style.height = '';
      viewport.style.maxHeight = '';
    }
    requestAnimationFrame(() => {
      syncDutyViewportHeight(lane);
      const { track } = dutyEls(lane);
      const first = track && track.querySelector('.dd-fc-duty-item');
      if (first && !st.expanded) {
        const gap = 4;
        st.rowHeight = Math.max(st.rowHeight, first.offsetHeight + gap);
      }
      applyDutySlide(lane, false);
    });
  }

  function buildDutyExpanded(lane) {
    const st = dutyLanes[lane];
    const { track } = dutyEls(lane);
    if (!track) return;
    resetDutyTrackMotion(lane);
    track.innerHTML = st.data.duties.map((d, i) => dutyItemHtml(lane, d, i)).join('');
    requestAnimationFrame(() => syncDutyViewportHeight(lane));
  }

  function slideDutyOnce(lane) {
    const st = dutyLanes[lane];
    if (st.expanded || st.data.duties.length <= dutyVisibleRows(lane)) return;
    st.slideIndex += 1;
    applyDutySlide(lane, true);
  }

  function renderDutyView(lane) {
    const st = dutyLanes[lane];
    if (st.expanded) buildDutyExpanded(lane);
    else buildDutyCarousel(lane);
  }

  function syncDutyUi(lane) {
    const st = dutyLanes[lane];
    const { shell, toggle } = dutyEls(lane);
    const n = st.data.duties.length;
    if (shell) shell.classList.toggle('is-expanded', st.expanded);
    if (toggle) {
      toggle.hidden = n <= dutyVisibleRows(lane);
      toggle.textContent = st.expanded ? '收起' : '查看全部';
    }
  }

  function startDutyCarousel(lane) {
    const st = dutyLanes[lane];
    if (st.timer) {
      clearInterval(st.timer);
      st.timer = null;
    }
    if (st.expanded || st.data.duties.length <= dutyVisibleRows(lane)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    st.timer = setInterval(() => slideDutyOnce(lane), 3000);
  }

  function setDutyExpanded(lane, on) {
    const st = dutyLanes[lane];
    st.expanded = !!on;
    if (st.expanded && st.timer) {
      clearInterval(st.timer);
      st.timer = null;
    }
    syncDutyUi(lane);
    renderDutyView(lane);
    if (!st.expanded) startDutyCarousel(lane);
  }

  function mountDuties(lane, job) {
    const duties = (job.duties || []).filter(Boolean);
    const scores = duties.map((_, i) =>
      job.dutyScores && job.dutyScores[i] != null
        ? job.dutyScores[i]
        : Math.max(62, 91 - i * 3)
    );
    const st = dutyLanes[lane];
    st.data = { duties, scores };
    st.slideIndex = 0;
    st.expanded = false;
    syncDutyUi(lane);
    renderDutyView(lane);
  }

  function bindDutiesOnce() {
    ['fc', 'found'].forEach((lane) => {
      const { toggle } = dutyEls(lane);
      if (!toggle || toggle._dutyBound) return;
      toggle._dutyBound = true;
      toggle.addEventListener('click', () => {
        const st = dutyLanes[lane];
        setDutyExpanded(lane, !st.expanded);
      });
    });
  }

  function skillHeatTier(score) {
    const n = Number(score) || 0;
    if (n >= 85) return 'is-hot';
    if (n >= 72) return 'is-warm';
    return 'is-cool';
  }

  function renderFoundSkills(job) {
    renderSkillConstellation('dd-found-skills', job);
  }

  function renderSkillConstellation(rootId, job) {
    const skillsEl = document.getElementById(rootId);
    if (!skillsEl || !job) return;
    const list = (job.skillScores || []).slice();
    if (!list.length) {
      skillsEl.innerHTML = '<p class="dd-skill-empty">暂无核心能力数据</p>';
      return;
    }
    const rows = Math.max(1, Math.ceil(list.length / 2));
    const items = list
      .map((s, i) => {
        const rank = i + 1;
        const tier = skillHeatTier(s.score);
        return (
          '<li class="dd-skill-item ' +
          tier +
          '" role="listitem" title="' +
          esc(s.name) +
          ' · 需求热度 ' +
          s.score +
          '%">' +
          '<div class="dd-skill-head">' +
          '<em>' +
          String(rank).padStart(2, '0') +
          '</em>' +
          '<span class="nm">' +
          esc(s.name) +
          '</span>' +
          '<b data-heat="' +
          s.score +
          '">0</b>' +
          '</div>' +
          '<div class="dd-skill-track" aria-hidden="true">' +
          '<span class="dd-skill-fill" data-w="' +
          s.score +
          '%"></span>' +
          '</div></li>'
        );
      })
      .join('');
    skillsEl.innerHTML =
      '<div class="dd-skill-ambient" aria-hidden="true">' +
      '<span class="dd-skill-orb is-gold"></span>' +
      '<span class="dd-skill-floor"></span></div>' +
      '<ul class="dd-skill-list" role="list" data-count="' +
      list.length +
      '" style="--skill-rows:' +
      rows +
      '">' +
      items +
      '</ul>';
  }

  function animateSkillConstellation(rootId) {
    const root = document.getElementById(rootId || 'dd-found-skills');
    if (!root) return;
    const items = root.querySelectorAll('.dd-skill-item');
    const scores = root.querySelectorAll('.dd-skill-item b[data-heat]');
    const fills = root.querySelectorAll('.dd-skill-item .dd-skill-fill[data-w]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || !window.gsap) {
      scores.forEach((el) => {
        el.textContent = String(el.getAttribute('data-heat') || 0);
      });
      fills.forEach((f) => {
        f.style.width = f.getAttribute('data-w') || '0%';
      });
      return;
    }

    scores.forEach((el) => {
      el.textContent = '0';
    });
    fills.forEach((f) => {
      f.style.width = '0%';
    });

    window.gsap.from(items, {
      opacity: 0,
      y: 14,
      x: -10,
      duration: 0.62,
      stagger: 0.045,
      delay: 0.38,
      ease: 'power3.out',
      clearProps: 'opacity,transform'
    });

    scores.forEach((el, i) => {
      const target = Number(el.getAttribute('data-heat')) || 0;
      const proxy = { v: 0 };
      window.gsap.to(proxy, {
        v: target,
        duration: 0.92,
        ease: 'power2.out',
        delay: 0.46 + i * 0.042,
        onUpdate() {
          el.textContent = String(Math.round(proxy.v));
        }
      });
    });

    fills.forEach((f, i) => {
      const w = f.getAttribute('data-w') || '0%';
      window.gsap.fromTo(
        f,
        { width: '0%' },
        {
          width: w,
          duration: 1.05,
          ease: 'power2.out',
          delay: 0.5 + i * 0.042
        }
      );
    });
  }

  function animateSkillBars(root) {
    if (!root) return;
    const bars = root.querySelectorAll('b[data-w]');
    if (!bars.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bars.forEach((b, i) => {
      const w = b.getAttribute('data-w') + '%';
      if (reduced || !window.gsap) {
        b.style.width = w;
        return;
      }
      window.gsap.fromTo(
        b,
        { width: '0%' },
        { width: w, duration: 0.72, ease: 'power2.out', delay: 0.04 * i }
      );
    });
  }

  function renderForecast(job) {
    clearDutyTimers();
    const found = document.getElementById('dd-found');
    const forecast = document.getElementById('dd-forecast-shell');
    if (found) found.hidden = true;
    if (forecast) forecast.hidden = false;

    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };

    const title =
      (job.title || '预测岗位') +
      (String(job.title || '').indexOf('预测') >= 0 ? '' : ' (预测)');
    set('dd-fc-title', title);
    set('dd-fc-conf', job.conf + '%');
    fillVerdict(job);
    syncFavButtons(job);

    const meta = document.getElementById('dd-fc-meta');
    if (meta) {
      meta.innerHTML =
        '<span><em>预计出现时间</em> ' +
        esc(job.windowLabel || job.etaDisplay) +
        '</span>' +
        '<span class="sep" aria-hidden="true">|</span>' +
        '<span><em>演化来源</em> ' +
        esc((job.fromRoles && job.fromRoles[0]) || '相邻岗位') +
        ' 等 ' +
        (job.evolveCount || 7) +
        ' 个岗位</span>' +
        '<span class="sep" aria-hidden="true">|</span>' +
        '<span><em>推演联盟</em> ' +
        esc(job.alliance) +
        '</span>';
    }

    const basics = document.getElementById('dd-fc-basics');
    if (basics) {
      basics.innerHTML = [
        ['岗位类别', job.direction],
        ['所属行业', job.industry],
        ['岗位层级', job.levelDisplay],
        ['预计窗口', job.windowLabel || job.etaDisplay],
        ['薪资范围', job.salaryDisplay]
      ]
        .map(
          (row) =>
            '<div><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>'
        )
        .join('');
    }
    set('dd-fc-brief', job.brief || job.positioning || '');

    renderSkillConstellation('dd-fc-skills', job);

    mountDuties('fc', job);
    bindDutiesOnce();
    startDutyCarousel('fc');

    set('dd-fc-risk-lead', job.riskLead || '—');
    const riskList = document.getElementById('dd-fc-risk-list');
    if (riskList) {
      const risks = job.risks || [];
      const tags = ['观测', '政策', '路径', '窗口'];
      riskList.className = 'dd-fc-risk-cards';
      riskList.innerHTML = risks
        .map((r, i) => {
          const sev = i === 0 ? 'is-watch' : i === 1 ? 'is-policy' : 'is-path';
          return (
            '<li class="dd-fc-risk-card ' +
            sev +
            '">' +
            '<span class="dd-fc-risk-tag">' +
            esc(tags[i] || '风险') +
            '</span>' +
            '<p>' +
            esc(r) +
            '</p></li>'
          );
        })
        .join('');
    }

    renderFcSankey();
    renderFcProb();
    renderFcIndustry();
    renderFcSupply();
    requestAnimationFrame(() => {
      layoutFcRow();
      setTimeout(layoutFcRow, 80);
    });
  }

  function disposeFcCharts() {
    try {
      if (fcProbChart) {
        fcProbChart.dispose();
        fcProbChart = null;
      }
      if (fcSupplyChart) {
        fcSupplyChart.dispose();
        fcSupplyChart = null;
      }
    } catch (_) {}
  }

  function resizeFcCharts() {
    requestAnimationFrame(() => {
      try {
        fcProbChart && fcProbChart.resize();
        fcSupplyChart && fcSupplyChart.resize();
      } catch (_) {}
    });
  }

  function renderFcSankey() {
    const el = document.getElementById('dd-fc-sankey');
    if (!el || !currentJob) return;
    const sources = (currentJob.fromRoles || []).slice(0, 6);
    const fusions = currentJob.fusionSkills || ['多智能体编排', 'LLMOps', '安全治理', '企业集成'];
    const target = (currentJob.title || '预测岗位').replace(/\s*\(预测\)\s*$/, '');
    el.innerHTML =
      '<div class="dd-flow-col">' +
      '<span class="dd-flow-h">已有岗位</span>' +
      sources.map((s) => '<span class="dd-flow-pill">' + esc(s) + '</span>').join('') +
      '</div>' +
      '<div class="dd-flow-arrow" aria-hidden="true"><span></span></div>' +
      '<div class="dd-flow-col is-mid">' +
      '<span class="dd-flow-h">能力交汇</span>' +
      fusions.map((s) => '<span class="dd-flow-pill is-fuse">' + esc(s) + '</span>').join('') +
      '</div>' +
      '<div class="dd-flow-arrow" aria-hidden="true"><span></span></div>' +
      '<div class="dd-flow-col is-end">' +
      '<span class="dd-flow-h">预测岗位</span>' +
      '<div class="dd-flow-target"><strong>' +
      esc(target) +
      '</strong><em>能力组合尚未固化为稳定招聘标题</em></div>' +
      '</div>';
  }

  function renderFcIndustry() {
    const el = document.getElementById('dd-fc-industry-chart');
    if (!el || !currentJob) return;
    const list = (currentJob.industries || []).slice().sort((a, b) => b.value - a.value);
    const max = Math.max.apply(
      null,
      list.map((d) => d.value).concat([1])
    );
    const top = list[0];
    const cover = list.slice(0, 3).reduce((s, d) => s + d.value, 0);
    el.innerHTML =
      '<div class="dd-fc-ind-summary">' +
      '<div class="dd-fc-ind-kpi"><span>主落地</span><strong>' +
      esc(top ? top.name : '—') +
      '</strong></div>' +
      '<div class="dd-fc-ind-kpi"><span>前三覆盖</span><strong class="is-gold">' +
      cover +
      '%</strong></div></div>' +
      '<ul class="dd-share-grid is-fc-ind" role="list" style="--share-rows:' +
      Math.max(1, Math.ceil(list.length / 2)) +
      '">' +
      list
        .map((d, i) => {
          const pct = Math.round((d.value / max) * 100);
          return (
            '<li class="dd-share-card' +
            (i === 0 ? ' is-lead' : '') +
            '" role="listitem">' +
            '<div class="dd-share-card-head">' +
            '<em>' +
            String(i + 1).padStart(2, '0') +
            '</em>' +
            '<span class="n">' +
            esc(d.name) +
            '</span>' +
            '<b>' +
            d.value +
            '%</b></div>' +
            '<div class="dd-skill-track" aria-hidden="true">' +
            '<span class="dd-skill-fill" style="width:' +
            pct +
            '%"></span></div></li>'
          );
        })
        .join('') +
      '</ul>';
  }

  function renderFcProb() {
    const el = document.getElementById('dd-fc-prob-chart');
    if (!el || !window.echarts) return;
    const labels = ['3月', '6月', '9月', '12月', '18月', '24月'];
    const data = [18, 32, 48, 66, 84, 96];
    const lastIdx = data.length - 1;
    const badge = document.getElementById('dd-fc-prob-badge');
    if (badge) {
      badge.textContent = '窗口抬升 ↑' + (data[lastIdx] - data[0]) + '%';
      badge.classList.add('is-surge');
    }
    if (!fcProbChart) fcProbChart = window.echarts.init(el);
    fcProbChart.setOption({
      backgroundColor: 'transparent',
      animationDuration: 980,
      animationEasing: 'cubicOut',
      grid: { left: 34, right: 12, top: 12, bottom: 18 },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.12)' }
        },
        backgroundColor: 'rgba(10,14,20,0.94)',
        borderColor: 'rgba(212,176,122,0.25)',
        textStyle: { color: '#e8f2f8', fontSize: 11 },
        formatter(params) {
          if (!params || !params.length) return '';
          const idx = params[0].dataIndex;
          return (
            labels[idx] +
            '<br/><span style="color:#e8c988">● 出现概率 ' +
            data[idx] +
            '%</span>'
          );
        }
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: true,
        axisLabel: { color: 'rgba(232,242,248,0.55)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(212,176,122,0.22)' } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        max: 100,
        splitNumber: 3,
        axisLabel: {
          color: 'rgba(232,201,136,0.58)',
          fontSize: 9,
          formatter: '{value}%'
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [
        {
          name: '出现概率',
          type: 'bar',
          data,
          barWidth: '48%',
          barCategoryGap: '28%',
          animationDelay(idx) {
            return idx * 70 + 220;
          },
          itemStyle: {
            borderRadius: [5, 5, 2, 2],
            borderWidth: 1,
            borderColor: 'rgba(255,240,200,0.32)',
            color(p) {
              const isLast = p.dataIndex === lastIdx;
              return {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: isLast
                  ? [
                      { offset: 0, color: '#fff8dc' },
                      { offset: 0.45, color: '#f0d080' },
                      { offset: 1, color: '#a87830' }
                    ]
                  : [
                      { offset: 0, color: 'rgba(232,201,136,0.88)' },
                      { offset: 1, color: 'rgba(168,120,48,0.55)' }
                    ]
              };
            }
          }
        },
        {
          name: '抬升轨迹',
          type: 'line',
          data,
          smooth: 0.35,
          symbol: 'circle',
          symbolSize(_v, p) {
            return p.dataIndex === lastIdx ? 7 : 0;
          },
          showSymbol: true,
          lineStyle: { width: 2, color: '#7ec8f0' },
          itemStyle: {
            color: '#0c1218',
            borderColor: '#9ad8f5',
            borderWidth: 2
          },
          z: 5
        }
      ]
    }, true);
    resizeFcCharts();
  }

  function renderFcSupply() {
    const el = document.getElementById('dd-fc-supply-chart');
    if (!el || !window.echarts) return;
    const labels = ['0', '6', '12', '18', '24', '30', '36月'];
    const demand = [22, 34, 48, 62, 78, 90, 100];
    const supply = [20, 26, 32, 38, 44, 50, 56];
    const lastIdx = demand.length - 1;
    const gap = demand[lastIdx] - supply[lastIdx];
    if (!fcSupplyChart) fcSupplyChart = window.echarts.init(el);
    fcSupplyChart.setOption({
      backgroundColor: 'transparent',
      animationDuration: 980,
      animationEasing: 'cubicOut',
      legend: { show: false },
      grid: { left: 32, right: 12, top: 14, bottom: 18 },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.12)' }
        },
        backgroundColor: 'rgba(10,14,20,0.94)',
        borderColor: 'rgba(212,176,122,0.25)',
        textStyle: { color: '#e8f2f8', fontSize: 11 },
        formatter(params) {
          if (!params || !params.length) return '';
          const idx = params[0].dataIndex;
          return (
            labels[idx] +
            '<br/><span style="color:#e8c988">● 需求预测 ' +
            demand[idx] +
            '</span><br/><span style="color:#7ec8f0">● 供给预测 ' +
            supply[idx] +
            '</span><br/><span style="color:#f0a35a">△ 缺口 ' +
            (demand[idx] - supply[idx]) +
            '</span>'
          );
        }
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: true,
        axisLabel: { color: 'rgba(232,242,248,0.55)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(212,176,122,0.22)' } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        splitNumber: 3,
        axisLabel: { color: 'rgba(232,201,136,0.58)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [
        {
          name: '需求预测',
          type: 'bar',
          data: demand,
          barWidth: '42%',
          barCategoryGap: '30%',
          animationDelay(idx) {
            return idx * 60 + 180;
          },
          itemStyle: {
            borderRadius: [5, 5, 2, 2],
            borderWidth: 1,
            borderColor: 'rgba(255,240,200,0.28)',
            color(p) {
              const isLast = p.dataIndex === lastIdx;
              return {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: isLast
                  ? [
                      { offset: 0, color: '#fff8dc' },
                      { offset: 0.5, color: '#e8c988' },
                      { offset: 1, color: '#9a7028' }
                    ]
                  : [
                      { offset: 0, color: 'rgba(232,201,136,0.78)' },
                      { offset: 1, color: 'rgba(154,112,40,0.48)' }
                    ]
              };
            }
          }
        },
        {
          name: '供给预测',
          type: 'line',
          data: supply,
          smooth: 0.35,
          symbol: 'circle',
          symbolSize: 5,
          showSymbol: true,
          lineStyle: { width: 2.2, color: '#7ec8f0' },
          itemStyle: {
            color: '#0c1218',
            borderColor: '#9ad8f5',
            borderWidth: 1.5
          },
          markPoint: {
            symbol: 'circle',
            symbolSize: 1,
            label: {
              show: true,
              formatter: '缺口 ' + gap,
              color: '#f0a35a',
              fontSize: 10,
              fontWeight: 700,
              backgroundColor: 'rgba(10,14,20,0.82)',
              borderColor: 'rgba(240,163,90,0.35)',
              borderWidth: 1,
              borderRadius: 4,
              padding: [3, 6]
            },
            data: [{ coord: [labels[lastIdx], demand[lastIdx]], name: 'gap' }]
          },
          z: 5
        }
      ]
    }, true);
    resizeFcCharts();
  }

  function getResumeReport() {
    try {
      const raw = sessionStorage.getItem('zhitu_resume_report');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {
      name: '我的简历报告',
      version: 'v2 · AI算法求职简历',
      score: 88,
      skills: [
        { name: '大模型应用', level: 78 },
        { name: 'RAG 工程', level: 74 },
        { name: 'Python 开发', level: 86 },
        { name: '系统架构', level: 62 },
        { name: '多智能体协同', level: 48 },
        { name: 'LLMOps', level: 40 },
        { name: '安全与治理', level: 35 },
        { name: '企业系统集成', level: 55 }
      ]
    };
  }

  function openResumeCompare() {
    if (!currentJob) return;
    const modal = document.getElementById('dd-resume-modal');
    const body = document.getElementById('dd-resume-body');
    const sub = document.getElementById('dd-resume-sub');
    const titleEl = document.getElementById('dd-resume-title');
    if (!modal || !body) return;
    const resume = getResumeReport();
    const laneTag = currentJob.isForecast ? '预测岗位' : '真实发现岗位';
    if (titleEl) titleEl.textContent = '与我的简历报告对比';
    if (sub) {
      sub.textContent =
        resume.version +
        ' · 对照「' +
        (currentJob.title || '') +
        '」· ' +
        laneTag;
    }

    const scored = (currentJob.skillScores || []).slice(0, 8).map((js) => {
      const hit = (resume.skills || []).find(
        (r) =>
          r.name === js.name ||
          js.name.indexOf(r.name) >= 0 ||
          r.name.indexOf(js.name.slice(0, 3)) >= 0
      );
      const mine = hit ? hit.level : Math.max(20, Math.round(js.score * 0.45));
      const gap = Math.max(0, js.score - mine);
      return { ...js, mine, gap };
    });
    scored.sort((a, b) => b.gap - a.gap);
    const priority = scored.filter((s) => s.gap > 12).slice(0, 3);

    const rows = scored
      .map((js) => {
        const fit = js.gap <= 12 ? '匹配较好' : js.gap <= 28 ? '需补强' : '缺口较大';
        const tone = js.gap <= 12 ? 'is-ok' : js.gap <= 28 ? 'is-warn' : 'is-gap';
        const pri =
          priority.some((p) => p.name === js.name) ?
            '<em class="dd-pri">优先</em>'
          : '';
        return (
          '<div class="dd-resume-row ' +
          tone +
          '"><span class="sk">' +
          pri +
          esc(js.name) +
          '</span><span class="need">岗位 ' +
          js.score +
          '</span><span class="have">简历 ' +
          js.mine +
          '</span><span class="gap">差距 ' +
          js.gap +
          '</span><span class="fit">' +
          fit +
          '</span></div>'
        );
      })
      .join('');

    const matched = scored.filter((s) => s.gap <= 12).length;
    const fitScore = Math.round(
      40 + (matched / Math.max(1, scored.length)) * 45 + resume.score * 0.12
    );

    const priHtml =
      priority.length ?
        '<div class="dd-resume-pri"><span class="lab">建议先补</span>' +
        priority
          .map((p) => '<span class="dd-chip-mini is-gap">' + esc(p.name) + '</span>')
          .join('') +
        '</div>'
      : '<div class="dd-resume-pri is-ok"><span class="lab">当前缺口可控</span><span>可先收藏观察，再按需深挖。</span></div>';

    body.innerHTML =
      '<div class="dd-resume-score"><strong>' +
      fitScore +
      '</strong><span>相对该岗位的适合度（基于简历报告能力画像）</span></div>' +
      priHtml +
      '<div class="dd-resume-cols"><span>能力</span><span>岗位需求</span><span>简历报告</span><span>差距</span><span>结论</span></div>' +
      '<div class="dd-resume-list">' +
      rows +
      '</div>' +
      '<p class="dd-resume-note">对比用于辅助决策，不是录用结论。完善人岗匹配中的简历后，适合度会更准。</p>';

    modal.hidden = false;
    document.body.classList.add('dd-modal-open');
    document.getElementById('dd-resume-match-cta')?.focus?.();
  }

  function closeResumeCompare() {
    const modal = document.getElementById('dd-resume-modal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('dd-modal-open');
  }

  function render(job) {
    currentJob = job;
    const page = document.getElementById('view-discovery-detail');
    page?.classList.toggle('is-forecast', !!job.isForecast);
    page?.classList.toggle('is-found', !job.isForecast);

    document.title =
      '执图破局 · ' + (job.title || '') + (job.isForecast ? ' · 预测详情' : ' · 岗位详情');

    try {
      sessionStorage.setItem('zhitu_disc_lane', job.isForecast ? 'forecast' : 'found');
    } catch (_) {}

    if (job.isForecast) renderForecast(job);
    else renderFoundBoard(job);
    window.DiscoveryFavs &&
      window.DiscoveryFavs.initBar({ activeId: job.id });
    if (job.isForecast) requestAnimationFrame(() => runDetailMotion(true));
    else requestAnimationFrame(() => runFoundMotion());
  }

  function runDetailMotion(isForecast) {
    if (!window.gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      window.gsap.from('.dd-back-bubble', {
        opacity: 0,
        x: -14,
        duration: 0.58,
        ease: 'power2.out',
        clearProps: 'opacity,transform'
      });
      const boardSel = isForecast ? '#dd-fc-board' : '#dd-found-board';
      const board = document.querySelector(boardSel);
      const panelSel = isForecast
        ? '.dd-fc-hero, .dd-verdict--fc, #dd-fc-board .dd-fc-panel'
        : '.dd-found-hero, #dd-found-verdict, #dd-found-board .dd-panel';
      window.gsap.from(panelSel, {
        opacity: 0,
        y: 16,
        duration: 0.72,
        stagger: 0.045,
        ease: 'power3.out',
        clearProps: 'opacity,transform'
      });
      if (board) {
        const inner = board.querySelectorAll(
          '.dd-fc-duty-item, .dd-cmp-row, .dd-rel-step, .dd-share-card, .dd-share-row, .dd-supply-item, .dd-flow-pill'
        );
        if (inner.length) {
          window.gsap.from(inner, {
            opacity: 0,
            x: -10,
            duration: 0.48,
            stagger: 0.035,
            delay: 0.22,
            ease: 'power2.out',
            clearProps: 'opacity,transform'
          });
        }
      }
      if (isForecast) animateSkillConstellation('dd-fc-skills');
    } catch (_) {}
  }

  window.initDiscoveryDetail = function () {
    const urlId = qs('id');
    if (urlId && window.buildMockScanPayload) {
      try {
        const match = findJobInMock(urlId);
        if (match) {
          sessionStorage.setItem('zhitu_disc_job', JSON.stringify(match));
          sessionStorage.setItem(
            'zhitu_disc_lane',
            match.is_forecast || match.status === 'forecast' ? 'forecast' : 'found'
          );
        }
      } catch (_) {}
    }

    render(loadJob());
    bindDutiesOnce();

    document.getElementById('dd-found-fav')?.addEventListener('click', () => {
      if (!currentJob?.id) return;
      const on = toggleFav(currentJob.id, {
        title: currentJob.title,
        lane: currentJob.isForecast ? 'forecast' : 'found',
        conf: currentJob.conf || currentJob.confidence || 0
      });
      syncFavButtons(currentJob);
      toast(on ? '已收藏，可在顶部收藏栏回看' : '已取消收藏');
    });
    document.getElementById('dd-found-compare')?.addEventListener('click', openResumeCompare);
    document.getElementById('dd-found-report')?.addEventListener('click', () => {
      toast('画像报告导出任务已创建（演示）');
    });

    document.getElementById('dd-fc-fav')?.addEventListener('click', () => {
      if (!currentJob?.id) return;
      const on = toggleFav(currentJob.id, {
        title: currentJob.title,
        lane: 'forecast',
        conf: currentJob.conf || currentJob.confidence || 0
      });
      syncFavButtons(currentJob);
      toast(on ? '已收藏，可在顶部收藏栏回看' : '已取消收藏', 'amber');
    });
    document.getElementById('dd-fc-compare')?.addEventListener('click', openResumeCompare);
    document.getElementById('dd-fc-report')?.addEventListener('click', () => {
      toast('预测报告导出任务已创建（演示）', 'amber');
    });
    document.querySelectorAll('[data-close-resume]').forEach((el) => {
      el.addEventListener('click', closeResumeCompare);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeResumeCompare();
    });

    window.addEventListener('resize', () => {
      trendChart && trendChart.resize();
      graphChart && graphChart.resize();
      fcProbChart && fcProbChart.resize();
      fcSupplyChart && fcSupplyChart.resize();
      if (currentJob && !currentJob.isForecast) layoutFoundRow();
      if (currentJob && currentJob.isForecast) layoutFcRow();
    });

    window.addEventListener('discovery-favs-changed', () => {
      if (currentJob) syncFavButtons(currentJob);
    });
  };
})();
