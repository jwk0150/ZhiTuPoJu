/* =========================================================================
 * 行业快讯 · 全量列表页
 * -------------------------------------------------------------------------
 * 路由：industry.html
 * 功能：展示全部「行业快讯」（真实外链新闻），顶部含搜索栏（关键词 /
 *       分类筛选），底部含翻页器。整行点击跳转原文（新标签页打开）。
 * ========================================================================= */
(function () {
  'use strict';

  var D = window.JOB_NEWS_DATA;
  var JN = window.JN;
  var esc = JN.escapeHtml;

  var PER_PAGE = 6; /* 每页条数；12 条 → 2 页，足以演示翻页 */

  var state = {
    keyword: '',
    category: 'all',
    page: 1
  };

  /* ---------- 数据过滤 ---------- */
  function filtered() {
    var kw = state.keyword.trim().toLowerCase();
    var list = D.latestNews.slice();
    if (state.category !== 'all') {
      list = list.filter(function (n) { return n.category === state.category; });
    }
    if (kw) {
      list = list.filter(function (n) {
        var hay = [n.title, n.summary, n.source, n.host].join(' ').toLowerCase();
        return hay.indexOf(kw) !== -1;
      });
    }
    return list;
  }

  function totalPages(list) {
    return Math.max(1, Math.ceil(list.length / PER_PAGE));
  }

  /* ---------- 分类标签 ---------- */
  function tabsHtml() {
    return D.CATEGORIES.map(function (c) {
      return '<button type="button" class="jn-filter-tab' +
        (c.key === state.category ? ' is-active' : '') +
        '" data-cat="' + c.key + '">' + esc(c.label) + '</button>';
    }).join('');
  }

  /* ---------- 翻页器（数字 + 上一页/下一页 + 省略号） ---------- */
  function pageWindow(cur, pages) {
    var span = 1;
    var start = Math.max(1, cur - span);
    var end = Math.min(pages, cur + span);
    while (end - start < 2 && (start > 1 || end < pages)) {
      if (start > 1) start--;
      else if (end < pages) end++;
      else break;
    }
    return [start, end];
  }

  function pageBtn(i) {
    return '<button type="button" class="jn-pager-num' + (i === state.page ? ' is-active' : '') +
      '" data-page="' + i + '" aria-label="第 ' + i + ' 页">' + i + '</button>';
  }

  function pagerHtml(pages, total) {
    if (total === 0 || pages <= 1) return '';
    var parts = [];
    parts.push(
      '<button type="button" class="jn-pager-btn" data-page="prev" aria-label="上一页" ' +
      (state.page === 1 ? 'disabled' : '') + '>‹</button>'
    );
    var win = pageWindow(state.page, pages);
    if (win[0] > 1) {
      parts.push(pageBtn(1));
      if (win[0] > 2) parts.push('<span class="jn-pager-ellipsis">…</span>');
    }
    for (var i = win[0]; i <= win[1]; i++) parts.push(pageBtn(i));
    if (win[1] < pages) {
      if (win[1] < pages - 1) parts.push('<span class="jn-pager-ellipsis">…</span>');
      parts.push(pageBtn(pages));
    }
    parts.push(
      '<button type="button" class="jn-pager-btn" data-page="next" aria-label="下一页" ' +
      (state.page === pages ? 'disabled' : '') + '>›</button>'
    );
    return parts.join('');
  }

  /* ---------- 渲染 ---------- */
  function render(opts) {
    opts = opts || {};
    var list = filtered();
    var pages = totalPages(list);
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;

    var tabsEl = document.getElementById('ind-tabs');
    if (tabsEl) tabsEl.innerHTML = tabsHtml();

    var items = list.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);
    var listEl = document.getElementById('ind-list');
    var countEl = document.getElementById('ind-count');
    var pagerEl = document.getElementById('ind-pager');

    if (countEl) countEl.textContent = list.length;

    if (list.length === 0) {
      listEl.innerHTML = '<div class="jn-state jn-state--compact">没有找到匹配的资讯，换个关键词或分类试试。</div>';
    } else {
      listEl.innerHTML = items.map(function (n) { return JN.newsRowHtml(n, null); }).join('');
    }

    if (pagerEl) pagerEl.innerHTML = pagerHtml(pages, list.length);

    /* 仅在实际翻页时回到列表顶部，避免首屏/筛选时跳动 */
    if (opts.scroll) {
      var sec = document.getElementById('ind-section');
      if (sec && list.length > 0) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ---------- 交互绑定 ---------- */
  function bind() {
    var kwEl = document.getElementById('ind-kw');
    var clearEl = document.getElementById('ind-clear');

    if (kwEl) {
      kwEl.addEventListener('input', function () {
        state.keyword = kwEl.value;
        state.page = 1;
        render();
      });
    }
    if (clearEl) {
      clearEl.addEventListener('click', function () {
        state.keyword = '';
        if (kwEl) kwEl.value = '';
        state.page = 1;
        render();
        if (kwEl) kwEl.focus();
      });
    }

    var section = document.getElementById('ind-section');
    if (section) {
      section.addEventListener('click', function (e) {
        var tab = e.target.closest ? e.target.closest('[data-cat]') : null;
        if (tab) {
          state.category = tab.getAttribute('data-cat');
          state.page = 1;
          render();
          return;
        }
        var p = e.target.closest ? e.target.closest('[data-page]') : null;
        if (!p) return;
        var pages = totalPages(filtered());
        var val = p.getAttribute('data-page');
        if (val === 'prev') state.page = Math.max(1, state.page - 1);
        else if (val === 'next') state.page = Math.min(pages, state.page + 1);
        else state.page = parseInt(val, 10) || 1;
        render({ scroll: true });
      });
    }
  }

  /* ---------- 启动 ---------- */
  function init() {
    var upd = document.getElementById('ind-update');
    if (upd && D.META) upd.textContent = D.META.date + ' ' + (D.META.time || '');

    bind();

    var loading = document.getElementById('app-loading');
    var app = document.getElementById('app');
    if (loading) loading.style.display = 'none';
    if (app) app.hidden = false;
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
