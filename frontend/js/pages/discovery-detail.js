/* Discovery job detail — found teal board; forecast gold board */
(function () {
  let trendChart = null;
  let fcProbChart = null;
  let fcSupplyChart = null;
  let currentJob = null;

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

  const FAV_KEY = 'zhitu_disc_favs';

  function readFavs() {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function isFav(id) {
    return readFavs().indexOf(String(id)) >= 0;
  }

  function toggleFav(id) {
    const key = String(id);
    let list = readFavs();
    const on = list.indexOf(key) >= 0;
    list = on ? list.filter((x) => x !== key) : list.concat(key);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(list));
    } catch (_) {}
    return !on;
  }

  function syncFavButtons(job) {
    const on = !!(job && job.id && isFav(job.id));
    ['dd-found-fav', 'dd-fc-fav'].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.classList.toggle('is-on', on);
      const ico = btn.querySelector('.ico');
      if (ico) ico.textContent = on ? '★' : '☆';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
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

  function loadJob() {
    const id = qs('id');
    let job = null;
    try {
      const raw = sessionStorage.getItem('zhitu_disc_job');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!id || parsed.id === id) job = parsed;
      }
    } catch (_) {}

    if (!job && window.buildMockScanPayload) {
      const mock = window.buildMockScanPayload();
      const all = [...(mock.discoveries || []), ...(mock.forecasts || [])];
      job = all.find((j) => j.id === id) || all[0];
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

    const foundPortrait = {
      positioning:
        basePos ||
        title +
          '负责把复杂智能体系统从方案推进到可上线、可运维的工程形态，明确模块边界、工具链路与评测标准。',
      brief:
        '这是一个已经在真实招聘文本中稳定出现的岗位。它不是单纯的模型调用角色，而是要把规划、工具调用、知识检索与执行闭环串成可交付系统。',
      duties: job.responsibilities || job.duties || [
        '负责 AI Agent 系统的整体架构设计与落地',
        '设计 Agent 工作流、任务规划与工具调用逻辑',
        '构建 RAG 检索增强与知识管理体系',
        '评估与优化 Agent 性能、效果与安全性',
        '推动 Agent 技术在业务场景中的应用落地'
      ],
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
      brief:
        '窗口期内更可能成型的岗位方向。请关注预计出现时间、能力演化来源，以及相对你简历报告的缺口。',
      duties: job.responsibilities || job.duties || [
        '设计企业级 AI 编排架构与多 Agent 协作边界',
        '建立 LLMOps、评测与灰度发布机制',
        '制定安全治理、权限审计与成本配额策略',
        '打通业务系统集成与工具调用链路',
        '推动试点编制走向常规岗位与交付标准'
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
    const dutyScores = isForecast ? [91, 86, 82, 78, 74] : [92, 88, 85, 72, 68];

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
      : [
          { name: '大模型工程师', score: 85, note: '模型能力底座' },
          { name: 'RAG 工程师', score: 82, note: '知识检索链路' },
          { name: '多模态开发工程师', score: 76, note: '多模态扩展' },
          { name: '多智能体工程师', score: 79, note: '协作编排' }
        ];

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
      skillDev: [
        { name: 'AI 编排', now: '中', m6: '高', m12: '极高', m24: '极高' },
        { name: '多智能体协作', now: '中', m6: '高', m12: '高', m24: '极高' },
        { name: 'LLMOps', now: '中', m6: '中', m12: '高', m24: '极高' },
        { name: '安全治理', now: '低', m6: '中', m12: '高', m24: '高' },
        { name: '企业集成', now: '中', m6: '高', m12: '高', m24: '极高' }
      ],
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
    const labels = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
      const t = (n - i) / n;
      const base = 24 + t * 52 + Math.sin(i * 0.65) * 3.5;
      heat.push(Math.round(base + (currentJob?.conf || 70) * 0.12));
      demand.push(Math.round(base * 0.82 + 10 + Math.cos(i * 0.45) * 2.5));
    }
    return { labels, heat, demand };
  }

  function chartTheme() {
    const real = currentJob?.isForecast ? '#d4b07a' : '#2ec4b6';
    return { real, demand: '#5b8fd9' };
  }

  /* ---------- Found unified board ---------- */
  function renderFoundBoard(job) {
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

    const salaryWrap = document.getElementById('dd-found-salary');
    const peak = document.getElementById('dd-salary-peak');
    if (salaryWrap) salaryWrap.hidden = false;
    if (peak) peak.style.left = (job.salaryPeak || 70) + '%';

    const skillsEl = document.getElementById('dd-found-skills');
    if (skillsEl) {
      skillsEl.innerHTML = job.skillScores
        .map(
          (s, i) =>
            '<div class="dd-found-skill">' +
            '<span class="idx">' +
            (i + 1) +
            '</span>' +
            '<span class="name">' +
            esc(s.name) +
            '</span>' +
            '<span class="bar"><b data-w="' +
            s.score +
            '"></b></span>' +
            '<span class="pct">' +
            s.score +
            '%</span>' +
            '</div>'
        )
        .join('');
      requestAnimationFrame(() => {
        skillsEl.querySelectorAll('b[data-w]').forEach((b) => {
          b.style.width = b.getAttribute('data-w') + '%';
        });
      });
    }

    const dutiesEl = document.getElementById('dd-found-duties');
    if (dutiesEl) {
      dutiesEl.innerHTML = (job.duties || [])
        .slice(0, 5)
        .map((d, i) => {
          const pct = (job.dutyScores && job.dutyScores[i]) || Math.max(60, 92 - i * 6);
          return (
            '<li><span class="num">' +
            String(i + 1).padStart(2, '0') +
            '</span><span class="txt">' +
            esc(d) +
            '</span><span class="pct">' +
            pct +
            '%</span></li>'
          );
        })
        .join('');
    }

    const supplyEl = document.getElementById('dd-found-supply');
    if (supplyEl && job.supply) {
      supplyEl.innerHTML =
        '<div class="dd-supply-item"><span class="lab">人才需求增长</span><strong class="is-up">↑ ' +
        job.supply.demandGrowth +
        '%</strong><em>近6个月</em></div>' +
        '<div class="dd-supply-item"><span class="lab">人才供给增长</span><strong class="is-up">↑ ' +
        job.supply.supplyGrowth +
        '%</strong><em>近6个月</em></div>' +
        '<div class="dd-supply-item"><span class="lab">供需比</span><strong>' +
        job.supply.ratio +
        '</strong><em>需求 / 供给</em></div>';
    }
    set('dd-found-supply-note', job.evidence?.future || '—');

    renderFoundTrend();
    renderFoundRadar();
    renderFoundGraph();
  }

  function renderFoundTrend() {
    const el = document.getElementById('dd-found-trend');
    if (!el || !window.echarts) return;
    const { labels, heat, demand } = seriesForRange(6);
    const { real, demand: dem } = chartTheme();
    if (!trendChart) trendChart = window.echarts.init(el);
    trendChart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10,14,20,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e8f2f8', fontSize: 12 }
      },
      legend: {
        data: ['发布量', '搜索趋势'],
        textStyle: { color: 'rgba(232,242,248,0.55)', fontSize: 10 },
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 6
      },
      grid: { left: 36, right: 12, top: 28, bottom: 22 },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: 'rgba(232,242,248,0.38)', fontSize: 9 }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLabel: { color: 'rgba(232,242,248,0.35)', fontSize: 9 }
      },
      series: [
        {
          name: '发布量',
          type: 'line',
          data: heat,
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { width: 2.2, color: real },
          itemStyle: { color: real },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: real + '40' },
                { offset: 1, color: real + '00' }
              ]
            }
          }
        },
        {
          name: '搜索趋势',
          type: 'line',
          data: demand,
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { width: 2, color: dem },
          itemStyle: { color: dem }
        }
      ]
    });
  }

  function renderFoundRadar() {
    const el = document.getElementById('dd-found-radar');
    if (!el || !currentJob) return;
    const axes = currentJob.radarAxes || [];
    const job = currentJob.radarJob || [];
    const avg = currentJob.radarAvg || [];
    el.innerHTML = axes
      .map((name, i) => {
        const j = job[i] || 0;
        const a = avg[i] || 0;
        const delta = j - a;
        const tip =
          delta >= 12 ? '差异化强' : delta >= 4 ? '略高于行业' : '接近行业';
        return (
          '<div class="dd-cmp-row" role="listitem">' +
          '<div class="dd-cmp-lab"><span>' +
          esc(name) +
          '</span><em>' +
          tip +
          '</em></div>' +
          '<div class="dd-cmp-tracks">' +
          '<div class="dd-cmp-track is-job" title="岗位 ' +
          j +
          '"><b style="width:' +
          j +
          '%"></b><span>' +
          j +
          '</span></div>' +
          '<div class="dd-cmp-track is-avg" title="行业 ' +
          a +
          '"><b style="width:' +
          a +
          '%"></b><span>' +
          a +
          '</span></div>' +
          '</div></div>'
        );
      })
      .join('');
  }

  function renderFoundGraph() {
    const el = document.getElementById('dd-found-graph');
    if (!el || !currentJob) return;
    const related = (currentJob.related || []).slice().sort((a, b) => b.score - a.score);
    el.innerHTML = related
      .map(
        (r, i) =>
          '<button type="button" class="dd-ladder-item" role="listitem">' +
          '<span class="rk">' +
          String(i + 1).padStart(2, '0') +
          '</span>' +
          '<span class="body"><strong>' +
          esc(r.name) +
          '</strong><em>' +
          esc(r.note || '能力重叠') +
          '</em></span>' +
          '<span class="meter"><b style="width:' +
          r.score +
          '%"></b></span>' +
          '<span class="sc">' +
          r.score +
          '%</span></button>'
      )
      .join('');
  }

  /* ---------- Forecast unified gold board ---------- */
  function levelTone(lv) {
    if (lv === '极高') return 'is-extreme';
    if (lv === '高') return 'is-high';
    if (lv === '中') return 'is-mid';
    return 'is-low';
  }

  function renderForecast(job) {
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
    const peak = document.getElementById('dd-fc-salary-peak');
    if (peak) peak.style.left = (job.salaryPeak || 62) + '%';

    const skillsEl = document.getElementById('dd-fc-skills');
    if (skillsEl) {
      skillsEl.innerHTML = job.skillScores
        .map(
          (s, i) =>
            '<div class="dd-found-skill dd-fc-skill">' +
            '<span class="idx">' +
            (i + 1) +
            '</span>' +
            '<span class="name">' +
            esc(s.name) +
            '</span>' +
            '<span class="bar"><b data-w="' +
            s.score +
            '"></b></span>' +
            '<span class="pct">' +
            s.score +
            '%</span></div>'
        )
        .join('');
      requestAnimationFrame(() => {
        skillsEl.querySelectorAll('b[data-w]').forEach((b) => {
          b.style.width = b.getAttribute('data-w') + '%';
        });
      });
    }

    const dutiesEl = document.getElementById('dd-fc-duties');
    if (dutiesEl) {
      dutiesEl.innerHTML = (job.duties || [])
        .slice(0, 5)
        .map((d, i) => {
          const pct = (job.dutyScores && job.dutyScores[i]) || Math.max(70, 91 - i * 5);
          return (
            '<li><span class="num">' +
            String(i + 1).padStart(2, '0') +
            '</span><span class="txt">' +
            esc(d) +
            '</span><span class="pct">' +
            pct +
            '%</span></li>'
          );
        })
        .join('');
    }

    const tbody = document.getElementById('dd-fc-dev-body');
    if (tbody) {
      tbody.innerHTML = (job.skillDev || [])
        .map(
          (r) =>
            '<tr><td>' +
            esc(r.name) +
            '</td>' +
            ['now', 'm6', 'm12', 'm24']
              .map(
                (k) =>
                  '<td><span class="dd-fc-lv ' +
                  levelTone(r[k]) +
                  '">' +
                  esc(r[k]) +
                  '</span></td>'
              )
              .join('') +
            '</tr>'
        )
        .join('');
    }

    set('dd-fc-risk-lead', job.riskLead || '—');
    const riskList = document.getElementById('dd-fc-risk-list');
    if (riskList) {
      riskList.innerHTML = (job.risks || []).map((r) => '<li>' + esc(r) + '</li>').join('');
    }

    renderFcSankey();
    renderFcProb();
    renderFcIndustry();
    renderFcSupply();
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
    el.innerHTML = list
      .map(
        (d, i) =>
          '<div class="dd-share-row" role="listitem">' +
          '<span class="n">' +
          esc(d.name) +
          '</span>' +
          '<span class="bar"><b style="width:' +
          Math.round((d.value / max) * 100) +
          '%"></b></span>' +
          '<span class="v">' +
          d.value +
          '%</span>' +
          (i === 0 ? '<span class="tag">优先</span>' : '<span class="tag is-muted"></span>') +
          '</div>'
      )
      .join('');
  }

  function renderFcProb() {
    const el = document.getElementById('dd-fc-prob-chart');
    if (!el || !window.echarts) return;
    const gold = '#d4b07a';
    const labels = ['3月', '6月', '9月', '12月', '18月', '24月'];
    const data = [18, 32, 48, 66, 84, 96];
    if (!fcProbChart) fcProbChart = window.echarts.init(el);
    fcProbChart.setOption({
      backgroundColor: 'transparent',
      grid: { left: 34, right: 10, top: 16, bottom: 22 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: 'rgba(232,242,248,0.38)', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          color: 'rgba(232,242,248,0.35)',
          fontSize: 9,
          formatter: '{value}%'
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
      },
      series: [
        {
          type: 'line',
          data,
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { width: 2.2, color: gold },
          itemStyle: { color: gold },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: gold + '44' },
                { offset: 1, color: gold + '00' }
              ]
            }
          }
        }
      ]
    });
  }

  function renderFcSupply() {
    const el = document.getElementById('dd-fc-supply-chart');
    if (!el || !window.echarts) return;
    const gold = '#d4b07a';
    const blue = '#6ba3d4';
    const labels = ['0', '6', '12', '18', '24', '30', '36月'];
    const demand = [22, 34, 48, 62, 78, 90, 100];
    const supply = [20, 26, 32, 38, 44, 50, 56];
    if (!fcSupplyChart) fcSupplyChart = window.echarts.init(el);
    fcSupplyChart.setOption({
      backgroundColor: 'transparent',
      legend: {
        data: ['需求预测', '供给预测'],
        textStyle: { color: 'rgba(232,242,248,0.5)', fontSize: 10 },
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 6
      },
      grid: { left: 32, right: 10, top: 28, bottom: 22 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: 'rgba(232,242,248,0.38)', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(232,242,248,0.35)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
      },
      series: [
        {
          name: '需求预测',
          type: 'line',
          data: demand,
          smooth: true,
          symbolSize: 4,
          lineStyle: { width: 2.2, color: gold },
          itemStyle: { color: gold }
        },
        {
          name: '供给预测',
          type: 'line',
          data: supply,
          smooth: true,
          symbolSize: 4,
          lineStyle: { width: 2, color: blue },
          itemStyle: { color: blue }
        }
      ]
    });
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
  }

  window.initDiscoveryDetail = function () {
    if (!window.buildMockScanPayload) {
      window.buildMockScanPayload = function () {
        return {
          discoveries: [
            {
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
              responsibilities: [
                '负责 AI Agent 系统的整体架构设计与落地',
                '设计 Agent 工作流、任务规划与工具调用逻辑',
                '构建 RAG 检索增强与知识管理体系',
                '评估与优化 Agent 性能、效果与安全性',
                '推动 Agent 技术在业务场景中的应用落地'
              ],
              source: '多源招聘库',
              sample_count: 2356
            }
          ],
          forecasts: [
            {
              id: 'forecast_1',
              title: '企业级 AI 编排架构师',
              is_forecast: true,
              status: 'forecast',
              category: '人工智能',
              confidence: 82,
              eta: '2025-Q3 – 2026-Q1',
              from: [
                'AI Agent 架构师',
                '大模型工程师',
                '平台架构师',
                'RAG 工程师',
                '自动化工程师',
                '智能体产品经理',
                '后端架构师'
              ],
              salary: '35-60K · 16薪',
              definition:
                '面向企业级 AI 编排：把多 Agent、工具链与治理要求收成可交付的架构岗位方向。'
            }
          ]
        };
      };
    }

    if (qs('lane') === 'forecast' || (qs('id') || '').indexOf('forecast') === 0) {
      try {
        const raw = sessionStorage.getItem('zhitu_disc_job');
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || !(parsed.is_forecast || parsed.status === 'forecast')) {
          const fc = window.buildMockScanPayload().forecasts[0];
          sessionStorage.setItem('zhitu_disc_job', JSON.stringify(fc));
        }
      } catch (_) {}
    }

    render(loadJob());

    document.getElementById('dd-found-fav')?.addEventListener('click', () => {
      if (!currentJob?.id) return;
      const on = toggleFav(currentJob.id);
      syncFavButtons(currentJob);
      toast(on ? '已收藏，可在本机稍后回看' : '已取消收藏');
    });
    document.getElementById('dd-found-compare')?.addEventListener('click', openResumeCompare);
    document.getElementById('dd-found-report')?.addEventListener('click', () => {
      toast('画像报告导出任务已创建（演示）');
    });

    document.getElementById('dd-fc-fav')?.addEventListener('click', () => {
      if (!currentJob?.id) return;
      const on = toggleFav(currentJob.id);
      syncFavButtons(currentJob);
      toast(on ? '已收藏，可在本机稍后回看' : '已取消收藏', 'amber');
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
      fcProbChart && fcProbChart.resize();
      fcSupplyChart && fcSupplyChart.resize();
    });

    if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        const sel = currentJob?.isForecast
          ? '.dd-fc-crumb, .dd-fc-hero, .dd-verdict--fc, .dd-fc-board .dd-panel'
          : '.dd-found-crumb, .dd-found-hero, .dd-verdict:not(.dd-verdict--fc), .dd-found-board .dd-panel';
        gsap.from(sel, {
          opacity: 0,
          y: 14,
          duration: 0.75,
          stagger: 0.05,
          ease: 'power3.out',
          clearProps: 'opacity,transform'
        });
      } catch (_) {}
    }
  };
})();
