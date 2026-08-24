/* =========================================================================
 * 岗位大新闻 · 首页逻辑
 * -------------------------------------------------------------------------
 * 渲染：模块标题 / 今日焦点（轮播 + TOP5）/ 热门资讯 / 最新资讯（筛选）/
 *       延伸阅读
 * 交互：轮播切换 / 分类筛选 / 收藏 / 点击进入详情
 * ========================================================================= */
(function () {
  'use strict';

  var D = window.JOB_NEWS_DATA;
  var JN = window.JN;
  var esc = JN.escapeHtml;

  var state = {
    latestCategory: 'all',
    slide: 0
  };

  /* ---------- 工具 ---------- */
  function hexToRgba(hex, a) {
    var h = String(hex || '#37C8FF').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
  }

  function catTag(key) {
    var c = D.catByKey(key);
    return '<span class="jn-cat-tag" style="color:' + c.color + ';background:' + hexToRgba(c.color, 0.13) + '">' + esc(c.label) + '</span>';
  }

  function sectionHead(title, sub) {
    return (
      '<div class="jn-section-head">' +
        '<h2 class="jn-section-title">' + title + '</h2>' +
        (sub ? '<span class="jn-section-count">' + sub + '</span>' : '') +
      '</div>'
    );
  }

  /* ---------- 顶部模块标题 ---------- */
  function renderModuleHead() {
    var M = D.META;
    document.getElementById('module-head').innerHTML =
      '<div class="jn-module-head-left">' +
        '<div class="jn-module-kicker"><span class="jn-kicker-line"></span>未来职业市场 · 数字情报中心</div>' +
        '<h1 class="jn-module-title">岗位大新闻</h1>' +
        '<p class="jn-module-sub">洞察岗位变化，把握职业趋势</p>' +
      '</div>' +
      '<div class="jn-module-head-right">' +
        '<span class="jn-module-update">更新时间 <b>' + esc(M.date) + ' ' + esc(M.time) + '</b></span>' +
        '<span class="jn-module-live"><i aria-hidden="true"></i>实时更新</span>' +
      '</div>';
  }

  /* ---------- 今日焦点：主轮播 ---------- */
  function slideHtml(n, i) {
    return (
      '<article class="jn-slide' + (i === state.slide ? ' is-active' : '') + '" data-go="' + n.id + '" data-slide="' + i + '">' +
        '<div class="jn-slide-body">' +
          '<span class="jn-slide-flag">' + esc(n.flag) + '</span>' +
          '<h3 class="jn-slide-title">' + esc(n.title) + '</h3>' +
          '<p class="jn-slide-summary">' + esc(n.summary) + '</p>' +
          '<div class="jn-slide-meta">' +
            '<span class="jn-slide-date">' + esc(n.date) + '</span>' +
            '<span class="jn-slide-read">' + JN.fmtRead(n.readCount) + '阅读</span>' +
            JN.trendBadge(n.growth) +
          '</div>' +
          '<button type="button" class="jn-btn-gold" aria-label="阅读详情">阅读详情 <span aria-hidden="true">→</span></button>' +
        '</div>' +
        '<div class="jn-slide-visual">' + JN.artVisual(n.cover) + '</div>' +
      '</article>'
    );
  }

  function carouselHtml() {
    var slides = D.newsList.slice(0, 4);
    var dots = slides.map(function (_, i) {
      return '<button type="button" class="jn-dot' + (i === state.slide ? ' is-active' : '') + '" data-dot="' + i + '" aria-label="第 ' + (i + 1) + ' 条"></button>';
    }).join('');
    return (
      '<div class="jn-carousel">' +
        '<div class="jn-carousel-viewport">' + slides.map(slideHtml).join('') + '</div>' +
        '<div class="jn-carousel-bar">' +
          '<button type="button" class="jn-carousel-arrow" data-carousel="prev" aria-label="上一条">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
          '</button>' +
          '<div class="jn-carousel-dots">' + dots + '</div>' +
          '<button type="button" class="jn-carousel-arrow" data-carousel="next" aria-label="下一条">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  /* ---------- 今日焦点：热门排行 TOP5 ---------- */
  function rankingGrowth(g) {
    var gi = JN.growthInfo(g);
    var arrow = gi.dir === 'up' ? '↑' : (gi.dir === 'down' ? '↓' : '→');
    return '<span class="jn-ranking-growth is-' + gi.dir + '">' + arrow + esc(gi.text) + '</span>';
  }

  function rankingHtml() {
    var items = D.rankingList.map(function (r, i) {
      return (
        '<li class="jn-ranking-item" data-go="' + r.id + '">' +
          '<span class="jn-ranking-num">0' + (i + 1) + '</span>' +
          '<span class="jn-ranking-title">' + esc(r.title) + '</span>' +
          rankingGrowth(r.growth) +
        '</li>'
      );
    }).join('');
    return (
      '<aside class="jn-ranking">' +
        '<div class="jn-ranking-head">' +
          '<span class="jn-ranking-head-label">热门排行</span>' +
          '<span class="jn-ranking-head-top">TOP 5</span>' +
        '</div>' +
        '<ol class="jn-ranking-list">' + items + '</ol>' +
      '</aside>'
    );
  }

  function renderFocus() {
    document.getElementById('focus').innerHTML =
      '<div class="jn-section-head">' +
        '<h2 class="jn-section-title">今日焦点</h2>' +
        '<span class="jn-section-count">5条值得关注的岗位大新闻</span>' +
      '</div>' +
      '<div class="jn-focus-grid">' +
        carouselHtml() +
        rankingHtml() +
      '</div>';
  }

  /* ---------- 热门资讯 ---------- */
  function hotItemHtml(h, i) {
    var art = D.findNews(h.id);
    return (
      '<article class="jn-hot-item" data-go="' + h.id + '">' +
        '<span class="jn-hot-num">0' + (i + 1) + '</span>' +
        '<div class="jn-hot-thumb">' + JN.artVisual(art ? art.cover : 'grid') + '</div>' +
        '<div class="jn-hot-body">' +
          '<div class="jn-hot-top">' + catTag(h.category) + '<span class="jn-hot-date">' + esc(h.date) + '</span></div>' +
          '<h3 class="jn-hot-title">' + esc(h.title) + '</h3>' +
          '<p class="jn-hot-summary">' + esc(h.summary) + '</p>' +
        '</div>' +
        '<div class="jn-hot-side">' +
          JN.favButton(h.id, 'is-static') +
          '<span class="jn-hot-growth">' + rankingGrowth(h.growth) + '</span>' +
        '</div>' +
      '</article>'
    );
  }

  function renderHot() {
    var items = D.hotNews.map(function (h, i) { return hotItemHtml(h, i); }).join('');
    document.getElementById('hot').innerHTML =
      sectionHead('热门资讯', '大家正在关注这些岗位变化') +
      '<div class="jn-hot-list">' + items + '</div>';
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

  function latestItemHtml(n) {
    var art = D.findNews(n.id);
    return (
      '<article class="jn-latest-item" data-go="' + n.id + '">' +
        '<div class="jn-latest-thumb">' + JN.artVisual(art ? art.cover : 'grid') + '</div>' +
        '<div class="jn-latest-body">' +
          catTag(n.category) +
          '<h3 class="jn-latest-title">' + esc(n.title) + '</h3>' +
        '</div>' +
        '<div class="jn-latest-meta">' +
          '<span>' + esc(n.readTime) + '</span>' +
          '<span class="jn-latest-read">' + JN.fmtRead(n.readCount) + '阅读</span>' +
        '</div>' +
      '</article>'
    );
  }

  function renderLatest() {
    var list = latestFiltered();
    var html = sectionHead('最新资讯', '实时更新 · 保持阅读节奏') +
      '<div class="jn-filter-tabs">' + latestTabsHtml() + '</div>';

    if (list.length === 0) {
      html += '<div class="jn-state jn-state--compact">该分类下暂时没有资讯，稍后再来看看。</div>';
    } else {
      html += '<div class="jn-latest-list">' + list.map(latestItemHtml).join('') + '</div>';
    }
    document.getElementById('latest').innerHTML = html;
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
      sectionHead('延伸阅读', '换个角度，继续了解就业市场') +
      '<div class="jn-readmore-grid">' + D.relatedNews.map(relatedItemHtml).join('') + '</div>';
  }

  /* ---------- 轮播交互 ---------- */
  function updateCarousel() {
    var slides = JN.$$('.jn-slide');
    var dots = JN.$$('.jn-dot');
    slides.forEach(function (s, i) { s.classList.toggle('is-active', i === state.slide); });
    dots.forEach(function (d, i) { d.classList.toggle('is-active', i === state.slide); });
  }

  function goSlide(dir) {
    var total = D.newsList.slice(0, 4).length;
    if (dir === 'next') state.slide = (state.slide + 1) % total;
    else state.slide = (state.slide - 1 + total) % total;
    updateCarousel();
  }

  function bindCarousel() {
    var root = document.getElementById('focus');
    if (!root) return;
    root.addEventListener('click', function (e) {
      var el = e.target;
      if (!el || !el.closest) return;
      var arrow = el.closest('[data-carousel]');
      if (arrow) {
        goSlide(arrow.getAttribute('data-carousel'));
        return;
      }
      var dot = el.closest('[data-dot]');
      if (dot) {
        state.slide = parseInt(dot.getAttribute('data-dot'), 10);
        updateCarousel();
      }
    });
  }

  /* ---------- 分类筛选交互 ---------- */
  function bindFilter() {
    var root = document.getElementById('latest');
    if (!root) return;
    root.addEventListener('click', function (e) {
      var tab = e.target && e.target.closest ? e.target.closest('[data-filter]') : null;
      if (!tab) return;
      state.latestCategory = tab.getAttribute('data-filter');
      renderLatest();
    });
  }

  /* ---------- 进入详情 ---------- */
  function bindNavigation() {
    document.addEventListener('click', function (e) {
      var el = e.target;
      if (!el || !el.closest) return;
      if (el.closest('[data-fav]')) return;
      var go = el.closest('[data-go]');
      if (!go) return;
      location.href = 'detail.html?id=' + encodeURIComponent(go.getAttribute('data-go'));
    });
  }

  /* ---------- 启动 ---------- */
  function renderAll() {
    renderModuleHead();
    renderFocus();
    renderHot();
    renderLatest();
    renderRelated();
  }

  function init() {
    bindCarousel();
    bindFilter();
    bindNavigation();
    // 短暂展示 Loading 骨架，再渲染内容（演示 Loading → Success 状态）
    setTimeout(function () {
      var loading = document.getElementById('app-loading');
      var app = document.getElementById('app');
      if (loading) loading.style.display = 'none';
      if (app) app.hidden = false;
      renderAll();
    }, 420);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
