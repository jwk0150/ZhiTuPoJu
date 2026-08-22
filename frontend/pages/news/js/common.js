/* =========================================================================
 * 岗位大新闻 · 共享工具层
 * -------------------------------------------------------------------------
 * DOM 辅助 / 提示 / 数字动效 / 收藏 / 抽象视觉图 / 迷你趋势图
 * ========================================================================= */
(function () {
  'use strict';

  /* ---------- 基础 DOM 辅助 ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- Toast 提示 ---------- */
  var toastTimer = null;
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'jn-toast';
    el.setAttribute('data-type', type || 'info');
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-show'); });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-show');
      setTimeout(function () { el.remove(); }, 320);
    }, 2200);
  }

  /* ---------- 数字 count-up ---------- */
  function countUp(el, target, opts) {
    if (!el) return;
    opts = opts || {};
    var decimals = opts.decimals != null ? opts.decimals : 0;
    var dur = opts.dur || 900;
    var start = 0;
    var t0 = null;
    function fmt(v) {
      return decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString('en-US');
    }
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(start + (target - start) * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = fmt(target);
    }
    requestAnimationFrame(step);
  }

  function animateDataValues(root) {
    $$('[data-count]', root).forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      countUp(el, target, { decimals: decimals });
    });
  }

  /* ---------- 收藏（前端 localStorage 状态） ---------- */
  var FAV_KEY = 'jobnews_favs';
  function getFavs() {
    try {
      var raw = localStorage.getItem(FAV_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function isFav(id) { return getFavs().indexOf(id) >= 0; }
  function toggleFav(id) {
    var favs = getFavs();
    var idx = favs.indexOf(id);
    var added = false;
    if (idx >= 0) { favs.splice(idx, 1); }
    else { favs.push(id); added = true; }
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch (e) {}
    return added;
  }

  var HEART_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">' +
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

  function favButton(id, cls) {
    var on = isFav(id);
    return (
      '<button type="button" class="jn-fav ' + (cls || '') + (on ? ' is-on' : '') + '"' +
      ' data-id="' + id + '" data-fav aria-label="收藏">' + HEART_SVG + '</button>'
    );
  }

  /* 收藏委托事件（首页 / 详情页通用） */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-fav]') : null;
    if (!btn) return;
    e.stopPropagation();
    var id = btn.getAttribute('data-id');
    var added = toggleFav(id);
    btn.classList.toggle('is-on', added);
    toast(added ? '已收藏' : '已取消收藏', 'success');
  });

  /* ---------- 抽象视觉图（渐变 + 数据节点，非真实照片） ---------- */
  function artVisual(kind, opts) {
    opts = opts || {};
    var cls = opts.cls || '';
    var id = 'av' + Math.random().toString(36).slice(2, 8);
    var inner = '';
    switch (kind) {
      case 'network':
        inner =
          '<circle cx="38" cy="38" r="3.2" fill="#fff" fill-opacity="0.9"/>' +
          '<circle cx="118" cy="24" r="2.4" fill="#fff" fill-opacity="0.7"/>' +
          '<circle cx="150" cy="70" r="3.4" fill="#fff" fill-opacity="0.85"/>' +
          '<circle cx="92" cy="96" r="2.6" fill="#fff" fill-opacity="0.7"/>' +
          '<circle cx="24" cy="88" r="2.2" fill="#fff" fill-opacity="0.6"/>' +
          '<path d="M38 38 L118 24 M38 38 L150 70 M38 38 L92 96 M38 38 L24 88" ' +
            'stroke="#fff" stroke-opacity="0.45" stroke-width="1.4" fill="none"/>' +
          '<path d="M118 24 L150 70 L92 96 L24 88 Z" stroke="#fff" stroke-opacity="0.2" stroke-width="1" fill="none"/>';
        break;
      case 'robot':
        inner =
          '<rect x="70" y="30" width="52" height="46" rx="12" fill="#fff" fill-opacity="0.9"/>' +
          '<circle cx="86" cy="50" r="6" fill="#4A9FE8"/><circle cx="106" cy="50" r="6" fill="#4A9FE8"/>' +
          '<path d="M86 66 h20" stroke="#4A9FE8" stroke-width="3" stroke-linecap="round"/>' +
          '<path d="M96 24 v-8 M96 30 h-4 M96 30 h4" stroke="#fff" stroke-width="2" fill="none"/>' +
          '<rect x="34" y="40" width="20" height="20" rx="6" fill="#fff" fill-opacity="0.55"/>' +
          '<rect x="138" y="40" width="20" height="20" rx="6" fill="#fff" fill-opacity="0.55"/>';
        break;
      case 'data':
        inner =
          '<path d="M28 88 v-26 M58 88 v-46 M88 88 v-18 M118 88 v-38 M148 88 v-56" ' +
            'stroke="#fff" stroke-opacity="0.85" stroke-width="7" stroke-linecap="round"/>' +
          '<circle cx="28" cy="62" r="3" fill="#fff"/><circle cx="58" cy="42" r="3" fill="#fff"/>' +
          '<circle cx="118" cy="50" r="3" fill="#fff"/><circle cx="148" cy="32" r="3" fill="#fff"/>';
        break;
      case 'grid':
        inner =
          '<g stroke="#fff" stroke-opacity="0.5" stroke-width="1.2">' +
          '<path d="M40 32 h112 M40 64 h112 M40 96 h112"/><path d="M64 32 v64 M112 32 v64 M160 32 v64"/>' +
          '</g>' +
          '<rect x="64" y="32" width="22" height="22" rx="5" fill="#fff" fill-opacity="0.85"/>' +
          '<rect x="136" y="64" width="22" height="22" rx="5" fill="#fff" fill-opacity="0.6"/>' +
          '<rect x="88" y="64" width="22" height="22" rx="5" fill="#fff" fill-opacity="0.35"/>';
        break;
      case 'doc':
        inner =
          '<rect x="60" y="30" width="72" height="84" rx="10" fill="#fff" fill-opacity="0.92"/>' +
          '<path d="M76 52 h40 M76 64 h40 M76 76 h26" stroke="#4A9FE8" stroke-width="4" stroke-linecap="round"/>' +
          '<circle cx="144" cy="44" r="7" fill="#fff" fill-opacity="0.7"/>';
        break;
      case 'bars':
        inner =
          '<path d="M30 96 h130" stroke="#fff" stroke-opacity="0.5" stroke-width="2"/>' +
          '<path d="M42 88 v-34 h18 v34 z M74 88 v-52 h18 v52 z M106 88 v-24 h18 v24 z M138 88 v-42 h18 v42 z" fill="#fff" fill-opacity="0.8"/>';
        break;
      default:
        inner = '<circle cx="96" cy="60" r="30" fill="#fff" fill-opacity="0.5"/>';
    }
    return (
      '<svg class="jn-art ' + cls + '" viewBox="0 0 192 128" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#7CC2F2"/><stop offset="1" stop-color="#4A9FE8"/>' +
        '</linearGradient></defs>' +
        '<rect width="192" height="128" fill="url(#' + id + ')"/>' +
        inner +
      '</svg>'
    );
  }

  /* ---------- 迷你趋势 sparkline（SVG，极简） ---------- */
  function sparkline(points, opts) {
    opts = opts || {};
    var w = opts.w || 260;
    var h = opts.h || 84;
    var pad = 10;
    var min = Math.min.apply(null, points);
    var max = Math.max.apply(null, points);
    var range = max - min || 1;
    var stepX = (w - pad * 2) / (points.length - 1);
    var pts = points.map(function (v, i) {
      var x = pad + i * stepX;
      var y = h - pad - ((v - min) / range) * (h - pad * 2);
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    });
    var line = pts.map(function (p, i) {
      return (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y;
    }).join(' ');
    var area = line + ' L' + pts[pts.length - 1].x + ' ' + (h - pad) + ' L' + pts[0].x + ' ' + (h - pad) + ' Z';
    var gid = 'spg' + Math.random().toString(36).slice(2, 7);
    return (
      '<svg class="jn-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
        '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#4A9FE8" stop-opacity="0.30"/>' +
          '<stop offset="1" stop-color="#4A9FE8" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        '<path d="' + area + '" fill="url(#' + gid + ')" stroke="none"/>' +
        '<path d="' + line + '" fill="none" stroke="#4A9FE8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }

  /* ---------- debounce ---------- */
  function debounce(fn, wait) {
    var t = null;
    return function () {
      var args = arguments;
      var self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  /* ---------- 趋势徽标 ---------- */
  function trendBadge(trend) {
    if (!trend) return '';
    var cls = trend.dir === 'up' ? 'is-up' : (trend.dir === 'down' ? 'is-down' : 'is-flat');
    var arrow = trend.dir === 'up' ? '↑' : (trend.dir === 'down' ? '↓' : '→');
    return '<span class="jn-trend ' + cls + '">' + arrow + ' ' + escapeHtml(trend.value) + '</span>';
  }

  window.JN = {
    $: $,
    $$: $$,
    escapeHtml: escapeHtml,
    toast: toast,
    countUp: countUp,
    animateDataValues: animateDataValues,
    getFavs: getFavs,
    isFav: isFav,
    toggleFav: toggleFav,
    favButton: favButton,
    artVisual: artVisual,
    sparkline: sparkline,
    debounce: debounce,
    trendBadge: trendBadge
  };
})();
