/* =========================================================================
 * 岗位大新闻 · 详情页逻辑
 * -------------------------------------------------------------------------
 * 渲染：面包屑 / 标题区 / 正文 / 关键岗位标签 / 相关资讯
 * 交互：收藏 / 智能摘要（侧边弹卡，非聊天）
 * ========================================================================= */
(function () {
  'use strict';

  var D = window.JOB_NEWS_DATA;
  var JN = window.JN;
  var esc = JN.escapeHtml;

  function hexToRgba(hex, a) {
    var h = String(hex || '#37C8FF').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
  }

  function catTag(key) {
    var c = D.catByKey(key);
    return '<span class="jn-cat-tag" style="color:' + c.color + ';background:' + hexToRgba(c.color, 0.13) + '">' + esc(c.label) + '</span>';
  }

  function currentId() {
    var q = location.search.replace(/^\?/, '');
    var params = q.split('&');
    for (var i = 0; i < params.length; i++) {
      var kv = params[i].split('=');
      if (kv[0] === 'id') return decodeURIComponent(kv[1] || '');
    }
    return '';
  }

  /* ---------- 渲染正文 ---------- */
  function renderArticle(a) {
    var breadcrumb =
      '<div class="jn-breadcrumb">' +
        '<a href="index.html">首页</a><span>/</span>' +
        '<span>岗位资讯</span><span>/</span>' +
        '<span class="is-current">详情</span>' +
      '</div>';

    var head =
      '<header class="jn-detail-head">' +
        '<div class="jn-detail-head-top">' +
          catTag(a.category) +
          '<div class="jn-detail-tools">' +
            '<button type="button" class="jn-tool-btn" id="detail-fav">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
              '<span id="detail-fav-label">收藏</span>' +
            '</button>' +
            '<button type="button" class="jn-tool-btn jn-tool-btn--gold" id="digest-btn">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 8l7-5 7 5"/><path d="M5 16l7 5 7-5"/></svg>' +
              '<span>智能摘要</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<h1 class="jn-detail-title">' + esc(a.title) + '</h1>' +
        '<div class="jn-detail-meta">' +
          '<span>' + esc(a.date) + '</span><span class="jn-meta-sep">·</span>' +
          '<span>阅读时间 ' + esc(a.readTime) + '</span><span class="jn-meta-sep">·</span>' +
          '<span class="jn-detail-source">示例数据</span>' +
        '</div>' +
      '</header>';

    var content =
      '<div class="jn-article">' +
        a.content.map(function (s) {
          return '<section><h2>' + esc(s.h) + '</h2>' + s.p.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</section>';
        }).join('') +
      '</div>';

    var tags =
      '<section class="jn-keytags" aria-label="关键岗位标签">' +
        '<span class="jn-keytags-label">关键岗位标签</span>' +
        '<div class="jn-keytags-chips">' +
          a.tags.map(function (t) { return '<span class="jn-keytags-chip">' + esc(t) + '</span>'; }).join('') +
        '</div>' +
      '</section>';

    var disclaimer =
      '<p class="jn-disclaimer">注：本文为示例资讯，所引用岗位、技能与数据均为演示用途，不代表真实统计或新闻来源。</p>';

    document.getElementById('detail').innerHTML =
      '<div class="jn-detail">' +
        breadcrumb + head + content + tags + disclaimer +
      '</div>' +
      renderRelated(a);
  }

  function renderRelated(a) {
    var rel = D.relatedById(a.id);
    if (!rel.length) return '';
    var cards = rel.map(function (n) {
      return (
        '<article class="jn-related-card" data-go="' + n.id + '">' +
          '<div class="jn-related-card-thumb">' + JN.artVisual(n.cover) + '</div>' +
          '<div class="jn-related-card-body">' +
            catTag(n.category) +
            '<h3 class="jn-related-card-title">' + esc(n.title) + '</h3>' +
            '<span class="jn-related-card-date">' + esc(n.date) + '</span>' +
          '</div>' +
        '</article>'
      );
    }).join('');
    return (
      '<section class="jn-related" aria-label="相关资讯">' +
        '<div class="jn-section-head"><h2 class="jn-section-title">相关资讯</h2></div>' +
        '<div class="jn-related-grid">' + cards + '</div>' +
      '</section>'
    );
  }

  /* ---------- 智能摘要（侧边弹卡） ---------- */
  function buildDigestPanel() {
    if (document.getElementById('digest-panel')) return;
    var mask = document.createElement('div');
    mask.className = 'jn-digest-mask';
    mask.id = 'digest-mask';
    mask.hidden = true;

    var panel = document.createElement('aside');
    panel.className = 'jn-digest-panel';
    panel.id = 'digest-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML =
      '<div class="jn-digest-head">' +
        '<span class="jn-digest-head-title">智能摘要</span>' +
        '<button type="button" class="jn-digest-close" id="digest-close" aria-label="关闭">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="jn-digest-body" id="digest-body"></div>' +
      '<div class="jn-digest-foot">智能摘要 · 仅供理解参考 · 非对话</div>';

    document.body.appendChild(mask);
    document.body.appendChild(panel);
  }

  function setDigest(a) {
    var body = document.getElementById('digest-body');
    if (!body) return;
    var d = a.digest;
    body.innerHTML =
      '<div class="jn-digest-item">' +
        '<h4>这篇新闻讲了什么？</h4>' +
        '<p>' + esc(d.what) + '</p>' +
      '</div>' +
      '<div class="jn-digest-item">' +
        '<h4>核心影响是什么？</h4>' +
        '<p>' + esc(d.impact) + '</p>' +
      '</div>' +
      '<div class="jn-digest-item">' +
        '<h4>涉及哪些岗位？</h4>' +
        '<div class="jn-digest-jobs">' + d.jobs.map(function (j) { return '<span class="jn-digest-job">' + esc(j) + '</span>'; }).join('') + '</div>' +
      '</div>';
  }

  function openDigest(a) {
    buildDigestPanel();
    setDigest(a);
    var panel = document.getElementById('digest-panel');
    var mask = document.getElementById('digest-mask');
    mask.hidden = false;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
  }

  function closeDigest() {
    var panel = document.getElementById('digest-panel');
    var mask = document.getElementById('digest-mask');
    if (!panel) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    if (mask) mask.hidden = true;
  }

  function bindDigest(a) {
    buildDigestPanel();
    var btn = document.getElementById('digest-btn');
    var close = document.getElementById('digest-close');
    var mask = document.getElementById('digest-mask');
    if (btn) btn.addEventListener('click', function () { openDigest(a); });
    if (close) close.addEventListener('click', closeDigest);
    if (mask) mask.addEventListener('click', closeDigest);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDigest();
    });
  }

  /* ---------- 错误 / 空状态 ---------- */
  function renderError(msg) {
    document.getElementById('detail').innerHTML =
      '<div class="jn-state">' +
        '<div class="jn-state-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>' +
        '</div>' +
        '<div class="jn-state-title">' + esc(msg || '资讯未找到或加载失败') + '</div>' +
        '<p class="jn-state-desc">这条资讯可能已被移除，或链接有误。</p>' +
        '<div class="jn-state-actions">' +
          '<a class="jn-btn-gold" href="index.html">返回首页</a>' +
        '</div>' +
      '</div>';
  }

  /* ---------- 交互 ---------- */
  function bindFav(a) {
    var btn = document.getElementById('detail-fav');
    if (!btn) return;
    var label = document.getElementById('detail-fav-label');
    function sync() {
      var on = JN.isFav(a.id);
      btn.classList.toggle('is-on', on);
      if (label) label.textContent = on ? '已收藏' : '收藏';
    }
    sync();
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      JN.toggleFav(a.id);
      sync();
      JN.toast(JN.isFav(a.id) ? '已收藏' : '已取消收藏', 'success');
    });
  }

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
  function init() {
    var id = currentId();
    var a = D.findNews(id);
    var loading = document.getElementById('detail-loading');
    var main = document.getElementById('detail');

    setTimeout(function () {
      if (loading) loading.style.display = 'none';
      if (main) main.hidden = false;

      if (!a) {
        renderError('资讯未找到');
        return;
      }
      renderArticle(a);
      bindFav(a);
      bindDigest(a);
      bindNavigation();
      document.title = a.title + ' · 岗位大新闻';
    }, 320);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
