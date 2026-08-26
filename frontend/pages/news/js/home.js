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

  /* ---------- 顶部模块标题 ---------- */
  function renderModuleHead() {
    var M = D.META;
    document.getElementById('module-head').innerHTML =
      '<div class="jn-module-head-left">' +
        '<h1 class="jn-module-title">岗位大新闻</h1>' +
        '<p class="jn-module-sub">洞察岗位变化，把握职业趋势</p>' +
      '</div>' +
      '<div class="jn-module-head-right">' +
        '<span class="jn-module-update">更新时间 <b>' + esc(M.date) + ' ' + esc(M.time) + '</b></span>' +
      '</div>';
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

  /* ---------- 今日焦点：主卡片 ---------- */
  function featureCardHtml(n) {
    return (
      '<article class="jn-feature-card" data-go="' + n.id + '">' +
        '<div class="jn-feature-body">' +
          '<span class="jn-feature-flag">' + esc(n.flag) + '</span>' +
          '<h3 class="jn-feature-title">' + esc(n.title) + '</h3>' +
          '<p class="jn-feature-summary">' + esc(n.summary) + '</p>' +
          '<div class="jn-feature-meta">' +
            (n.source ? '<span class="jn-feature-source">' + esc(n.source) + '</span>' : '') +
            '<span>' + esc(n.date) + '</span>' +
            '<span class="jn-feature-read">' + JN.fmtRead(n.readCount) + '阅读</span>' +
          '</div>' +
          '<button type="button" class="jn-btn-accent">阅读详情 <span aria-hidden="true">→</span></button>' +
        '</div>' +
        '<div class="jn-feature-visual">' + JN.artVisual(n.cover) + '</div>' +
      '</article>'
    );
  }

  /* ---------- 今日焦点：右侧焦点小卡片 ---------- */
  function focusMiniHtml(n) {
    return (
      '<article class="jn-focus-mini" data-go="' + n.id + '">' +
        '<div class="jn-focus-mini-body">' +
          JN.catTag(n.category) +
          '<h3 class="jn-focus-mini-title">' + esc(n.title) + '</h3>' +
          '<div class="jn-focus-mini-meta">' +
            (n.source ? '<span class="jn-focus-mini-source">' + esc(n.source) + '</span>' : '') +
            '<span>' + esc(n.date) + '</span>' +
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
        '<span class="jn-section-count">5条值得关注的岗位大新闻</span>' +
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
    return JN.sectionHead('热门资讯', '', false) +
      '<div class="jn-news-list">' + items + '</div>';
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
    var list = latestFiltered();
    var more = { href: 'industry.html', text: '全部 <span aria-hidden="true">→</span>' };
    var html = JN.sectionHead('行业快讯', '真实来源外链 · 整行点击跳转原文（新标签页打开）', more, true, 'industry.html') +
      '<div class="jn-filter-tabs">' + latestTabsHtml() + '</div>';

    if (list.length === 0) {
      html += '<div class="jn-state jn-state--compact">该分类下暂时没有资讯，稍后再来看看。</div>';
    } else {
      html += '<div class="jn-news-list">' + list.map(function (n) { return JN.newsRowHtml(n, null); }).join('') + '</div>';
    }
    return html;
  }

  /* ---------- 热门排行（右栏，TOP10） ---------- */
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
    return (
      '<div class="jn-rail-head">' +
        '<h2 class="jn-section-title">热门排行</h2>' +
        '<span class="jn-rail-sub">阅读热度 · TOP ' + D.rankingList.length + '</span>' +
      '</div>' +
      '<ol class="jn-rank-list">' + items + '</ol>'
    );
  }

  /* ---------- 主体：左双栏（热门 + 最新） + 右排行 ---------- */
  function renderNewsCols() {
    document.getElementById('news-cols').innerHTML =
      '<div class="jn-triple-col jn-triple-col--hot">' + renderHot() + '</div>' +
      '<div class="jn-triple-col jn-triple-col--latest" id="jn-latest-col">' + renderLatest() + '</div>';
  }

  function renderRail() {
    var inner = document.getElementById('rail-inner');
    if (inner) inner.innerHTML = renderRanking();
  }

  /* ---------- 搜索 / 筛选（右栏） ---------- */
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
    var colsEl = document.getElementById('news-cols');
    var relatedEl = document.getElementById('related');
    var loadBtn = document.getElementById('load-more');
    if (!resultsEl) return;

    var html = JN.sectionHead('搜索结果', list.length + ' 条匹配', false);
    if (list.length === 0) {
      html += '<div class="jn-state jn-state--compact">没有找到匹配的资讯，换个关键词或日期试试。</div>';
    } else {
      html += '<div class="jn-news-list">' + list.map(function (n) { return JN.newsRowHtml(n, null); }).join('') + '</div>';
    }
    resultsEl.innerHTML = html;

    /* 隐藏常规三栏，仅展示搜索结果（不销毁原节点，便于清除后还原） */
    resultsEl.hidden = false;
    if (colsEl) colsEl.style.display = 'none';
    if (relatedEl) relatedEl.style.display = 'none';
    if (loadBtn) loadBtn.style.display = 'none';
  }

  /* 主体调度：搜索激活时显示结果，否则恢复常规三栏 */
  function renderMain() {
    var resultsEl = document.getElementById('search-results');
    var colsEl = document.getElementById('news-cols');
    var relatedEl = document.getElementById('related');
    var loadBtn = document.getElementById('load-more');

    if (isSearchActive()) {
      renderSearchResults();
    } else {
      /* 还原：恢复常规三栏，清空并隐藏搜索结果容器 */
      if (resultsEl) { resultsEl.hidden = true; resultsEl.innerHTML = ''; }
      if (colsEl) colsEl.style.display = '';
      if (relatedEl) relatedEl.style.display = '';
      if (loadBtn) loadBtn.style.display = '';
      renderNewsCols();
      renderRelated();
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
    var root = document.getElementById('news-cols');
    if (!root) return;
    root.addEventListener('click', function (e) {
      var tab = e.target.closest ? e.target.closest('[data-filter]') : null;
      if (!tab) return;
      state.latestCategory = tab.getAttribute('data-filter');
      renderNewsCols();
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

  /* ---------- 进入详情 ---------- */
  function bindNavigation() {
    document.addEventListener('click', function (e) {
      var el = e.target;
      if (!el || !el.closest) return;
      if (el.closest('[data-fav]')) return;
      if (el.closest('[data-more]')) {
        JN.toast('更多资讯即将上线', 'info');
        return;
      }
      var go = el.closest('[data-go]');
      if (!go) return;
      location.href = 'detail.html?id=' + encodeURIComponent(go.getAttribute('data-go'));
    });
  }

  function bindLoadMore() {
    var btn = document.getElementById('load-more');
    if (!btn) return;
    btn.addEventListener('click', function () {
      JN.toast('更多资讯即将上线', 'info');
    });
  }

  /* ---------- 启动 ---------- */
  function renderAll() {
    renderModuleHead();
    renderFocus();
    renderMain();
    renderRail();
  }

  function init() {
    bindFilter();
    bindFocusPager();
    bindSearch();
    bindNavigation();
    bindLoadMore();

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
    }, 420);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
