/* =========================================================================
 * 岗位大新闻 · 共享工具层
 * -------------------------------------------------------------------------
 * DOM 辅助 / 提示 / 数字动效 / 收藏 / 抽象视觉图 / 格式化工具
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
    if (window.Utils && typeof window.Utils.showToast === 'function') {
      var tone = type === 'success' ? 'mint' : (type === 'error' ? 'coral' : 'cyan');
      return window.Utils.showToast(msg, tone);
    }
    var el = document.getElementById('zhitu-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'zhitu-toast';
      document.body.appendChild(el);
    }
    el.className = 'zhitu-toast jn-toast is-show';
    el.setAttribute('data-type', type || 'info');
    el.textContent = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-show');
    }, 2200);
  }

  /* ---------- 数字 count-up ---------- */
  function countUp(el, target, opts) {
    if (!el) return;
    opts = opts || {};
    var decimals = opts.decimals != null ? opts.decimals : 0;
    var dur = opts.dur || 900;
    var t0 = null;
    function fmt(v) {
      return decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString('en-US');
    }
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(p >= 1 ? target : start + (target - start) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    var start = 0;
    requestAnimationFrame(step);
  }

  function animateDataValues(root) {
    $$('[data-count]', root || document).forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      countUp(el, target, { decimals: decimals });
    });
  }

  /* ---------- 格式化 ---------- */
  function fmtRead(n) {
    n = Number(n) || 0;
    if (n >= 10000) {
      var v = n / 10000;
      return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + '万';
    }
    return String(n);
  }

  function growthInfo(g) {
    g = Number(g) || 0;
    if (g > 0) return { dir: 'up', text: g.toFixed(1) + '%' };
    if (g < 0) return { dir: 'down', text: Math.abs(g).toFixed(1) + '%' };
    return { dir: 'flat', text: '持平' };
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
          '<circle cx="38" cy="38" r="3.2" fill="#D9B56A"/>' +
          '<circle cx="118" cy="24" r="2.4" fill="#37C8FF" fill-opacity="0.9"/>' +
          '<circle cx="150" cy="70" r="3.4" fill="#D9B56A" fill-opacity="0.9"/>' +
          '<circle cx="92" cy="96" r="2.6" fill="#24D8C7" fill-opacity="0.85"/>' +
          '<circle cx="24" cy="88" r="2.2" fill="#37C8FF" fill-opacity="0.8"/>' +
          '<path d="M38 38 L118 24 M38 38 L150 70 M38 38 L92 96 M38 38 L24 88" ' +
            'stroke="#fff" stroke-opacity="0.28" stroke-width="1.4" fill="none"/>' +
          '<path d="M118 24 L150 70 L92 96 L24 88 Z" stroke="#fff" stroke-opacity="0.14" stroke-width="1" fill="none"/>';
        break;
      case 'robot':
        inner =
          '<rect x="70" y="30" width="52" height="46" rx="12" fill="#fff" fill-opacity="0.9"/>' +
          '<circle cx="86" cy="50" r="6" fill="#37C8FF"/><circle cx="106" cy="50" r="6" fill="#37C8FF"/>' +
          '<path d="M86 66 h20" stroke="#37C8FF" stroke-width="3" stroke-linecap="round"/>' +
          '<path d="M96 24 v-8 M96 30 h-4 M96 30 h4" stroke="#fff" stroke-width="2" fill="none"/>' +
          '<rect x="34" y="40" width="20" height="20" rx="6" fill="#24D8C7" fill-opacity="0.55"/>' +
          '<rect x="138" y="40" width="20" height="20" rx="6" fill="#24D8C7" fill-opacity="0.55"/>';
        break;
      case 'data':
        inner =
          '<path d="M28 88 v-26 M58 88 v-46 M88 88 v-18 M118 88 v-38 M148 88 v-56" ' +
            'stroke="#37C8FF" stroke-opacity="0.9" stroke-width="7" stroke-linecap="round"/>' +
          '<circle cx="28" cy="62" r="3" fill="#D9B56A"/><circle cx="58" cy="42" r="3" fill="#D9B56A"/>' +
          '<circle cx="118" cy="50" r="3" fill="#D9B56A"/><circle cx="148" cy="32" r="3" fill="#D9B56A"/>';
        break;
      case 'grid':
        inner =
          '<g stroke="#37C8FF" stroke-opacity="0.4" stroke-width="1.2">' +
          '<path d="M40 32 h112 M40 64 h112 M40 96 h112"/><path d="M64 32 v64 M112 32 v64 M160 32 v64"/>' +
          '</g>' +
          '<rect x="64" y="32" width="22" height="22" rx="5" fill="#D9B56A" fill-opacity="0.9"/>' +
          '<rect x="136" y="64" width="22" height="22" rx="5" fill="#37C8FF" fill-opacity="0.6"/>' +
          '<rect x="88" y="64" width="22" height="22" rx="5" fill="#24D8C7" fill-opacity="0.45"/>';
        break;
      case 'doc':
        inner =
          '<rect x="60" y="30" width="72" height="84" rx="10" fill="#fff" fill-opacity="0.92"/>' +
          '<path d="M76 52 h40 M76 64 h40 M76 76 h26" stroke="#37C8FF" stroke-width="4" stroke-linecap="round"/>' +
          '<circle cx="144" cy="44" r="7" fill="#D9B56A" fill-opacity="0.9"/>';
        break;
      case 'bars':
        inner =
          '<path d="M30 96 h130" stroke="#fff" stroke-opacity="0.3" stroke-width="2"/>' +
          '<path d="M42 88 v-34 h18 v34 z M74 88 v-52 h18 v52 z M106 88 v-24 h18 v24 z M138 88 v-42 h18 v42 z" fill="#37C8FF" fill-opacity="0.85"/>' +
          '<circle cx="83" cy="34" r="3" fill="#D9B56A"/>';
        break;
      default:
        inner = '<circle cx="96" cy="60" r="30" fill="#37C8FF" fill-opacity="0.5"/>';
    }
    return (
      '<svg class="jn-art ' + cls + '" viewBox="0 0 192 128" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#123044"/><stop offset="0.55" stop-color="#0D2231"/>' +
          '<stop offset="1" stop-color="#101820"/>' +
        '</linearGradient></defs>' +
        '<rect width="192" height="128" fill="url(#' + id + ')"/>' +
        '<circle cx="170" cy="14" r="40" fill="#D9B56A" fill-opacity="0.06"/>' +
        inner +
      '</svg>'
    );
  }

  /* ---------- 趋势徽标 ---------- */
  function trendBadge(growth) {
    var g = growthInfo(growth);
    var arrow = g.dir === 'up' ? '↑' : (g.dir === 'down' ? '↓' : '→');
    return '<span class="jn-trend is-' + g.dir + '">' + arrow + ' ' + escapeHtml(g.text) + '</span>';
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

  window.JN = {
    $: $,
    $$: $$,
    escapeHtml: escapeHtml,
    toast: toast,
    countUp: countUp,
    animateDataValues: animateDataValues,
    fmtRead: fmtRead,
    growthInfo: growthInfo,
    getFavs: getFavs,
    isFav: isFav,
    toggleFav: toggleFav,
    favButton: favButton,
    artVisual: artVisual,
    trendBadge: trendBadge,
    debounce: debounce
  };
})();
