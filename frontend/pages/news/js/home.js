/* =========================================================================
 * 岗位大新闻 · 首页逻辑
 * -------------------------------------------------------------------------
 * 渲染：模块标题 / 今日焦点（主卡片 + 右侧焦点卡片）/
 *       三栏（热门资讯 / 行业快讯 / 热门排行）/ 延伸阅读
 * 交互：分类筛选 / 收藏 / 点击进入详情
 * ========================================================================= */
(function () {
  'use strict';

  var D = window.JOB_NEWS_DATA;
  var JN = window.JN;
  var esc = JN.escapeHtml;

  var state = {
    latestCategory: 'all',
    focusIndex: 0,
    search: { keyword: '', date: '', sort: 'date' }
  };

  var FOCUS_AUTO_MS = 5000;
  var focusTimer = null;
  var focusHover = false;
  var FOCUS_GROUPS = buildFocusGroups();

  /* ---------- 顶部更新时间胶囊（全屏滚动版） ---------- */
  function renderModuleHead() {
    var M = D.META;
    var el = document.getElementById('jn-topbar-update');
    if (el) el.innerHTML = '更新于 <b>' + esc(M.date) + ' ' + esc(M.time) + '</b>';
  }

  /* ---------- 今日焦点：分组（主卡 + 3 侧卡） ---------- */
  function buildFocusGroups() {
    var list = D.focusList;
    var groups = [];
    for (var i = 0; i < list.length; i += 4) {
      var main = list[i];
      var side = [];
      for (var k = 1; k <= 3; k++) {
        var idx = i + k;
        if (idx >= list.length) idx -= list.length; /* 末尾循环补齐 */
        side.push(list[idx]);
      }
      groups.push({ main: main, side: side });
    }
    return groups;
  }

  /* ---------- 今日焦点：主卡片（兼容外链行业资讯） ---------- */
  function featureCardHtml(n) {
    var isExt = !!n.external;
    var attr = isExt ? ('data-url="' + esc(n.url) + '"') : ('data-go="' + n.id + '"');
    var flag = n.flag || (isExt ? '行业快讯' : '');
    var cover = n.cover || 'default';
    var btnText = isExt ? '查看原文 <span aria-hidden="true">↗</span>' : '阅读详情 <span aria-hidden="true">→</span>';
    return (
      '<article class="jn-feature-card' + (isExt ? ' jn-feature-card--ext' : '') + '" ' + attr + '>' +
        '<div class="jn-feature-body">' +
          (flag ? '<span class="jn-feature-flag">' + esc(flag) + '</span>' : '') +
          '<h3 class="jn-feature-title">' + esc(n.title) + '</h3>' +
          '<p class="jn-feature-summary">' + esc(n.summary) + '</p>' +
          '<div class="jn-feature-meta">' +
            (n.source ? '<span class="jn-feature-source">' + esc(n.source) + '</span>' : '') +
            (isExt && n.host ? '<span class="jn-feature-host">' + esc(n.host) + '</span>' : '') +
            (n.date ? '<span>' + esc(n.date) + '</span>' : '') +
            '<span class="jn-feature-read">' + JN.fmtRead(n.readCount) + '阅读</span>' +
          '</div>' +
          '<button type="button" class="jn-btn-accent">' + btnText + '</button>' +
        '</div>' +
        '<div class="jn-feature-visual">' + JN.artVisual(cover) + '</div>' +
      '</article>'
    );
  }

  /* ---------- 今日焦点：右侧焦点小卡片（兼容外链行业资讯） ---------- */
  function focusMiniHtml(n) {
    var isExt = !!n.external;
    var attr = isExt ? ('data-url="' + esc(n.url) + '"') : ('data-go="' + n.id + '"');
    return (
      '<article class="jn-focus-mini' + (isExt ? ' jn-focus-mini--ext' : '') + '" ' + attr + '>' +
        '<div class="jn-focus-mini-body">' +
          JN.catTag(n.category) +
          '<h3 class="jn-focus-mini-title">' + esc(n.title) + '</h3>' +
          '<div class="jn-focus-mini-meta">' +
            (n.source ? '<span class="jn-focus-mini-source">' + esc(n.source) + '</span>' : '') +
            (isExt && n.host ? '<span class="jn-focus-mini-host">' + esc(n.host) + '</span>' : '') +
            (n.date ? '<span>' + esc(n.date) + '</span>' : '') +
            '<span>' + JN.fmtRead(n.readCount) + '阅读</span>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function renderFocus() {
    var g = FOCUS_GROUPS[state.focusIndex];
    var sideNews = g.side;

    document.getElementById('focus').innerHTML =
      '<div class="jn-section-head">' +
        '<h2 class="jn-section-title">今日焦点</h2>' +
        '<span class="jn-section-count">' + D.focusList.length + '条焦点 · 含行业快讯</span>' +
      '</div>' +
      '<div class="jn-focus-grid">' +
        featureCardHtml(g.main) +
        '<div class="jn-focus-side">' + sideNews.map(focusMiniHtml).join('') + '</div>' +
      '</div>' +
      focusPagerHtml();
  }

  function focusPagerHtml() {
    var pages = FOCUS_GROUPS.length;
    if (pages <= 1) return '';
    var dots = [];
    for (var i = 1; i <= pages; i++) {
      dots.push(
        '<button type="button" class="jn-pager-dot' + (i - 1 === state.focusIndex ? ' is-active' : '') + '" data-focus="' + i + '" aria-label="第 ' + i + ' 组"></button>'
      );
    }
    return (
      '<div class="jn-pager jn-pager--focus">' +
        '<div class="jn-pager-dots">' + dots.join('') + '</div>' +
      '</div>'
    );
  }

  /* ---------- 今日焦点：自动轮播 ---------- */
  function startFocusCarousel() {
    stopFocusCarousel();
    focusTimer = setInterval(function () {
      if (FOCUS_GROUPS.length <= 1) return;
      state.focusIndex = (state.focusIndex + 1) % FOCUS_GROUPS.length;
      renderFocus();
    }, FOCUS_AUTO_MS);
  }

  function stopFocusCarousel() {
    if (focusTimer) { clearInterval(focusTimer); focusTimer = null; }
  }

  function renderHot() {
    var items = D.hotNews.map(function (h, i) {
      return JN.newsRowHtml(h, i + 1);
    }).join('');
    return JN.sectionHead('热门资讯', '阅读热度 · 编辑精选', { href: 'all.html', text: '全部 <span aria-hidden="true">→</span>' }) +
      '<div class="jn-news-grid">' + items + '</div>';
  }

  /* ---------- 行业快讯 ---------- */
  function latestTabsHtml() {
    return D.CATEGORIES.map(function (c) {
      return '<button type="button" class="jn-filter-tab' + (c.key === state.latestCategory ? ' is-active' : '') + '" data-filter="' + c.key + '">' + esc(c.label) + '</button>';
    }).join('');
  }

  function latestFiltered() {
    if (state.latestCategory === 'all') return D.latestNews;
    return D.latestNews.filter(function (n) { return n.category === state.latestCategory; });
  }

  function renderLatest() {
    var list = latestFiltered().slice(0, 6);
    var more = { href: 'industry.html', text: '全部 <span aria-hidden="true">→</span>' };
    var html = JN.sectionHead('行业快讯', '真实来源外链 · 整行点击跳转原文（新标签页打开）', more, true, 'industry.html') +
      '<div class="jn-filter-tabs">' + latestTabsHtml() + '</div>';

    if (list.length === 0) {
      html += '<div class="jn-state jn-state--compact">该分类下暂时没有资讯，稍后再来看看。</div>';
    } else {
      html += '<div class="jn-news-grid">' + list.map(function (n) { return JN.newsRowHtml(n, null); }).join('') + '</div>';
    }
    return html;
  }

  /* ---------- 热门排行（屏内，TOP10） ---------- */
  function renderRanking() {
    var items = D.rankingList.map(function (n, i) {
      return (
        '<li class="jn-rank-item' + (i < 3 ? ' is-top' : '') + '" data-go="' + n.id + '">' +
          '<span class="jn-rank-num">' + (i + 1) + '</span>' +
          '<span class="jn-rank-title">' + esc(n.title) + '</span>' +
          '<span class="jn-rank-read">' + JN.fmtRead(n.readCount) + '</span>' +
        '</li>'
      );
    }).join('');
    return JN.sectionHead('热门排行', '阅读热度 · TOP ' + D.rankingList.length, false) +
      '<ol class="jn-rank-list">' + items + '</ol>';
  }

  /* ---------- 搜索 / 筛选（抽屉式） ---------- */
  function isSearchActive() {
    return !!(state.search.keyword.trim() || state.search.date.trim() || state.search.sort === 'hot');
  }

  function getSearchResults() {
    var kw = state.search.keyword.trim().toLowerCase();
    var dateNorm = state.search.date.trim().replace(/-/g, '.');
    var list = D.newsList.slice();

    if (kw) {
      list = list.filter(function (n) {
        var c = D.catByKey(n.category);
        var hay = [n.title, n.summary, n.source, (n.tags || []).join(' '), c ? c.label : ''].join(' ').toLowerCase();
        return hay.indexOf(kw) !== -1;
      });
    }
    if (dateNorm) {
      list = list.filter(function (n) { return n.date === dateNorm; });
    }
    if (state.search.sort === 'hot') {
      list.sort(function (a, b) { return b.readCount - a.readCount; });
    } else {
      list.sort(function (a, b) {
        if (a.date === b.date) return b.readCount - a.readCount;
        return a.date < b.date ? 1 : -1;
      });
    }
    return list;
  }

  function renderSearchResults() {
    var list = getSearchResults();
    var resultsEl = document.getElementById('search-results');
    if (!resultsEl) return;
    var html = JN.sectionHead('搜索结果', list.length + ' 条匹配', false);
    if (list.length === 0) {
      html += '<div class="jn-state jn-state--compact">没有找到匹配的资讯，换个关键词或日期试试。</div>';
    } else {
      html += '<div class="jn-news-list">' + list.map(function (n) { return JN.newsRowHtml(n, null); }).join('') + '</div>';
    }
    resultsEl.innerHTML = html;
  }

  function clearSearchResults() {
    var el = document.getElementById('search-results');
    if (el) el.innerHTML = '';
  }

  function openSearchDrawer() {
    var d = document.getElementById('search-drawer');
    var m = document.getElementById('search-mask');
    if (d) d.classList.add('is-open');
    if (m) m.hidden = false;
  }
  function closeSearchDrawer() {
    var d = document.getElementById('search-drawer');
    var m = document.getElementById('search-mask');
    if (d) d.classList.remove('is-open');
    if (m) m.hidden = true;
  }

  /* 主体调度：搜索激活时打开抽屉并展示结果；否则恢复常规浏览 */
  function renderMain() {
    if (isSearchActive()) {
      openSearchDrawer();
      renderSearchResults();
    } else {
      closeSearchDrawer();
      clearSearchResults();
    }
  }

  function updateSearchUI() {
    var panel = document.getElementById('search-panel');
    if (!panel) return;
    panel.classList.toggle('is-active', isSearchActive());
  }

  function bindSearch() {
    var panel = document.getElementById('search-panel');
    if (!panel) return;
    var kwEl = document.getElementById('search-kw');
    var dateEl = document.getElementById('search-date');
    var goBtn = document.getElementById('search-go');
    var resetBtn = document.getElementById('search-reset');

    function syncSeg() {
      var btns = panel.querySelectorAll('[data-sort]');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('is-active', btns[i].getAttribute('data-sort') === state.search.sort);
      }
    }

    kwEl.addEventListener('input', function () {
      state.search.keyword = kwEl.value;
      renderMain();
      updateSearchUI();
    });
    dateEl.addEventListener('change', function () {
      state.search.date = dateEl.value;
      renderMain();
      updateSearchUI();
    });
    panel.addEventListener('click', function (e) {
      var seg = e.target.closest ? e.target.closest('[data-sort]') : null;
      if (seg) {
        state.search.sort = seg.getAttribute('data-sort');
        syncSeg();
        renderMain();
        updateSearchUI();
      }
    });
    goBtn.addEventListener('click', function () {
      state.search.keyword = kwEl.value;
      state.search.date = dateEl.value;
      renderMain();
      updateSearchUI();
    });
    resetBtn.addEventListener('click', function () {
      state.search.keyword = '';
      state.search.date = '';
      state.search.sort = 'date';
      kwEl.value = '';
      dateEl.value = '';
      syncSeg();
      renderMain();
      updateSearchUI();
    });
  }

  /* ---------- 延伸阅读 ---------- */
  function relatedItemHtml(r) {
    return (
      '<article class="jn-readmore-item" data-go="' + r.id + '">' +
        (r.source ? '<span class="jn-readmore-source">' + esc(r.source) + '</span>' : '') +
        '<h3 class="jn-readmore-title">' + esc(r.title) + '</h3>' +
        '<div class="jn-readmore-foot">' +
          '<span>' + esc(r.date) + '</span>' +
          '<span class="jn-readmore-read">' + JN.fmtRead(r.readCount) + '阅读</span>' +
        '</div>' +
      '</article>'
    );
  }

  function renderRelated() {
    document.getElementById('related').innerHTML =
      JN.sectionHead('延伸阅读', '换个角度，继续了解就业市场', true) +
      '<div class="jn-readmore-grid">' + D.relatedNews.map(relatedItemHtml).join('') + '</div>';
  }

  /* ---------- 分类筛选交互 ---------- */
  function bindFilter() {
    var root = document.getElementById('latest-cols');
    if (!root) return;
    root.addEventListener('click', function (e) {
      var tab = e.target.closest ? e.target.closest('[data-filter]') : null;
      if (!tab) return;
      state.latestCategory = tab.getAttribute('data-filter');
      document.getElementById('latest-cols').innerHTML = renderLatest();
    });
  }

  /* ---------- 今日焦点：翻页交互（点击/悬停圆点翻页） ---------- */
  function bindFocusPager() {
    var root = document.getElementById('focus');
    if (!root) return;
    root.addEventListener('click', function (e) {
      var p = e.target.closest ? e.target.closest('.jn-pager-dot') : null;
      if (!p) return;
      goFocusPage(p.getAttribute('data-focus'));
    });

    /* 鼠标放到圆点上即翻页（mouseenter 不冒泡，需捕获阶段） */
    root.addEventListener('mouseenter', function (e) {
      var p = e.target.closest ? e.target.closest('.jn-pager-dot') : null;
      if (!p) return;
      goFocusPage(p.getAttribute('data-focus'));
    }, true);
  }

  function goFocusPage(val) {
    var pages = FOCUS_GROUPS.length;
    var cur = parseInt(val, 10) - 1;
    if (cur < 0) cur = 0;
    if (cur > pages - 1) cur = pages - 1;
    if (cur === state.focusIndex) return;
    state.focusIndex = cur;
    renderFocus();
    if (!focusHover) startFocusCarousel();
  }

  /* ---------- 进入详情 / 外链 ---------- */
  function bindNavigation() {
    document.addEventListener('click', function (e) {
      var el = e.target;
      if (!el || !el.closest) return;
      if (el.closest('[data-fav]')) return;
      /* 行业快讯等外链：整卡在新标签打开原文 */
      var ext = el.closest('[data-url]');
      if (ext) {
        e.preventDefault();
        window.open(ext.getAttribute('data-url'), '_blank', 'noopener');
        return;
      }
      if (el.closest('[data-more]')) {
        JN.toast('更多资讯即将上线', 'info');
        return;
      }
      var go = el.closest('[data-go]');
      if (!go) return;
      location.href = 'detail.html?id=' + encodeURIComponent(go.getAttribute('data-go'));
    });
  }

  /* ---------- 启动 ---------- */
  function renderAll() {
    renderModuleHead();
    renderFocus();
    document.getElementById('hot-cols').innerHTML = renderHot();
    document.getElementById('latest-cols').innerHTML = renderLatest();
    document.getElementById('rank-cols').innerHTML = renderRanking();
    renderRelated();
    initDots();
  }

  /* ---------- 全屏滚动：右侧导航圆点 ---------- */
  function initDots() {
    var fp = document.getElementById('jn-fullpage');
    var dotsEl = document.getElementById('jn-dots');
    if (!fp || !dotsEl) return;
    var screens = Array.prototype.slice.call(fp.querySelectorAll('.jn-screen'));
    dotsEl.innerHTML = screens.map(function (s, i) {
      var label = s.getAttribute('data-label') || ('0' + (i + 1));
      return '<button type="button" class="jn-dot' + (i === 0 ? ' is-active' : '') + '" data-i="' + i + '" aria-label="跳转到' + label + '">' +
        '<span class="jn-dot-label">' + esc(label) + '</span></button>';
    }).join('');

    dotsEl.addEventListener('click', function (e) {
      var d = e.target.closest ? e.target.closest('.jn-dot') : null;
      if (!d) return;
      var i = parseInt(d.getAttribute('data-i'), 10);
      if (screens[i]) screens[i].scrollIntoView({ behavior: 'smooth' });
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var i = screens.indexOf(en.target);
            if (i < 0) return;
            var dots = dotsEl.querySelectorAll('.jn-dot');
            for (var k = 0; k < dots.length; k++) dots[k].classList.toggle('is-active', k === i);
          }
        });
      }, { root: fp, threshold: 0.55 });
      screens.forEach(function (s) { io.observe(s); });
    }
  }

  /* ---------- 全屏滚动：键盘上下翻屏 ---------- */
  function bindKeyboard() {
    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (document.getElementById('search-drawer') && document.getElementById('search-drawer').classList.contains('is-open')) return;
      var fp = document.getElementById('jn-fullpage');
      if (!fp) return;
      var screens = Array.prototype.slice.call(fp.querySelectorAll('.jn-screen'));
      var cur = 0;
      for (var i = 0; i < screens.length; i++) {
        var r = screens[i].getBoundingClientRect();
        if (r.top <= 2 && r.bottom > 2) { cur = i; break; }
      }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        if (cur < screens.length - 1) { screens[cur + 1].scrollIntoView({ behavior: 'smooth' }); e.preventDefault(); }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        if (cur > 0) { screens[cur - 1].scrollIntoView({ behavior: 'smooth' }); e.preventDefault(); }
      } else if (e.key === 'Home') {
        screens[0].scrollIntoView({ behavior: 'smooth' }); e.preventDefault();
      } else if (e.key === 'End') {
        screens[screens.length - 1].scrollIntoView({ behavior: 'smooth' }); e.preventDefault();
      }
    });
  }

  /* ---------- 搜索抽屉开合 ---------- */
  function bindSearchDrawer() {
    var toggle = document.getElementById('search-toggle');
    var close = document.getElementById('search-close');
    var mask = document.getElementById('search-mask');
    if (toggle) toggle.addEventListener('click', function () {
      if (isSearchActive()) {
        renderSearchResults();
      } else {
        var el = document.getElementById('search-results');
        if (el) el.innerHTML = JN.sectionHead('全部资讯', D.newsList.length + ' 条', false) +
          '<div class="jn-news-list">' + D.newsList.map(function (n) { return JN.newsRowHtml(n, null); }).join('') + '</div>';
      }
      openSearchDrawer();
    });
    if (close) close.addEventListener('click', closeSearchDrawer);
    if (mask) mask.addEventListener('click', closeSearchDrawer);
  }

  /* ---------- 焦点轮播：仅当首屏可见时自动播放 ---------- */
  function bindFocusVisibility() {
    var fp = document.getElementById('jn-fullpage');
    var fEl = document.getElementById('focus');
    if (!fp || !fEl || !('IntersectionObserver' in window)) return;
    var obs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { if (!focusHover) startFocusCarousel(); }
        else { stopFocusCarousel(); }
      });
    }, { root: fp, threshold: 0.4 });
    obs.observe(fEl);
  }

  function init() {
    bindFilter();
    bindFocusPager();
    bindSearch();
    bindSearchDrawer();
    bindKeyboard();
    bindNavigation();

    var focusEl = document.getElementById('focus');
    if (focusEl) {
      focusEl.addEventListener('mouseenter', function () { focusHover = true; stopFocusCarousel(); });
      focusEl.addEventListener('mouseleave', function () { focusHover = false; startFocusCarousel(); });
    }

    setTimeout(function () {
      var loading = document.getElementById('app-loading');
      var app = document.getElementById('app');
      if (loading) loading.style.display = 'none';
      if (app) app.hidden = false;
      renderAll();
      startFocusCarousel();
      bindFocusVisibility();
    }, 420);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
