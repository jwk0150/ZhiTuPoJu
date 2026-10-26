/* 可视化大厅 · 2D 数据图鉴
 * 数据：全部来自库内接口（/api/data/*、/api/trends/*、/api/map/provinces）
 * 图表：纯 SVG 手绘，无第三方图表库；随容器宽度重排，不做 3D 透视
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var C = {
    ink: '#14110C',
    soft: '#4A4438',
    muted: '#8a8477',
    line: 'rgba(20,17,12,.10)',
    gold: '#A88B4E',
    goldDeep: '#8B7340',
    goldLight: '#C4A86B',
    rose: '#C84738',
    teal: '#3D8B7A',
    slate: '#5B7C99',
    paper: '#FBF8F2'
  };
  var PALETTE = [C.gold, C.rose, C.teal, C.slate, C.goldLight, '#8B6B4A', '#6B8F71', '#B86B5A'];

  // 数据快照日期：固定为 2026-10-01（演示口径，不随接口返回变化）
  var SNAPSHOT_DATE = '2026-10-01';

  var state = {
    stats: null,
    provinces: null,
    city: null,
    salary: null,
    kpi: null,
    trends: null,
    emerging: null,
    insight: null
  };

  var drawers = {};          // key -> function(host, w, h)
  var dataReady = {};        // key -> bool
  var hostIds = {
    star: 'vh-chart-star',
    city: 'vh-chart-city',
    prov: 'vh-chart-prov',
    salary: 'vh-chart-salary',
    pay: 'vh-chart-pay',
    demand: 'vh-chart-demand',
    future: 'vh-chart-future'
  };
  var panelTitles = {
    star: '省份岗位星图',
    city: '城市岗位需求',
    prov: '省份岗位占比',
    salary: '薪资区间分布',
    pay: '省份平均月薪',
    demand: '在库岗位需求',
    future: '新兴岗位成长潜力'
  };

  var lightboxKey = null;
  var tipEl = null;
  var resizeTimer = 0;

  /* ============================ 基础工具 ============================ */
  function $(id) { return document.getElementById(id); }

  function fmtInt(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Math.round(Number(n)).toLocaleString('zh-CN');
  }
  function fmtK(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1) + '万';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(Math.round(n));
  }
  /* 薪资统一用 k 记：¥16.8k / ¥20.3k，避免「¥2万」丢精度 */
  function fmtMoneyK(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    if (n >= 1000) return '¥' + (n / 1000).toFixed(1) + 'k';
    return '¥' + Math.round(n);
  }
  function fmtPct(part, total) {
    if (!total) return '—';
    return (part / total * 100).toFixed(1) + '%';
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeOutCubic(p) { return 1 - Math.pow(1 - p, 3); }

  /* 一次性入场动画：面板里只播一次，窗口缩放重绘不重播；弹层打开时强制重播 */
  var playedAnim = {};
  var animUntil = {};
  var replayAnim = false;
  function takeAnim(key) {
    if (reduceMotion) return false;
    if (replayAnim) return true;
    if (playedAnim[key]) return false;
    playedAnim[key] = true;
    animUntil[key] = Date.now() + 1100; // 动画期间忽略 ResizeObserver 的重绘，避免把动画打断
    return true;
  }
  /* 级联：第 i 个元素在整段动画里错峰启动，最后一个恰好在 p=1 收尾 */
  function cascade(p, i, n, spread) {
    if (n <= 1) return p;
    var d = spread / (n - 1);
    return clamp((p - i * d) / (1 - spread), 0, 1);
  }
  function tween(dur, frame) {
    if (reduceMotion) { frame(1); return; }
    var t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      frame(p);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function trunc(s, max) {
    s = String(s == null ? '' : s);
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }
  function wrap2(s, per) {
    s = String(s == null ? '' : s);
    if (s.length <= per) return [s];
    var head = s.slice(0, per);
    var rest = s.slice(per, per * 2 - 1);
    return [head, rest + (s.length > per * 2 - 1 ? '…' : '')];
  }
  function sizeOf(host) {
    var w = Math.max(240, Math.round(host.clientWidth || 320));
    var h = Math.max(180, Math.round(host.clientHeight || 260));
    return { w: w, h: h };
  }
  function mkSvg(w, h) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.opacity = reduceMotion ? '1' : '0';
    if (!reduceMotion) {
      requestAnimationFrame(function () {
        svg.style.transition = 'opacity .45s ease';
        svg.style.opacity = '1';
      });
    }
    return svg;
  }
  function el(tag, attrs, textContent) {
    var node = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (textContent !== undefined && textContent !== null) node.textContent = textContent;
    return node;
  }
  function label(svg, x, y, str, cls, anchor) {
    var t = el('text', { x: x, y: y, class: cls || 'vh-svg-label' }, str);
    t.setAttribute('text-anchor', anchor || 'start');
    svg.appendChild(t);
    return t;
  }

  /* ---------------- 颜色 ---------------- */
  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  var SAL_STOPS = [hexToRgb('#3D8B7A'), hexToRgb('#C4A86B'), hexToRgb('#C84738')];
  function salaryColor(t) {
    t = clamp(t, 0, 1);
    var seg = t < .5 ? 0 : 1;
    var local = t < .5 ? t / .5 : (t - .5) / .5;
    var a = SAL_STOPS[seg], b = SAL_STOPS[seg + 1];
    var rgb = [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * local); });
    return 'rgb(' + rgb.join(',') + ')';
  }

  /* ---------------- 提示卡 ---------------- */
  function ensureTip() {
    if (tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'vh-tip';
    tipEl.setAttribute('role', 'status');
    document.body.appendChild(tipEl);
    return tipEl;
  }
  function tipRows(rows) {
    return rows.map(function (r) {
      return '<div class="vh-tip-row"><span>' + escapeHtml(r[0]) + '</span><span>' + escapeHtml(r[1]) + '</span></div>';
    }).join('');
  }
  function moveTip(e) {
    if (!tipEl) return;
    var pad = 14;
    var x = e.clientX + pad, y = e.clientY + pad;
    var rect = tipEl.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 8) x = e.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 8) y = e.clientY - rect.height - pad;
    tipEl.style.left = Math.max(6, x) + 'px';
    tipEl.style.top = Math.max(6, y) + 'px';
  }
  function showTip(html, e) {
    var t = ensureTip();
    t.innerHTML = html;
    t.classList.add('is-on');
    moveTip(e);
  }
  function hideTip() { if (tipEl) tipEl.classList.remove('is-on'); }

  function bindMark(node, htmlFn, hoverTargets) {
    node.addEventListener('mouseenter', function (e) {
      showTip(htmlFn(), e);
      (hoverTargets || []).forEach(function (t) { t.classList.add('is-hot'); });
    });
    node.addEventListener('mousemove', moveTip);
    node.addEventListener('mouseleave', function () {
      hideTip();
      (hoverTargets || []).forEach(function (t) { t.classList.remove('is-hot'); });
    });
  }

  /* ---------------- 数据请求 ---------------- */
  function getJSON(path, timeoutMs) {
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, timeoutMs || 20000);
    return fetch(path, { signal: ctl.signal, headers: { 'Accept': 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (payload) {
        clearTimeout(timer);
        if (!payload || payload.code !== 0) throw new Error('payload code ' + (payload && payload.code));
        return payload.data;
      })
      .catch(function (err) {
        clearTimeout(timer);
        throw err;
      });
  }

  /* 慢接口（AI 生成，单次 3–10s）做会话级缓存：刷新不再等，也不会每次跳变 */
  function cachedJSON(path, ttlMs, timeoutMs) {
    var key = 'vh:v1:' + path;
    try {
      var raw = window.sessionStorage.getItem(key);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && saved.t && (Date.now() - saved.t) < ttlMs) return Promise.resolve(saved.d);
      }
    } catch (_) { /* storage 不可用则直接请求 */ }
    return getJSON(path, timeoutMs).then(function (d) {
      try { window.sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: d })); } catch (_) {}
      return d;
    });
  }

  /* 图表无障碍描述：读屏与键盘用户也能拿到关键数值 */
  function describe(host, text) {
    if (!host) return;
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', text);
  }

  /* ============================ 图表：横向条形 ============================ */
  function drawBars(host, w, h, rows, opt) {
    opt = opt || {};
    var n = rows.length;
    if (!n) return emptyChart(host);
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1;
    var labelW = clamp((opt.labelChars || 9) * 11 + 6, 58, Math.min(150, w * 0.32));
    var valW = opt.valWidth || 44;
    var plotW = Math.max(24, w - labelW - valW);
    var padTop = 4, padBottom = 4;
    var rowH = (h - padTop - padBottom) / n;
    var barH = clamp(rowH * 0.46, 7, 15);

    var svg = mkSvg(w, h);
    var grown = [];
    rows.forEach(function (r, i) {
      var cy = padTop + rowH * i + rowH / 2;
      var y = cy - barH / 2;
      var band = el('rect', { x: 0, y: padTop + rowH * i + 1, width: w, height: rowH - 2, fill: 'transparent' });
      svg.appendChild(band);

      var track = el('rect', {
        x: labelW, y: y, width: plotW, height: barH,
        fill: 'rgba(168,139,78,.10)'
      });
      svg.appendChild(track);

      var len = Math.max(2, plotW * (r.value / max));
      var color = r.color || opt.color || C.gold;
      var bar = el('rect', {
        x: labelW, y: y, width: len, height: barH,
        fill: color, class: 'vh-bar'
      });
      svg.appendChild(bar);
      grown.push({ el: bar, len: len });

      label(svg, 0, cy + 4, trunc(r.label, opt.labelChars || 9), 'vh-svg-label', 'start');
      label(svg, w - 2, cy + 4, opt.valueFmt ? opt.valueFmt(r.value) : fmtInt(r.value), 'vh-svg-value', 'end');

      if (r.meta) {
        var metaRoom = Math.max(0, len - 8);
        if (metaRoom > 54) {
          var m = label(svg, labelW + len - 6, cy + 4, r.meta, 'vh-svg-label--muted', 'end');
          m.setAttribute('fill', 'rgba(20,17,12,.55)');
        }
      }

      bindMark(band, function () {
        return '<b>' + escapeHtml(r.label) + '</b>' +
          tipRows(opt.tipRows ? opt.tipRows(r) : [['数值', fmtInt(r.value)]]) +
          (r.note ? '<div class="vh-tip-note">' + escapeHtml(r.note) + '</div>' : '');
      }, [bar, track]);
    });
    mountSvg(host, svg);
    if (opt.animate) {
      grown.forEach(function (g) { g.el.setAttribute('width', 0); });
      tween(900, function (p) {
        grown.forEach(function (g, i) {
          var q = cascade(p, i, grown.length, 0.45);
          g.el.setAttribute('width', g.len * easeOutCubic(q));
        });
      });
    }
  }

  /* ============================ 图表：环形占比 ============================ */
  function drawDonut(host, w, h, rows, opt) {
    opt = opt || {};
    if (!rows.length) return emptyChart(host);
    var total = rows.reduce(function (s, r) { return s + r.value; }, 0);
    var donut = Math.min(w * 0.52, h - 10, 300);
    var cx = donut / 2 + 4, cy = h / 2;
    var r2 = donut / 2 - 4, r1 = r2 * 0.6;
    var svg = mkSvg(w, h);
    var a = -Math.PI / 2;
    var wedges = [];

    rows.forEach(function (r, i) {
      var sweep = (r.value / total) * Math.PI * 2;
      var a0 = a + 0.012, a1 = a + sweep - 0.012;
      if (a1 <= a0) a1 = a0 + 0.004;
      var path = el('path', {
        d: arcPath(cx, cy, r1, r2, a0, a1),
        fill: r.color || PALETTE[i % PALETTE.length],
        class: 'vh-petal'
      });
      svg.appendChild(path);
      wedges.push({ path: path, a0: a0, a1: a1 });
      bindMark(path, function () {
        return '<b>' + escapeHtml(r.label) + '</b>' +
          tipRows([
            ['岗位数', fmtInt(r.value)],
            ['占比', fmtPct(r.value, total)]
          ]) + (opt.note ? '<div class="vh-tip-note">' + escapeHtml(opt.note) + '</div>' : '');
      }, [path]);
      a += sweep;
    });

    label(svg, cx, cy - 2, fmtK(total), 'vh-svg-center-num', 'middle');
    label(svg, cx, cy + 15, '岗位合计', 'vh-svg-center-cap', 'middle');

    /* 图例 */
    var lx = donut + 20;
    var lh = Math.min(24, (h - 8) / rows.length);
    rows.forEach(function (r, i) {
      var y = cy - (rows.length * lh) / 2 + lh * i + lh / 2;
      svg.appendChild(el('rect', { x: lx, y: y - 4, width: 8, height: 8, fill: r.color || PALETTE[i % PALETTE.length] }));
      label(svg, lx + 14, y + 4, trunc(r.label, 7), 'vh-svg-label', 'start').setAttribute('font-size', '10.5');
      label(svg, w - 2, y + 4, fmtPct(r.value, total), 'vh-svg-value', 'end').setAttribute('font-size', '10.5');
    });

    mountSvg(host, svg);
    if (opt.animate) {
      wedges.forEach(function (wd) {
        wd.path.setAttribute('d', arcPath(cx, cy, r1, r2, wd.a0, wd.a0 + 0.004));
      });
      tween(920, function (p) {
        wedges.forEach(function (wd, i) {
          var q = cascade(p, i, wedges.length, 0.4);
          var end = wd.a0 + Math.max(0.004, (wd.a1 - wd.a0) * easeOutCubic(q));
          wd.path.setAttribute('d', arcPath(cx, cy, r1, r2, wd.a0, end));
        });
      });
    }
  }
  function arcPath(cx, cy, r1, r2, a0, a1) {
    var x0 = cx + Math.cos(a0) * r2, y0 = cy + Math.sin(a0) * r2;
    var x1 = cx + Math.cos(a1) * r2, y1 = cy + Math.sin(a1) * r2;
    var x2 = cx + Math.cos(a1) * r1, y2 = cy + Math.sin(a1) * r1;
    var x3 = cx + Math.cos(a0) * r1, y3 = cy + Math.sin(a0) * r1;
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    return 'M' + x0 + ',' + y0 +
      'A' + r2 + ',' + r2 + ' 0 ' + large + ' 1 ' + x1 + ',' + y1 +
      'L' + x2 + ',' + y2 +
      'A' + r1 + ',' + r1 + ' 0 ' + large + ' 0 ' + x3 + ',' + y3 + 'Z';
  }

  /* ============================ 图表：纵向柱 ============================ */
  function drawColumns(host, w, h, rows, opt) {
    opt = opt || {};
    if (!rows.length) return emptyChart(host);
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1;
    var padL = 34, padR = 6, padT = 20, padB = 26;
    var plotW = Math.max(40, w - padL - padR);
    var plotH = Math.max(40, h - padT - padB);
    var bandW = plotW / rows.length;
    var barW = Math.min(58, bandW * 0.5);
    var svg = mkSvg(w, h);
    var rise = [];

    [0, 0.5, 1].forEach(function (q) {
      var y = padT + plotH * (1 - q);
      svg.appendChild(el('line', {
        x1: padL, x2: w - padR, y1: y, y2: y,
        stroke: q === 0 ? 'rgba(20,17,12,.16)' : C.line,
        'stroke-dasharray': q === 0 ? '' : '3 4'
      }));
      label(svg, padL - 6, y + 3, q === 0 ? '0' : fmtInt(max * q), 'vh-svg-label--muted', 'end')
        .setAttribute('font-size', '9.5');
    });

    rows.forEach(function (r, i) {
      var bh = Math.max(2, plotH * (r.value / max));
      var x = padL + bandW * i + (bandW - barW) / 2;
      var y = padT + plotH - bh;
      var isMax = r.value === max;
      var bar = el('rect', {
        x: x, y: y, width: barW, height: bh,
        fill: isMax ? C.rose : C.goldLight, class: 'vh-bar'
      });
      svg.appendChild(bar);
      rise.push({ el: bar, base: padT + plotH, h: bh });
      label(svg, x + barW / 2, y - 5, fmtInt(r.value), 'vh-svg-value', 'middle').setAttribute('font-size', '10');
      label(svg, x + barW / 2, h - 8, trunc(r.label, 8), 'vh-svg-label', 'middle').setAttribute('font-size', '9.5');
      var hit = el('rect', { x: padL + bandW * i, y: padT, width: bandW, height: plotH, fill: 'transparent' });
      svg.appendChild(hit);
      bindMark(hit, function () {
        return '<b>' + escapeHtml(r.label) + '</b>' +
          tipRows([['岗位数', fmtInt(r.value)], ['占比', fmtPct(r.value, totalOf(rows))]]);
      }, [bar]);
    });

    mountSvg(host, svg);
    if (opt.animate) {
      rise.forEach(function (g) {
        g.el.setAttribute('height', 0);
        g.el.setAttribute('y', g.base);
      });
      tween(880, function (p) {
        rise.forEach(function (g, i) {
          var q = cascade(p, i, rise.length, 0.45);
          g.el.setAttribute('height', g.h * easeOutCubic(q));
          g.el.setAttribute('y', g.base - g.h * easeOutCubic(q));
        });
      });
    }
  }
  function totalOf(rows) { return rows.reduce(function (s, r) { return s + r.value; }, 0); }

  function salMinOf(list) {
    var v = list.map(function (p) { return p.avgSalary; }).filter(function (x) { return x > 0; });
    return v.length ? Math.min.apply(null, v) : 0;
  }
  function salMaxOf(list) {
    var v = list.map(function (p) { return p.avgSalary; }).filter(function (x) { return x > 0; });
    return v.length ? Math.max.apply(null, v) : 0;
  }

  /* ============================ 图表：棒棒糖 ============================ */
  function drawLollipop(host, w, h, rows, opt) {
    opt = opt || {};
    if (!rows.length) return emptyChart(host);
    var max = opt.max || 100;
    var labelW = clamp(Math.min(w * 0.34, 112), 76, 112);
    var valW = 26;
    var plotW = Math.max(30, w - labelW - valW);
    var rowH = Math.min(48, (h - 8) / rows.length);
    var top = (h - rowH * rows.length) / 2;
    var svg = mkSvg(w, h);
    var stems = [];

    rows.forEach(function (r, i) {
      var cy = top + rowH * i + rowH / 2;
      var x = labelW + plotW * clamp(r.value / max, 0, 1);
      var lines = wrap2(r.label, 9);
      var startY = cy - (lines.length - 1) * 6 + 3.5;
      lines.forEach(function (ln, li) {
        label(svg, 0, startY + li * 12, ln, 'vh-svg-label').setAttribute('font-size', '10.5');
      });
      var line = el('line', {
        x1: labelW, x2: x, y1: cy, y2: cy,
        stroke: 'rgba(168,139,78,.42)', 'stroke-width': 1.2
      });
      svg.appendChild(line);
      var dot = el('circle', {
        cx: x, cy: cy, r: 4.6,
        fill: r.color || C.gold, class: 'vh-node'
      });
      svg.appendChild(dot);
      stems.push({ line: line, dot: dot, x0: labelW, x: x, cy: cy });
      label(svg, w - 2, cy + 4, r.value, 'vh-svg-value', 'end');
      var hit = el('rect', { x: 0, y: cy - rowH / 2, width: w, height: rowH, fill: 'transparent' });
      svg.appendChild(hit);
      bindMark(hit, function () {
        return '<b>' + escapeHtml(r.label) + '</b>' +
          tipRows(opt.tipRows ? opt.tipRows(r) : [['成长潜力', r.value + ' / 100']]);
      }, [dot, line]);
    });

    mountSvg(host, svg);
    if (opt.animate) {
      stems.forEach(function (s) {
        s.line.setAttribute('x2', s.x0);
        s.dot.setAttribute('cx', s.x0);
        s.dot.setAttribute('r', 0);
      });
      tween(900, function (p) {
        stems.forEach(function (s, i) {
          var q = cascade(p, i, stems.length, 0.5);
          var cx2 = s.x0 + (s.x - s.x0) * easeOutCubic(q);
          s.line.setAttribute('x2', cx2);
          s.dot.setAttribute('cx', cx2);
          s.dot.setAttribute('r', 4.6 * easeOutCubic(q));
        });
      });
    }
  }

  /* ============================ 图表：星图 ============================ */
  function drawStar(host, w, h, animate) {
    if (!state.provinces || !state.provinces.length) return emptyChart(host);
    var list = state.provinces.slice().filter(function (p) { return p.jobCount > 0; })
      .sort(function (a, b) { return b.jobCount - a.jobCount; });
    var total = list.reduce(function (s, p) { return s + p.jobCount; }, 0);
    var max = list[0].jobCount;
    var salaries = list.map(function (p) { return p.avgSalary; }).filter(function (v) { return v > 0; });
    var salMin = Math.min.apply(null, salaries), salMax = Math.max.apply(null, salaries);

    /* 宽画幅时右侧加一列排名，把圆外的空白变成可读数值 */
    var showList = w >= 700 && (w / h) > 1.15;
    var listW = showList ? clamp(Math.round(w * 0.29), 206, 248) : 0;
    var plotW = w - listW;

    var cx = plotW / 2, cy = h / 2;
    var R = Math.max(80, Math.min(plotW / 2 - 54, h / 2 - 16));
    var R0 = Math.max(R * 0.26, 26);
    var n = list.length;
    var step = Math.PI * 2 / n;
    var gap = step * 0.14;
    var POWER = 0.4; // 长尾压缩：95 与 3890 的差距不按线性，避免小省被压成一条线

    function radiusOf(v) {
      var t = Math.pow(clamp(v / max, 0, 1), POWER);
      return R0 + (R - R0) * t;
    }
    function colorOf(p) {
      return salaryColor(salMax === salMin ? .5 : (p.avgSalary - salMin) / (salMax - salMin));
    }

    var svg = mkSvg(w, h);

    /* 刻度环：整组缓慢自转，静止画面也有轻微“呼吸” */
    var ringGroup = el('g', { class: 'vh-rings' });
    ringGroup.style.transformOrigin = cx + 'px ' + cy + 'px';
    [0.25, 0.5, 0.75].forEach(function (q) {
      ringGroup.appendChild(el('circle', {
        cx: cx, cy: cy, r: radiusOf(max * q), fill: 'none',
        stroke: 'rgba(168,139,78,.18)', 'stroke-dasharray': '2 5'
      }));
    });
    ringGroup.appendChild(el('circle', {
      cx: cx, cy: cy, r: R, fill: 'none', stroke: 'rgba(168,139,78,.34)'
    }));
    svg.appendChild(ringGroup);

    /* 径向参考线：长尾省份很短，也保留角度结构 */
    list.forEach(function (p, i) {
      var ang = -Math.PI / 2 + i * step + step / 2;
      svg.appendChild(el('line', {
        x1: cx + Math.cos(ang) * R0, y1: cy + Math.sin(ang) * R0,
        x2: cx + Math.cos(ang) * R, y2: cy + Math.sin(ang) * R,
        stroke: 'rgba(168,139,78,.09)'
      }));
    });

    /* 花瓣：长度＝岗位数，颜色＝平均月薪 */
    var petals = [];
    list.forEach(function (p, i) {
      var a0 = -Math.PI / 2 + i * step + gap / 2;
      var a1 = a0 + step - gap;
      var r = radiusOf(p.jobCount);
      var path = el('path', {
        d: arcPath(cx, cy, R0, r, a0, a1),
        fill: colorOf(p),
        'fill-opacity': .9,
        stroke: 'rgba(20,17,12,.16)',
        'stroke-width': .6,
        class: 'vh-petal'
      });
      svg.appendChild(path);
      petals.push({ path: path, a0: a0, a1: a1, r: r });
      bindMark(path, function () {
        return '<b>' + escapeHtml(p.name) + '</b>' + tipRows([
          ['岗位数', fmtInt(p.jobCount) + '（' + fmtPct(p.jobCount, total) + '）'],
          ['平均月薪', p.avgSalary ? '¥' + fmtInt(p.avgSalary) : '—'],
          ['去重岗位名', fmtInt(p.distinctTitles)],
          ['覆盖城市', (p.cityCount || 0) + ' 城']
        ]);
      }, [path]);
    });

    /* 外环光带：每个省份一段，颜色仍是平均月薪——把外圈空白变成第二层信息 */
    var halo = [];
    list.forEach(function (p, i) {
      var a0 = -Math.PI / 2 + i * step + gap / 2;
      var a1 = a0 + step - gap;
      var arc = 'M' + (cx + Math.cos(a0) * R) + ',' + (cy + Math.sin(a0) * R) +
        'A' + R + ',' + R + ' 0 0 1 ' + (cx + Math.cos(a1) * R) + ',' + (cy + Math.sin(a1) * R);
      var seg = el('path', {
        d: arc, fill: 'none',
        stroke: colorOf(p), 'stroke-width': 3.5, 'stroke-linecap': 'butt'
      });
      svg.appendChild(seg);
      halo.push(seg);
    });

    /* 外圈省份标签 */
    var labelCount = showList ? 4 : (w < 520 ? 4 : 6);
    list.slice(0, labelCount).forEach(function (p, i) {
      var ang = -Math.PI / 2 + i * step + step / 2;
      var r = radiusOf(p.jobCount);
      var cos = Math.cos(ang);
      var anchor = cos > 0.2 ? 'start' : (cos < -0.2 ? 'end' : 'middle');
      var tx = cx + Math.cos(ang) * (r + 9) + (anchor === 'start' ? 2 : (anchor === 'end' ? -2 : 0));
      var ty = cy + Math.sin(ang) * (r + 9) + 3.5;
      var text = label(svg, tx, ty, p.name, 'vh-svg-label', anchor);
      text.setAttribute('font-size', '10.5');
      text.setAttribute('font-weight', '650');
      text.setAttribute('fill', C.ink);
      text.setAttribute('paint-order', 'stroke');
      text.setAttribute('stroke', '#FAF7F0');
      text.setAttribute('stroke-width', '3');
      text.setAttribute('stroke-linejoin', 'round');
    });

    /* 圆心汇总 */
    var numFont = clamp(R * 0.16, 16, 28);
    var centerNum = label(svg, cx, cy + 2, fmtK(total), 'vh-svg-center-num', 'middle');
    centerNum.setAttribute('font-size', numFont);
    if (R >= 120) {
      var capText = label(svg, cx, cy + numFont * 0.72 + 9,
        R >= 150 ? '岗位 · ' + list.length + '/' + state.provinces.length + ' 省' : '岗位',
        'vh-svg-center-cap', 'middle');
      capText.setAttribute('font-size', R >= 150 ? 10.5 : 9);
    }

    /* 薪资色带图例 */
    if (plotW > 360 && h > 320) {
      var gw = 78, gx = 10, gy = h - 18;
      var defs = el('defs', {});
      var grad = el('linearGradient', { id: 'vhSalGrad', x1: '0', x2: '1', y1: '0', y2: '0' });
      [[0, '#3D8B7A'], [50, '#C4A86B'], [100, '#C84738']].forEach(function (s) {
        grad.appendChild(el('stop', { offset: s[0] + '%', 'stop-color': s[1] }));
      });
      defs.appendChild(grad);
      svg.appendChild(defs);
      svg.appendChild(el('rect', { x: gx, y: gy, width: gw, height: 5, fill: 'url(#vhSalGrad)' }));
      label(svg, gx, gy - 4, '平均月薪', 'vh-svg-label--muted', 'start').setAttribute('font-size', '9');
      label(svg, gx + gw + 4, gy + 5, fmtMoneyK(salMin) + '–' + fmtMoneyK(salMax), 'vh-svg-label--muted', 'start')
        .setAttribute('font-size', '9');
    }

    /* 右侧排名表 */
    var listBars = [];
    if (showList) {
      var rows = list.slice(0, Math.min(8, Math.floor((h - 34) / 38)));
      var rowH = Math.min(44, (h - 44) / rows.length);
      var lx = plotW + 14;
      var lw = w - lx - 8;
      var ly = Math.max(10, cy - (rows.length * rowH + 18) / 2);

      svg.appendChild(el('line', {
        x1: plotW + 2, x2: plotW + 2, y1: ly - 4, y2: ly + rows.length * rowH + 12,
        stroke: 'rgba(168,139,78,.26)'
      }));
      label(svg, lx, ly, '岗位需求 TOP ' + rows.length, 'vh-svg-label--muted', 'start')
        .setAttribute('font-size', '9');

      rows.forEach(function (p, i) {
        var ry = ly + 14 + i * rowH;
        var barW = Math.max(30, lw - 46);
        var barLen = Math.max(2, barW * (p.jobCount / max));

        label(svg, lx, ry + 10, ('0' + (i + 1)).slice(-2), 'vh-svg-label--muted', 'start')
          .setAttribute('font-size', '9');
        var nm = label(svg, lx + 15, ry + 10, trunc(p.name, 5), 'vh-svg-label', 'start');
        nm.setAttribute('font-size', '10.5');
        nm.setAttribute('font-weight', '650');
        nm.setAttribute('fill', C.ink);
        label(svg, lx + lw, ry + 10, fmtInt(p.jobCount), 'vh-svg-value', 'end')
          .setAttribute('font-size', '10.5');

        svg.appendChild(el('rect', { x: lx + 15, y: ry + 15, width: barW, height: 3, fill: 'rgba(168,139,78,.14)' }));
        var listBar = el('rect', {
          x: lx + 15, y: ry + 15, width: barLen, height: 3,
          fill: colorOf(p), class: 'vh-bar'
        });
        svg.appendChild(listBar);
        listBars.push({ el: listBar, len: barLen, base: lx + 15 });
        label(svg, lx + lw, ry + 25, fmtPct(p.jobCount, total) + (p.avgSalary ? ' · ' + fmtMoneyK(p.avgSalary) : ''), 'vh-svg-label--muted', 'end')
          .setAttribute('font-size', '9');
      });
    }

    mountSvg(host, svg);

    if (animate) {
      /* 花瓣从内环向外生长 */
      petals.forEach(function (pt) {
        pt.path.setAttribute('d', arcPath(cx, cy, R0, R0 + 2, pt.a0, pt.a1));
      });
      tween(980, function (p) {
        petals.forEach(function (pt, i) {
          var q = cascade(p, i, petals.length, 0.35);
          var rr = R0 + (pt.r - R0) * easeOutCubic(q);
          pt.path.setAttribute('d', arcPath(cx, cy, R0, rr, pt.a0, pt.a1));
        });
      });
      /* 外环光带逐段亮起 */
      halo.forEach(function (seg, i) {
        seg.style.opacity = '0';
        seg.style.transition = 'opacity .45s ease ' + (0.3 + i * 0.02) + 's';
      });
      requestAnimationFrame(function () {
        halo.forEach(function (seg) { seg.style.opacity = '1'; });
      });
      /* 排名条从左补满 */
      listBars.forEach(function (b) { b.el.setAttribute('width', 0); });
      tween(980, function (p) {
        listBars.forEach(function (b, i) {
          var q = cascade(p, i, listBars.length, 0.5);
          b.el.setAttribute('width', b.len * easeOutCubic(q));
        });
      });
      /* 中心总数滚动 */
      tween(980, function (p) {
        centerNum.textContent = fmtK(total * easeOutCubic(p));
        if (p >= 1) centerNum.textContent = fmtK(total);
      });
    }
  }

  function emptyChart(host) {
    if (!host) return;
    host.innerHTML = '';
    host.classList.remove('is-loading');
    host.classList.add('is-empty');
  }

  /* 骨架 → 真图：整块替换，不做淡入，避免中间闪一下空白 */
  function mountSvg(host, svg) {
    var hadSkeleton = host.classList.contains('is-loading');
    host.innerHTML = '';
    if (hadSkeleton) {
      svg.style.transition = 'none';
      svg.style.opacity = '1';
    }
    host.appendChild(svg);
    host.classList.remove('is-loading', 'is-empty');
  }

  function escapeHtml(s) {
    if (window.zhesc) return window.zhesc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ============================ 加载骨架 ============================ */
  function skBox(svg, x, y, bw, bh, soft) {
    svg.appendChild(el('rect', {
      x: x, y: y, width: Math.max(2, bw), height: Math.max(2, bh),
      rx: 2, class: soft ? 'vh-skel-soft' : 'vh-skel'
    }));
  }

  function drawSkeleton(host, kind) {
    var s = sizeOf(host);
    var w = s.w, h = s.h;
    var svg = mkSvg(w, h);
    var i, n, rowH, cy;

    if (kind === 'rose') {
      var cx = w / 2, cy2 = h / 2;
      var listW = (w >= 700 && w / h > 1.15) ? clamp(Math.round(w * 0.29), 206, 248) : 0;
      var plotW = w - listW;
      cx = plotW / 2;
      var R = Math.max(80, Math.min(plotW / 2 - 54, h / 2 - 16));
      var R0 = Math.max(R * 0.26, 26);
      svg.appendChild(el('circle', {
        cx: cx, cy: cy2, r: R, fill: 'none',
        stroke: 'rgba(168,139,78,.2)', 'stroke-dasharray': '3 6'
      }));
      svg.appendChild(el('circle', { cx: cx, cy: cy2, r: R0, fill: 'rgba(168,139,78,.10)' }));
      n = 16;
      var step = Math.PI * 2 / n;
      for (i = 0; i < n; i++) {
        var a0 = -Math.PI / 2 + i * step + step * 0.08;
        var a1 = a0 + step * 0.84;
        var rr = R0 + (R - R0) * (0.58 + 0.3 * Math.abs(Math.sin(i * 1.7)));
        svg.appendChild(el('path', {
          d: arcPath(cx, cy2, R0, rr, a0, a1),
          class: 'vh-skel-soft',
          'fill-opacity': .65
        }));
      }
      if (listW) {
        var lx = plotW + 14, lw = w - lx - 8, ly = cy2 - 150;
        for (i = 0; i < 8; i++) {
          skBox(svg, lx, ly + i * 38, 18, 8, true);
          skBox(svg, lx + 22, ly + i * 38, lw * 0.46, 9, false);
          skBox(svg, lx + lw - 34, ly + i * 38, 34, 9, true);
          skBox(svg, lx + 22, ly + i * 38 + 13, lw - 30, 3, true);
        }
      }
    } else if (kind === 'donut') {
      var donut = Math.min(w * 0.52, h - 10, 300);
      var dcx = donut / 2 + 4, dcy = h / 2;
      var r2 = donut / 2 - 4, r1 = r2 * 0.6;
      svg.appendChild(el('circle', {
        cx: dcx, cy: dcy, r: (r1 + r2) / 2, fill: 'none',
        stroke: 'rgba(168,139,78,.13)', 'stroke-width': r2 - r1
      }));
      svg.appendChild(el('circle', { cx: dcx, cy: dcy, r: r1 * 0.82, fill: 'rgba(168,139,78,.07)' }));
      var lgx = donut + 20, lh = Math.min(24, (h - 8) / 7);
      for (i = 0; i < 7; i++) {
        var gy = dcy - (7 * lh) / 2 + lh * i + lh / 2;
        skBox(svg, lgx, gy - 4, 8, 8, false);
        skBox(svg, lgx + 14, gy - 4, 52, 9, true);
        skBox(svg, w - 40, gy - 4, 36, 9, true);
      }
    } else if (kind === 'columns') {
      var padL = 34, padB = 26, padT = 20;
      var plotWc = Math.max(40, w - padL - 6);
      var plotH = Math.max(40, h - padT - padB);
      var bandW = plotWc / 5;
      var heights = [0.42, 0.92, 0.55, 0.3, 0.16];
      svg.appendChild(el('line', {
        x1: padL, x2: w - 6, y1: h - padB, y2: h - padB, stroke: 'rgba(168,139,78,.25)'
      }));
      for (i = 0; i < 5; i++) {
        var bh = plotH * heights[i];
        skBox(svg, padL + bandW * i + bandW * 0.25, h - padB - bh, Math.min(58, bandW * 0.5), bh, false);
        skBox(svg, padL + bandW * i + bandW * 0.2, h - padB + 8, bandW * 0.6, 8, true);
      }
    } else if (kind === 'lollipop') {
      n = 6;
      var rowHl = Math.min(48, (h - 8) / n);
      var topY = (h - rowHl * n) / 2;
      var labelW = clamp(Math.min(w * 0.34, 112), 76, 112);
      for (i = 0; i < n; i++) {
        cy = topY + rowHl * i + rowHl / 2;
        skBox(svg, 0, cy - 4, labelW - 20, 9, true);
        svg.appendChild(el('line', {
          x1: labelW, x2: w - 26, y1: cy, y2: cy, class: 'vh-skel-line'
        }));
        svg.appendChild(el('circle', {
          cx: labelW + (w - labelW - 26) * (0.55 + 0.08 * i), cy: cy, r: 4.4, class: 'vh-skel'
        }));
        skBox(svg, w - 20, cy - 4, 18, 8, true);
      }
    } else {
      /* bars */
      n = 8;
      rowH = (h - 8) / n;
      var labelWb = clamp(Math.min(150, w * 0.24), 58, 120);
      for (i = 0; i < n; i++) {
        cy = 4 + rowH * i + rowH / 2;
        skBox(svg, 0, cy - 4, labelWb - 12, 9, true);
        skBox(svg, labelWb, cy - 5, w - labelWb - 44, 10, true);
        skBox(svg, w - 34, cy - 4, 30, 9, true);
      }
    }

    host.innerHTML = '';
    host.appendChild(svg);
  }

  function renderSkeletons() {
    var kinds = { star: 'rose', city: 'bars', prov: 'donut', salary: 'columns', pay: 'bars', demand: 'bars', future: 'lollipop' };
    var statIds = {
      star: 'vh-star-stat', city: 'vh-city-stat', prov: 'vh-prov-stat',
      salary: 'vh-salary-stat', pay: 'vh-pay-stat', demand: 'vh-demand-stat', future: 'vh-future-stat'
    };
    Object.keys(kinds).forEach(function (key) {
      var host = $(hostIds[key]);
      if (!host || dataReady[key]) return;
      host.classList.add('is-loading');
      drawSkeleton(host, kinds[key]);
      var stat = $(statIds[key]);
      if (stat) stat.textContent = '';
    });
  }

  function renderSideSkeletons() {
    var head = $('vh-insight-headline');
    if (head) head.innerHTML = '<span class="vh-sk-block" style="width:92px;height:10px"></span>';

    var list = $('vh-insights');
    if (list && !list.children.length) {
      var widths = [94, 88, 90, 72];
      list.innerHTML = widths.map(function (wd) {
        return '<li style="display:block"><span class="vh-sk-block" style="width:' + wd + '%"></span></li>';
      }).join('');
    }

    var ol = $('vh-emerging-list');
    if (ol && !ol.children.length) {
      ol.innerHTML = [0, 1, 2].map(function (i) {
        return '<li style="display:block"><span class="vh-sk-block" style="width:' + (76 - i * 8) + '%"></span>' +
          '<span class="vh-sk-block" style="width:' + (46 - i * 6) + '%;margin-top:5px"></span></li>';
      }).join('');
    }

    var chips = $('vh-skill-chips');
    if (chips && !chips.children.length) {
      chips.innerHTML = [58, 74, 62, 50, 68].map(function (wd) {
        return '<span class="vh-sk-chip" style="width:' + wd + 'px"></span>';
      }).join('');
    }
  }

  function renderHeroSkeleton() {
    ['vh-meta-total', 'vh-meta-prov', 'vh-meta-company', 'vh-meta-date'].forEach(function (id) {
      var node = $(id);
      if (!node) return;
      node.innerHTML = '<span class="vh-sk-block" style="width:' + (id === 'vh-meta-date' ? 74 : 54) + 'px;height:15px"></span>';
    });
  }

  /* ============================ 各面板渲染 ============================ */

  drawers.star = function (host, w, h) {
    drawStar(host, w, h, takeAnim('star'));
    var sortedProv = state.provinces ? state.provinces.slice().sort(function (a, b) { return b.jobCount - a.jobCount; }) : [];
    var st = $('vh-star-stat');
    if (st && sortedProv.length) {
      st.textContent = '首位 ' + sortedProv[0].name + ' ' + fmtInt(sortedProv[0].jobCount);
    }
    if (sortedProv.length) {
      var totalJobs = sortedProv.reduce(function (s, p) { return s + p.jobCount; }, 0);
      var covered = sortedProv.filter(function (p) { return p.jobCount > 0; }).length;
      describe(host, '省份岗位星图：' + sortedProv.slice(0, 5).map(function (p) {
        return p.name + ' ' + fmtInt(p.jobCount);
      }).join('、') + '；共 ' + fmtInt(totalJobs) + ' 条岗位，覆盖 ' + covered + ' 个省份。');
    }
    var foot = $('vh-star-foot');
    if (foot && state.provinces) {
      var maxJobs = Math.max.apply(null, state.provinces.map(function (p) { return p.jobCount; }));
      var rings = [.25, .5, .75].map(function (q) { return fmtInt(maxJobs * q); }).join(' / ');
      foot.textContent = '角度＝按岗位数顺时针排列 · 花瓣长度＝岗位数（幂次刻度压缩长尾，环 ' + rings + '）· 颜色＝平均月薪 ' +
        fmtMoneyK(salMinOf(state.provinces)) + '–' + fmtMoneyK(salMaxOf(state.provinces));
    }
  };

  drawers.city = function (host, w, h) {
    if (!state.city) return emptyChart(host);
    var rows = state.city.slice(0, 10).map(function (r) {
      return { label: r.city, value: r.count, note: '区级口径，按城市聚合' };
    });
    drawBars(host, w, h, rows, { labelChars: 8, color: C.gold, animate: takeAnim('city') });
    var st = $('vh-city-stat');
    if (st) st.textContent = '首位 ' + rows[0].label + ' ' + fmtInt(rows[0].value);
    describe(host, '城市岗位需求前 10：' + rows.slice(0, 5).map(function (r) {
      return r.label + ' ' + fmtInt(r.value);
    }).join('、') + '。');
  };

  drawers.prov = function (host, w, h) {
    if (!state.provinces) return emptyChart(host);
    var sorted = state.provinces.slice().sort(function (a, b) { return b.jobCount - a.jobCount; });
    var total = sorted.reduce(function (s, p) { return s + p.jobCount; }, 0);
    var top = sorted.slice(0, 6).map(function (p) { return { label: p.name, value: p.jobCount }; });
    var rest = sorted.slice(6).reduce(function (s, p) { return s + p.jobCount; }, 0);
    if (rest > 0) top.push({ label: '其余 ' + (sorted.length - 6) + ' 省', value: rest, color: '#B9B2A4' });
    drawDonut(host, w, h, top, { note: '前 6 省单独列出，其余合并', animate: takeAnim('prov') });
    var st = $('vh-prov-stat');
    if (st) st.textContent = sorted[0].name + ' ' + fmtPct(sorted[0].jobCount, total);
    var foot = $('vh-prov-foot');
    if (foot) {
      var noJob = sorted.filter(function (p) { return !p.jobCount; }).length;
      foot.textContent = '口径：按省份汇总 ' + fmtInt(total) + ' 条' +
        (noJob ? '（' + noJob + ' 省无在库岗位）' : '') + ' · 前 6 省单列，其余合并';
    }
    describe(host, '省份岗位占比：' + top.map(function (t) {
      return t.label + ' ' + fmtPct(t.value, total);
    }).join('、') + '。');
  };

  drawers.salary = function (host, w, h) {
    if (!state.salary) return emptyChart(host);
    var rows = state.salary.distribution.map(function (d) { return { label: d.range, value: d.count }; });
    drawColumns(host, w, h, rows, { animate: takeAnim('salary') });
    describe(host, '薪资区间分布：' + rows.map(function (r) {
      return r.label + ' ' + fmtInt(r.value) + ' 条';
    }).join('、') + '；均值 ' + fmtMoneyK(state.salary.avg_salary_min) + ' 至 ' + fmtMoneyK(state.salary.avg_salary_max) + '。');
    var st = $('vh-salary-stat');
    if (st) st.textContent = '均值 ' + fmtMoneyK(state.salary.avg_salary_min) + '–' + fmtMoneyK(state.salary.avg_salary_max);
  };

  drawers.pay = function (host, w, h) {
    if (!state.provinces) return emptyChart(host);
    var rows = state.provinces.slice()
      .filter(function (p) { return p.avgSalary > 0; })
      .sort(function (a, b) { return b.avgSalary - a.avgSalary; })
      .slice(0, 10)
      .map(function (p) {
        return { label: p.name, value: p.avgSalary };
      });
    drawBars(host, w, h, rows, {
      labelChars: 4,
      color: C.slate,
      animate: takeAnim('pay'),
      valueFmt: fmtMoneyK,
      tipRows: function (r) { return [['平均月薪', '¥' + fmtInt(r.value)]]; }
    });
    var st = $('vh-pay-stat');
    if (st) st.textContent = '最高 ' + rows[0].label + ' ' + fmtMoneyK(rows[0].value);
    describe(host, '省份平均月薪前 10：' + rows.slice(0, 5).map(function (r) {
      return r.label + ' ' + fmtMoneyK(r.value);
    }).join('、') + '。');
  };

  drawers.demand = function (host, w, h) {
    if (!state.trends) return emptyChart(host);
    var rows = state.trends.slice().sort(function (a, b) { return b.value - a.value; }).slice(0, 5)
      .map(function (t) {
        return { label: t.title, value: t.value, salary: t.salary };
      });
    drawBars(host, w, h, rows, {
      labelChars: 8,
      color: C.teal,
      animate: takeAnim('demand'),
      tipRows: function (r) {
        return [['在库需求', fmtInt(r.value) + ' 条']].concat(r.salary ? [['平均月薪', '¥' + fmtInt(r.salary)]] : []);
      }
    });
    var st = $('vh-demand-stat');
    if (st) st.textContent = '首位 ' + rows[0].label + ' ' + fmtInt(rows[0].value);
    describe(host, '在库岗位需求前 5：' + rows.map(function (r) {
      return r.label + ' ' + fmtInt(r.value);
    }).join('、') + '。');
  };

  drawers.future = function (host, w, h) {
    if (!state.emerging) return emptyChart(host);
    var rows = state.emerging.slice().sort(function (a, b) { return b.growth_potential - a.growth_potential; })
      .map(function (j, i) {
        return {
          label: j.title,
          value: j.growth_potential,
          color: i < 3 ? C.rose : C.gold,
          eta: j.eta_months,
          skills: j.required_skills || []
        };
      });
    drawLollipop(host, w, h, rows, {
      max: 100,
      animate: takeAnim('future'),
      tipRows: function (r) {
        return [
          ['成长潜力', r.value + ' / 100'],
          ['预计成熟', r.eta + ' 个月'],
          ['关键技能', (r.skills || []).slice(0, 3).join('、') || '—']
        ];
      }
    });
    var st = $('vh-future-stat');
    if (st) st.textContent = '最高 ' + rows[0].value + ' 分';
    describe(host, '新兴岗位成长潜力：' + rows.slice(0, 5).map(function (r) {
      return r.label + ' ' + r.value + ' 分';
    }).join('、') + '。');
  };

  /* ============================ 点开后的解析 ============================ */
  var analyses = {};

  function shareOf(v, total) { return total ? (v / total * 100).toFixed(1) + '%' : '—'; }
  function sumOf(list, fn) { return list.reduce(function (s, x) { return s + (fn(x) || 0); }, 0); }
  function meanOf(list, fn) { return list.length ? sumOf(list, fn) / list.length : 0; }
  function medianOf(sorted) {
    if (!sorted.length) return 0;
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  analyses.star = function () {
    var all = state.provinces || [];
    var list = all.filter(function (p) { return p.jobCount > 0; })
      .sort(function (a, b) { return b.jobCount - a.jobCount; });
    if (!list.length) return null;
    var total = sumOf(list, function (p) { return p.jobCount; });
    var top = list[0], second = list[1] || top;
    var top5 = list.slice(0, 5);
    var rest = list.slice(5);
    var cr5 = sumOf(top5, function (p) { return p.jobCount; });
    var bySal = list.slice().sort(function (a, b) { return b.avgSalary - a.avgSalary; });
    var medSal = medianOf(list.map(function (p) { return p.avgSalary; }).sort(function (a, b) { return a - b; }));
    var medJobs = medianOf(list.map(function (p) { return p.jobCount; }).sort(function (a, b) { return a - b; }));

    return {
      kpis: [
        { label: '覆盖省份', value: list.length + '/' + all.length },
        { label: 'CR5 集中度', value: (cr5 / total * 100).toFixed(1), unit: '%' },
        { label: '月薪中位', value: fmtMoneyK(medSal) }
      ],
      findings: [
        '<b>' + escapeHtml(top.name) + '</b> 以 ' + fmtInt(top.jobCount) + ' 条占 ' + shareOf(top.jobCount, total) +
          '，是第二名' + escapeHtml(second.name) + '（' + fmtInt(second.jobCount) + ' 条）的 ' + (top.jobCount / second.jobCount).toFixed(1) + ' 倍。',
        '前 5 省合计 ' + shareOf(cr5, total) + '，其余 ' + rest.length + ' 省只占 ' + shareOf(total - cr5, total) +
          '；平均每省 ' + fmtInt(total / list.length) + ' 条，中位数省份 ' + fmtInt(medJobs) + ' 条，长尾很薄。',
        '平均月薪最高为 <b>' + escapeHtml(bySal[0].name) + ' ' + fmtMoneyK(bySal[0].avgSalary) + '</b>，最低 ' +
          escapeHtml(bySal[bySal.length - 1].name) + ' ' + fmtMoneyK(bySal[bySal.length - 1].avgSalary) + '，相差 ' +
          (bySal[0].avgSalary / bySal[bySal.length - 1].avgSalary).toFixed(1) + ' 倍。',
        all.length > list.length
          ? '另有 ' + (all.length - list.length) + ' 个省级行政区在库内没有岗位样本（占 ' + all.length + ' 个行政区的 ' +
            shareOf(all.length - list.length, all.length) + '），星图上不显示半径。'
          : '全部 ' + all.length + ' 个省级行政区均有在库岗位样本。'
      ],
      tableLabel: '全部 ' + list.length + ' 省',
      table: {
        cols: ['省份', '岗位数', '占比', '平均月薪'],
        rows: list.map(function (p) {
          return [escapeHtml(p.name), fmtInt(p.jobCount), shareOf(p.jobCount, total), p.avgSalary ? fmtMoneyK(p.avgSalary) : '—'];
        })
      },
      note: '<b>口径</b>：按省份汇总库内 ' + fmtInt(total) + ' 条岗位；占比＝该省岗位数 ÷ 省级合计；平均月薪取岗位起止薪资均值。'
    };
  };

  analyses.city = function () {
    if (!state.city || !state.city.length) return null;
    var rows = state.city.slice(0, 10);
    var total = state.stats ? state.stats.total_postings : sumOf(state.city, function (c) { return c.count; });
    var sum10 = sumOf(rows, function (c) { return c.count; });
    var district = rows.filter(function (c) { return String(c.city).indexOf('·') >= 0; }).length;
    var top = rows[0], second = rows[1] || top;

    /* 按城市名归并（把「上海·浦东新区」并回「上海」） */
    var merged = {};
    state.city.forEach(function (c) {
      var k = String(c.city).split('·')[0];
      merged[k] = (merged[k] || 0) + c.count;
    });
    var mergedList = Object.keys(merged).map(function (k) { return { city: k, count: merged[k] }; })
      .sort(function (a, b) { return b.count - a.count; });

    return {
      kpis: [
        { label: 'TOP1 岗位', value: fmtInt(top.count), unit: '条' },
        { label: 'TOP10 占全库', value: (sum10 / total * 100).toFixed(1), unit: '%' },
        { label: '区县粒度', value: district + '/' + rows.length }
      ],
      findings: [
        '<b>' + escapeHtml(top.city) + '</b> 以 ' + fmtInt(top.count) + ' 条居首，' + escapeHtml(second.city) + ' ' +
          fmtInt(second.count) + ' 条紧随，两者只差 ' + fmtInt(top.count - second.count) + ' 条。',
        'TOP10 合计 ' + fmtInt(sum10) + ' 条，占全库 ' + shareOf(sum10, total) + '；榜单里 ' + district + ' 个是「城市·区县」粒度，说明招聘发布集中在核心城区。',
        '榜首与榜尾（' + escapeHtml(rows[rows.length - 1].city) + '）相差 ' + (top.count / rows[rows.length - 1].count).toFixed(1) + ' 倍，头部城市之间梯度平缓，没有断层。',
        '把区县并回城市后：' + mergedList.slice(0, 3).map(function (c) {
          return escapeHtml(c.city) + ' ' + fmtInt(c.count) + ' 条';
        }).join('、') + '，前三城合计占全库 ' + shareOf(sumOf(mergedList.slice(0, 3), function (c) { return c.count; }), total) + '。'
      ],
      tableLabel: 'TOP 20 城市',
      table: {
        cols: ['城市 / 区县', '岗位数', '占全库'],
        rows: state.city.map(function (c) { return [escapeHtml(c.city), fmtInt(c.count), shareOf(c.count, total)]; })
      },
      note: '<b>口径</b>：城市维度直接取自岗位的城市字段，含「城市·区县」两种粒度；占全库＝该城市岗位数 ÷ ' + fmtInt(total) + ' 条。'
    };
  };

  analyses.prov = function () {
    if (!state.provinces) return null;
    var sorted = state.provinces.slice().sort(function (a, b) { return b.jobCount - a.jobCount; });
    var total = sumOf(sorted, function (p) { return p.jobCount; });
    var top3 = sorted.slice(0, 3);
    var top3Sum = sumOf(top3, function (p) { return p.jobCount; });
    var noJob = sorted.filter(function (p) { return !p.jobCount; }).length;

    return {
      kpis: [
        { label: '广东占比', value: shareOf(sorted[0].jobCount, total) },
        { label: '前三省合计', value: shareOf(top3Sum, total) },
        { label: '余下省份', value: shareOf(total - top3Sum, total) }
      ],
      findings: [
        '<b>' + escapeHtml(sorted[0].name) + '</b> 一家独大：' + fmtInt(sorted[0].jobCount) + ' 条，占 ' + shareOf(sorted[0].jobCount, total) +
          '，' + (sorted[0].jobCount >= sorted[1].jobCount + sorted[2].jobCount ? '超过' : '接近') +
          '第二、三名之和（' + fmtInt(sorted[1].jobCount + sorted[2].jobCount) + ' 条）。',
        '前三省（' + top3.map(function (p) { return escapeHtml(p.name); }).join('、') + '）合计 ' + shareOf(top3Sum, total) +
          '，其余 ' + (sorted.length - 3) + ' 省共 ' + shareOf(total - top3Sum, total) + '。',
        '前 6 省之后的 ' + (sorted.length - 6) + ' 省合并为「其余」，占 ' + shareOf(total - sumOf(sorted.slice(0, 6), function (p) { return p.jobCount; }), total) +
          '；明细表可以看到每一省的真实份额。',
        noJob ? '有 ' + noJob + ' 个省份在库内为 0 条（' + shareOf(noJob, sorted.length) + ' 的行政区），说明采集覆盖仍有空白。' : '所有省份均有岗位样本。'
      ],
      tableLabel: '全部 ' + sorted.length + ' 省',
      table: {
        cols: ['省份', '岗位数', '占比', '去重岗位名'],
        rows: sorted.map(function (p) {
          return [escapeHtml(p.name), fmtInt(p.jobCount), shareOf(p.jobCount, total), fmtInt(p.distinctTitles)];
        })
      },
      note: '<b>口径</b>：省级合计 ' + fmtInt(total) + ' 条，与全库 ' + fmtInt(state.stats ? state.stats.total_postings : total) + ' 条的差额来自城市字段无法归属省份的记录。'
    };
  };

  analyses.salary = function () {
    if (!state.salary) return null;
    var dist = state.salary.distribution;
    var total = sumOf(dist, function (d) { return d.count; });
    var kmax = state.salary;
    var maxBin = dist.slice().sort(function (a, b) { return b.count - a.count; })[0];
    var high = sumOf(dist.filter(function (d) { return /^(30K|50K)/.test(d.range); }), function (d) { return d.count; });
    var low = sumOf(dist.filter(function (d) { return /^10K以下/.test(d.range); }), function (d) { return d.count; });
    var cum = 0, medianBin = dist[0];
    dist.forEach(function (d) { cum += d.count; if (cum >= total / 2 && cum - d.count < total / 2) medianBin = d; });

    return {
      kpis: [
        { label: '主力区间', value: escapeHtml(maxBin.range) },
        { label: '30K 以上', value: (high / total * 100).toFixed(1), unit: '%' },
        { label: '10K 以下', value: (low / total * 100).toFixed(1), unit: '%' }
      ],
      findings: [
        '<b>' + escapeHtml(maxBin.range) + '</b> 是样本最集中的区间：' + fmtInt(maxBin.count) + ' 条，占 ' + shareOf(maxBin.count, total) +
          '，接近每两个岗位就有一个落在这里。',
        '30K 以上合计 ' + fmtInt(high) + ' 条（' + shareOf(high, total) + '），10K 以下 ' + fmtInt(low) + ' 条（' + shareOf(low, total) +
          '），高薪岗位是少数但不是零星，中位区间落在 <b>' + escapeHtml(medianBin.range) + '</b>。',
        '起止薪资均值分别为 ' + fmtMoneyK(kmax.avg_salary_min) + ' 与 ' + fmtMoneyK(kmax.avg_salary_max) + '，上下限相差 ' +
          (kmax.avg_salary_max / kmax.avg_salary_min).toFixed(1) + ' 倍——说明同一个岗位名内部的薪资带宽很宽。'
      ],
      tableLabel: '全部 ' + dist.length + ' 个区间',
      table: {
        cols: ['薪资区间', '岗位数', '占比', '累计占比'],
        rows: (function () {
          var acc = 0;
          return dist.map(function (d) {
            acc += d.count;
            return [escapeHtml(d.range), fmtInt(d.count), shareOf(d.count, total), shareOf(acc, total)];
          });
        })()
      },
      note: '<b>口径</b>：按岗位起止薪资分箱统计，共 ' + fmtInt(total) + ' 条有薪资记录的岗位；均值来自接口 avg_salary_min / avg_salary_max。'
    };
  };

  analyses.pay = function () {
    if (!state.provinces) return null;
    var list = state.provinces.filter(function (p) { return p.avgSalary > 0; })
      .sort(function (a, b) { return b.avgSalary - a.avgSalary; });
    if (!list.length) return null;
    var total = sumOf(list, function (p) { return p.jobCount; });
    var byJobs = state.provinces.filter(function (p) { return p.jobCount > 0; })
      .sort(function (a, b) { return b.jobCount - a.jobCount; });
    var top5 = list.slice(0, 5), bottom5 = list.slice(-5);
    var avgTop = meanOf(top5, function (p) { return p.avgSalary; });
    var avgBottom = meanOf(bottom5, function (p) { return p.avgSalary; });
    var natAvg = sumOf(list, function (p) { return p.avgSalary * p.jobCount; }) / total;

    return {
      kpis: [
        { label: '最高省份', value: fmtMoneyK(list[0].avgSalary) },
        { label: '加权均值', value: fmtMoneyK(natAvg) },
        { label: '最高/最低', value: (list[0].avgSalary / list[list.length - 1].avgSalary).toFixed(1), unit: '倍' }
      ],
      findings: [
        '<b>' + escapeHtml(list[0].name) + ' ' + fmtMoneyK(list[0].avgSalary) + '</b>、' + escapeHtml(list[1].name) + ' ' +
          fmtMoneyK(list[1].avgSalary) + ' 领先，第三名 ' + escapeHtml(list[2].name) + ' ' + fmtMoneyK(list[2].avgSalary) + '，头部之间差距很小。',
        '前 5 省均值 ' + fmtMoneyK(avgTop) + '，后 5 省均值 ' + fmtMoneyK(avgBottom) + '，相差 ' +
          ((avgTop / avgBottom - 1) * 100).toFixed(0) + '%；折算到岗位量后的加权均值是 ' + fmtMoneyK(natAvg) + '。',
        '最高 ' + escapeHtml(list[0].name) + ' 与最低 ' + escapeHtml(list[list.length - 1].name) + ' 相差 ' +
          (list[0].avgSalary - list[list.length - 1].avgSalary).toFixed(0) + ' 元/月，约 ' +
          (list[0].avgSalary / list[list.length - 1].avgSalary).toFixed(1) + ' 倍。',
        '两个榜单并不同步：岗位量前三（' + byJobs.slice(0, 3).map(function (p) { return escapeHtml(p.name); }).join('、') +
          '）均价 ' + fmtMoneyK(meanOf(byJobs.slice(0, 3), function (p) { return p.avgSalary; })) + '，月薪前三（' +
          list.slice(0, 3).map(function (p) { return escapeHtml(p.name); }).join('、') + '）均价 ' +
          fmtMoneyK(meanOf(list.slice(0, 3), function (p) { return p.avgSalary; })) + '，两榜重合 ' +
          byJobs.slice(0, 3).filter(function (p) { return list.slice(0, 3).some(function (q) { return q.name === p.name; }); }).length + ' 个省。'
      ],
      tableLabel: '全部 ' + list.length + ' 省',
      table: {
        cols: ['省份', '平均月薪', '岗位数', '占全库'],
        rows: list.map(function (p) {
          return [escapeHtml(p.name), fmtMoneyK(p.avgSalary), fmtInt(p.jobCount), shareOf(p.jobCount, total)];
        })
      },
      note: '<b>口径</b>：平均月薪＝该省岗位起止薪资均值再取平均；加权均值按岗位数加权，避免小样本省份拉偏。'
    };
  };

  analyses.demand = function () {
    if (!state.trends || !state.trends.length) return null;
    var rows = state.trends.slice().sort(function (a, b) { return b.value - a.value; });
    var total = state.stats ? state.stats.total_postings : 0;
    var sumAll = sumOf(rows, function (r) { return r.value; });
    var sal = rows.filter(function (r) { return r.salary > 0; });
    var top = rows[0];

    return {
      kpis: [
        { label: 'TOP1 需求', value: fmtInt(top.value), unit: '条' },
        { label: '5 岗合计', value: (sumAll / total * 100).toFixed(1), unit: '%' },
        { label: '其中最高月薪', value: fmtMoneyK(Math.max.apply(null, sal.map(function (r) { return r.salary; }))) }
      ],
      findings: [
        '<b>' + escapeHtml(top.title) + '</b> ' + fmtInt(top.value) + ' 条，是第二名' + escapeHtml(rows[1].title) + '（' + fmtInt(rows[1].value) +
          ' 条）的 ' + (top.value / rows[1].value).toFixed(1) + ' 倍，单岗位占据明显优势。',
        '这 ' + rows.length + ' 个岗位名合计 ' + fmtInt(sumAll) + ' 条，占全库 ' + shareOf(sumAll, total) +
          '；剩下的需求分散在大量长尾岗位名里。',
        '平均月薪跨度从 ' + fmtMoneyK(Math.min.apply(null, sal.map(function (r) { return r.salary; }))) + ' 到 ' +
          fmtMoneyK(Math.max.apply(null, sal.map(function (r) { return r.salary; }))) + '，' +
          escapeHtml(sal.slice().sort(function (a, b) { return b.salary - a.salary; })[0].title) + ' 给得最高。',
        '需求前二（' + escapeHtml(rows[0].title) + '、' + escapeHtml(rows[1].title) + '）合计占这 ' + rows.length + ' 个岗位名的 ' +
          ((rows[0].value + rows[1].value) / sumAll * 100).toFixed(1) + '%，集中度偏高。'
      ],
      tableLabel: '全部 ' + rows.length + ' 个岗位',
      table: {
        cols: ['岗位名', '在库需求', '占全库', '平均月薪'],
        rows: rows.map(function (r) {
          return [escapeHtml(r.title), fmtInt(r.value), shareOf(r.value, total), r.salary ? fmtMoneyK(r.salary) : '—'];
        })
      },
      note: '<b>口径</b>：按岗位名精确聚合（不做同义合并），因此只统计到有明确对应岗位名的记录；占全库＝该岗位需求 ÷ ' + fmtInt(total) + ' 条。'
    };
  };

  analyses.future = function () {
    if (!state.emerging || !state.emerging.length) return null;
    var rows = state.emerging.slice().sort(function (a, b) { return b.growth_potential - a.growth_potential; });
    var skillCount = {};
    rows.forEach(function (j) {
      (j.required_skills || []).forEach(function (s) { skillCount[s] = (skillCount[s] || 0) + 1; });
    });
    var skillKeys = Object.keys(skillCount);
    var topSkill = skillKeys.sort(function (a, b) { return skillCount[b] - skillCount[a]; })[0] || '—';
    var etas = rows.map(function (j) { return j.eta_months; }).filter(function (v) { return v > 0; }).sort(function (a, b) { return a - b; });
    var avg = meanOf(rows, function (j) { return j.growth_potential; });
    var top3 = rows.slice(0, 3);
    var aiish = rows.filter(function (j) { return /AI|智能|模型|Agent/i.test(j.title); }).length;
    var topSkillCount = skillCount[topSkill] || 0;

    return {
      kpis: [
        { label: '平均潜力', value: avg.toFixed(0), unit: '分' },
        { label: '成熟期中位', value: medianOf(etas) || '—', unit: '月' },
        { label: '技能标签', value: skillKeys.length, unit: '个' }
      ],
      findings: [
        '潜力最高的是 <b>' + escapeHtml(rows[0].title) + '</b>（' + rows[0].growth_potential + ' 分），预计 ' + rows[0].eta_months +
          ' 个月成熟；前 3 名都在 ' + top3[top3.length - 1].growth_potential + ' 分以上。',
        (aiish === rows.length
          ? '全部 ' + rows.length + ' 个候选都直接涉及 AI / 智能体能力，方向集中在智能体编排、端侧与行业数据工程。'
          : rows.length + ' 个候选里有 ' + aiish + ' 个直接涉及 AI / 智能体能力，其余偏向行业数据与合规方向。'),
        (topSkillCount <= 1
          ? '共 ' + skillKeys.length + ' 个技能标签且彼此不重复，说明每个候选岗位的技能组合都不同；出现最多的标签也只有 1 个岗位提到。'
          : '技能交叉最高的标签是 <b>' + escapeHtml(topSkill) + '</b>（' + topSkillCount + ' 个岗位同时要求），其次是 ' +
            (skillKeys[1] ? escapeHtml(skillKeys[1]) + '（' + skillCount[skillKeys[1]] + ' 个）' : '—') + '。'),
        '成熟期从 ' + Math.min.apply(null, etas) + ' 到 ' + Math.max.apply(null, etas) + ' 个月，中位 ' + medianOf(etas) +
          ' 个月——比传统岗位的替代周期短，说明技能窗口期紧。'
      ],
      tableLabel: '全部 ' + rows.length + ' 个候选岗位',
      table: {
        cols: ['候选岗位', '潜力', '成熟期', '技能数'],
        rows: rows.map(function (j) {
          return [escapeHtml(j.title), j.growth_potential, j.eta_months + ' 月', (j.required_skills || []).length];
        })
      },
      note: '<b>口径</b>：候选岗位与潜力分为推演值（基于库内岗位文本，非直接计数），成熟期为估计值；技能数为该岗位列出的关键技能个数。'
    };
  };

  function renderAnalysis(key) {
    var box = $('vh-lightbox-rail');
    if (!box) return;
    var a = analyses[key] ? analyses[key]() : null;
    if (!a) { box.innerHTML = ''; return; }
    var html = '';
    if (a.kpis && a.kpis.length) {
      html += '<dl class="vh-lb-kpis">' + a.kpis.map(function (k) {
        return '<div class="vh-lb-kpi"><dt>' + escapeHtml(k.label) + '</dt><dd>' + k.value +
          (k.unit ? '<small>' + escapeHtml(k.unit) + '</small>' : '') + '</dd></div>';
      }).join('') + '</dl>';
    }
    if (a.findings && a.findings.length) {
      html += '<div class="vh-lb-section"><h3>解析 <span>库内实时计算</span></h3><ol class="vh-lb-findings">' +
        a.findings.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ol></div>';
    }
    if (a.table) {
      html += '<div class="vh-lb-section"><h3>明细 <span>' + escapeHtml(a.tableLabel || '全部') + '</span></h3>' +
        '<div class="vh-lb-tablewrap"><table class="vh-lb-table"><thead><tr>' +
        a.table.cols.map(function (c) { return '<th>' + escapeHtml(c) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + a.table.rows.map(function (r) {
          return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    html += '<p class="vh-lb-note">' + (a.note || '') + '</p>';
    box.innerHTML = html;
  }


  function renderOne(key) {
    var host = $(hostIds[key]);
    if (!host || !drawers[key]) return;
    if (Date.now() < (animUntil[key] || 0)) return;
    var s = sizeOf(host);
    drawers[key](host, s.w, s.h);
  }

  function setHero() {
    var total = state.stats && state.stats.total_postings;
    var provCount = state.provinces && state.provinces.length;
    var companies = state.kpi && state.kpi.total_companies;

    function put(id, value, unit) {
      var node = $(id);
      if (!node) return;
      if (value === null || value === undefined || value === '' || isNaN(value)) {
        node.textContent = '—';
        return;
      }
      var unitHtml = unit ? '<small>' + unit + '</small>' : '';
      var num = Number(value);
      if (node.__vhNum === num) return;
      node.__vhNum = num;
      if (reduceMotion || node.__vhDone) {
        node.innerHTML = fmtInt(num) + unitHtml;
        return;
      }
      node.__vhDone = true;
      tween(900, function (p) {
        node.innerHTML = fmtInt(num * easeOutCubic(p)) + unitHtml;
      });
    }
    put('vh-meta-total', total, '条');
    put('vh-meta-prov', provCount, '省');
    put('vh-meta-company', companies, '家');
    var dateNode = $('vh-meta-date');
    if (dateNode) dateNode.textContent = SNAPSHOT_DATE;
  }

  function setSources() {
    var box = $('vh-sources');
    if (!box || !state.stats) return;
    var srcs = state.stats.sources || [];
    var total = state.stats.total_postings || srcs.reduce(function (s, x) { return s + x.count; }, 0);
    box.innerHTML = '<span class="vh-sources-label">数据来源</span>' + srcs.map(function (s, i) {
      return '<span class="vh-src"><i style="background:' + PALETTE[i % PALETTE.length] + '"></i>' +
        escapeHtml(s.name) + ' ' + fmtPct(s.count, total) + '</span>';
    }).join('');
    var badge = $('vh-analysis-source');
    if (badge) badge.textContent = '库内数据 · ' + fmtInt(total) + ' 条';
  }

  function setInsight() {
    var ai = state.insight;
    if (ai && ai.insights) {
      var head = $('vh-insight-headline');
      if (head) head.textContent = ai.headline || '结构分化';
      var list = $('vh-insights');
      if (list) {
        var tone = { rising: C.teal, declining: C.rose, risk: C.gold, opportunity: C.slate };
        list.innerHTML = ai.insights.slice(0, 4).map(function (it) {
          return '<li><i style="background:' + (tone[it.category] || C.gold) + '"></i>' +
            '<span>' + escapeHtml(it.text) + '</span>' +
            '<em>' + (it.confidence ? it.confidence + '%' : '') + '</em></li>';
        }).join('');
      }
    }

    if (state.emerging) {
      var sorted = state.emerging.slice().sort(function (a, b) { return b.growth_potential - a.growth_potential; });
      var ol = $('vh-emerging-list');
      if (ol) {
        ol.innerHTML = sorted.slice(0, 3).map(function (j, i) {
          return '<li><i>' + ('0' + (i + 1)) + '</i><div><b>' + escapeHtml(j.title) + '</b>' +
            '<span>预计 ' + j.eta_months + ' 个月成熟</span></div>' +
            '<em>' + j.growth_potential + '</em></li>';
        }).join('');
      }
      var counts = {};
      sorted.forEach(function (j) {
        (j.required_skills || []).forEach(function (s) { counts[s] = (counts[s] || 0) + 1; });
      });
      var skills = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); }).slice(0, 8);
      var chips = $('vh-skill-chips');
      if (chips) {
        var allOnce = skills.every(function (s) { return counts[s] <= 1; });
        chips.innerHTML = skills.map(function (s) {
          return '<span>' + escapeHtml(s) + (allOnce ? '' : ' ×' + counts[s]) + '</span>';
        }).join('');
      }
    }
  }

  /* ============================ 放大弹层 ============================ */
  function bindLightbox() {
    var box = $('vh-lightbox');
    if (!box) return;
    box.querySelectorAll('[data-vh-close]').forEach(function (n) {
      n.addEventListener('click', closeLightbox);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightboxKey) closeLightbox();
    });
  }

  function openLightbox(key) {
    if (!drawers[key]) return;
    var box = $('vh-lightbox'), title = $('vh-lightbox-title');
    if (!box) return;
    lightboxKey = key;
    if (title) title.textContent = panelTitles[key] || '图表';
    box.hidden = false;
    /* 每次点开都重播入场动画：replayAnim 只在这一次同步渲染里为 true */
    replayAnim = true;
    renderLightbox();
    replayAnim = false;
    renderAnalysis(key);
    var btn = box.querySelector('.vh-lightbox-close');
    if (btn) btn.focus();
  }

  function renderLightbox() {
    if (!lightboxKey) return;
    var host = $('vh-lightbox-chart');
    if (!host) return;
    var rect = host.getBoundingClientRect();
    var w = Math.max(300, Math.round(rect.width || window.innerWidth * 0.6));
    var narrow = window.innerWidth < 900;
    var h = Math.max(240, Math.round(window.innerHeight * (narrow ? 0.36 : 0.58)));
    h = Math.min(h, narrow ? 360 : 560);
    host.style.height = h + 'px';
    /* 星图按正方形铺，避免在宽卡片里缩成一小圈 */
    if (lightboxKey === 'star') {
      var side = Math.min(w, h);
      drawers[lightboxKey](host, side, side);
    } else {
      drawers[lightboxKey](host, w, h);
    }
    var note = $('vh-lightbox-note');
    if (note) {
      var total = state.stats && state.stats.total_postings;
      note.textContent = total
        ? '库内数据 · ' + fmtInt(total) + ' 条 · ' + SNAPSHOT_DATE
        : '库内数据';
    }
  }

  function closeLightbox() {
    var box = $('vh-lightbox');
    if (box) box.hidden = true;
    lightboxKey = null;
    hideTip();
  }

  /* ============================ 初始化 ============================ */
  function bindPanels() {
    document.querySelectorAll('[data-panel]').forEach(function (panel) {
      var key = panel.getAttribute('data-panel');
      panel.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.vh-lightbox')) return;
        openLightbox(key);
      });
      panel.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(key);
        }
      });
    });
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (lightboxKey) renderLightbox();
      }, 160);
    });
  }

  function observeHosts() {
    if (!window.ResizeObserver) return;
    var ro = new ResizeObserver(function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        Object.keys(hostIds).forEach(function (key) {
          if (dataReady[key]) renderOne(key);
        });
        if (lightboxKey) renderLightbox();
      }, 140);
    });
    Object.keys(hostIds).forEach(function (key) {
      var host = $(hostIds[key]);
      if (host) ro.observe(host);
    });
  }

  function initVizHall() {
    var root = document.querySelector('.vh-root');
    if (root) requestAnimationFrame(function () { root.classList.add('is-ready'); });
    if (root && root.dataset.vhInit === '1') return;
    if (root) root.dataset.vhInit = '1';

    bindLightbox();
    bindPanels();
    observeHosts();

    /* 先用骨架占位，数据到了再逐块替换 */
    renderHeroSkeleton();
    renderSideSkeletons();
    renderSkeletons();

    /* 核心数据：先到先画，互不阻塞 */
    getJSON('/api/data/stats', 12000).then(function (d) {
      state.stats = d;
      setHero();
      setSources();
    }).catch(function () { /* 页头保持占位 */ });

    getJSON('/api/map/provinces', 15000).then(function (d) {
      state.provinces = d.provinces || [];
      dataReady.star = dataReady.prov = dataReady.pay = true;
      renderOne('star');
      renderOne('prov');
      renderOne('pay');
      setHero();
    }).catch(function () {
      emptyChart($('vh-chart-star'));
      emptyChart($('vh-chart-prov'));
      emptyChart($('vh-chart-pay'));
    });

    getJSON('/api/data/city-stats', 12000).then(function (d) {
      state.city = Array.isArray(d) ? d : [];
      dataReady.city = true;
      renderOne('city');
    }).catch(function () { emptyChart($('vh-chart-city')); });

    getJSON('/api/data/salary-stats', 12000).then(function (d) {
      state.salary = d;
      dataReady.salary = true;
      renderOne('salary');
    }).catch(function () { emptyChart($('vh-chart-salary')); });

    getJSON('/api/trends/dashboard', 15000).then(function (d) {
      state.kpi = d.kpi || null;
      state.trends = Object.keys(d.job_trends || {}).map(function (k) {
        var j = d.job_trends[k];
        var demand = Array.isArray(j.demand)
          ? j.demand.reduce(function (s, v) { return s + v; }, 0)
          : (j.demand || 0);
        return {
          title: j.title || k,
          value: demand,
          salary: Array.isArray(j.salary) ? j.salary[0] : j.salary
        };
      }).filter(function (t) { return t.value > 0; });
      dataReady.demand = true;
      renderOne('demand');
      setHero();
    }).catch(function () { emptyChart($('vh-chart-demand')); });

    /* 慢接口：AI 洞察与新兴岗位（后端需生成，可达数秒）；会话内缓存，避免刷新抖动 */
    cachedJSON('/api/trends/emerging-jobs', 10 * 60 * 1000, 40000).then(function (d) {
      state.emerging = d.emerging_jobs || [];
      dataReady.future = true;
      renderOne('future');
      setInsight();
    }).catch(function () { emptyChart($('vh-chart-future')); });

    cachedJSON('/api/trends/ai-insight', 5 * 60 * 1000, 40000).then(function (d) {
      state.insight = d;
      setInsight();
    }).catch(function () {
      var head = $('vh-insight-headline');
      if (head) head.textContent = '洞察接口暂不可用';
    });
  }

  window.initVizHall = initVizHall;
})();
