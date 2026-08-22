/* =========================================================================
 * 岗位大新闻 · 首页逻辑
 * -------------------------------------------------------------------------
 * 渲染：Hero / 今日头版 / 热门岗位 / 新职业 / 行业变化 / 全部资讯
 * 交互：搜索 / 分类筛选 / 行业切换 / 加载更多 / 收藏 / 导航 / 通知
 * ========================================================================= */
(function () {
  'use strict';

  var D = window.JOB_NEWS_DATA;
  var JN = window.JN;
  var esc = JN.escapeHtml;

  var state = {
    category: 'all',
    search: '',
    shown: 6,
    industry: 'ai'
  };

  /* ---------- 工具 ---------- */
  function hexToRgba(hex, a) {
    var h = String(hex || '#4A9FE8').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function catTag(key) {
    var c = D.catByKey(key);
    return '<span class="jn-cat-tag" style="color:' + c.color + ';background:' + hexToRgba(c.color, 0.12) + '">' + esc(c.label) + '</span>';
  }

  function sectionHead(opts) {
    var more = opts.more
      ? '<a class="jn-section-more" href="' + opts.more + '">' + opts.moreText + ' <span aria-hidden="true">→</span></a>'
      : '';
    return (
      '<div class="jn-section-head">' +
        '<div>' +
          '<h2 class="jn-section-title">' + opts.title + '</h2>' +
          (opts.sub ? '<p class="jn-section-sub">' + opts.sub + '</p>' : '') +
        '</div>' + more +
      '</div>'
    );
  }

  /* ---------- Hero ---------- */
  function renderHero() {
    var H = D.HERO;
    var el = document.getElementById('hero');
    el.innerHTML =
      '<section class="jn-hero jn-enter">' +
        '<div class="jn-hero-inner">' +
          '<div>' +
            '<span class="jn-hero-kicker"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg> 就业市场数字报纸</span>' +
            '<h1>岗位大新闻</h1>' +
            '<p>' + esc(H.slogan) + '</p>' +
          '</div>' +
          '<div class="jn-hero-right">' +
            '<div class="jn-issue">' + esc(H.date) + ' · 第 <b>' + esc(H.issue) + '</b> 期</div>' +
            '<div class="jn-heat">' +
              '<div class="jn-heat-label">今日岗位热度</div>' +
              '<div class="jn-heat-value">' +
                '<span class="jn-heat-num" data-count="' + H.heat + '">0</span>' +
                '<span class="jn-heat-trend">↑ ' + esc(H.heatTrend) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  /* ---------- 今日头版 ---------- */
  function renderHeadline() {
    var featured = null;
    for (var i = 0; i < D.NEWS.length; i++) {
      if (D.NEWS[i].featured) { featured = D.NEWS[i]; break; }
    }
    if (!featured) featured = D.NEWS[0];
    var side = [D.findNews('n002'), D.findNews('n003')];

    var main =
      '<article class="jn-headline-main jn-enter" data-go="' + featured.id + '">' +
        '<div class="jn-headline-visual">' +
          '<span class="jn-headline-flag">🔥 ' + esc(D.catByKey(featured.category).label) + '</span>' +
          JN.artVisual(featured.visual) +
          JN.favButton(featured.id) +
        '</div>' +
        '<div class="jn-headline-body">' +
          catTag(featured.category) +
          '<h3 class="jn-headline-title">' +
            '<span class="jn-line">' + esc(featured.title) + '</span>' +
            '<span class="jn-line">' + esc(featured.subtitle) + '</span>' +
          '</h3>' +
          '<p class="jn-headline-summary">' + esc(featured.summary) + '</p>' +
          '<div class="jn-headline-meta">' +
            '<span>' + esc(featured.date) + '</span>' +
            '<span class="jn-source">来源：' + esc(featured.source) + '</span>' +
            '<span>' + (featured.tags || []).map(esc).join(' / ') + '</span>' +
          '</div>' +
          '<div class="jn-headline-foot">' +
            '<div class="jn-headline-heat">' +
              '<span class="jn-headline-heat-label">岗位热度</span>' +
              '<span class="jn-headline-heat-num" data-count="' + featured.heat + '">0</span>' +
              JN.trendBadge(featured.trend) +
            '</div>' +
            '<span class="jn-btn-read">阅读完整资讯 <span class="jn-arrow">→</span></span>' +
          '</div>' +
        '</div>' +
      '</article>';

    var sideHtml = side.map(function (n, i) {
      return (
        '<article class="jn-headline-mini jn-enter" style="--d:' + (0.08 + i * 0.06) + 's" data-go="' + n.id + '">' +
          '<span class="jn-mini-num">0' + (i + 1) + '</span>' +
          catTag(n.category) +
          '<h3 class="jn-mini-title">' + esc(n.subtitle || n.title) + '</h3>' +
          '<span class="jn-mini-read">阅读 <span aria-hidden="true">→</span></span>' +
        '</article>'
      );
    }).join('');

    document.getElementById('headline').innerHTML =
      sectionHead({
        title: '今日头版',
        sub: '最近，就业市场又发生了什么大事？',
        more: '#news', moreText: '查看全部'
      }) +
      '<div class="jn-headline-grid">' + main + '<div class="jn-headline-side">' + sideHtml + '</div></div>';
  }

  /* ---------- 热门岗位资讯 ---------- */
  function renderHot() {
    var cards = D.HOT_JOBS.map(function (h, i) {
      return (
        '<article class="jn-hot-card jn-enter" style="--d:' + (i * 0.06) + 's" data-go="' + h.id + '">' +
          JN.favButton(h.id) +
          '<div class="jn-hot-top">' +
            '<h3 class="jn-hot-name">' + esc(h.job) + '</h3>' +
            JN.trendBadge({ dir: h.dir, value: h.trend }) +
          '</div>' +
          '<p class="jn-hot-summary">' + esc(h.summary) + '</p>' +
          '<div class="jn-hot-foot">' +
            '<span class="jn-chip jn-chip--blue">' + esc(h.category) + '</span>' +
            '<span class="jn-hot-link">查看资讯 <span class="jn-arrow">→</span></span>' +
          '</div>' +
        '</article>'
      );
    }).join('');

    document.getElementById('hot').innerHTML =
      sectionHead({ title: '🔥 热门岗位资讯', sub: '最近，哪些岗位正在受到关注？' }) +
      '<div class="jn-hot-grid">' + cards + '</div>';
  }

  /* ---------- 新职业 ---------- */
  function renderCareers() {
    var cards = D.CAREERS.map(function (c, i) {
      return (
        '<article class="jn-career-card jn-enter" style="--d:' + (i * 0.07) + 's" data-go="' + c.id + '">' +
          '<div class="jn-career-visual">' + JN.artVisual(c.visual) + '</div>' +
          '<div class="jn-career-body">' +
            '<div class="jn-career-tags">' +
              '<span class="jn-chip jn-chip--blue">' + esc(c.tag) + '</span>' +
              '<span class="jn-chip jn-chip--teal">' + esc(c.badge) + '</span>' +
            '</div>' +
            '<h3 class="jn-career-name">' + esc(c.name) + '</h3>' +
            '<p class="jn-career-desc">' + esc(c.desc) + '</p>' +
            '<span class="jn-career-link">查看职业资讯 <span class="jn-arrow">→</span></span>' +
          '</div>' +
        '</article>'
      );
    }).join('');

    document.getElementById('careers').innerHTML =
      sectionHead({ title: '🔭 新职业', sub: '这些岗位，你可能还没听过。' }) +
      '<div class="jn-career-grid">' + cards + '</div>';
  }

  /* ---------- 行业岗位变化 ---------- */
  function industryTabsHtml() {
    return D.INDUSTRIES.map(function (ind) {
      return '<button type="button" class="jn-industry-tab' + (ind.key === state.industry ? ' is-active' : '') + '" data-industry="' + ind.key + '">' + esc(ind.label) + '</button>';
    }).join('');
  }

  function industryBodyHtml() {
    var ind = null;
    for (var i = 0; i < D.INDUSTRIES.length; i++) {
      if (D.INDUSTRIES[i].key === state.industry) { ind = D.INDUSTRIES[i]; break; }
    }
    if (!ind) return '';
    var items = ind.items.map(function (it) {
      return (
        '<div class="jn-industry-item">' +
          '<span class="jn-industry-item-name">' + esc(it.name) + '</span>' +
          JN.trendBadge({ dir: it.dir, value: it.value }) +
        '</div>'
      );
    }).join('');
    return (
      '<div class="jn-industry-body">' +
        '<div class="jn-industry-blurb"><b>' + esc(ind.label) + ' · 岗位观察</b>' + esc(ind.blurb) + '</div>' +
        '<div class="jn-industry-list">' + items + '</div>' +
      '</div>'
    );
  }

  function renderIndustries() {
    document.getElementById('industries').innerHTML =
      sectionHead({ title: '行业岗位变化', sub: '按行业查看岗位新闻与趋势。' }) +
      '<div class="jn-industry">' +
        '<div class="jn-industry-tabs">' + industryTabsHtml() + '</div>' +
        '<div id="industry-body">' + industryBodyHtml() + '</div>' +
      '</div>';
  }

  function updateIndustries() {
    var tabs = document.querySelectorAll('#industries .jn-industry-tab');
    Array.prototype.forEach.call(tabs, function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-industry') === state.industry);
    });
    var body = document.getElementById('industry-body');
    if (body) body.innerHTML = industryBodyHtml();
  }

  /* ---------- 全部资讯 ---------- */
  function matchesQuery(n, q) {
    var hay = [n.title, n.subtitle, n.summary, (n.tags || []).join(' '), D.catByKey(n.category).label, n.job || '', n.source || '']
      .join(' ')
      .toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function filteredNews() {
    var list = D.NEWS;
    var q = state.search.trim().toLowerCase();
    if (state.category !== 'all') {
      list = list.filter(function (n) { return n.category === state.category; });
    }
    if (q) {
      list = list.filter(function (n) { return matchesQuery(n, q); });
    }
    return list;
  }

  function filterTabsHtml() {
    return D.CATEGORIES.map(function (c) {
      return '<button type="button" class="jn-filter-tab' + (c.key === state.category ? ' is-active' : '') + '" data-cat="' + c.key + '">' + esc(c.label) + '</button>';
    }).join('');
  }

  function resultCountText(list) {
    if (state.search.trim()) {
      return '搜索 “' + esc(state.search.trim()) + '” · ' + list.length + ' 条结果';
    }
    return '共 ' + list.length + ' 条';
  }

  function newsRowHtml(n, idx) {
    return (
      '<article class="jn-news-row jn-enter" style="--d:' + (idx * 0.045) + 's" data-go="' + n.id + '">' +
        '<div class="jn-news-row-main">' +
          '<div class="jn-news-row-top">' + catTag(n.category) + JN.trendBadge(n.trend) + '</div>' +
          '<h3 class="jn-news-row-title">' + esc(n.title) + '</h3>' +
          '<p class="jn-news-row-summary">' + esc(n.summary) + '</p>' +
          '<div class="jn-news-row-meta">' +
            '<span>' + esc(n.date) + '</span>' +
            '<span class="jn-source">来源：' + esc(n.source) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="jn-news-row-side">' +
          JN.favButton(n.id, 'is-static') +
          '<span class="jn-read-more">阅读详情 <span class="jn-arrow">→</span></span>' +
        '</div>' +
      '</article>'
    );
  }

  function emptyStateHtml() {
    var searching = !!state.search.trim();
    return (
      '<div class="jn-state jn-enter">' +
        '<div class="jn-state-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
        '</div>' +
        '<div class="jn-state-title">' + (searching ? '暂时没有找到相关岗位资讯' : '暂无相关资讯') + '</div>' +
        '<p class="jn-state-desc">' + (searching ? '换个关键词试试，或看看下面这些热门内容。' : '该分类下暂时没有内容，稍后再来看看。') + '</p>' +
        '<div class="jn-recommend">' +
          '<div class="jn-recommend-label">推荐查看</div>' +
          '<div class="jn-recommend-chips">' +
            '<a class="jn-chip jn-chip--blue" href="#hot">热门岗位</a>' +
            '<a class="jn-chip jn-chip--teal" href="#careers">新职业</a>' +
            '<a class="jn-chip jn-chip--red" href="#industries">行业趋势</a>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderNews() {
    var list = filteredNews();
    var visible = list.slice(0, state.shown);
    var html = sectionHead({ title: '全部岗位资讯', sub: '浏览最新岗位资讯与就业趋势。' }) +
      '<div class="jn-news-toolbar">' +
        '<div class="jn-filter-tabs">' + filterTabsHtml() + '</div>' +
        '<span class="jn-result-count">' + resultCountText(list) + '</span>' +
      '</div>';

    if (list.length === 0) {
      html += emptyStateHtml();
    } else {
      html += '<div class="jn-news-list">' + visible.map(newsRowHtml).join('') + '</div>';
      if (visible.length < list.length) {
        html += '<div class="jn-load-more"><button type="button" class="jn-btn-more" id="load-more">加载更多</button></div>';
      }
    }

    document.getElementById('news').innerHTML = html;
  }

  /* ---------- 事件绑定 ---------- */
  function scrollToNews() {
    var el = document.getElementById('news');
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bindSearch() {
    var handler = JN.debounce(function (e) {
      state.search = e.target.value;
      state.shown = 6;
      renderNews();
      if (state.search.trim()) scrollToNews();
    }, 240);
    var a = document.getElementById('search-input');
    var b = document.getElementById('search-input-mobile');
    if (a) a.addEventListener('input', handler);
    if (b) b.addEventListener('input', handler);
  }

  function bindChrome() {
    var toggle = document.getElementById('search-toggle');
    var mobile = document.getElementById('mobile-search');
    if (toggle && mobile) {
      toggle.addEventListener('click', function () {
        mobile.classList.toggle('is-open');
      });
    }
    var notify = document.getElementById('notify-btn');
    if (notify) notify.addEventListener('click', function () { JN.toast('暂无新通知（示例）', 'info'); });
    var avatar = document.getElementById('avatar-btn');
    if (avatar) avatar.addEventListener('click', function () { JN.toast('登录后可同步收藏（示例）', 'info'); });
  }

  function bindDelegates() {
    // 行业切换
    var ind = document.getElementById('industries');
    if (ind) {
      ind.addEventListener('click', function (e) {
        var tab = e.target && e.target.closest ? e.target.closest('.jn-industry-tab') : null;
        if (!tab) return;
        state.industry = tab.getAttribute('data-industry');
        updateIndustries();
      });
    }
    // 分类筛选 / 加载更多
    var news = document.getElementById('news');
    if (news) {
      news.addEventListener('click', function (e) {
        var tab = e.target && e.target.closest ? e.target.closest('.jn-filter-tab') : null;
        if (tab) {
          state.category = tab.getAttribute('data-cat');
          state.shown = 6;
          renderNews();
          return;
        }
        var more = e.target && e.target.closest ? e.target.closest('#load-more') : null;
        if (more) {
          state.shown += 6;
          renderNews();
        }
      });
    }
    // 卡片导航
    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest) {
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('label')) return;
      }
      var card = e.target && e.target.closest ? e.target.closest('[data-go]') : null;
      if (!card) return;
      location.href = 'detail.html?id=' + encodeURIComponent(card.getAttribute('data-go'));
    });
  }

  /* ---------- 启动 ---------- */
  function renderAll() {
    renderHero();
    renderHeadline();
    renderHot();
    renderCareers();
    renderIndustries();
    renderNews();
    JN.animateDataValues(document.getElementById('app'));
  }

  function init() {
    bindChrome();
    bindSearch();
    bindDelegates();
    // 短暂展示 Loading 骨架，再渲染内容（演示 Loading → Success 状态）
    setTimeout(function () {
      var loading = document.getElementById('app-loading');
      var app = document.getElementById('app');
      if (loading) loading.style.display = 'none';
      if (app) app.hidden = false;
      renderAll();
    }, 450);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
