/* Discovery job detail — prototype-aligned compose layout */
(function () {
  let trendChart = null;
  let trendFocusChart = null;
  let sparkChart = null;
  let currentJob = null;
  let rangeMonths = 12;
  let skillsPage = 0;
  let skillsFocusPage = 0;
  const SKILLS_PAGE_SIZE = 5;
  const SKILLS_FOCUS_PAGE_SIZE = 8;

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
        requiredSkills: ['LangChain', 'Function Calling', 'RAG', 'Python'],
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
    const growth = Math.max(48, Math.round((conf - 30) * 2.4));
    const skills = job.requiredSkills || job.core_skills || [];
    const first =
      job.freshness ||
      (job.discoveredAt || job.discovered_at
        ? String(job.discoveredAt || job.discovered_at).slice(0, 7)
        : '2024-04');

    let skillScores = skills.map((s, i) => ({
      name: s,
      score: Math.max(62, Math.min(96, conf + 8 - i * 5))
    }));
    const extras = [
      { name: '向量数据库', score: 82 },
      { name: 'Prompt Engineering', score: 78 },
      { name: '多智能体协作', score: 74 },
      { name: '系统架构设计', score: 71 },
      { name: 'API 网关与编排', score: 69 },
      { name: '可观测性与评测', score: 67 },
      { name: '安全与权限控制', score: 65 },
      { name: '成本优化', score: 63 }
    ];
    extras.forEach((e) => {
      if (!skillScores.some((x) => x.name === e.name)) skillScores.push(e);
    });
    skillScores = skillScores.slice(0, 12);

    const sceneIcons = ['💬', '📚', '⚙️', '🧪', '🧭', '🛰️'];
    const scenes = (job.typical_scenarios || job.scenarios || [
      '智能客服',
      '企业知识助手',
      '自动化运营',
      '研发效能工具',
      '智能决策支持'
    ]).map((name, i) => ({ name, icon: sceneIcons[i % sceneIcons.length] }));

    return {
      ...job,
      isForecast,
      conf,
      growth,
      firstSeen: first,
      dataConf: Math.min(96, conf + 4),
      industry: job.industry || '互联网',
      direction: '技术研发',
      subtype: job.category || '软件与系统架构',
      positioning:
        job.definition ||
        job.description ||
        '负责设计与规划复杂 AI Agent 系统，完成工具编排、知识链路与执行闭环。',
      duties: job.responsibilities || job.duties || [
        'Agent 系统总体架构与模块边界设计',
        '工具调用、RAG 与知识系统集成',
        '多模型协同与执行流程编排',
        '可靠性、评测与成本可控性设计'
      ],
      scenes,
      skillScores,
      related: [
        { name: '大模型工程师', score: 92, note: '模型能力底座' },
        { name: 'RAG 工程师', score: 88, note: '知识检索链路' },
        { name: '后端架构师', score: 81, note: '系统与服务边界' },
        { name: '自动化工程师', score: 74, note: '流程与工具编排' }
      ],
      derived: [
        { name: '多智能体系统架构师', score: 86, eta: '12–18 月', note: '高潜力' },
        { name: '智能体产品经理', score: 78, eta: '9–15 月', note: '跨职能' },
        { name: 'AI 应用架构师', score: 82, eta: '6–12 月', note: '落地扩展' },
        { name: '自主智能体工程师', score: 75, eta: '12–24 月', note: '前沿方向' }
      ],
      evidence: {
        reasons: ['大模型能力成熟', '工具调用需求上升', 'Agent 场景扩张'],
        fusion: ['大模型工程师', '后端架构师', '自动化工程师'],
        industries: ['互联网', '金融', '教育', '企业服务'],
        future: isForecast
          ? '预计未来窗口期内相关需求将从试点走向规模化落地。'
          : 'AI Agent 正成为下一代企业智能系统的重要形态，岗位需求有望持续放大。'
      },
      trendInsights: [
        first + ' 前后相关招聘信号开始稳定出现',
        '近周期热度显著抬升，多行业同步扩散',
        isForecast
          ? '预计未来 ' + (job.eta_months || '6–12') + ' 个月进入更快增长阶段'
          : '预计未来 6–12 个月仍保持高增长区间'
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
      labels.push(String(d.getMonth() + 1).padStart(2, '0') + '月');
      const t = (n - i) / n;
      const base = 24 + t * 52 + Math.sin(i * 0.65) * 3.5;
      heat.push(Math.round(base + (currentJob?.conf || 70) * 0.12));
      demand.push(Math.round(base * 0.82 + 10 + Math.cos(i * 0.45) * 2.5));
    }
    return { labels, heat, demand };
  }

  function chartTheme() {
    const real = currentJob?.isForecast ? '#d4b07a' : '#2ec4b6';
    return { real, demand: '#6ba3d4' };
  }

  function renderSpark() {
    const el = document.getElementById('dd-hero-spark');
    if (!el || !window.echarts) return;
    const { labels, heat } = seriesForRange(12);
    if (!sparkChart) sparkChart = window.echarts.init(el);
    const { real } = chartTheme();
    sparkChart.setOption({
      grid: { left: 0, right: 0, top: 8, bottom: 0 },
      xAxis: { type: 'category', data: labels, show: false },
      yAxis: { type: 'value', show: false, min: 'dataMin' },
      series: [
        {
          type: 'line',
          data: heat,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: real, shadowBlur: 12, shadowColor: real + '88' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: real + '66' },
                { offset: 1, color: real + '00' }
              ]
            }
          }
        }
      ]
    });
  }

  function applyTrendOption(chart) {
    if (!chart) return;
    const { labels, heat, demand } = seriesForRange(rangeMonths);
    const { real, demand: dem } = chartTheme();
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(12,16,22,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e8f2f8', fontSize: 12 }
      },
      legend: {
        data: ['岗位热度', '招聘需求'],
        textStyle: { color: 'rgba(232,242,248,0.62)', fontSize: 10 },
        top: 0,
        itemWidth: 12,
        itemHeight: 6
      },
      grid: { left: 32, right: 10, top: 30, bottom: 24 },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: 'rgba(232,242,248,0.4)', fontSize: 9 }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLabel: { color: 'rgba(232,242,248,0.4)', fontSize: 9 }
      },
      series: [
        {
          name: '岗位热度',
          type: 'line',
          data: heat,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { width: 2.2, color: real, shadowBlur: 8, shadowColor: real + '66' },
          itemStyle: { color: real },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: real + '33' },
                { offset: 1, color: real + '00' }
              ]
            }
          }
        },
        {
          name: '招聘需求',
          type: 'line',
          data: demand,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { width: 2, color: dem },
          itemStyle: { color: dem }
        }
      ]
    });
  }

  function renderTrend() {
    const el = document.getElementById('dd-trend-chart');
    const elF = document.getElementById('dd-trend-chart-focus');
    if (el && window.echarts) {
      if (!trendChart) trendChart = window.echarts.init(el);
      applyTrendOption(trendChart);
    }
    if (elF && window.echarts && !elF.closest('[hidden]')) {
      if (!trendFocusChart) trendFocusChart = window.echarts.init(elF);
      applyTrendOption(trendFocusChart);
    }
  }

  function animateSkillBars(root) {
    requestAnimationFrame(() => {
      (root || document).querySelectorAll('.dd-skill .bar b').forEach((b) => {
        b.style.width = b.getAttribute('data-w') + '%';
      });
    });
  }

  const GUIDE = {
    overview:
      '先看左侧岗位定义 → 中间技能与趋势 → 底部为何被发现；右侧可关注或导出。',
    skills: '技能按相关度排序。概览里可块内翻页；此处展开看更完整清单。',
    trend: '切换时间范围对比热度与招聘需求；下方洞察说明曲线含义。',
    related: '关联岗位是能力输入来源，点击可查看与当前角色的关系。',
    evolve: '演化路径是能力输出方向，金色表示预测衍生潜力。',
    evidence: '四条证据链解释系统为何判定该岗位值得关注。'
  };

  function setGuide(sec) {
    const el = document.getElementById('dd-guide');
    if (!el) return;
    const text = GUIDE[sec] || GUIDE.overview;
    el.innerHTML = '<span class="dd-guide-k">读法</span>' + text;
  }

  function setSection(sec) {
    const page = document.getElementById('view-discovery-detail');
    if (page) page.setAttribute('data-mode', sec);

    document.querySelectorAll('.dd-tabs button').forEach((b) => {
      const on = b.getAttribute('data-sec') === sec;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    setGuide(sec);

    const compose = document.getElementById('sec-overview');
    const evidence = document.getElementById('sec-evidence');
    const focuses = ['skills', 'trend', 'related', 'evolve'];

    if (sec === 'overview') {
      if (compose) compose.hidden = false;
      focuses.forEach((id) => {
        const el = document.getElementById('sec-' + id);
        if (el) el.hidden = true;
      });
      if (evidence) evidence.hidden = false;
      setTimeout(() => {
        renderTrend();
        renderSkillsOverview();
        trendChart && trendChart.resize();
        sparkChart && sparkChart.resize();
      }, 40);
      return;
    }

    if (sec === 'evidence') {
      if (compose) compose.hidden = true;
      focuses.forEach((id) => {
        const el = document.getElementById('sec-' + id);
        if (el) el.hidden = true;
      });
      if (evidence) evidence.hidden = false;
      return;
    }

    if (compose) compose.hidden = true;
    focuses.forEach((id) => {
      const el = document.getElementById('sec-' + id);
      if (el) el.hidden = id !== sec;
    });
    if (evidence) evidence.hidden = true;

    if (sec === 'skills') {
      renderSkillsFocus();
    }
    if (sec === 'trend') {
      const ul = document.getElementById('dd-trend-insights');
      const ulF = document.getElementById('dd-trend-insights-focus');
      if (ul && ulF) ulF.innerHTML = ul.innerHTML;
      setTimeout(() => {
        const elF = document.getElementById('dd-trend-chart-focus');
        if (elF && window.echarts) {
          if (!trendFocusChart) trendFocusChart = window.echarts.init(elF);
          applyTrendOption(trendFocusChart);
          trendFocusChart.resize();
        }
      }, 40);
    }
  }

  function skillsHtml(list) {
    return list
      .map(
        (s) =>
          '<div class="dd-skill"><span class="name">' +
          esc(s.name) +
          '</span><span class="bar"><b data-w="' +
          s.score +
          '"></b></span><span class="pct">' +
          s.score +
          '</span></div>'
      )
      .join('');
  }

  function pageSlice(list, page, size) {
    const total = Math.max(1, Math.ceil(list.length / size));
    const safe = Math.min(Math.max(0, page), total - 1);
    const start = safe * size;
    return { items: list.slice(start, start + size), page: safe, total, size };
  }

  function updateSkillsPager(pagerId, labelId, hintId, page, total, size, attrs) {
    const pager = document.getElementById(pagerId);
    const label = document.getElementById(labelId);
    if (!pager || !label) return;
    if (total <= 1) {
      pager.hidden = true;
      return;
    }
    pager.hidden = false;
    label.textContent = page + 1 + ' / ' + total;
    const hint = hintId ? document.getElementById(hintId) : pager.querySelector('em');
    if (hint && currentJob) {
      const remain = Math.max(0, currentJob.skillScores.length - (page + 1) * size);
      hint.textContent = remain > 0 ? '还有 ' + remain + ' 项 · 块内翻页' : '已是末页 · 块内翻页';
    }
    pager.querySelectorAll('button').forEach((btn) => {
      const delta = Number(btn.getAttribute(attrs));
      btn.disabled = (delta < 0 && page <= 0) || (delta > 0 && page >= total - 1);
    });
  }

  function renderSkillsOverview() {
    if (!currentJob) return;
    const { items, page, total } = pageSlice(currentJob.skillScores, skillsPage, SKILLS_PAGE_SIZE);
    skillsPage = page;
    const el = document.getElementById('dd-skills');
    if (el) {
      el.innerHTML = skillsHtml(items);
      animateSkillBars(el);
    }
    updateSkillsPager(
      'dd-skills-pager',
      'dd-skills-page-label',
      'dd-skills-more-hint',
      page,
      total,
      SKILLS_PAGE_SIZE,
      'data-skills-page'
    );
  }

  function renderSkillsFocus() {
    if (!currentJob) return;
    const { items, page, total } = pageSlice(
      currentJob.skillScores,
      skillsFocusPage,
      SKILLS_FOCUS_PAGE_SIZE
    );
    skillsFocusPage = page;
    const el = document.getElementById('dd-skills-focus');
    if (el) {
      el.innerHTML = skillsHtml(items);
      animateSkillBars(el);
    }
    updateSkillsPager(
      'dd-skills-pager-focus',
      'dd-skills-page-label-focus',
      null,
      page,
      total,
      SKILLS_FOCUS_PAGE_SIZE,
      'data-skills-page-focus'
    );
  }

  function render(job) {
    currentJob = job;
    const page = document.getElementById('view-discovery-detail');
    page?.classList.toggle('is-forecast', !!job.isForecast);

    const tag = document.getElementById('dd-tag');
    if (tag) tag.textContent = job.isForecast ? '未来预测' : '真实发现';
    document.getElementById('dd-title').textContent = job.title || '岗位详情';
    document.getElementById('dd-path').innerHTML = [job.industry, job.direction, job.subtype]
      .map((t) => '<span class="dd-chip">' + esc(t) + '</span>')
      .join('');
    document.getElementById('dd-blurb').textContent = job.positioning;

    document.getElementById('dd-first').textContent = job.firstSeen;
    document.getElementById('dd-heat').textContent = String(job.conf);
    document.getElementById('dd-heat-note').textContent =
      '高于约 ' + Math.min(98, job.conf + 4) + '% 同类岗位';
    document.getElementById('dd-growth').textContent = '↑ ' + job.growth + '%';
    document.getElementById('dd-conf').textContent = job.dataConf + '%';
    document.getElementById('dd-conf-note').textContent =
      job.dataConf >= 85 ? '高' : job.dataConf >= 70 ? '中高' : '中';

    document.getElementById('dd-positioning').textContent = job.positioning;
    document.getElementById('dd-duties').innerHTML = job.duties
      .map((d) => '<li>' + esc(d) + '</li>')
      .join('');
    document.getElementById('dd-scenes').innerHTML = job.scenes
      .slice(0, 4)
      .map(
        (s) =>
          '<div class="dd-scene"><span class="ico" aria-hidden="true">' +
          s.icon +
          '</span><span>' +
          esc(s.name) +
          '</span></div>'
      )
      .join('');

    skillsPage = 0;
    skillsFocusPage = 0;
    renderSkillsOverview();
    document.getElementById('dd-trend-insights').innerHTML = job.trendInsights
      .map((t) => '<li>' + esc(t) + '</li>')
      .join('');

    const relHtml = (list, pred) =>
      list
        .map(
          (r) =>
            '<button type="button" class="dd-rel" data-name="' +
            esc(r.name) +
            '"><span class="name">' +
            esc(r.name) +
            '</span><span class="meta">' +
            esc(r.note || (pred ? '预测窗口 ' + (r.eta || '') : '能力输入')) +
            '</span><span class="score">' +
            (pred ? '潜力 ' : '关联 ') +
            r.score +
            '%</span></button>'
        )
        .join('');

    document.getElementById('dd-related').innerHTML = relHtml(job.related, false);
    document.getElementById('dd-derived').innerHTML = relHtml(job.derived, true);

    document.getElementById('dd-rail-related').innerHTML = job.related
      .map(
        (r) =>
          '<button type="button" class="dd-rail-item"><span class="n">' +
          esc(r.name) +
          '</span><span class="s">' +
          r.score +
          '%</span><span class="bar"><b style="width:' +
          r.score +
          '%"></b></span></button>'
      )
      .join('');
    document.getElementById('dd-rail-derived').innerHTML = job.derived
      .map(
        (r) =>
          '<button type="button" class="dd-rail-item"><span class="n">' +
          esc(r.name) +
          '</span><span class="s">' +
          r.score +
          '%</span><span class="bar"><b style="width:' +
          r.score +
          '%"></b></span></button>'
      )
      .join('');

    const ev = job.evidence;
    document.getElementById('dd-evidence').innerHTML =
      '<div class="dd-ev"><span class="step">01</span><div class="icon">✦</div><span class="kicker">岗位出现原因</span><h4>市场信号已形成</h4><p>系统捕捉到该岗位名称与职责组合在真实招聘文本中持续出现。</p><div class="chips">' +
      ev.reasons.map((x) => '<span>' + esc(x) + '</span>').join('') +
      '</div></div>' +
      '<div class="dd-ev"><span class="step">02</span><div class="icon">◎</div><span class="kicker">能力融合来源</span><h4>多岗位能力交汇</h4><p>相关能力从既有岗位逐步融合，形成新的职责边界。</p><div class="chips">' +
      ev.fusion.map((x) => '<span>' + esc(x) + '</span>').join('') +
      '</div></div>' +
      '<div class="dd-ev"><span class="step">03</span><div class="icon">⬡</div><span class="kicker">行业扩散情况</span><h4>多行业同步出现</h4><p>相关需求不再局限于单一赛道，覆盖面持续扩大。</p><div class="chips">' +
      ev.industries.map((x) => '<span>' + esc(x) + '</span>').join('') +
      '</div></div>' +
      '<div class="dd-ev is-pred"><span class="step">04</span><div class="icon">✧</div><span class="kicker">未来潜力</span><h4>中长期增长可期</h4><p>' +
      esc(ev.future) +
      '</p></div>';

    document.getElementById('dd-basics').innerHTML = [
      ['发现类型', job.isForecast ? '未来预测' : '真实发现'],
      ['所属行业', job.industry],
      ['岗位方向', job.direction],
      ['岗位类别', job.subtype],
      ['级别', job.level || '中高级'],
      ['城市覆盖', job.city || '多城'],
      ['数据来源', job.source || '多源招聘库']
    ]
      .map((row) => '<div><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>')
      .join('');

    document.title = '执图破局 · ' + (job.title || '岗位详情');
    const evolveHref =
      'discovery-evolve.html?id=' + encodeURIComponent(job.id || 'disc_mock_1');
    document.querySelectorAll('#dd-open-evolve, #dd-open-evolve-tab').forEach((a) => {
      a.setAttribute('href', evolveHref);
    });
    renderSpark();
    setSection('overview');
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
              requiredSkills: ['LangChain', 'Function Calling', 'RAG', 'Python'],
              definition:
                '负责设计与规划基于大模型的 Agent 系统架构，打通工具调用、知识检索与多模型协同，支撑企业级智能应用落地。',
              responsibilities: [
                'Agent 系统架构设计',
                '多工具协同与编排',
                'RAG 与知识系统集成',
                'Agent 执行流程与评测'
              ],
              typical_scenarios: ['智能客服', '企业知识助手', '自动化运营', '研发效能工具', '智能决策支持'],
              source: '多源招聘库'
            }
          ],
          forecasts: []
        };
      };
    }

    render(loadJob());

    document.querySelectorAll('.dd-tabs button').forEach((btn) => {
      btn.addEventListener('click', () => setSection(btn.getAttribute('data-sec')));
    });

    document.querySelectorAll('.dd-range button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.parentElement;
        group.querySelectorAll('button').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        // sync sibling ranges
        const val = btn.getAttribute('data-range');
        document.querySelectorAll('.dd-range button[data-range="' + val + '"]').forEach((b) => {
          b.parentElement.querySelectorAll('button').forEach((x) => x.classList.remove('is-active'));
          b.classList.add('is-active');
        });
        rangeMonths = Number(val) || 12;
        renderTrend();
      });
    });

    document.getElementById('dd-skills-pager')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-skills-page]');
      if (!btn || btn.disabled) return;
      skillsPage += Number(btn.getAttribute('data-skills-page')) || 0;
      renderSkillsOverview();
    });
    document.getElementById('dd-skills-pager-focus')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-skills-page-focus]');
      if (!btn || btn.disabled) return;
      skillsFocusPage += Number(btn.getAttribute('data-skills-page-focus')) || 0;
      renderSkillsFocus();
    });

    window.addEventListener('resize', () => {
      trendChart && trendChart.resize();
      trendFocusChart && trendFocusChart.resize();
      sparkChart && sparkChart.resize();
    });

    const bindToast = (id, msg) => {
      document.getElementById(id)?.addEventListener('click', (e) => {
        e.currentTarget.classList.toggle('is-on');
        toast(msg);
      });
    };
    bindToast('dd-fav', '已加入收藏');
    bindToast('dd-compare', '已加入对比清单');
    bindToast('dd-share', '分享链接已复制（演示）');
    bindToast('dd-watch', '已加入关注清单');
    bindToast('dd-focus', '已标记为重点岗位');
    bindToast('dd-export', '分析报告导出任务已创建');

    document.getElementById('dd-related')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.dd-rel');
      if (btn) toast('能力输入岗位：' + btn.getAttribute('data-name'));
    });
    document.getElementById('dd-derived')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.dd-rel');
      if (btn) toast('可衍生方向：' + btn.getAttribute('data-name'), 'amber');
    });

    if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        gsap.from('.dd-crumb, .dd-hero, .dd-nav-band, .dd-shell', {
          opacity: 0,
          y: 12,
          duration: 0.8,
          stagger: 0.07,
          ease: 'power3.out',
          clearProps: 'opacity,transform'
        });
      } catch (_) {}
    }

    window.addEventListener('resize', () => {
      sparkChart && sparkChart.resize();
      trendChart && trendChart.resize();
      trendFocusChart && trendFocusChart.resize();
    });
  };
})();
