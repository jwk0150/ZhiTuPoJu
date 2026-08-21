/* Discovery forecast v4 — operation first, charts optional */
(function () {
  let jobs = [];
  let ctxJob = null;
  let selectedId = null;
  let probChart = null;
  let sankeyChart = null;
  let ganttChart = null;

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
    if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, tone || 'amber');
  }

  function loadContext() {
    const id = qs('id');
    try {
      const raw = sessionStorage.getItem('zhitu_disc_job');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!id || parsed.id === id) return parsed;
      }
    } catch (_) {}
    return {
      id: 'disc_mock_1',
      title: 'AI Agent 架构师',
      confidence: 88,
      category: '人工智能'
    };
  }

  function buildJobs(ctx) {
    const base = [
      {
        title: 'AI Agent 协作工程师',
        conf: 92,
        eta: '8–12 个月',
        skills: ['Multi-Agent', '协同编排'],
        from: ['AI Agent 架构师', 'RAG 工程师'],
        bridge: 'Agent 编排',
        start: 8,
        span: 4,
        why: '企业开始需要能把多个 Agent 协同起来的人，而不只是调用单个模型。'
      },
      {
        title: '企业智能体运维工程师',
        conf: 88,
        eta: '6–10 个月',
        skills: ['Agent Ops', '可观测性'],
        from: ['自动化运维工程师', '后端架构师'],
        bridge: '系统集成',
        start: 6,
        span: 4,
        why: 'Agent 上线后，稳定性、成本和权限会变成日常运维问题。'
      },
      {
        title: 'AI 工作流架构师',
        conf: 85,
        eta: '10–14 个月',
        skills: ['Workflow', 'Tool Calling'],
        from: ['后端架构师', 'AI Agent 架构师'],
        bridge: '工具调用',
        start: 10,
        span: 4,
        why: '业务要把模型能力嵌进流程，需要会设计工具编排的人。'
      },
      {
        title: '多模态大模型应用工程师',
        conf: 83,
        eta: '9–15 个月',
        skills: ['多模态', 'RAG'],
        from: ['大模型工程师', '数据工程师'],
        bridge: '多模态融合',
        start: 9,
        span: 6,
        why: '图文音视频一起进业务场景，岗位边界正在从纯文本扩展。'
      },
      {
        title: '智能体安全工程师',
        conf: 82,
        eta: '12–18 个月',
        skills: ['安全策略', '权限'],
        from: ['后端架构师', 'AI Agent 架构师'],
        bridge: '安全治理',
        start: 12,
        span: 6,
        why: '工具调用与自主执行带来越权、泄露和对抗风险。'
      },
      {
        title: 'Agent 训练工程师',
        conf: 79,
        eta: '12–20 个月',
        skills: ['RLHF', '评测'],
        from: ['大模型工程师'],
        bridge: '训练闭环',
        start: 12,
        span: 8,
        why: '通用模型不够用时，需要专人把 Agent 行为训到业务可用。'
      },
      {
        title: '智能体产品经理',
        conf: 77,
        eta: '6–12 个月',
        skills: ['场景设计', 'Agent 产品'],
        from: ['RAG 工程师'],
        bridge: '场景编排',
        start: 6,
        span: 6,
        why: '先把场景做对，再谈架构与运维，产品侧需求在抬升。'
      },
      {
        title: '企业 AI 编排架构师',
        conf: 76,
        eta: '14–22 个月',
        skills: ['编排', '平台'],
        from: ['AI Agent 架构师', '后端架构师'],
        bridge: '平台化',
        start: 14,
        span: 8,
        why: '多业务线复用 Agent 能力时，需要平台级编排与治理。'
      },
      {
        title: '知识智能体工程师',
        conf: 74,
        eta: '8–14 个月',
        skills: ['KG', 'RAG'],
        from: ['知识图谱工程师', 'RAG 工程师'],
        bridge: '知识推理',
        start: 8,
        span: 6,
        why: '企业知识要从检索走向可推理的智能体回答。'
      },
      {
        title: '自主智能体工程师',
        conf: 73,
        eta: '16–24 个月',
        skills: ['自主规划', '记忆'],
        from: ['AI Agent 架构师'],
        bridge: '自主执行',
        start: 16,
        span: 8,
        why: '从“人触发”走向“长程自主执行”，岗位要求会再抬一档。'
      },
      {
        title: '多智能体系统架构师',
        conf: 72,
        eta: '12–24 个月',
        skills: ['Multi-Agent', '评测'],
        from: ['AI Agent 架构师', '大模型工程师'],
        bridge: '多智能体',
        start: 12,
        span: 12,
        why: '复杂任务会被拆成多个角色协作，系统架构岗会随之出现。'
      }
    ];

    if (ctx && ctx.title) base[0].from = [ctx.title, 'RAG 工程师'];

    return base.map((j, i) => ({
      id: 'forecast_' + (i + 1),
      ...j,
      is_forecast: true,
      status: 'forecast',
      category: ctx?.category || '人工智能',
      confidence: j.conf,
      industry: 'it'
    }));
  }

  function filteredJobs() {
    const minConf = Number(document.getElementById('df-conf')?.value || 70);
    return jobs.filter((j) => j.conf >= minConf);
  }

  function wireNav() {
    const detail = document.getElementById('df-stage-detail');
    if (detail) {
      detail.removeAttribute('href');
      detail.setAttribute('aria-disabled', 'true');
      detail.classList.remove('is-active');
    }
  }

  function selectedJob() {
    return filteredJobs().find((j) => j.id === selectedId) || null;
  }

  function renderList() {
    const list = filteredJobs();
    document.getElementById('df-count').textContent = String(list.length);
    const host = document.getElementById('df-cards');
    const pick = qs('pick');

    if (!list.length) {
      host.innerHTML = '<p class="df-sel-why" style="padding:12px">没有符合筛选的岗位，试着把置信度调低。</p>';
      selectedId = null;
      renderAction();
      return;
    }

    if (pick && list.some((j) => j.id === pick)) {
      selectedId = pick;
    } else if (!selectedId || !list.some((j) => j.id === selectedId)) {
      selectedId = list[0].id;
    }

    host.innerHTML = list
      .map((j, i) => {
        const hot = i === 0 ? ' is-hot' : '';
        const sel = j.id === selectedId ? ' is-selected' : '';
        return (
          '<button type="button" class="df-row' +
          hot +
          sel +
          '" role="option" aria-selected="' +
          (j.id === selectedId ? 'true' : 'false') +
          '" data-id="' +
          esc(j.id) +
          '"><span class="rank">#' +
          (i + 1) +
          '</span><span><span class="name">' +
          esc(j.title) +
          '</span><span class="meta">预计 ' +
          esc(j.eta) +
          ' · ' +
          esc((j.skills || []).slice(0, 2).join(' / ')) +
          '</span></span><span class="conf">' +
          j.conf +
          '%</span></button>'
        );
      })
      .join('');

    host.querySelectorAll('.df-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedId = btn.getAttribute('data-id');
        renderList();
        renderAction();
        const panel = document.getElementById('df-why-panel');
        if (panel && !panel.hidden) renderWhyCharts();
      });
    });

    renderAction();
  }

  function renderAction() {
    const job = selectedJob();
    const go = document.getElementById('df-go-detail');
    const whyBtn = document.getElementById('df-toggle-why');
    const kicker = document.getElementById('df-action-kicker');
    const title = document.getElementById('df-sel-title');
    const meta = document.getElementById('df-sel-meta');
    const why = document.getElementById('df-sel-why');

    if (!job) {
      kicker.textContent = '先从左侧选一个岗位';
      title.textContent = '还没选择';
      meta.innerHTML = '';
      why.textContent = '点左侧任意一行，右侧会出现「进入详情」按钮。';
      go.disabled = true;
      whyBtn.disabled = true;
      return;
    }

    kicker.textContent = '已选中 · 下一步很简单';
    title.textContent = job.title;
    meta.innerHTML =
      '<div><dt>置信度</dt><dd>' +
      job.conf +
      '%</dd></div>' +
      '<div><dt>预计出现</dt><dd>' +
      esc(job.eta) +
      '</dd></div>' +
      '<div><dt>关键能力</dt><dd>' +
      esc((job.skills || []).join('、')) +
      '</dd></div>';
    why.textContent =
      (job.why || '这是系统根据能力演化推演的潜在方向。') +
      ' 进入详情后仍可随时返回本列表，不会跳进真实发现线。';
    go.disabled = false;
    whyBtn.disabled = false;
  }

  function openSelected() {
    const job = selectedJob();
    if (!job) return;
    const payload = {
      id: job.id,
      title: job.title,
      category: job.category,
      confidence: job.conf,
      is_forecast: true,
      status: 'forecast',
      requiredSkills: job.skills,
      definition: job.why || job.title + ' · AI 预测岗位',
      freshness: '预测窗口',
      eta_months: job.eta
    };
    try {
      sessionStorage.setItem('zhitu_disc_job', JSON.stringify(payload));
      sessionStorage.setItem('zhitu_disc_lane', 'forecast');
    } catch (_) {}
    toast('正在进入预测岗位详情：' + job.title);
    location.href = 'discovery-detail.html?id=' + encodeURIComponent(job.id);
  }

  function setWhyOpen(open) {
    const panel = document.getElementById('df-why-panel');
    const btn = document.getElementById('df-toggle-why');
    if (!panel) return;
    panel.hidden = !open;
    if (btn) btn.textContent = open ? '收起解释' : '看看为什么会预测它';
    if (open) {
      requestAnimationFrame(() => {
        renderWhyCharts();
        [probChart, ganttChart, sankeyChart].forEach((c) => c && c.resize());
      });
    }
  }

  function renderWhyCharts() {
    const list = filteredJobs();
    const job = selectedJob() || list[0];
    if (!job || !window.echarts) return;

    const probEl = document.getElementById('df-prob-chart');
    if (probEl) {
      if (!probChart) probChart = window.echarts.init(probEl);
      const cats = ['今', '+3', '+6', '+9', '+12'];
      const real = [48, 55, 62, null, null];
      const pred = [null, null, 62, 70, Math.min(96, job.conf)];
      probChart.setOption({
        grid: { left: 32, right: 10, top: 12, bottom: 24 },
        xAxis: {
          type: 'category',
          data: cats,
          axisLabel: { color: 'rgba(160,180,195,0.85)', fontSize: 10 },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }
        },
        yAxis: {
          type: 'value',
          min: 30,
          max: 100,
          axisLabel: { color: 'rgba(150,170,185,0.7)', fontSize: 10 },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } }
        },
        series: [
          {
            type: 'line',
            data: real,
            smooth: true,
            symbolSize: 5,
            lineStyle: { color: '#2ec4b6', width: 2 },
            areaStyle: { color: 'rgba(46,196,182,0.15)' }
          },
          {
            type: 'line',
            data: pred,
            smooth: true,
            symbolSize: 5,
            lineStyle: { color: '#d4b07a', width: 2, type: 'dashed' },
            areaStyle: { color: 'rgba(212,176,122,0.12)' }
          }
        ]
      });
    }

    const ganttEl = document.getElementById('df-gantt');
    if (ganttEl) {
      if (!ganttChart) ganttChart = window.echarts.init(ganttEl);
      const rows = list.slice(0, 5).reverse();
      ganttChart.setOption({
        grid: { left: 110, right: 12, top: 8, bottom: 22 },
        xAxis: {
          type: 'value',
          min: 0,
          max: 24,
          axisLabel: { color: 'rgba(150,170,185,0.75)', fontSize: 10 },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } }
        },
        yAxis: {
          type: 'category',
          data: rows.map((j) => j.title),
          axisLabel: { color: 'rgba(210,222,232,0.9)', fontSize: 10, width: 100, overflow: 'truncate' },
          axisLine: { show: false },
          axisTick: { show: false }
        },
        series: [
          {
            type: 'custom',
            renderItem: (params, api) => {
              const i = api.value(0);
              const a = api.coord([api.value(1), i]);
              const b = api.coord([api.value(2), i]);
              const h = api.size([0, 1])[1] * 0.4;
              const focus = rows[i] && rows[i].id === job.id;
              return {
                type: 'rect',
                shape: { x: a[0], y: a[1] - h / 2, width: Math.max(b[0] - a[0], 4), height: h, r: 3 },
                style: {
                  fill: focus ? 'rgba(212,176,122,0.9)' : 'rgba(46,196,182,0.65)'
                }
              };
            },
            data: rows.map((j, i) => ({ name: j.title, value: [i, j.start, j.start + j.span] }))
          }
        ]
      });
    }

    const sankeyEl = document.getElementById('df-sankey');
    if (sankeyEl) {
      if (!sankeyChart) sankeyChart = window.echarts.init(sankeyEl);
      const sources = (job.from || []).slice(0, 2);
      const bridge = job.bridge || '能力桥';
      const nodes = [
        ...sources.map((n) => ({ name: n, itemStyle: { color: '#6b8cae' } })),
        { name: bridge, itemStyle: { color: '#2ec4b6' } },
        { name: job.title, itemStyle: { color: '#d4b07a' } }
      ];
      const links = [
        ...sources.map((s) => ({ source: s, target: bridge, value: 12 })),
        { source: bridge, target: job.title, value: 16 }
      ];
      sankeyChart.setOption({
        series: [
          {
            type: 'sankey',
            left: 4,
            right: 80,
            top: 6,
            bottom: 6,
            nodeWidth: 10,
            nodeGap: 12,
            label: { color: 'rgba(220,230,240,0.9)', fontSize: 10 },
            lineStyle: { color: 'gradient', opacity: 0.4, curveness: 0.5 },
            data: nodes,
            links
          }
        ]
      });
    }
  }

  window.initDiscoveryForecast = function () {
    try {
      sessionStorage.setItem('zhitu_disc_lane', 'forecast');
    } catch (_) {}
    ctxJob = loadContext();
    jobs = buildJobs(ctxJob);
    // 若首页点进了某个预测岗位，优先用它的标题对齐列表选中
    const pick = qs('pick');
    if (pick && ctxJob && (ctxJob.id === pick || ctxJob.is_forecast || ctxJob.status === 'forecast')) {
      const hit = jobs.find((j) => j.id === pick || j.title === ctxJob.title);
      if (hit) selectedId = hit.id;
      else if (ctxJob.title) {
        jobs = [
          {
            id: pick,
            title: ctxJob.title,
            conf: ctxJob.confidence || 80,
            eta: ctxJob.eta_months || '6–12 个月',
            skills: ctxJob.requiredSkills || ['LLM', 'Agent'],
            from: ['相关已有岗位'],
            bridge: '能力桥',
            start: 8,
            span: 6,
            why: ctxJob.definition || ctxJob.description || '来自首页未来预测入口。',
            is_forecast: true,
            status: 'forecast',
            category: ctxJob.category || '人工智能',
            confidence: ctxJob.confidence || 80,
            industry: 'it'
          }
        ].concat(jobs.filter((j) => j.id !== pick));
        selectedId = pick;
      }
    }
    wireNav();
    renderList();

    document.getElementById('df-conf')?.addEventListener('change', () => {
      renderList();
      const panel = document.getElementById('df-why-panel');
      if (panel && !panel.hidden) renderWhyCharts();
    });

    document.getElementById('df-go-detail')?.addEventListener('click', openSelected);
    document.getElementById('df-toggle-why')?.addEventListener('click', () => {
      const panel = document.getElementById('df-why-panel');
      setWhyOpen(!!(panel && panel.hidden));
    });
    document.getElementById('df-close-why')?.addEventListener('click', () => setWhyOpen(false));

    // double-click row also goes
    document.getElementById('df-cards')?.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.df-row');
      if (!row) return;
      selectedId = row.getAttribute('data-id');
      openSelected();
    });

    window.addEventListener('resize', () => {
      [probChart, ganttChart, sankeyChart].forEach((c) => c && c.resize());
    });

    if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        gsap.from('.df-topbar, .df-hero, .df-howto, .df-workspace', {
          opacity: 0,
          y: 10,
          duration: 0.7,
          stagger: 0.06,
          ease: 'power3.out',
          clearProps: 'opacity,transform'
        });
      } catch (_) {}
    }
  };
})();
