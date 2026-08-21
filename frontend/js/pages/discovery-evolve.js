/* Discovery evolve map — standalone page OR embed in detail tab 05 */
(function () {
  let currentJob = null;
  let selectedId = 'center';
  let scale = 1;
  let pan = { x: 0, y: 0 };
  let industryChart = null;
  let trendChart = null;
  let forecastChart = null;
  let graph = null;
  let rootEl = document;
  let embedMode = false;
  let bound = false;

  function $(sel) {
    if (!rootEl || rootEl === document) return document.querySelector(sel);
    if (sel.charAt(0) === '#') return rootEl.querySelector(sel);
    return rootEl.querySelector(sel);
  }

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

  function detailHref(id) {
    return (
      'discovery-detail.html?id=' +
      encodeURIComponent(id || (currentJob && currentJob.id) || 'disc_mock_1') +
      '&tab=evolve'
    );
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
        freshness: '2024-04'
      };
    }
    return enrich(job);
  }

  function enrich(job) {
    const isForecast = !!(job.is_forecast || job.status === 'forecast');
    const conf = job.confidence || 72;
    const growth = Math.max(48, Math.round((conf - 30) * 2.4));
    const first =
      job.freshness ||
      (job.discoveredAt || job.discovered_at
        ? String(job.discoveredAt || job.discovered_at).slice(0, 7)
        : '2024-04');
    const title = job.title || 'AI Agent 架构师';

    const sources = [
      { id: 's1', name: '大模型工程师', skills: ['LLM', 'Python'], when: '2023', score: 92 },
      { id: 's2', name: 'RAG 工程师', skills: ['RAG', '向量检索'], when: '2023', score: 88 },
      { id: 's3', name: '后端架构师', skills: ['API', '分布式'], when: '2022', score: 81 },
      { id: 's4', name: '向量数据库工程师', skills: ['Milvus', 'Embedding'], when: '2023', score: 76 },
      { id: 's5', name: '自动化运维工程师', skills: ['Workflow', 'CI'], when: '2022', score: 68 }
    ];

    const skillsNew = [
      { id: 'sk1', name: 'Agent Planning', kind: 'new' },
      { id: 'sk2', name: 'Tool Calling', kind: 'new' },
      { id: 'sk3', name: 'Multi-Agent', kind: 'new' }
    ];
    const skillsBoost = [
      { id: 'sk4', name: 'LLM', kind: 'boost' },
      { id: 'sk5', name: 'RAG', kind: 'boost' },
      { id: 'sk6', name: 'Python', kind: 'boost' }
    ];

    const related = [
      { id: 'r1', name: 'AI 应用开发工程师', skills: ['Agent', 'App'], when: '2024', score: 84 },
      { id: 'r2', name: '智能体产品经理', skills: ['Agent', '产品'], when: '2024', score: 78 },
      { id: 'r3', name: '知识图谱工程师', skills: ['KG', '推理'], when: '2024', score: 72 },
      { id: 'r4', name: '数据工程师', skills: ['Pipeline', 'ETL'], when: '2023', score: 66 }
    ];

    const predicted = [
      { id: 'p1', name: '多智能体系统架构师', conf: 90, eta: '6–12 月' },
      { id: 'p2', name: '自主智能体工程师', conf: 85, eta: '12–24 月' },
      { id: 'p3', name: '智能体安全工程师', conf: 82, eta: '12–24 月' },
      { id: 'p4', name: 'AI 应用架构师', conf: 80, eta: '24–36 月' },
      { id: 'p5', name: 'Agent 训练工程师', conf: 76, eta: '18–30 月' }
    ];

    return {
      ...job,
      title,
      isForecast,
      conf,
      growth,
      firstSeen: first,
      dataConf: Math.min(96, conf + 4),
      relatedCount: sources.length + related.length,
      positioning:
        job.definition ||
        job.description ||
        '负责设计与规划复杂 AI Agent 系统，完成工具编排、知识链路与执行闭环。',
      sources,
      skillsNew,
      skillsBoost,
      related,
      predicted,
      skillDelta: [
        { name: 'Agent Planning', delta: 92 },
        { name: 'Tool Calling', delta: 76 },
        { name: 'Multi-Agent', delta: 64 },
        { name: 'MCP', delta: 51 },
        { name: 'RAG', delta: 35 }
      ],
      why:
        '随着企业级 LLM 应用从单模型调用发展为具备任务规划、工具调用与多 Agent 协作的复杂系统，对能够进行整体智能体架构设计的人才需求开始在招聘文本中稳定出现。',
      stages: [
        { label: '2023 · LLM 应用', now: false },
        { label: '2024 · RAG + Tool Use', now: false },
        { label: '2025 · Agent System', now: true },
        { label: '未来 · Multi-Agent', now: false }
      ]
    };
  }

  function buildLayout(job, depth) {
    const W = 1100;
    const H = 420;
    const cols = { hist: 70, skill: 290, center: 480, real: 700, pred: 920 };
    const nodes = [];
    const edges = [];

    const hist = job.sources.slice(0, depth >= 4 ? 5 : 4);
    hist.forEach((s, i) => {
      const y = 36 + i * ((H - 80) / Math.max(hist.length - 1, 1));
      nodes.push({ ...s, type: 'hist', x: cols.hist, y: Math.min(H - 90, y), kicker: '已有岗位' });
      edges.push({ from: s.id, to: 'center', kind: 'solid', soft: i > 2 });
    });

    [...job.skillsNew, ...job.skillsBoost].forEach((sk, i) => {
      nodes.push({
        id: sk.id,
        name: sk.name,
        type: 'skill',
        kind: sk.kind,
        x: cols.skill + (i % 2) * 18,
        y: 70 + i * 48
      });
      if (sk.kind === 'new') edges.push({ from: sk.id, to: 'center', kind: 'solid', soft: true });
    });

    nodes.push({
      id: 'center',
      name: job.title,
      type: 'center',
      x: cols.center,
      y: H / 2 - 55,
      kicker: '真实发现岗位',
      skills: (job.requiredSkills || ['LLM', 'RAG', 'Agent', 'Tool Calling']).slice(0, 4),
      heat: job.conf,
      growth: job.growth,
      first: job.firstSeen
    });

    const rel = job.related.slice(0, depth >= 3 ? 4 : 3);
    rel.forEach((r, i) => {
      const y = 48 + i * ((H - 100) / Math.max(rel.length - 1, 1));
      nodes.push({ ...r, type: 'real', x: cols.real, y: Math.min(H - 90, y), kicker: '真实关联' });
      edges.push({ from: 'center', to: r.id, kind: 'solid', soft: i > 1 });
    });

    const pred = job.predicted.slice(0, depth >= 4 ? 5 : 4);
    pred.forEach((p, i) => {
      const y = 40 + i * ((H - 90) / Math.max(pred.length - 1, 1));
      nodes.push({ ...p, type: 'pred', x: cols.pred, y: Math.min(H - 90, y), kicker: '潜在方向' });
      edges.push({ from: 'center', to: p.id, kind: 'dash', soft: i > 1 });
    });

    return { nodes, edges, W, H };
  }

  function nodeHtml(n) {
    if (n.type === 'skill') {
      return (
        '<button type="button" class="de-node is-skill ' +
        (n.kind === 'boost' ? 'is-boost' : '') +
        '" data-id="' +
        esc(n.id) +
        '" style="left:' +
        n.x +
        'px;top:' +
        n.y +
        'px"><span class="de-n-name">' +
        esc(n.name) +
        '</span></button>'
      );
    }

    if (n.type === 'center') {
      return (
        '<button type="button" class="de-node is-center is-real" data-id="center" style="left:' +
        n.x +
        'px;top:' +
        n.y +
        'px"><span class="de-n-kicker">' +
        esc(n.kicker) +
        '</span><span class="de-n-name">' +
        esc(n.name) +
        '</span><div class="de-n-stats"><div>岗位热度<b>' +
        n.heat +
        '</b></div><div>增长趋势<b class="is-up">+' +
        n.growth +
        '%</b></div><div>首次出现<b>' +
        esc(n.first) +
        '</b></div><div>关联岗位<b>' +
        (currentJob.relatedCount || 12) +
        '</b></div></div><div class="de-n-skills">' +
        (n.skills || []).map((s) => '<span>' + esc(s) + '</span>').join('') +
        '</div></button>'
      );
    }

    const cls = n.type === 'hist' ? 'is-hist' : n.type === 'pred' ? 'is-pred' : 'is-real';
    const meta =
      n.type === 'pred'
        ? '<div class="de-n-meta"><span>' +
          esc(n.eta || '') +
          '</span><span>置信度 ' +
          (n.conf || 0) +
          '%</span></div>'
        : '<div class="de-n-meta"><span>' +
          esc(n.when || '') +
          '</span><span>' +
          (n.score != null ? n.score + '%' : '') +
          '</span></div>';

    return (
      '<button type="button" class="de-node ' +
      cls +
      '" data-id="' +
      esc(n.id) +
      '" style="left:' +
      n.x +
      'px;top:' +
      n.y +
      'px"><span class="de-n-kicker">' +
      esc(n.kicker) +
      '</span><span class="de-n-name">' +
      esc(n.name) +
      '</span>' +
      (n.skills
        ? '<div class="de-n-skills">' + n.skills.map((s) => '<span>' + esc(s) + '</span>').join('') + '</div>'
        : '') +
      meta +
      '</button>'
    );
  }

  function anchor(n) {
    const w = n.type === 'center' ? 178 : n.type === 'skill' ? 110 : 148;
    const h = n.type === 'center' ? 118 : n.type === 'skill' ? 28 : 78;
    return { cx: n.x + w / 2, cy: n.y + h / 2, l: n.x, r: n.x + w, t: n.y, b: n.y + h };
  }

  function drawEdges(g) {
    const svg = $('#de-edges');
    const canvas = $('#de-canvas');
    if (!svg || !canvas || !g) return;
    const rect = canvas.getBoundingClientRect();
    svg.setAttribute('viewBox', '0 0 ' + rect.width + ' ' + rect.height);
    svg.setAttribute('width', rect.width);
    svg.setAttribute('height', rect.height);

    const byId = {};
    g.nodes.forEach((n) => {
      byId[n.id] = n;
    });

    const parts = [];
    let labeledSrc = false;
    let labeledPred = false;
    g.edges.forEach((e) => {
      const a = byId[e.from];
      const b = byId[e.to];
      if (!a || !b) return;
      const A = anchor(a);
      const B = anchor(b);
      const x1 = a.x < b.x ? A.r : A.l;
      const y1 = A.cy;
      const x2 = a.x < b.x ? B.l : B.r;
      const y2 = B.cy;
      const mx = (x1 + x2) / 2;
      const stroke =
        e.kind === 'dash'
          ? 'rgba(212,176,122,' + (e.soft ? '0.35' : '0.55') + ')'
          : a.type === 'hist' || b.type === 'hist'
            ? 'rgba(107,140,174,' + (e.soft ? '0.35' : '0.55') + ')'
            : 'rgba(46,196,182,' + (e.soft ? '0.35' : '0.6') + ')';
      const dash = e.kind === 'dash' ? '6 5' : 'none';
      parts.push(
        '<path d="M' +
          x1 +
          ' ' +
          y1 +
          ' C' +
          mx +
          ' ' +
          y1 +
          ' ' +
          mx +
          ' ' +
          y2 +
          ' ' +
          x2 +
          ' ' +
          y2 +
          '" fill="none" stroke="' +
          stroke +
          '" stroke-width="' +
          (e.soft ? 1 : 1.4) +
          '" stroke-dasharray="' +
          dash +
          '" />'
      );
      if (!labeledSrc && a.type === 'hist' && b.id === 'center') {
        labeledSrc = true;
        parts.push(
          '<text class="de-edge-label" x="' + (mx - 18) + '" y="' + (Math.min(y1, y2) - 6) + '">能力来源</text>'
        );
      }
      if (!labeledPred && e.kind === 'dash') {
        labeledPred = true;
        parts.push(
          '<text class="de-edge-label" x="' + (mx + 4) + '" y="' + (Math.max(y1, y2) + 14) + '">潜在方向</text>'
        );
      }
    });
    svg.innerHTML = parts.join('');
  }

  function applyTransform() {
    const nodes = $('#de-nodes');
    if (!nodes) return;
    nodes.style.transform = 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + scale + ')';
    drawEdges(graph);
  }

  function renderGraph() {
    const depth = Number($('#de-depth')?.value || 3);
    graph = buildLayout(currentJob, depth);
    const host = $('#de-nodes');
    const canvas = $('#de-canvas');
    if (!host || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;
    const sx = rect.width / graph.W;
    const sy = rect.height / graph.H;
    graph.nodes.forEach((n) => {
      n.x = n.x * sx;
      n.y = n.y * sy;
    });
    graph.W = rect.width;
    graph.H = rect.height;

    host.innerHTML = graph.nodes.map(nodeHtml).join('');
    host.querySelectorAll('.de-node').forEach((el) => {
      el.addEventListener('click', () => selectNode(el.getAttribute('data-id')));
    });
    highlight(selectedId);
    requestAnimationFrame(() => drawEdges(graph));
  }

  function highlight(id) {
    selectedId = id || 'center';
    const q = ($('#de-search')?.value || '').trim();
    (rootEl === document ? document : rootEl).querySelectorAll('.de-node').forEach((el) => {
      const nid = el.getAttribute('data-id');
      el.classList.toggle('is-active', nid === selectedId);
      if (q) {
        const name = el.querySelector('.de-n-name')?.textContent || '';
        el.classList.toggle('is-dim', name.indexOf(q) === -1 && nid !== 'center');
      } else {
        el.classList.remove('is-dim');
      }
    });
  }

  function setNote(title, tag, blurb, showJump, jumpPayload) {
    const t = $('#de-rail-title') || $('#de-embed-title');
    const tagEl = $('#de-rail-tag') || $('#de-embed-tag');
    const b = $('#de-rail-blurb') || $('#de-embed-blurb');
    const jump = $('#de-open-detail') || $('#de-embed-jump');
    if (t) t.textContent = title;
    if (tagEl) {
      tagEl.textContent = tag;
      tagEl.classList.toggle('is-pred', tag.indexOf('潜在') !== -1 || tag.indexOf('预测') !== -1);
    }
    if (b) b.textContent = blurb;
    if (jump) {
      jump.hidden = !showJump;
      if (showJump && jumpPayload) {
        jump.onclick = function (e) {
          e.preventDefault();
          try {
            sessionStorage.setItem('zhitu_disc_job', JSON.stringify(jumpPayload));
            sessionStorage.setItem('zhitu_disc_lane', 'found');
          } catch (_) {}
          location.href = detailHref(jumpPayload.id);
        };
      }
    }
  }

  function selectNode(id) {
    highlight(id);
    const n = graph?.nodes.find((x) => x.id === id);
    if (!n || n.type === 'skill') return;

    if (n.type === 'center') {
      fillRail(currentJob);
      return;
    }

    if (n.type === 'pred') {
      setNote(
        n.name,
        '潜在方向',
        '仅示意演化可能，不会跳进「未来预测」线。预测岗位请从首页「未来预测」进入。',
        false
      );
      toast('潜在方向仅示意，不进入预测线', 'amber');
      return;
    }

    if (n.type === 'real' || n.type === 'hist') {
      const payload = {
        id: 'disc_evo_' + n.id,
        title: n.name,
        category: currentJob.category || '人工智能',
        confidence: n.score || n.conf || 75,
        is_forecast: false,
        status: 'found',
        requiredSkills: n.skills || ['LLM', 'Agent'],
        definition: n.name + ' · 由「' + currentJob.title + '」演化路径关联进入。',
        freshness: n.when || currentJob.firstSeen
      };
      setNote(
        n.name,
        n.type === 'hist' ? '已有岗位' : '真实关联',
        '仍在真实发现线内。可打开该岗位详情继续查看演化路径。',
        true,
        payload
      );
      if (!embedMode) {
        try {
          sessionStorage.setItem('zhitu_disc_job', JSON.stringify(payload));
          sessionStorage.setItem('zhitu_disc_lane', 'found');
        } catch (_) {}
        toast('进入关联岗位详情：' + n.name, 'mint');
        location.href = detailHref(payload.id);
      }
    }
  }

  function barsHtml(list, scoreKey) {
    return list
      .map((x) => {
        const s = x[scoreKey] || x.score || x.conf || 0;
        return (
          '<div class="de-bar-row"><span>' +
          esc(x.name) +
          '</span><span class="pct">' +
          s +
          '%</span><span class="track"><b style="width:' +
          s +
          '%"></b></span></div>'
        );
      })
      .join('');
  }

  function fillRail(job) {
    setNote(job.title, '真实发现', job.positioning, false);

    const kpis = $('#de-kpis');
    if (kpis) {
      kpis.innerHTML =
        '<div class="de-kpi"><span class="lab">首次出现</span><strong>' +
        esc(job.firstSeen) +
        '</strong></div>' +
        '<div class="de-kpi"><span class="lab">热度指数</span><strong>' +
        job.conf +
        '</strong></div>' +
        '<div class="de-kpi"><span class="lab">需求增长</span><strong class="is-up">↑ ' +
        job.growth +
        '%</strong></div>' +
        '<div class="de-kpi"><span class="lab">数据置信度</span><strong>' +
        job.dataConf +
        '%</strong></div>';
    }

    const src = $('#de-src-bars');
    if (src) src.innerHTML = barsHtml(job.sources.slice(0, 5), 'score');
    const mig = $('#de-mig-bars');
    if (mig) mig.innerHTML = barsHtml(job.related.slice(0, 5), 'score');

    const path = $('#de-path');
    if (path) {
      path.innerHTML =
        '<li class="is-now"><span class="when">当前</span><span class="who">' +
        esc(job.title) +
        '</span></li>' +
        job.predicted
          .slice(0, 3)
          .map(
            (p) =>
              '<li><span class="when">' +
              esc(p.eta) +
              '</span><span class="who">' +
              esc(p.name) +
              '</span><span class="conf">' +
              p.conf +
              '%</span></li>'
          )
          .join('');
    }

    renderMiniCharts(job);
  }

  function fillBottom(job) {
    const why = $('#de-why');
    if (why) why.textContent = job.why;
    const stages = $('#de-stages');
    if (stages) {
      stages.innerHTML = job.stages
        .map((s, i) => {
          const arrow = i < job.stages.length - 1 ? '<i>→</i>' : '';
          return '<span class="' + (s.now ? 'is-now' : '') + '">' + esc(s.label) + '</span>' + arrow;
        })
        .join('');
    }
    const delta = $('#de-skill-delta');
    if (delta) {
      delta.innerHTML = job.skillDelta
        .map(
          (d) =>
            '<div class="de-delta-row"><span>' +
            esc(d.name) +
            '</span><span class="track"><b style="width:' +
            d.delta +
            '%"></b></span><span class="up">+' +
            d.delta +
            '%</span></div>'
        )
        .join('');
    }
    renderForecast(job);
  }

  function renderMiniCharts(job) {
    if (!window.echarts) return;
    const indEl = $('#de-industry-chart');
    const trEl = $('#de-trend-chart');
    if (indEl) {
      if (!industryChart) industryChart = window.echarts.init(indEl);
      industryChart.setOption({
        color: ['#2ec4b6', '#6b8cae', '#d4b07a', '#4a6a88', '#3d9e94'],
        series: [
          {
            type: 'pie',
            radius: ['48%', '72%'],
            label: { show: false },
            data: [
              { name: '互联网', value: 42 },
              { name: '金融', value: 18 },
              { name: '企业服务', value: 16 },
              { name: '教育', value: 12 },
              { name: '其他', value: 12 }
            ]
          }
        ],
        tooltip: { trigger: 'item' }
      });
    }
    if (trEl) {
      if (!trendChart) trendChart = window.echarts.init(trEl);
      const base = job.conf - 20;
      const vals = [0, 1, 2, 3, 4, 5].map((i) => Math.round(base + i * (job.growth / 20) + (i % 2) * 3));
      trendChart.setOption({
        grid: { left: 4, right: 4, top: 8, bottom: 4 },
        xAxis: { type: 'category', show: false, data: vals.map((_, i) => i) },
        yAxis: { type: 'value', show: false },
        series: [
          {
            type: 'line',
            data: vals,
            smooth: true,
            symbol: 'none',
            lineStyle: { color: '#2ec4b6', width: 2 },
            areaStyle: { color: 'rgba(46,196,182,0.18)' }
          }
        ]
      });
    }
  }

  function renderForecast(job) {
    const el = $('#de-forecast-chart');
    if (!el || !window.echarts) return;
    if (!forecastChart) forecastChart = window.echarts.init(el);
    const hist = [42, 48, 55, 61, 70, 78, job.conf];
    const pred = hist.map((v, i) => (i < hist.length - 1 ? null : v)).concat([
      Math.min(98, job.conf + 6),
      Math.min(99, job.conf + 11),
      Math.min(99, job.conf + 14)
    ]);
    forecastChart.setOption({
      grid: { left: 28, right: 10, top: 12, bottom: 22 },
      xAxis: {
        type: 'category',
        data: ['M-6', 'M-5', 'M-4', 'M-3', 'M-2', 'M-1', '今', '+3', '+6', '+9'],
        axisLabel: { color: 'rgba(150,170,185,0.8)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }
      },
      yAxis: {
        type: 'value',
        min: 30,
        axisLabel: { color: 'rgba(150,170,185,0.7)', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
      },
      series: [
        {
          name: '岗位关联度',
          type: 'line',
          data: hist.concat([null, null, null]),
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { color: '#2ec4b6', width: 2 },
          itemStyle: { color: '#2ec4b6' }
        },
        {
          name: '预测延伸',
          type: 'line',
          data: pred,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#d4b07a', width: 2, type: 'dashed' },
          itemStyle: { color: '#d4b07a' }
        }
      ]
    });
  }

  function renderHeader(job) {
    const jt = $('#de-job-title');
    if (jt) jt.textContent = job.title;
    const tag = $('#de-tag');
    if (tag) {
      tag.textContent = '真实发现岗位';
      tag.classList.remove('is-pred');
    }
    const meta = $('#de-meta');
    if (meta) {
      meta.innerHTML =
        '<span class="de-chip">首次出现 <b>' +
        esc(job.firstSeen) +
        '</b></span>' +
        '<span class="de-chip">热度 <b>' +
        job.conf +
        '</b></span>' +
        '<span class="de-chip">增长 <b>+' +
        job.growth +
        '%</b></span>' +
        '<span class="de-chip">关联岗位 <b>' +
        job.relatedCount +
        '</b></span>';
    }
    const back = 'discovery-detail.html?id=' + encodeURIComponent(job.id || 'disc_mock_1') + '&tab=evolve';
    const bd = $('#de-back-detail');
    const bb = $('#de-back-btn');
    if (bd) bd.href = back;
    if (bb) bb.href = back;
    document.title = '执图破局 · ' + job.title + ' · 岗位演化路径';
  }

  function bindCanvasPan() {
    const canvas = $('#de-canvas');
    if (!canvas || canvas.dataset.panBound === '1') return;
    canvas.dataset.panBound = '1';
    let dragging = false;
    let last = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.de-node') || e.target.closest('.de-zoom')) return;
      dragging = true;
      last = { x: e.clientX, y: e.clientY };
      canvas.classList.add('is-panning');
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging || !last) return;
      pan.x += e.clientX - last.x;
      pan.y += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      applyTransform();
    });
    const end = () => {
      dragging = false;
      last = null;
      canvas.classList.remove('is-panning');
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  function bindChrome() {
    if (bound) return;
    bound = true;
    $('#de-depth')?.addEventListener('change', () => renderGraph());
    $('#de-range')?.addEventListener('change', () => {
      toast('已切换时间维度（演示）');
      renderMiniCharts(currentJob);
      renderForecast(currentJob);
    });
    $('#de-search')?.addEventListener('input', () => highlight(selectedId));
    $('#de-reset')?.addEventListener('click', () => {
      scale = 1;
      pan = { x: 0, y: 0 };
      const s = $('#de-search');
      if (s) s.value = '';
      applyTransform();
      highlight('center');
      fillRail(currentJob);
      toast('视图已重置');
    });
    $('#de-export')?.addEventListener('click', () => toast('图谱导出任务已创建'));
    (rootEl === document ? document : rootEl).querySelectorAll('.de-zoom button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const z = btn.getAttribute('data-zoom');
        if (z === 'in') scale = Math.min(1.6, scale + 0.1);
        if (z === 'out') scale = Math.max(0.7, scale - 0.1);
        if (z === 'fit') {
          scale = 1;
          pan = { x: 0, y: 0 };
        }
        applyTransform();
      });
    });
  }

  function mountCore(job) {
    currentJob = enrich(job || loadJob());
    if (currentJob.isForecast) return false;
    try {
      sessionStorage.setItem('zhitu_disc_lane', 'found');
    } catch (_) {}
    scale = 1;
    pan = { x: 0, y: 0 };
    selectedId = 'center';
    renderHeader(currentJob);
    bindChrome();
    bindCanvasPan();
    fillRail(currentJob);
    fillBottom(currentJob);
    requestAnimationFrame(() => {
      renderGraph();
      industryChart && industryChart.resize();
      trendChart && trendChart.resize();
      forecastChart && forecastChart.resize();
    });
    return true;
  }

  /** Embed into detail tab 05 */
  window.mountDiscoveryEvolveEmbed = function (root, job) {
    if (!root) return false;
    rootEl = root;
    embedMode = true;
    industryChart = null;
    trendChart = null;
    forecastChart = null;
    bound = false;
    return mountCore(job);
  };

  window.resizeDiscoveryEvolveEmbed = function () {
    renderGraph();
    industryChart && industryChart.resize();
    trendChart && trendChart.resize();
    forecastChart && forecastChart.resize();
  };

  window.initDiscoveryEvolve = function () {
    // Old standalone URL → detail tab 05
    const id = qs('id') || 'disc_mock_1';
    let job = null;
    try {
      const raw = sessionStorage.getItem('zhitu_disc_job');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!qs('id') || parsed.id === id) job = parsed;
      }
    } catch (_) {}
    if (job && (job.is_forecast || job.status === 'forecast')) {
      location.replace('discovery-detail.html?id=' + encodeURIComponent(job.id || id));
      return;
    }
    location.replace('discovery-detail.html?id=' + encodeURIComponent(id) + '&tab=evolve');
  };
})();
