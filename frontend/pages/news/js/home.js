/* =========================================================================
 * 岗位大新闻 · 首页逻辑
 * -------------------------------------------------------------------------
 * 第一屏：数字杂志式 Hero（标题 / 大数据 / 视觉 / 编辑列表 / 头版新闻）
 * 第二~五屏：热门资讯 / 行业快讯 / 热门排行 / 延伸阅读（保持原样）
 * ========================================================================= */
(function () {
  'use strict';

  var D = window.JOB_NEWS_DATA;
  var JN = window.JN;
  var esc = JN.escapeHtml;

  var state = {
    latestCategory: 'all',
    search: { keyword: '', date: '', sort: 'date' }
  };

  /* ---------- 顶部更新时间胶囊（Hero 页头中央） ---------- */
  function renderModuleHead() {
    var M = D.META;
    var el = document.getElementById('jn-topbar-update');
    if (el) el.innerHTML = '更新于 <b>' + esc(M.date) + ' ' + esc(M.time) + '</b>';
  }

  /* ============================================================
   * 第一屏 · 杂志式 Hero
   * ============================================================ */

  /* 编辑部精选 4 条：与第二张图内容一一对应 */
  var HERO_EDITORIAL = [
    { id: 'r007', cat: '行业趋势', catCls: 'is-teal' },
    { id: 'n007', cat: '政策资讯', catCls: 'is-rose' },
    { id: 'n002', cat: '新职业',   catCls: 'is-blue' },
    { id: 'n015', cat: '市场洞察', catCls: 'is-violet' }
  ];

  function findById(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* 头版封面新闻：腾讯 2026 校招（flag = 热点、阅读量最高） */
  function pickHeadline() {
    var n = findById(D.focusList, 'n001');
    if (n) return n;
    /* 退化：取 flag=热点 或阅读量最高的一条 */
    for (var i = 0; i < D.focusList.length; i++) {
      if (D.focusList[i].flag === '热点') return D.focusList[i];
    }
    return D.focusList[0];
  }

  function statsHtml() {
    var items = [
      { label: 'AI相关岗位需求', val: 218, suffix: '%', note: '同比增长', dec: 0 },
      { label: '企业人才需求缺口', val: 285, suffix: '万+', note: '预计2026年', dec: 0 },
      { label: '平均薪资涨幅', val: 26.7, suffix: '%', note: '高于整体行业', dec: 1 }
    ];
    return items.map(function (s) {
      return (
        '<div class="jn-stat">' +
          '<div class="jn-stat-label">' + esc(s.label) + '</div>' +
          '<div class="jn-stat-value">' +
            '<span class="jn-stat-num" data-count="' + s.val + '" data-decimals="' + s.dec + '">0</span>' +
            '<span class="jn-stat-suffix">' + esc(s.suffix) + '</span>' +
          '</div>' +
          '<div class="jn-stat-note">' + esc(s.note) + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function tagsHtml() {
    var tags = ['AI产品经理', '智能体开发', '大模型工程师', '数据分析师', '数字化转型'];
    return tags.map(function (t, i) {
      return '<a class="jn-hero-tag' + (i === 0 ? ' is-gold' : '') + '" href="all.html?tag=' + encodeURIComponent(t) + '">' + esc(t) + '</a>';
    }).join('');
  }

  function headlinerHtml(head) {
    var isExt = !!head.external;
    var attr = isExt
      ? ('data-url="' + esc(head.url) + '"')
      : ('data-go="' + esc(head.id) + '"');
    return (
      '<article class="jn-hero-headliner jn-hero-anim" style="--d:.58s" ' + attr + '>' +
        '<span class="jn-hero-headliner-flag">热点</span>' +
        '<div class="jn-hero-headliner-body">' +
          '<h3 class="jn-hero-headliner-title">' + esc(head.title) + '</h3>' +
          '<div class="jn-hero-headliner-meta">' +
            '<span class="jn-hero-headliner-source">' + esc(head.source) + '</span>' +
            '<span>' + esc(head.date) + '</span>' +
            '<span>' + JN.fmtRead(head.readCount) + '阅读</span>' +
          '</div>' +
          '<div class="jn-hero-headliner-cta">查看完整报道 <span aria-hidden="true">→</span></div>' +
        '</div>' +
      '</article>'
    );
  }

  function editorialHtml() {
    var pool = D.focusList.concat(D.newsList);
    return HERO_EDITORIAL.map(function (p, i) {
      var n = findById(pool, p.id);
      if (!n) return '';
      var isExt = !!n.external;
      var attr = isExt
        ? ('data-url="' + esc(n.url) + '"')
        : ('data-go="' + esc(n.id) + '"');
      var hostHtml = n.host ? '<span class="jn-hero-edit-host">' + esc(n.host) + '</span>' : '';
      return (
        '<article class="jn-hero-edit-item jn-hero-anim" style="--d:' + (0.55 + i * 0.08).toFixed(2) + 's" ' + attr + '>' +
          '<div class="jn-hero-edit-num">' + ('0' + (i + 1)) + '</div>' +
          '<div class="jn-hero-edit-body">' +
            '<div class="jn-hero-edit-cat ' + p.catCls + '">' + esc(p.cat) + '</div>' +
            '<h4 class="jn-hero-edit-title">' + esc(n.title) + '</h4>' +
            '<div class="jn-hero-edit-meta">' +
              '<span class="jn-hero-edit-source">' + esc(n.source) + '</span>' +
              hostHtml +
              '<span>' + esc(n.date) + '</span>' +
              '<span>' + JN.fmtRead(n.readCount) + '阅读</span>' +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');
  }

  function renderFocus() {
    var root = document.getElementById('focus');
    if (!root) return;
    var head = pickHeadline();

    var leftCol =
      '<div class="jn-hero-left">' +
        '<div class="jn-hero-eyebrow jn-hero-anim" style="--d:.05s">2026 岗位变化观察</div>' +
        '<h1 class="jn-hero-title jn-hero-anim" style="--d:.15s">' +
          '<span class="jn-hero-title-line">AI浪潮重塑</span>' +
          '<span class="jn-hero-title-line">就业格局</span>' +
          '<span class="jn-hero-subtitle">新岗位爆发式增长</span>' +
        '</h1>' +
        '<p class="jn-hero-desc jn-hero-anim" style="--d:.25s">2026 校招新趋势：AI 产品经理、智能体开发等岗位需求激增，企业人才标准正在被重新定义。</p>' +
        '<div class="jn-hero-stats jn-hero-anim" style="--d:.32s">' + statsHtml() + '</div>' +
        '<div class="jn-hero-actions jn-hero-anim" style="--d:.42s">' +
          '<a class="jn-hero-btn-primary" href="detail.html?id=' + esc(head.id) + '">查看完整报告 <span aria-hidden="true">→</span></a>' +
          '<button type="button" class="jn-hero-btn-secondary" id="hero-play">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
            '<span>3分钟速览</span>' +
          '</button>' +
        '</div>' +
        '<div class="jn-hero-tags jn-hero-anim" style="--d:.5s">' +
          '<span class="jn-hero-tags-label">热门岗位</span>' +
          '<div class="jn-hero-tags-list">' + tagsHtml() + '</div>' +
        '</div>' +
        headlinerHtml(head) +
      '</div>';

    var visual =
      '<div class="jn-hero-visual jn-hero-anim" style="--d:.2s">' +
        '<img class="jn-hero-visual-img" src="../../assets/news/hero-magazine.png" alt="未来城市职业入口" />' +
        '<span class="jn-hero-visual-tag">本期封面</span>' +
        '<div class="jn-hero-visual-caption">' +
          '<span>VOL.01</span>' +
          '<span class="jn-dotline"></span>' +
          '<span>FUTURE CAREER MEDIA</span>' +
        '</div>' +
      '</div>';

    var editorialCol =
      '<aside class="jn-hero-editorial jn-hero-anim" style="--d:.35s">' +
        '<div class="jn-hero-editorial-head">' +
          '<div class="jn-hero-editorial-title">编辑部精选</div>' +
          '<div class="jn-hero-editorial-sub">04 STORIES</div>' +
        '</div>' +
        editorialHtml() +
      '</aside>';

    root.innerHTML = leftCol + visual + editorialCol;

    /* 数据数字 count-up */
    JN.animateDataValues(root);

    /* 3 分钟速览：平滑滚到下一屏（行业快讯） */
    var play = document.getElementById('hero-play');
    if (play) {
      play.addEventListener('click', function () {
        var next = document.getElementById('screen-industry');
        if (next && next.scrollIntoView) next.scrollIntoView({ behavior: 'smooth' });
        else JN.toast('即将上线', 'info');
      });
    }
  }

  /* ============================================================
   * 第二~五屏：热门资讯 / 行业快讯 / 热门排行 / 延伸阅读（保持原样）
   * ============================================================ */

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

  /* ---------- 分类筛选交互（行业快讯） ---------- */
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

  /* ---------- 进入详情 / 外链 ---------- */
  function bindNavigation() {
    document.addEventListener('click', function (e) {
      var el = e.target;
      if (!el || !el.closest) return;
      if (el.closest('[data-fav]')) return;
      /* 行业快讯 / 头版封面 / 编辑列表外链：整卡新标签打开原文 */
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

  function init() {
    bindFilter();
    bindSearch();
    bindSearchDrawer();
    bindKeyboard();
    bindNavigation();

    setTimeout(function () {
      var loading = document.getElementById('app-loading');
      var app = document.getElementById('app');
      if (loading) loading.style.display = 'none';
      if (app) app.hidden = false;
      renderAll();
    }, 380);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();