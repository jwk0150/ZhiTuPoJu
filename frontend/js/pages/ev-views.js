/* 岗位能力演化工作台 · 其余 Tab 视图 (ev-views.js) */
(function () {
  'use strict';
  var A = window.EVApp;
  var D = window.EVData;
  var $ = A.$, $$ = A.$$, esc = A.esc, toast = A.toast;
  var store = A.store;
  var chartInstances = A.chartInstances;
  var disposeChart = A.disposeChart;
  var metricOf = function (v, m) {
    switch (m) {
      case 'frequency': return Math.round(v * 0.72);
      case 'coverage': return Math.round(v * 0.48);
      case 'adoption': return Math.round(v * 0.84);
      default: return v;
    }
  };
  var METRIC_LABEL = { demand: '招聘需求强度', frequency: '出现频率', coverage: '岗位覆盖率', adoption: '企业采用率' };

  function render(tab) {
    if (tab === 'changes') renderChanges();
    else if (tab === 'trends') renderTrends();
    else if (tab === 'forecast') renderForecast();
    else if (tab === 'evidence') renderEvidenceTab();
    else if (tab === 'gap') renderGap();
  }

  // ============================================================
  // 能力变更
  // ============================================================
  function renderChanges() {
    var C = D.CHANGES;
    var wrap = $('#ce-changes-body');
    if (!wrap) return;
    var per = $('#ce-changes-period');
    if (per) per.textContent = C.periodFrom + ' → ' + C.periodTo + ' · 共 ' + C.summary.all + ' 项变化';
    var head = document.createElement('div');
    head.className = 'ce-changes-filters';
    head.innerHTML = [
      ['all', '全部', C.summary.all], ['added', '新增', C.summary.added],
      ['modified', '修改', C.summary.modified], ['deleted', '删除', C.summary.deleted],
    ].map(function (f) {
      return '<button class="ce-chg-f' + (store._changeFilter === f[0] ? ' active' : '') + '" data-f="' + f[0] + '">' + f[1] + ' <b>' + f[2] + '</b></button>';
    }).join('');
    wrap.insertBefore(head, wrap.firstChild);
    $$('.ce-chg-f', head).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.ce-chg-f', head).forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        store._changeFilter = b.dataset.f;
        $$('.ce-chg-section', wrap).forEach(function (sec) {
          sec.style.display = (b.dataset.f === 'all' || sec.dataset.kind === b.dataset.f) ? '' : 'none';
        });
      });
    });
    wrap.innerHTML = wrap.innerHTML + addedSectionHtml() + modifiedSectionHtml() + deletedSectionHtml();
    bindChangeEvents();
  }

  function bindChangeEvents() {
    $$('.ce-chg-card', $('#ce-changes-body')).forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.dataset.id;
        if (id && window.EVInsight) window.EVInsight.openSkillInsight(id);
      });
    });
    $$('.ce-chg-evidence-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.dataset.id;
        if (id && window.EVEvidence) window.EVEvidence.open(id);
      });
    });
  }

  function addedSectionHtml() {
    var C = D.CHANGES;
    return '<section class="ce-chg-section" data-kind="added">' +
      '<div class="ce-chg-sec-head"><span class="ce-chg-badge add">NEW</span><h3>新增能力</h3>' +
      '<span class="ce-chg-sec-sub">之前不在能力模型中，现在成为岗位要求</span></div>' +
      '<div class="ce-chg-grid">' +
      C.added.map(function (c) {
        return '<div class="ce-chg-card add" data-id="' + c.id + '">' +
          '<div class="ce-chg-card-top"><span class="ce-chg-name">' + esc(c.name) + '</span><span class="ce-chg-growth">' + c.growth + '</span></div>' +
          '<div class="ce-chg-demand"><span>需求强度</span>' +
          '<div class="ce-chg-demand-bar"><i class="from" style="width:' + Math.min(100, c.demandFrom) + '%"></i><i class="to" style="width:' + Math.min(100, c.demandTo) + '%"></i></div>' +
          '<b>' + c.demandFrom + '% → ' + c.demandTo + '%</b></div>' +
          '<p class="ce-chg-why">为什么新增？<br><span>' + esc(c.why) + '</span></p>' +
          '<div class="ce-chg-tech">' + c.tech.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
          '<div class="ce-chg-foot"><span class="ce-chg-evidence-btn" data-id="' + c.id + '">查看证据</span> · <span class="ce-chg-detail">能力详情</span></div>' +
        '</div>';
      }).join('') +
      '</div></section>';
  }

  function modifiedSectionHtml() {
    var C = D.CHANGES;
    return '<section class="ce-chg-section" data-kind="modified">' +
      '<div class="ce-chg-sec-head"><span class="ce-chg-badge mod">UPD</span><h3>修改能力</h3>' +
      '<span class="ce-chg-sec-sub">不是消失，而是能力要求升级</span></div>' +
      '<div class="ce-chg-grid">' +
      C.modified.map(function (c) {
        return '<div class="ce-chg-card mod" data-id="' + c.id + '">' +
          '<div class="ce-chg-card-top"><span class="ce-chg-name">' + esc(c.name) + '</span><span class="ce-chg-depth">' + c.depth + '</span></div>' +
          '<div class="ce-chg-ba">' +
            '<div class="ce-chg-ba-col"><span class="ce-chg-ba-tag before">Before</span><p>' + esc(c.before) + '</p></div>' +
            '<div class="ce-chg-ba-arrow">→</div>' +
            '<div class="ce-chg-ba-col"><span class="ce-chg-ba-tag after">After</span><p>' + esc(c.after) + '</p></div>' +
          '</div>' +
          '<div class="ce-chg-tech">新增关联：' + c.addLinks.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
          '<p class="ce-chg-why">' + esc(c.reason) + '</p>' +
          '<div class="ce-chg-foot"><span class="ce-chg-evidence-btn" data-id="' + c.id + '">查看证据</span></div>' +
        '</div>';
      }).join('') +
      '</div></section>';
  }

  function deletedSectionHtml() {
    var C = D.CHANGES;
    return '<section class="ce-chg-section" data-kind="deleted">' +
      '<div class="ce-chg-sec-head"><span class="ce-chg-badge del">GONE</span><h3>删除能力</h3>' +
      '<span class="ce-chg-sec-sub">已退出核心能力模型（历史记录保留）</span></div>' +
      '<div class="ce-chg-grid del-grid">' +
      C.deleted.map(function (c) {
        return '<div class="ce-chg-card del">' +
          '<div class="ce-chg-card-top"><span class="ce-chg-name">' + esc(c.name) + '</span><span class="ce-chg-growth down">' + (c.to - c.from) + '%</span></div>' +
          '<div class="ce-chg-demand"><span>需求强度</span>' +
          '<div class="ce-chg-demand-bar"><i class="from" style="width:' + Math.min(100, c.from) + '%"></i><i class="to" style="width:' + Math.min(100, c.to) + '%"></i></div>' +
          '<b>' + c.from + '% → ' + c.to + '%</b></div>' +
          '<p class="ce-chg-why">原因：<span>' + esc(c.reason) + '</span></p>' +
          '<p class="ce-chg-note">' + esc(c.note) + '</p>' +
        '</div>';
      }).join('') +
      '</div></section>';
  }

  // ============================================================
  // 技术趋势（ECharts）
  // ============================================================
  function renderTrends() {
    var wrap = $('#ce-trends-body');
    if (!wrap) return;
    var rbtn = function (r, lb) {
      return '<button class="ce-tctl' + (store.timeRange === r ? ' active' : '') + '" data-r="' + r + '">' + lb + '</button>';
    };
    var gbtn = function (g, lb) {
      return '<button class="ce-tctl' + (store.granularity === g ? ' active' : '') + '" data-g="' + g + '">' + lb + '</button>';
    };
    var mbtn = function (m, lb) {
      return '<button class="ce-tctl' + (store.metric === m ? ' active' : '') + '" data-m="' + m + '">' + lb + '</button>';
    };
    wrap.innerHTML =
      '<div class="ce-trends-toolbar">' +
        '<div class="ce-tctl-group"><span class="ce-tctl-label">时间范围</span>' +
          rbtn('3', '过去 3 个月') + rbtn('6', '过去 6 个月') + rbtn('12', '过去 12 个月') + rbtn('24', '过去 24 个月') + '</div>' +
        '<div class="ce-tctl-group"><span class="ce-tctl-label">粒度</span>' +
          gbtn('month', '月') + gbtn('quarter', '季度') + gbtn('half', '半年') + '</div>' +
        '<div class="ce-tctl-group"><span class="ce-tctl-label">指标</span>' +
          mbtn('demand', '招聘需求强度') + mbtn('frequency', '出现频率') + mbtn('coverage', '岗位覆盖率') + '</div>' +
        '<label class="ce-tctl-toggle"><input type="checkbox" id="ce-fc-toggle" ' + (store.showForecast ? 'checked' : '') + '/><span>显示预测</span></label>' +
      '</div>' +
      '<div class="ce-trends-compare"><span class="ce-tctl-label">技能对比</span>' +
        '<div class="ce-trends-chips" id="ce-trend-chips"></div>' +
        '<span class="ce-trends-hint">点击曲线可查看能力详情</span></div>' +
      '<div class="ce-chart-card"><div class="ce-chart" id="ce-trend-chart"></div></div>' +
      '<div class="ce-trends-note">' + (D.isDemo()
        ? '当前展示为 <b>Demo 数据</b>；预测区间（虚线）为模型估计，非真实数据。'
        : '历史曲线基于真实 JD 语料与多源模型估计；预测区间（虚线）为<b>模型估计</b>。') + '</div>';

    $$('.ce-tctl[data-r]', wrap).forEach(function (b) { b.addEventListener('click', function () { store.timeRange = b.dataset.r; renderTrends(); }); });
    $$('.ce-tctl[data-g]', wrap).forEach(function (b) { b.addEventListener('click', function () { store.granularity = b.dataset.g; renderTrends(); }); });
    $$('.ce-tctl[data-m]', wrap).forEach(function (b) { b.addEventListener('click', function () { store.metric = b.dataset.m; renderTrends(); }); });
    var fc = $('#ce-fc-toggle');
    if (fc) fc.addEventListener('change', function () { store.showForecast = fc.checked; renderTrendChart(); });
    renderTrendChips();
    renderTrendChart();
  }

  function renderTrendChips() {
    var el = $('#ce-trend-chips');
    if (!el) return;
    el.innerHTML = D.SKILLS.map(function (s) {
      return '<button class="ce-chip' + (store.compareSkills.indexOf(s.id) >= 0 ? ' on' : '') + '" data-id="' + s.id + '">' + esc(s.name) + '</button>';
    }).join('');
    $$('.ce-chip', el).forEach(function (c) {
      c.addEventListener('click', function () {
        var id = c.dataset.id;
        var i = store.compareSkills.indexOf(id);
        if (i >= 0) store.compareSkills.splice(i, 1);
        else if (store.compareSkills.length < 5) store.compareSkills.push(id);
        else { toast('最多同时对比 5 项技能', 'amber'); return; }
        renderTrendChips();
        renderTrendChart();
      });
    });
  }

  function renderTrendChart() {
    var dom = $('#ce-trend-chart');
    if (!dom || !window.echarts) return;
    disposeChart('trend');
    var chart = window.echarts.init(dom);
    chartInstances.trend = chart;

    var N = D.N;
    var range = store.timeRange === 'all' ? N : parseInt(store.timeRange, 10);
    var startIdx = Math.max(0, N - range);
    var monthLabels = D.MONTHS.slice(startIdx);
    var gran = store.granularity;

    function agg(arr) {
      if (gran === 'month') return arr;
      var out = [];
      var step = gran === 'quarter' ? 3 : 6;
      for (var i = 0; i < arr.length; i += step) {
        var chunk = arr.slice(i, i + step).filter(function (v) { return v > 0; });
        out.push(chunk.length ? Math.round(chunk.reduce(function (a, b) { return a + b; }, 0) / chunk.length) : 0);
      }
      return out;
    }
    function aggLabels(labels) {
      if (gran === 'month') return labels;
      var step = gran === 'quarter' ? 3 : 6;
      var out = [];
      for (var i = 0; i < labels.length; i += step) {
        out.push(labels[i] + '~' + labels[Math.min(labels.length - 1, i + step - 1)]);
      }
      return out;
    }

    var labels = aggLabels(monthLabels);
    var colors = ['#3E9C77', '#9B7BD4', '#D98E3C', '#5B8DB8', '#CF6B62', '#7C9CD4', '#D99E6C', '#5FA88F'];
    var series = [];
    var hasForecast = store.showForecast;
    var histLen = labels.length;
    var fcLen = hasForecast ? D.FORECAST_MONTHS.length : 0;

    store.compareSkills.forEach(function (id, ci) {
      var s = D.SKILL_MAP[id];
      if (!s) return;
      var color = colors[ci % colors.length];
      var histRaw = agg(s.series.slice(startIdx)).map(function (v) { return metricOf(v, store.metric); });
      series.push({
        name: s.name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 5,
        data: histRaw, lineStyle: { width: 2.4, color: color }, itemStyle: { color: color },
        connectNulls: true, id: s.id,
      });
      if (hasForecast) {
        var fv = s.forecast.slice(0, fcLen).map(function (v) { return metricOf(v, store.metric); });
        var low = s.forecast.slice(0, fcLen).map(function (v) { return metricOf(Math.round(v * 0.86), store.metric); });
        var high = s.forecast.slice(0, fcLen).map(function (v) { return metricOf(Math.round(v * 1.14), store.metric); });
        var gapFill = new Array(histLen).fill(null);
        series.push({
          name: s.name + '（预测）', type: 'line', smooth: true, symbol: 'none',
          data: gapFill.concat(fv), z: 5, connectNulls: false,
          lineStyle: { width: 2, type: 'dashed', color: color }, itemStyle: { color: color },
          markLine: ci === 0 ? {
            symbol: 'none', silent: true, animation: false, z: 100,
            label: { show: true, position: 'insideEndTop', formatter: '预测起点', color: '#9B7BD4', fontSize: 11 },
            lineStyle: { color: 'rgba(155,123,212,0.5)', type: 'dashed', width: 1 },
            data: [{ xAxis: histLen - 0.5 }],
          } : undefined,
        });
        series.push({
          name: '下限', type: 'line', stack: 'band' + ci, symbol: 'none',
          data: new Array(histLen).fill(null).concat(low),
          lineStyle: { opacity: 0 }, areaStyle: { color: 'transparent' }, tooltip: { show: false }, silent: true,
        });
        series.push({
          name: '区间宽', type: 'line', stack: 'band' + ci, symbol: 'none',
          data: new Array(histLen).fill(null).concat(high.map(function (h, i) { return h - low[i]; })),
          lineStyle: { opacity: 0 }, areaStyle: { color: color, opacity: 0.13 }, tooltip: { show: false }, silent: true,
        });
      }
    });

    var allX = labels.concat(hasForecast ? D.FORECAST_MONTHS : []);
    chart.setOption({
      animation: true,
      grid: { left: 52, right: 30, top: 44, bottom: 36 },
      legend: {
        top: 8, type: 'scroll', textStyle: { color: '#665F55', fontSize: 12 },
        data: series.filter(function (s) { return s.name && !/区间|下限/.test(s.name); }).map(function (s) { return s.name; }),
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,252,246,0.97)', borderColor: 'rgba(140,120,90,0.25)',
        textStyle: { color: '#2B2821', fontSize: 12 },
        formatter: function (params) {
          var p0 = params[0];
          if (!p0) return '';
          var html = '<div style="font-weight:700;margin-bottom:4px">' + allX[p0.dataIndex] + '</div>';
          params.forEach(function (p) {
            if (!p || p.value === null || p.value === undefined || /区间|下限/.test(p.seriesName)) return;
            var c = p.color && typeof p.color === 'string' ? p.color : '#5B8DB8';
            html += '<div style="font-size:12px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + c + ';margin-right:6px"></span>' + p.seriesName + '：<b>' + p.value + '</b></div>';
          });
          var sk = D.SKILL_MAP[store.compareSkills[0]];
          var mi = p0.dataIndex;
          if (sk && mi < N) {
            var idx = startIdx + mi;
            var mom = idx > 0 ? Math.round((sk.series[idx] - sk.series[idx - 1]) / Math.max(sk.series[idx - 1], 0.5) * 100) : 0;
            var yoy = idx >= 12 ? Math.round((sk.series[idx] - sk.series[idx - 12]) / Math.max(sk.series[idx - 12], 0.5) * 100) : 0;
            html += '<div style="border-top:1px solid rgba(140,120,90,0.2);margin-top:5px;padding-top:5px;font-size:12px;color:#91887B">环比：<b>' + (mom >= 0 ? '+' : '') + mom + '%</b> &nbsp; 同比：<b>' + (yoy >= 0 ? '+' : '') + yoy + '%</b>' +
              '<br>岗位覆盖率：<b>' + Math.round(sk.series[idx] * 0.48) + '%</b> &nbsp; 数据量：<b>' + (Math.round(sk.series[idx] * 26) + 320).toLocaleString() + ' 条 JD</b></div>';
          }
          return html;
        },
      },
      xAxis: { type: 'category', data: allX, boundaryGap: false, axisLabel: { color: '#665F55', fontSize: 11 }, axisLine: { lineStyle: { color: '#DDD4C5' } } },
      yAxis: { type: 'value', name: METRIC_LABEL[store.metric] + (store.metric === 'demand' ? '' : '（估计）'), nameTextStyle: { color: '#91887B' }, axisLabel: { color: '#665F55' }, splitLine: { lineStyle: { color: 'rgba(140,120,90,0.12)', type: 'dashed' } } },
      series: series,
    });

    chart.on('click', function (p) {
      if (!p || !p.seriesName || /预测|区间|下限/.test(p.seriesName)) return;
      var id = p.seriesId || (D.SKILL_MAP[p.seriesName] ? p.seriesName : null);
      if (id && window.EVInsight) window.EVInsight.openSkillInsight(id);
    });

    var ro = new ResizeObserver(function () { try { chart.resize(); } catch (e) {} });
    ro.observe(dom);
  }

  // ============================================================
  // 未来预测
  // ============================================================
  function renderForecast() {
    var wrap = $('#ce-forecast-body');
    if (!wrap) return;
    var horizon = store.horizon;
    wrap.innerHTML =
      '<div class="ce-forecast-title"><h2>未来 ' + horizon + ' 个月，岗位需要什么？</h2>' +
      '<div class="ce-horizon-group">' +
        [1, 3, 6].map(function (h) { return '<button class="ce-tctl' + (horizon === h ? ' active' : '') + '" data-h="' + h + '">未来 ' + h + ' 个月</button>'; }).join('') +
      '</div><span class="ce-demo-flag">Demo 预测</span></div>' +
      (D.isDemo() ? '<div class="ce-demo-banner">当前为 <b>Demo 预测（Illustrative）</b>，用于演示预测模型交互；上线后将接入真实模型并标注置信区间。</div>' : '') +
      '<div class="ce-forecast-grid">' +
        '<div class="ce-panel"><div class="ce-panel-h"><span class="ce-panel-t">未来能力增长榜</span><span class="ce-panel-sub">按预测增长率排序</span></div>' +
          '<div class="ce-fc-rank" id="ce-fc-rank"></div></div>' +
        '<div class="ce-panel"><div class="ce-panel-h"><span class="ce-panel-t">未来能力气象图</span><span class="ce-panel-sub">点击查看预测依据</span></div>' +
          '<div class="ce-fc-weather" id="ce-fc-weather"></div></div>' +
      '</div>';

    $$('.ce-tctl[data-h]', wrap).forEach(function (b) { b.addEventListener('click', function () { store.horizon = parseInt(b.dataset.h, 10); renderForecast(); }); });

    var rank = D.forecastRanking(horizon);
    var rankEl = $('#ce-fc-rank');
    if (rankEl) {
      rankEl.innerHTML = rank.map(function (r, i) {
        return '<div class="ce-fc-rank-item" data-id="' + r.id + '">' +
          '<span class="ce-fc-rank-no">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<div class="ce-fc-rank-info"><span class="ce-fc-rank-name">' + esc(r.name) + '</span>' +
          '<div class="ce-fc-rank-bar"><i style="width:' + Math.min(100, Math.max(6, r.current)) + '%"></i></div></div>' +
          '<span class="ce-fc-rank-growth ' + (r.growth >= 0 ? 'up' : 'down') + '">' + (r.growth >= 0 ? '▲' : '▼') + ' ' + r.growth + '%</span>' +
          '<span class="ce-fc-rank-conf">' + Math.round(r.confidence * 100) + '%</span>' +
        '</div>';
      }).join('');
      $$('.ce-fc-rank-item', rankEl).forEach(function (it) { it.addEventListener('click', function () { openForecast(it.dataset.id); }); });
    }

    var weather = $('#ce-fc-weather');
    if (weather) {
      var heat = function (g) { return g < 0 ? '❄️' : g < 12 ? '🟢' : g >= 70 ? '🔥🔥🔥' : g >= 40 ? '🔥🔥' : '🔥'; };
      weather.innerHTML = rank.map(function (r) {
        var cls = 'grow';
        if (r.growth >= 50) cls = 'grow-fast';
        else if (r.growth <= 0 && r.status === 'deleted') cls = 'fade';
        else if (r.growth < 10) cls = 'steady';
        return '<button class="ce-weather-node ' + cls + '" data-id="' + r.id + '">' +
          '<span class="ce-weather-name">' + esc(r.name) + '</span>' +
          '<span class="ce-weather-heat">' + heat(r.growth) + '</span></button>';
      }).join('') + '<div class="ce-weather-legend"><span>🔥 快速增长</span><span>🟢 稳定</span><span>❄ 衰退</span></div>';
      $$('.ce-weather-node', weather).forEach(function (n) { n.addEventListener('click', function () { openForecast(n.dataset.id); }); });
    }
  }

  function openForecast(skillId) {
    if (window.EVEvidence) window.EVEvidence.open(skillId);
  }

  // ============================================================
  // 数据证据（结论 → 数据 → 原始证据）
  // ============================================================
  function renderEvidenceTab() {
    var wrap = $('#ce-evidence-body');
    if (!wrap) return;
    var claim = D.CHANGES.added[0];
    wrap.innerHTML =
      '<div class="ce-evidence-title"><h2>结论 → 数据 → 原始证据</h2>' +
      '<span class="ce-evidence-sub">每个结论可追溯到具体数据来源，防止无据结论</span></div>' +
      '<div class="ce-claim-chain">' +
        '<div class="ce-claim-box"><span class="ce-claim-tag">结论</span><h3>' + esc(claim.name) + ' 需求 ' + claim.growth + '</h3>' +
        '<p>来自 ' + D.EVIDENCE.length + ' 类数据源交叉验证</p></div>' +
        '<div class="ce-claim-arrow">↓</div>' +
        '<div class="ce-claim-sources">' +
        D.EVIDENCE.map(function (e) {
          return '<div class="ce-claim-source" data-id="' + e.id + '">' +
            '<span class="ce-claim-source-type">' + esc(e.type) + '</span><b>' + esc(e.scale) + '</b>' +
            '<span class="ce-claim-source-name">' + esc(e.name) + '</span>' +
            '<span class="ce-claim-source-conf">可信度 ' + Math.round(e.confidence * 100) + '%</span></div>';
        }).join('') +
        '</div></div>' +
      '<div class="ce-evidence-cards">' +
      D.EVIDENCE.map(function (e) { return evidenceCard(e); }).join('') +
      '</div>';
    $$('.ce-claim-source', wrap).forEach(function (el) { el.addEventListener('click', function () { openEvidenceCard(el.dataset.id); }); });
    $$('.ce-ev-card', wrap).forEach(function (el) { el.addEventListener('click', function () { openEvidenceCard(el.dataset.id); }); });
  }

  function evidenceCard(e) {
    return '<div class="ce-ev-card" data-id="' + e.id + '">' +
      '<div class="ce-ev-card-head"><span class="ce-ev-type">' + esc(e.type) + '</span><span class="ce-ev-conf">' + Math.round(e.confidence * 100) + '%</span></div>' +
      '<div class="ce-ev-name">' + esc(e.name) + '</div>' +
      '<div class="ce-ev-meta">' + esc(e.scale) + ' · ' + esc(e.timeRange) + '</div>' +
      '<p class="ce-ev-excerpt">' + highlight(e.excerpt, e.keywords) + '</p>' +
      '<div class="ce-ev-supports">' + e.supports.map(function (s) { return '<span>支持：' + esc(s) + '</span>'; }).join('') + '</div>' +
      '<div class="ce-ev-foot"><span>更新时间 ' + esc(e.updated) + '</span><b>查看原始证据 →</b></div>' +
    '</div>';
  }

  function highlight(text, kws) {
    var out = esc(text);
    (kws || []).forEach(function (k) {
      var re = new RegExp(esc(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      out = out.replace(re, '<mark>' + esc(k) + '</mark>');
    });
    return out;
  }

  function openEvidenceCard(eid) {
    var e = D.EVIDENCE_MAP[eid];
    if (!e) return;
    var skill = D.SKILLS.find(function (s) { return (s.evidence || []).indexOf(eid) >= 0; });
    if (skill && window.EVEvidence) window.EVEvidence.open(skill.id);
    else toast('该来源关联能力信息较少，请从具体能力进入证据详情', 'amber');
  }

  // ============================================================
  // 我的差距
  // ============================================================
  function renderGap() {
    var wrap = $('#ce-gap-body');
    if (!wrap) return;
    var items = D.GAP.items.slice().sort(function (a, b) { return b.gap - a.gap; });
    var maxGap = items[0];
    wrap.innerHTML =
      '<div class="ce-gap-title"><h2>我的能力 vs 未来岗位要求</h2>' +
      '<span class="ce-gap-sub">' + esc(D.GAP.profile) + ' · ' + esc(D.GAP.sourceNote) + '</span></div>' +
      '<div class="ce-gap-max"><span class="ce-gap-max-label">最大能力缺口</span><b>' + esc(maxGap.name) + '</b>' +
      '<em>差距 ' + maxGap.gap + '</em><span class="ce-gap-max-tag">优先补强</span></div>' +
      '<div class="ce-gap-list">' +
      items.map(function (g) {
        var cls = g.gap >= 50 ? 'severe' : g.gap >= 25 ? 'warn' : 'ok';
        return '<div class="ce-gap-item ' + cls + '" data-id="' + g.id + '">' +
          '<div class="ce-gap-name">' + esc(g.name) + '<span class="ce-gap-level">' + esc(g.level) + '</span></div>' +
          '<div class="ce-gap-bars">' +
            '<div class="ce-gap-bar-row"><span class="ce-gap-bar-label">岗位要求</span><div class="ce-gap-bar"><i style="width:' + g.required + '%"></i></div><b>' + g.required + '</b></div>' +
            '<div class="ce-gap-bar-row mine"><span class="ce-gap-bar-label">我的能力</span><div class="ce-gap-bar"><i style="width:' + g.mine + '%"></i></div><b>' + g.mine + '</b></div>' +
          '</div>' +
          '<span class="ce-gap-num' + (g.gap >= 50 ? ' severe' : '') + '">差 ' + g.gap + '</span></div>';
      }).join('') +
      '</div>' +
      '<div class="ce-path-panel"><div class="ce-path-head"><h3>我的能力进化路径</h3>' +
      '<span class="ce-path-sub">基于当前能力 + 未来岗位需求生成</span></div>' +
      '<div class="ce-path">' +
      D.PATH.map(function (p, i) {
        var map = { have: ['已具备', 'ok'], partial: ['部分具备', 'partial'], gap: ['能力缺口', 'gap'], learn: ['推荐学习', 'learn'] };
        var m = map[p.status];
        return '<div class="ce-path-node ' + m[1] + '">' +
          '<div class="ce-path-dot"></div><span class="ce-path-name">' + esc(p.name) + '</span>' +
          '<span class="ce-path-status">' + m[0] + '</span><span class="ce-path-period">' + esc(p.period) + '</span>' +
          (i < D.PATH.length - 1 ? '<div class="ce-path-line"></div>' : '') + '</div>';
      }).join('') +
      '</div>' +
      '<button class="ce-btn primary big" id="ce-gen-path">生成我的能力提升路线</button></div>';

    $$('.ce-gap-item', wrap).forEach(function (el) { el.addEventListener('click', function () { var id = el.dataset.id; if (id && window.EVInsight) window.EVInsight.openSkillInsight(id); }); });
    var btn = $('#ce-gen-path');
    if (btn) btn.addEventListener('click', function () { toast('已生成个性化能力提升路线（演示）', 'mint'); });
  }

  window.EVViews = { render: render };
})();