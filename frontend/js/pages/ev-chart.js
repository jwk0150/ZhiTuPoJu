/* 岗位能力演化工作台 · 时间×能力层级演化图 (ev-chart.js) */
(function () {
  'use strict';
  var A = window.EVApp;
  var D = window.EVData;
  var $ = A.$, $$ = A.$$, esc = A.esc;
  var store = A.store;
  var COLORS = A.STATUS_COLORS;

  var CW = 1080, CH = 572, PL = 118, PR = 26, PT = 16, PB = 52;
  var BAND_H = 92, BAND_GAP = 5, PAD = 8;

  function bandTop(i) { return PT + i * (BAND_H + BAND_GAP); }
  function colX(c) { return PL + (c + 0.5) * ((CW - PL - PR) / D.VERSIONS.length); }
  function yAt(node, c, top) {
    var v = node.vals[c].value;
    if (v <= 0) return -1;
    var norm = Math.min(1, v / node.bandMax);
    return top + PAD + (1 - norm) * (BAND_H - PAD * 2);
  }

  function buildModel() {
    var colIdx = A.currentCol();
    return D.CHART_BANDS.map(function (band) {
      var nodes = band.ids.map(function (id) {
        var n = D.chartNodeById(id);
        if (!n) return null;
        var vals = D.VERSIONS.map(function (v, c) {
          return { value: D.chartValue(n, c), status: D.chartStatusAt(n, c) };
        });
        var maxV = 1;
        vals.forEach(function (x) { if (x.value > maxV) maxV = x.value; });
        return {
          id: n.id, name: n.name, en: n.en, isSkill: n.isSkill,
          imp: n.importance || 3, vals: vals, maxV: maxV,
          rawStatus: n.status, versionAdded: n.versionAdded || 'V2024.01',
          reason: n.reason || '', related: n.related || [],
        };
      }).filter(function (x) { return !!x; });
      var bandMax = 1;
      nodes.forEach(function (n) { if (n.maxV > bandMax) bandMax = n.maxV; });
      nodes.forEach(function (n) { n.bandMax = bandMax; });
      return { id: band.id, name: band.name, nodes: nodes, bandMax: bandMax };
    });
  }

  function nodeColor(node, c) {
    var st = node.vals[c].status;
    if (store.selectedSkill === node.id) return '#2B4C6F';
    return COLORS[st] || COLORS.stable;
  }

  function filterOk(node, c) {
    if (store.filter === 'all') return true;
    var st = node.vals[c].status;
    switch (store.filter) {
      case 'added': return st === 'added';
      case 'stable': return st === 'stable';
      case 'declining': return st === 'declining';
      case 'predicted': return st === 'predicted';
      case 'modified': return node.rawStatus === 'modified' && node.vals[c].value > 0;
      default: return true;
    }
  }

  function renderChart() {
    var svg = $('#ce-chart-svg');
    var wrap = $('#ce-chart-wrap');
    if (!svg || !wrap) return;
    var model = buildModel();
    var colIdx = A.currentCol();
    var curVer = A.currentVersion();
    var range = $('#ce-ct-range');
    if (range) range.textContent = '2024.01 → ' + curVer.label + (curVer.isForecast ? '（预测）' : '');

    var html = '';
    var c, bi, p;

    // 版本列网格线与坐标
    for (c = 0; c < D.VERSIONS.length; c++) {
      var isCur = c === colIdx;
      html += '<line class="ce-cv-grid' + (isCur ? ' cur' : '') + '" x1="' + colX(c) + '" y1="' + PT + '" x2="' + colX(c) + '" y2="' + (CH - PB + 6) + '"/>';
      html += '<text class="ce-cv-axis' + (isCur ? ' cur' : '') + '" x="' + colX(c) + '" y="' + (CH - PB + 26) + '" text-anchor="middle">' + D.VERSIONS[c].label + (D.VERSIONS[c].isForecast ? ' ·预测' : '') + '</text>';
    }
    // 当前版本引导线
    html += '<line class="ce-cv-guide" x1="' + colX(colIdx) + '" y1="' + PT + '" x2="' + colX(colIdx) + '" y2="' + (CH - PB + 6) + '"/>';

    // 层级带
    model.forEach(function (band, bi) {
      var top = bandTop(bi);
      html += '<text class="ce-band-label" x="' + (PL - 14) + '" y="' + (top + BAND_H / 2 + 4) + '" text-anchor="end">' + esc(band.name) + '</text>';
      html += '<line class="ce-band-line' + (bi === model.length - 1 ? ' last' : '') + '" x1="' + PL + '" y1="' + (top + BAND_H + 4) + '" x2="' + (CW - PR) + '" y2="' + (top + BAND_H + 4) + '"/>';
      html += '<rect class="ce-cv-col-bg" x="' + (colX(colIdx) - 72) + '" y="' + top + '" width="144" height="' + BAND_H + '" rx="10"/>';

      // 轨迹线
      band.nodes.forEach(function (node) {
        var pts = [];
        for (c = 0; c < D.VERSIONS.length; c++) {
          var y = yAt(node, c, top);
          if (y > 0) pts.push({ x: colX(c), y: y });
        }
        if (pts.length < 2) return;
        var d = 'M ' + pts[0].x + ' ' + pts[0].y;
        for (p = 1; p < pts.length; p++) d += ' L ' + pts[p].x + ' ' + pts[p].y;
        var sel = store.selectedSkill === node.id;
        var dim = store.hover && store.hover !== node.id;
        var cls = 'ce-cv-line';
        if (sel) cls += ' sel';
        if (dim) cls += ' dim';
        if (!filterOk(node, colIdx)) cls += ' hide';
        var lw = sel ? 2.4 : (node.isSkill ? 1.5 : 1.3);
        var lc = sel ? '#2B4C6F' : (node.rawStatus === 'deleted' ? 'rgba(207,107,98,.45)' : 'rgba(91,141,184,.5)');
        html += '<path class="' + cls + '" d="' + d + '" stroke="' + lc + '" stroke-width="' + lw + '" fill="none"/>';
      });
    });
    renderNodes(html, model, colIdx, svg, wrap);
  }

  function renderNodes(html, model, colIdx, svg, wrap) {
    var c;
    // 节点
    model.forEach(function (band, bi) {
      var top = bandTop(bi);
      band.nodes.forEach(function (node, ni) {
        var cls = ['ce-cv-node'];
        if (store.selectedSkill === node.id) cls.push('selected');
        if (store.hover === node.id) cls.push('hover');
        if (store.hover && store.hover !== node.id) cls.push('dim');
        if (!filterOk(node, colIdx)) cls.push('hide');
        var anim = ' style="animation-delay:' + (bi * 60 + ni * 28) + 'ms"';
        for (c = 0; c < D.VERSIONS.length; c++) {
          var y = yAt(node, c, top);
          if (y <= 0) continue;
          var color = nodeColor(node, c);
          var r = 3.4 + (node.imp / 5) * 3.1;
          var ring = '';
          if (store.selectedSkill === node.id) {
            ring = '<circle class="ce-cv-ring" cx="0" cy="0" r="' + (r + 3.5) + '" fill="none" stroke="#2B4C6F" stroke-width="1.6"/>';
          }
          var label = '';
          if (store.hover === node.id || store.selectedSkill === node.id) {
            label = '<text class="ce-cv-nlabel" x="0" y="' + (-(r + 7)) + '" text-anchor="middle">' + esc(node.name) + '</text>';
          }
          html += '<g class="' + cls.join(' ') + '" data-id="' + node.id + '" data-ver="' + D.VERSIONS[c].id + '"' + anim +
            ' transform="translate(' + colX(c).toFixed(1) + ',' + y.toFixed(1) + ')">' +
            ring + label +
            '<circle class="ce-cv-dot" r="' + r + '" fill="' + color + '" opacity="' + (node.vals[c].value <= 0 ? 0 : 1) + '"/>' +
            '<title>' + esc(node.name) + ' · ' + D.VERSIONS[c].label + ' · ' + Math.round(node.vals[c].value) + '</title>' +
          '</g>';
        }
      });
    });
    svg.innerHTML = html;
    applyZoom(svg);
    svg.classList.add('ce-noanim');
    bindEvents(svg, wrap, model);
  }

  function applyZoom(svg) {
    var z = store.zoom;
    var vw = CW / z, vh = CH / z;
    var vx = Math.max(0, (CW - vw) / 2), vy = Math.max(0, (CH - vh) / 2);
    svg.setAttribute('viewBox', vx + ' ' + vy + ' ' + vw + ' ' + vh);
  }

  function bindEvents(svg, wrap, model) {
    var tip = $('#ce-tooltip');
    $$('.ce-cv-node', svg).forEach(function (g) {
      g.addEventListener('mouseenter', function (e) {
        store.hover = g.dataset.id;
        svg.querySelectorAll('.ce-cv-node').forEach(function (x) {
          x.classList.toggle('hover', x.dataset.id === store.hover);
          x.classList.toggle('dim', x.dataset.id !== store.hover);
        });
        svg.querySelectorAll('.ce-cv-line').forEach(function (l) { l.classList.add('dim'); });
        showTooltip(e, store.hover, model, wrap, tip);
      });
      g.addEventListener('mouseleave', function () {
        store.hover = null;
        svg.querySelectorAll('.ce-cv-node').forEach(function (x) { x.classList.remove('hover', 'dim'); });
        svg.querySelectorAll('.ce-cv-line').forEach(function (l) { l.classList.remove('dim'); });
        if (tip) tip.style.display = 'none';
      });
      g.addEventListener('click', function () {
        var id = g.dataset.id;
        if (D.SKILL_MAP[id]) { if (window.EVInsight) window.EVInsight.openSkillInsight(id); }
        else { store.selectedSkill = id; renderChart(); }
      });
    });
  }

  function showTooltip(e, id, model, wrap, tip) {
    if (!tip) return;
    var n = null;
    model.forEach(function (b) { b.nodes.forEach(function (x) { if (x.id === id) n = x; }); });
    if (!n) return;
    var skill = D.SKILL_MAP[id];
    var counts = skill ? D.evidenceCounts(skill, store.version) : null;
    var rel = skill ? D.relevance(skill, store.version) : null;
    var growth = skill ? D.futureGrowth(skill) : null;
    var col = A.currentCol();
    var val = n.vals[col] ? n.vals[col].value : 0;
    var st = n.vals[col] ? n.vals[col].status : 'stable';
    var html = '<div class="ce-tt-name">' + esc(n.name) + (n.en ? ' <em>' + esc(n.en) + '</em>' : '') + '</div>' +
      '<div class="ce-tt-status s-' + st + '">' + (A.STATUS_LABELS[st] || '稳定') + ' · ' + currentVersionLabel() + '</div>' +
      '<div class="ce-tt-grid">' +
        '<div><span>当前能力值</span><b>' + Math.round(val) + '</b></div>' +
        (rel != null ? '<div><span>岗位相关度</span><b>' + rel + '%</b></div>' : '') +
        (growth != null ? '<div class="' + (growth >= 0 ? 'up' : 'down') + '"><span>未来增长</span><b>' + (growth >= 0 ? '+' : '') + growth + '%</b></div>' : '') +
        '<div><span>首次出现</span><b>' + esc(n.versionAdded) + '</b></div>' +
      '</div>' +
      (counts ? '<div class="ce-tt-ev">招聘需求 ' + counts.recruit + ' 条 · 企业岗位 ' + counts.corp + ' 个 · 行业报告 ' + counts.report + ' 份</div>' : '') +
      '<div class="ce-tt-hint">点击节点查看能力详情 →</div>';
    tip.innerHTML = html;
    tip.style.display = 'block';
    var rect = wrap.getBoundingClientRect();
    var x = e.clientX - rect.left + 14, y = e.clientY - rect.top + 14;
    if (x + 240 > rect.width) x = e.clientX - rect.left - 248;
    if (y + 150 > rect.height) y = e.clientY - rect.top - 158;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  function currentVersionLabel() {
    return A.currentVersion().label + (A.currentVersion().isForecast ? ' 预测' : '');
  }

  var FILTERS = [['all', '全部'], ['added', '新增'], ['modified', '修改'], ['stable', '稳定'], ['declining', '衰减'], ['predicted', '预测']];

  function renderFilters() {
    var el = $('#ce-chart-filters');
    if (!el) return;
    el.innerHTML = FILTERS.map(function (f) {
      return '<button class="ce-cf' + (store.filter === f[0] ? ' active' : '') + '" data-f="' + f[0] + '" type="button">' + f[1] + '</button>';
    }).join('');
    $$('.ce-cf', el).forEach(function (b) { b.addEventListener('click', function () { store.filter = b.dataset.f; renderFilters(); renderChart(); }); });
  }

  function renderLegend() {
    var el = $('#ce-chart-legend');
    if (!el) return;
    el.innerHTML = [
      ['#3E9C77', '新增'], ['#5B8DB8', '稳定'], ['#D98E3C', '修改'], ['#CF6B62', '衰减'],
      ['#9B7BD4', '预测'], ['#2B4C6F', '选中'],
    ].map(function (x) {
      return '<span><i style="background:' + x[0] + '"></i>' + x[1] + '</span>';
    }).join('') + '<em class="ce-chart-hint">Hover 查看详情 · 点击能力联动右侧洞察 · 双击空白重置</em>';
  }

  function zoom(f) {
    store.zoom = Math.min(1.7, Math.max(1, store.zoom + f));
    renderChart();
  }

  function bindControls() {
    var zin = $('#ce-zoom-in'), zout = $('#ce-zoom-out'), zrs = $('#ce-zoom-reset');
    if (zin && !zin.dataset.bound) { zin.dataset.bound = '1'; zin.addEventListener('click', function () { zoom(0.15); }); }
    if (zout && !zout.dataset.bound) { zout.dataset.bound = '1'; zout.addEventListener('click', function () { zoom(-0.15); }); }
    if (zrs && !zrs.dataset.bound) { zrs.dataset.bound = '1'; zrs.addEventListener('click', function () { store.zoom = 1; renderChart(); }); }
  }

  window.EVChart = {
    render: function () { renderChart(); renderFilters(); renderLegend(); bindControls(); },
  };
})();
