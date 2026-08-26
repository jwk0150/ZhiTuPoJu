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
  var FAV_META_KEY = 'jobnews_fav_meta';
  function getFavs() {
    try {
      var raw = localStorage.getItem(FAV_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function getFavMeta() {
    try {
      var raw = localStorage.getItem(FAV_META_KEY);
      var m = raw ? JSON.parse(raw) : {};
      return m && typeof m === 'object' ? m : {};
    } catch (e) { return {}; }
  }
  function isFav(id) { return getFavs().indexOf(id) >= 0; }
  function toggleFav(id, meta) {
    var favs = getFavs();
    var idx = favs.indexOf(id);
    var added = false;
    var map = getFavMeta();
    if (idx >= 0) {
      favs.splice(idx, 1);
      delete map[String(id)];
    } else {
      favs.push(id);
      added = true;
      if (meta && meta.title) {
        map[String(id)] = {
          title: String(meta.title),
          savedAt: Date.now()
        };
      }
    }
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(favs));
      localStorage.setItem(FAV_META_KEY, JSON.stringify(map));
    } catch (e) {}
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
    var title = btn.getAttribute('data-title') || '';
    if (!title) {
      var card = btn.closest('.jn-card, .jn-item, article, .jn-detail');
      if (card) {
        var tEl = card.querySelector('h1, h2, h3, .jn-title, .jn-card-title');
        if (tEl) title = (tEl.textContent || '').trim();
      }
    }
    var added = toggleFav(id, title ? { title: title } : null);
    btn.classList.toggle('is-on', added);
    toast(added ? '已收藏' : '已取消收藏', 'success');
  });

  /* ---------- 新闻视觉图（贴合内容的扁平插画） ---------- */
  function _bust(cx, cy, suit, skin) {
    suit = suit || '#1C4A66';
    skin = skin || '#F2D9B8';
    return '<g>' +
      '<ellipse cx="' + cx + '" cy="' + (cy + 17) + '" rx="12" ry="10" fill="' + suit + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="6.5" fill="' + skin + '"/>' +
    '</g>';
  }

  var SCENES = {
    /* AI 正在重塑人才市场：城市天际线 + 中心服务器节点 + 连接的人才 */
    network: {
      bg: ['#235A7E', '#0F2C42'],
      body:
        '<g fill="#0C2436" fill-opacity="0.55">' +
          '<rect x="8" y="94" width="22" height="34"/><rect x="34" y="82" width="17" height="46"/>' +
          '<rect x="150" y="88" width="20" height="40"/><rect x="172" y="78" width="16" height="50"/>' +
        '</g>' +
        '<g fill="none" stroke="#A6D2E6" stroke-opacity="0.5" stroke-width="1.4">' +
          '<path d="M96 60 C72 50 54 42 42 34"/>' +
          '<path d="M96 60 C120 48 140 40 152 30"/>' +
          '<path d="M96 60 C124 70 146 76 158 82"/>' +
          '<path d="M96 60 C72 72 54 82 42 90"/>' +
        '</g>' +
        '<rect x="74" y="42" width="44" height="36" rx="8" fill="#0E2A3E" stroke="#E8B85F" stroke-width="2"/>' +
        '<rect x="82" y="50" width="28" height="20" rx="3" fill="#12384F"/>' +
        '<circle cx="96" cy="60" r="5" fill="#7FE3C4"/>' +
        '<path d="M88 52 l5 5 9 -10" stroke="#7FE3C4" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
        _bust(40, 28, '#1C4A66') + _bust(152, 26, '#1C4A66') +
        _bust(158, 78, '#1C4A66') + _bust(42, 86, '#1C4A66')
    },
    /* 智能体开发：电路板上带表情的智能芯片 + 元件 */
    chip: {
      bg: ['#3C2E66', '#1A1434'],
      body:
        '<g stroke="#3C6B5A" stroke-width="2" fill="none" stroke-opacity="0.8">' +
          '<path d="M18 30 H54 M18 60 H54 M18 98 H54"/>' +
          '<path d="M138 30 H174 M138 60 H174 M138 98 H174"/>' +
        '</g>' +
        '<g fill="#2E5A4C"><circle cx="54" cy="30" r="3"/><circle cx="54" cy="60" r="3"/><circle cx="54" cy="98" r="3"/>' +
          '<circle cx="138" cy="30" r="3"/><circle cx="138" cy="60" r="3"/><circle cx="138" cy="98" r="3"/></g>' +
        '<rect x="66" y="40" width="60" height="48" rx="9" fill="#1E2A3E" stroke="#C9B6F0" stroke-width="2"/>' +
        '<rect x="80" y="54" width="32" height="20" rx="5" fill="#2A2148"/>' +
        '<circle cx="90" cy="64" r="2.6" fill="#7FE3C4"/><circle cx="102" cy="64" r="2.6" fill="#7FE3C4"/>' +
        '<path d="M89 70 q7 5 14 0" stroke="#7FE3C4" stroke-width="2" fill="none" stroke-linecap="round"/>' +
        '<g stroke="#C9B6F0" stroke-width="2" stroke-linecap="round">' +
          '<path d="M66 50 h-10 M66 64 h-10 M66 78 h-10 M126 50 h10 M126 64 h10 M126 78 h10"/>' +
          '<path d="M84 40 v-10 M96 40 v-10 M108 40 v-10 M84 88 v10 M96 88 v10 M108 88 v10"/>' +
        '</g>'
    },
    /* AI 产品经理 / 智能制造：数据分析看板（多面板 + 折线 + 光标） */
    grid: {
      bg: ['#27384B', '#111E29'],
      body:
        '<rect x="32" y="28" width="128" height="72" rx="10" fill="#10202C" stroke="#6E8AA0" stroke-width="2"/>' +
        '<rect x="32" y="28" width="128" height="15" rx="10" fill="#284A63"/>' +
        '<circle cx="44" cy="35.5" r="2.4" fill="#E8B85F"/><circle cx="52" cy="35.5" r="2.4" fill="#7FA8D6"/><circle cx="60" cy="35.5" r="2.4" fill="#7FE3C4"/>' +
        '<g fill="#1C3548"><rect x="42" y="50" width="32" height="16" rx="3"/><rect x="80" y="50" width="32" height="16" rx="3"/><rect x="118" y="50" width="30" height="16" rx="3"/></g>' +
        '<g fill="#E8B85F"><rect x="46" y="70" width="11" height="14" rx="2"/><rect x="61" y="63" width="11" height="21" rx="2"/></g>' +
        '<polyline points="118,88 126,74 134,80 142,64 148,70" fill="none" stroke="#7FE3C4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M150 82 l9 11 l-3 -1.5 l-2.5 4 l-2 -3.5 l-3 1.5 z" fill="#E8B85F"/>'
    },
    /* 新能源：太阳 + 风机 + 光伏阵列 + 电池 + 叶片 */
    bars: {
      bg: ['#2E7E86', '#143E47'],
      body:
        '<circle cx="158" cy="28" r="13" fill="#F4C95D"/>' +
        '<g stroke="#F4C95D" stroke-width="2" stroke-linecap="round">' +
          '<path d="M158 6 v-5 M158 50 v5 M136 28 h-5 M180 28 h5 M142 12 l-4 -4 M174 44 l4 4 M174 12 l4 -4 M142 44 l-4 4"/>' +
        '</g>' +
        '<line x1="40" y1="106" x2="40" y2="54" stroke="#9FC0D6" stroke-width="3"/>' +
        '<g fill="#9FC0D6"><path d="M40 54 l-3 -18 l8 6 z"/><path d="M40 54 l16 -8 l-6 9 z"/><path d="M40 54 l-12 14 l10 -4 z"/></g>' +
        '<circle cx="40" cy="54" r="3" fill="#E8B85F"/>' +
        '<g transform="translate(68,72)"><polygon points="0,18 46,8 58,30 12,40" fill="#16323A" stroke="#7FB0D0" stroke-width="1.4"/>' +
          '<g stroke="#7FB0D0" stroke-width="0.8" stroke-opacity="0.7"><path d="M10,17 l8 24 M22,14 l8 24 M34,11 l8 24 M14,36 l42 -10"/></g></g>' +
        '<rect x="130" y="84" width="34" height="20" rx="4" fill="#16323A" stroke="#E8B85F" stroke-width="2"/>' +
        '<rect x="164" y="90" width="4" height="8" rx="2" fill="#E8B85F"/>' +
        '<rect x="134" y="88" width="22" height="12" rx="2" fill="#7FE3C4" fill-opacity="0.85"/>' +
        '<path d="M98 56 q12 -16 26 -6 q7 9 -2 16 q-14 5 -24 -10 z" fill="#7FB88F"/>'
    },
    /* 具身智能机器人：工厂场景中的人形机器人 + 货物箱 */
    gear: {
      bg: ['#2B5E7C', '#123040'],
      body:
        '<g fill="none" stroke="#4A6A7E" stroke-opacity="0.5" stroke-width="3"><circle cx="152" cy="38" r="13"/></g>' +
        '<circle cx="152" cy="38" r="4" fill="#4A6A7E" fill-opacity="0.6"/>' +
        '<line x1="96" y1="36" x2="96" y2="26" stroke="#6E8AA0" stroke-width="2"/>' +
        '<circle cx="96" cy="23" r="3.5" fill="#E8B85F"/>' +
        '<rect x="80" y="36" width="32" height="26" rx="7" fill="#E2EBF1" stroke="#5E7A8E" stroke-width="1.6"/>' +
        '<circle cx="89" cy="49" r="3.4" fill="#2B5E7C"/><circle cx="103" cy="49" r="3.4" fill="#2B5E7C"/>' +
        '<rect x="88" y="56" width="16" height="3" rx="1.5" fill="#2B5E7C"/>' +
        '<rect x="74" y="64" width="44" height="34" rx="9" fill="#E2EBF1" stroke="#5E7A8E" stroke-width="1.6"/>' +
        '<circle cx="96" cy="82" r="6" fill="#7FE3C4" fill-opacity="0.85"/>' +
        '<rect x="60" y="68" width="12" height="26" rx="6" fill="#C2D2DD"/>' +
        '<rect x="120" y="68" width="12" height="26" rx="6" fill="#C2D2DD"/>' +
        '<rect x="82" y="98" width="12" height="18" rx="5" fill="#C2D2DD"/>' +
        '<rect x="98" y="98" width="12" height="18" rx="5" fill="#C2D2DD"/>' +
        '<rect x="138" y="92" width="34" height="24" rx="3" fill="#C98A4A" stroke="#8A5A2A" stroke-width="1.4"/>' +
        '<path d="M138 96 h34 M155 92 v24" stroke="#8A5A2A" stroke-width="1.2"/>' +
        '<line x1="20" y1="118" x2="184" y2="118" stroke="#6E8AA0" stroke-opacity="0.5" stroke-width="2"/>'
    },
    /* 数据分析：展示板 + 柱状/折线 + 放大镜 + 饼图 */
    data: {
      bg: ['#33406B', '#1A2138'],
      body:
        '<line x1="96" y1="96" x2="96" y2="110" stroke="#46577F" stroke-width="3"/>' +
        '<line x1="70" y1="114" x2="122" y2="114" stroke="#46577F" stroke-width="3"/>' +
        '<rect x="30" y="34" width="88" height="62" rx="6" fill="#16233A" stroke="#6E8AA0" stroke-width="2"/>' +
        '<rect x="40" y="74" width="12" height="16" rx="2" fill="#7FA8D6"/>' +
        '<rect x="56" y="64" width="12" height="26" rx="2" fill="#9FC0E8"/>' +
        '<rect x="72" y="54" width="12" height="36" rx="2" fill="#E8B85F"/>' +
        '<rect x="88" y="66" width="12" height="24" rx="2" fill="#7FE3C4"/>' +
        '<polyline points="46,70 62,58 78,50 94,60 102,46" fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="132" cy="62" r="16" fill="#ffffff" fill-opacity="0.12" stroke="#E8B85F" stroke-width="2.4"/>' +
        '<line x1="144" y1="74" x2="156" y2="86" stroke="#E8B85F" stroke-width="3" stroke-linecap="round"/>' +
        '<g transform="translate(150,38)"><circle r="12" fill="none" stroke="#46577F" stroke-width="6"/>' +
          '<path d="M0 -12 A12 12 0 1 1 -12 0 L0 0 Z" fill="#E8B85F"/></g>'
    },
    /* 政策：政府楼 + 文件 + 红色印章 */
    doc: {
      bg: ['#3A4A66', '#1E293B'],
      body:
        '<g fill="#E8B85F">' +
          '<path d="M24 46 L48 28 L72 46 Z"/>' +
          '<rect x="30" y="46" width="6" height="20"/><rect x="42" y="46" width="6" height="20"/><rect x="54" y="46" width="6" height="20"/>' +
          '<rect x="22" y="66" width="52" height="6"/>' +
        '</g>' +
        '<rect x="86" y="26" width="78" height="86" rx="8" fill="#EEF2F6" stroke="#C2CEDB" stroke-width="1.6"/>' +
        '<g fill="#9FB0C2"><rect x="98" y="40" width="54" height="5" rx="2.5"/><rect x="98" y="54" width="54" height="5" rx="2.5"/>' +
          '<rect x="98" y="68" width="38" height="5" rx="2.5"/><rect x="98" y="82" width="54" height="5" rx="2.5"/></g>' +
        '<circle cx="150" cy="96" r="13" fill="#C0392B"/>' +
        '<circle cx="150" cy="96" r="13" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="1.5"/>' +
        '<path d="M150 89 l2 5 5 0 -4 3 1.5 5 -4.5 -3 -4.5 3 1.5 -5 -4 -3 5 0 z" fill="#fff"/>'
    },
    default: {
      bg: ['#33406B', '#1A2138'],
      body:
        '<rect x="36" y="86" width="16" height="26" rx="3" fill="#7FA8D6"/>' +
        '<rect x="60" y="74" width="16" height="38" rx="3" fill="#9FC0E8"/>' +
        '<rect x="84" y="64" width="16" height="48" rx="3" fill="#E8B85F"/>' +
        '<rect x="108" y="78" width="16" height="34" rx="3" fill="#7FE3C4"/>'
    }
  };

  function artVisual(kind, opts) {
    opts = opts || {};
    var cls = opts.cls || '';
    var scene = SCENES[kind] || SCENES.default;
    var id = 'av' + Math.random().toString(36).slice(2, 8);
    return (
      '<svg class="jn-art ' + cls + '" viewBox="0 0 192 128" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="' + scene.bg[0] + '"/><stop offset="1" stop-color="' + scene.bg[1] + '"/>' +
        '</linearGradient></defs>' +
        '<rect width="192" height="128" fill="url(#' + id + ')"/>' +
        '<circle cx="150" cy="16" r="80" fill="#ffffff" fill-opacity="0.05"/>' +
        scene.body +
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
