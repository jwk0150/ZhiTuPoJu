/* =========================================================================
 * 岗位大新闻 · 首页逻辑
 * -------------------------------------------------------------------------
 * 渲染：模块标题 / 今日焦点（主卡片 + 右侧焦点卡片）/
 *       三栏（热门资讯 / 最新资讯 / 热门排行）/ 延伸阅读
 * 交互：分类筛选 / 收藏 / 点击进入详情
 * ========================================================================= */
(function () {
  'use strict';

  var D = window.JOB_NEWS_DATA;
  var JN = window.JN;
  var esc = JN.escapeHtml;

  var state = {
    latestCategory: 'all',
    latestPage: 1,
    focusIndex: 0
  };

  var LATEST_PER_PAGE = 5;
  var LATEST_AUTO_MS = 4500;
  var latestTimer = null;
  var latestHover = false;

  var FOCUS_AUTO_MS = 5000;
  var focusTimer = null;
  var focusHover = false;
  var FOCUS_GROUPS = buildFocusGroups();

  /* ---------- 工具 ---------- */
  function catTag(key) {
    var c = D.catByKey(key);
    return '<span class="jn-cat-tag" style="color:' + esc(c.color) + ';border-color:' + esc(c.color) + '">' + esc(c.label) + '</span>';
  }

  function sectionHead(title, sub, more) {
    return (
      '<div class="jn-section-head">' +
        '<h2 class="jn-section-title">' + title + (sub ? '<span class="jn-section-count">' + sub + '</span>' : '') + '</h2>' +
        (more ? '<a class="jn-more" href="#">更多 <span aria-hidden="true">→</span></a>' : '') +
      '</div>'
    );
  }

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
    var list = D.newsList;
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
          catTag(n.category) +
          '<h3 class="jn-focus-mini-title">' + esc(n.title) + '</h3>' +
          '<div class="jn-focus-mini-meta">' +
            '<span>' + esc(n.date) + '</span>' +
            '<span>' + JN.fmtRead(n.readCount) + '阅读</span>' +
          '</div>' +
        '</div>' +
        '<div class="jn-focus-mini-visual">' + JN.artVisual(n.cover) + '</div>' +
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
        '<button type="button" class="jn-pager-dot' + (i - 1 === state.focusIndex ? ' is-active' : '') + '" data-focus="' + i + '">' + i + '</button>'
      );
    }
    return (
      '<div class="jn-pager jn-pager--focus">' +
        '<button type="button" class="jn-pager-btn" data-focus="prev" aria-label="上一组">‹</button>' +
        '<div class="jn-pager-dots">' + dots.join('') + '</div>' +
        '<button type="button" class="jn-pager-btn" data-focus="next" aria-label="下一组">›</button>' +
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

  /* ---------- 资讯行（热门 / 最新 统一结构，保证两栏对齐） ---------- */
  function newsRowHtml(n, rank) {
    if (!n) return '';
    return (
      '<article class="jn-news-row" data-go="' + n.id + '">' +
        (rank ? '<span class="jn-news-rank">' + (rank < 10 ? '0' + rank : rank) + '</span>' : '') +
        '<div class="jn-news-thumb">' + JN.artVisual(n.cover) + '</div>' +
        '<div class="jn-news-body">' +
          catTag(n.category) +
          '<h3 class="jn-news-title">' + esc(n.title) + '</h3>' +
          '<div class="jn-news-meta">' +
            '<span>' + esc(n.readTime || n.date) + '</span>' +
            '<span class="jn-news-read">' + JN.fmtRead(n.readCount) + '阅读</span>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function renderHot() {
    var items = D.hotNews.map(function (h, i) {
      return newsRowHtml(D.findNews(h.id), i + 1);
    }).join('');
    return sectionHead('热门资讯', '', false) +
      '<div class="jn-news-list">' + items + '</div>';
  }

  /* ---------- 最新资讯 ---------- */
  function latestTabsHtml() {
    return D.CATEGORIES.map(function (c) {
      return '<button type="button" class="jn-filter-tab' + (c.key === state.latestCategory ? ' is-active' : '') + '" data-filter="' + c.key + '">' + esc(c.label) + '</button>';
    }).join('');
  }

  function latestFiltered() {
    if (state.latestCategory === 'all') return D.latestNews;
    return D.latestNews.filter(function (n) { return n.category === state.latestCategory; });
  }

  function latestTotalPages(list) {
    return Math.max(1, Math.ceil(list.length / LATEST_PER_PAGE));
  }

  function latestItemHtml(n) {
    return newsRowHtml(D.findNews(n.id), null);
  }

  function renderLatest() {
    var list = latestFiltered();
    var pages = latestTotalPages(list);
    if (state.latestPage > pages) state.latestPage = pages;
    if (state.latestPage < 1) state.latestPage = 1;

    var items = list.slice((state.latestPage - 1) * LATEST_PER_PAGE, state.latestPage * LATEST_PER_PAGE);
    var html = sectionHead('最新资讯', '', false) +
      '<div class="jn-filter-tabs">' + latestTabsHtml() + '</div>';

    if (items.length === 0) {
      html += '<div class="jn-state jn-state--compact">该分类下暂时没有资讯，稍后再来看看。</div>';
    } else {
      html += '<div class="jn-news-list">' + items.map(latestItemHtml).join('') + '</div>';
    }
    html += pagerHtml(pages);
    return html;
  }

  function pagerHtml(pages) {
    if (pages <= 1) return '';
    var dots = [];
    for (var i = 1; i <= pages; i++) {
      dots.push(
        '<button type="button" class="jn-pager-dot' + (i === state.latestPage ? ' is-active' : '') + '" data-page="' + i + '">' + i + '</button>'
      );
    }
    return (
      '<div class="jn-pager">' +
        '<button type="button" class="jn-pager-btn" data-page="prev" aria-label="上一页">‹</button>' +
        '<div class="jn-pager-dots">' + dots.join('') + '</div>' +
        '<button type="button" class="jn-pager-btn" data-page="next" aria-label="下一页">›</button>' +
      '</div>'
    );
  }

  function updateLatestPage() {
    var col = document.getElementById('jn-latest-col');
    if (col) col.innerHTML = renderLatest();
  }

  /* ---------- 热门排行（右栏，TOP10） ---------- */
  function renderRanking() {
    var items = D.rankingList.map(function (id, i) {
      var n = D.findNews(id);
      return (
        '<li class="jn-rank-item' + (i < 3 ? ' is-top' : '') + '" data-go="' + id + '">' +
          '<span class="jn-rank-num">' + (i + 1) + '</span>' +
          '<span class="jn-rank-title">' + esc(n ? n.title : id) + '</span>' +
          '<span class="jn-rank-read">' + (n ? JN.fmtRead(n.readCount) : '') + '</span>' +
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

    var latestCol = document.getElementById('jn-latest-col');
    if (latestCol) {
      latestCol.addEventListener('mouseenter', function () { latestHover = true; stopLatestCarousel(); });
      latestCol.addEventListener('mouseleave', function () { latestHover = false; startLatestCarousel(); });
    }
    startLatestCarousel();
  }

  function renderRail() {
    var rail = document.getElementById('rail-col');
    if (rail) rail.innerHTML = '<div class="jn-rail">' + renderRanking() + '</div>';
  }

  /* ---------- 最新资讯：自动轮播 ---------- */
  function startLatestCarousel() {
    stopLatestCarousel();
    latestTimer = setInterval(function () {
      var pages = latestTotalPages(latestFiltered());
      if (pages <= 1) return;
      state.latestPage = state.latestPage >= pages ? 1 : state.latestPage + 1;
      updateLatestPage();
    }, LATEST_AUTO_MS);
  }

  function stopLatestCarousel() {
    if (latestTimer) { clearInterval(latestTimer); latestTimer = null; }
  }

  /* ---------- 延伸阅读 ---------- */
  function relatedItemHtml(r) {
    return (
      '<article class="jn-readmore-item" data-go="' + r.id + '">' +
        '<div class="jn-readmore-thumb">' + JN.artVisual(r.cover) + '</div>' +
        '<h3 class="jn-readmore-title">' + esc(r.title) + '</h3>' +
        '<span class="jn-readmore-read">' + JN.fmtRead(r.readCount) + '阅读</span>' +
      '</article>'
    );
  }

  function renderRelated() {
    document.getElementById('related').innerHTML =
      sectionHead('延伸阅读', '换个角度，继续了解就业市场', true) +
      '<div class="jn-readmore-grid">' + D.relatedNews.map(relatedItemHtml).join('') + '</div>';
  }

  /* ---------- 分类筛选 / 翻页交互 ---------- */
  function bindFilter() {
    var root = document.getElementById('news-cols');
    if (!root) return;
    root.addEventListener('click', function (e) {
      var tab = e.target.closest ? e.target.closest('[data-filter]') : null;
      if (tab) {
        state.latestCategory = tab.getAttribute('data-filter');
        state.latestPage = 1;
        renderNewsCols();
        return;
      }
      var p = e.target.closest ? e.target.closest('[data-page]') : null;
      if (!p) return;
      var pages = latestTotalPages(latestFiltered());
      var cur = state.latestPage;
      var val = p.getAttribute('data-page');
      if (val === 'prev') cur -= 1;
      else if (val === 'next') cur += 1;
      else cur = parseInt(val, 10);
      if (cur < 1) cur = pages;
      if (cur > pages) cur = 1;
      state.latestPage = cur;
      updateLatestPage();
      if (!latestHover) startLatestCarousel();
    });
  }

  /* ---------- 今日焦点：翻页交互 ---------- */
  function bindFocusPager() {
    var root = document.getElementById('focus');
    if (!root) return;
    root.addEventListener('click', function (e) {
      var p = e.target.closest ? e.target.closest('[data-focus]') : null;
      if (!p) return;
      var pages = FOCUS_GROUPS.length;
      var val = p.getAttribute('data-focus');
      var cur = state.focusIndex;
      if (val === 'prev') cur -= 1;
      else if (val === 'next') cur += 1;
      else cur = parseInt(val, 10) - 1;
      if (cur < 0) cur = pages - 1;
      if (cur > pages - 1) cur = 0;
      state.focusIndex = cur;
      renderFocus();
      if (!focusHover) startFocusCarousel();
    });
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
    renderNewsCols();
    renderRail();
    renderRelated();
  }

  function init() {
    bindFilter();
    bindFocusPager();
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
