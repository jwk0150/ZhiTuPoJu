/* =========================================================================
 * 岗位大新闻 · 详情页逻辑
 * -------------------------------------------------------------------------
 * 渲染：面包屑 / 标题区 / 正文 / 关键数据 / 趋势图 / 岗位信息 / AI解读
 *       相关资讯 / 上一篇下一篇
 * 交互：收藏 / 分享 / 展开AI解读 / 数字动效 / 扫描线
 * ========================================================================= */
(function () {
  'use strict';

  var D = window.JOB_NEWS_DATA;
  var JN = window.JN;
  var esc = JN.escapeHtml;

  function hexToRgba(hex, a) {
    var h = String(hex || '#4A9FE8').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
  }

  function catTag(key) {
    var c = D.catByKey(key);
    return '<span class="jn-cat-tag" style="color:' + c.color + ';background:' + hexToRgba(c.color, 0.12) + '">' + esc(c.label) + '</span>';
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

  /* ---------- 渲染 ---------- */
  function renderArticle(a) {
    var breadcrumb =
      '<div class="jn-breadcrumb jn-enter">' +
        '<a href="index.html">首页</a><span>/</span>' +
        '<a href="index.html#news">岗位资讯</a><span>/</span>' +
        '<span>详情</span>' +
      '</div>';

    var head =
      '<header class="jn-detail-head jn-enter" style="--d:.06s">' +
        catTag(a.category) +
        '<h1 class="jn-detail-title">' + esc(a.title) + '</h1>' +
        '<p class="jn-detail-subtitle">' + esc(a.subtitle) + '</p>' +
        '<div class="jn-detail-meta">' +
          '<span>' + esc(a.date) + '</span><span class="jn-meta-sep">·</span>' +
          '<span class="jn-source">来源：' + esc(a.source) + '</span><span class="jn-meta-sep">·</span>' +
          '<span>阅读时间：' + esc(a.readTime) + '</span>' +
          '<div class="jn-detail-tools">' +
            '<button type="button" class="jn-tool-btn" id="detail-fav">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
              '<span id="detail-fav-label">收藏</span>' +
            '</button>' +
            '<button type="button" class="jn-tool-btn" id="share-btn">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>' +
              '<span>分享</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</header>';

    var article =
      '<div class="jn-article jn-enter" style="--d:.12s">' +
        a.sections.map(function (s) {
          return '<section><h2>' + esc(s.h) + '</h2>' + s.p.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</section>';
        }).join('') +
        '<p class="jn-disclaimer">注：本文为示例资讯，所引用岗位、技能与数据均为演示用途，不代表真实统计或新闻来源。</p>' +
      '</div>';

    var keydata =
      '<section class="jn-keydata jn-enter" style="--d:.16s" aria-label="关键数据">' +
        a.keyData.map(function (k) {
          return (
            '<div class="jn-keydata-card">' +
              '<div class="jn-keydata-label">' + esc(k.label) + '</div>' +
              '<div class="jn-keydata-value">' +
                '<span data-count="' + k.value + '" data-decimals="' + (k.decimals || 0) + '">0</span>' +
                (k.suffix ? '<small>' + esc(k.suffix) + '</small>' : '') +
              '</div>' +
            '</div>'
          );
        }).join('') +
      '</section>';

    var trendbox =
      '<section class="jn-trendbox jn-enter" style="--d:.2s" aria-label="岗位热度趋势">' +
        '<div class="jn-trendbox-head">' +
          '<span class="jn-trendbox-label">' + esc(a.trendLabel) + '</span>' +
          '<span class="jn-trendbox-final">' + (a.trend ? (a.trend.dir === 'up' ? '↑ ' : a.trend.dir === 'down' ? '↓ ' : '') + esc(a.trend.value) : '') + '</span>' +
        '</div>' +
        JN.sparkline(a.trendPoints) +
        '<div class="jn-trendbox-axis"><span>30天前</span><span>今天</span></div>' +
      '</section>';

    var job =
      '<section class="jn-job jn-enter" style="--d:.24s" aria-label="岗位信息">' +
        '<h2 class="jn-job-name">这个岗位是做什么的？——' + esc(a.job) + '</h2>' +
        '<div class="jn-job-block">' +
          '<div class="jn-job-block-label">主要职责</div>' +
          '<div class="jn-job-chips">' + (a.duties || []).map(function (d) { return '<span class="jn-job-chip">' + esc(d) + '</span>'; }).join('') + '</div>' +
        '</div>' +
        '<div class="jn-job-block">' +
          '<div class="jn-job-block-label">常见技能</div>' +
          '<div class="jn-job-chips">' + (a.skills || []).map(function (s) { return '<span class="jn-job-chip">' + esc(s) + '</span>'; }).join('') + '</div>' +
        '</div>' +
      '</section>';

    var ai = renderAi(a);

    document.getElementById('detail').innerHTML =
      '<div class="jn-detail">' + breadcrumb + head + article + keydata + trendbox + job + ai + '</div>' +
      renderRelated(a) +
      renderPager(a);
  }

  function renderAi(a) {
    var ins = a.aiInsight;
    var short = ins.short;
    var expanded = ins.expanded;
    return (
      '<section class="jn-ai jn-enter" style="--d:.28s" id="ai-card" aria-label="AI解读">' +
        '<span class="jn-ai-scan" aria-hidden="true"></span>' +
        '<div class="jn-ai-head">' +
          '<span class="jn-ai-badge">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 3 7v6c0 5 3.8 8.3 9 9 5.2-.7 9-4 9-9V7l-9-5z"/><path d="M12 22V12M12 12 3 7M12 12l9-5"/></svg>' +
            '✦ AI解读' +
          '</span>' +
          '<div><div class="jn-ai-title">AI解读</div><div class="jn-ai-sub">用更简单的话，帮你读懂这条资讯。</div></div>' +
        '</div>' +
        '<div class="jn-ai-body">' +
          '<p class="jn-ai-lead">简单来说：</p>' +
          '<p class="jn-ai-direction" style="margin-top:6px">' + esc(short.summary) + '</p>' +
          '<div class="jn-ai-points">' + short.points.map(function (p) { return '<span class="jn-ai-point">' + esc(p) + '</span>'; }).join('') + '</div>' +
          '<p class="jn-ai-direction">这意味着：<b>' + esc(short.direction) + '</b></p>' +
        '</div>' +
        '<div class="jn-ai-foot">' +
          '<span class="jn-ai-disclaimer">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>' +
            'AI生成内容 · 仅供资讯理解参考' +
          '</span>' +
          '<button type="button" class="jn-ai-expand-btn" id="ai-expand">展开AI解读' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="jn-ai-expand" id="ai-expand-body"><div class="jn-ai-expand-inner">' +
          '<div class="jn-ai-expand-item"><h4>为什么发生？<span class="jn-ai-tag">AI分析</span></h4><p>' + esc(expanded.why) + '</p></div>' +
          '<div class="jn-ai-expand-item"><h4>发生了什么变化？<span class="jn-ai-tag">AI分析</span></h4><p>' + esc(expanded.what) + '</p></div>' +
          '<div class="jn-ai-expand-item"><h4>可能影响什么？<span class="jn-ai-tag">AI分析</span></h4><p>' + esc(expanded.impact) + '</p></div>' +
          '<div class="jn-ai-expand-item"><h4>AI如何理解？<span class="jn-ai-tag">AI分析</span></h4><p>' + esc(expanded.aiView) + '</p></div>' +
        '</div></div>' +
      '</section>'
    );
  }

  function renderRelated(a) {
    var rel = D.relatedNews(a.id);
    if (!rel.length) return '';
    var cards = rel.map(function (n, i) {
      return (
        '<article class="jn-related-card jn-enter" style="--d:' + (0.3 + i * 0.05) + 's" data-go="' + n.id + '">' +
          catTag(n.category) +
          '<h3 class="jn-related-card-title">' + esc(n.title) + '</h3>' +
          '<div class="jn-related-card-foot"><span>' + esc(n.date) + '</span><span class="jn-related-arrow">→</span></div>' +
        '</article>'
      );
    }).join('');
    return (
      '<section class="jn-related" aria-label="相关资讯">' +
        '<h2 class="jn-related-title">你可能还想了解</h2>' +
        '<div class="jn-related-grid">' + cards + '</div>' +
      '</section>'
    );
  }

  function renderPager(a) {
    var nb = D.neighbors(a.id);
    var prev = nb.prev ? (
      '<a class="jn-pager-item" data-go="' + nb.prev.id + '" href="detail.html?id=' + encodeURIComponent(nb.prev.id) + '">' +
        '<span class="jn-pager-label">上一篇</span>' +
        '<span class="jn-pager-title">' + esc(nb.prev.title) + '</span>' +
      '</a>'
    ) : '<span></span>';
    var next = nb.next ? (
      '<a class="jn-pager-item is-next" data-go="' + nb.next.id + '" href="detail.html?id=' + encodeURIComponent(nb.next.id) + '">' +
        '<span class="jn-pager-label">下一篇</span>' +
        '<span class="jn-pager-title">' + esc(nb.next.title) + '</span>' +
      '</a>'
    ) : '<span></span>';
    return '<nav class="jn-pager" aria-label="上一篇下一篇"><div class="jn-pager-grid">' + prev + next + '</div></nav>';
  }

  /* ---------- 错误 / 空状态 ---------- */
  function renderError(msg) {
    document.getElementById('detail').innerHTML =
      '<div class="container"><div class="jn-state">' +
        '<div class="jn-state-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>' +
        '</div>' +
        '<div class="jn-state-title">' + esc(msg || '资讯未找到或加载失败') + '</div>' +
        '<p class="jn-state-desc">这条资讯可能已被移除，或链接有误。</p>' +
        '<div class="jn-state-actions">' +
          '<a class="jn-btn-read" href="index.html">返回首页</a>' +
          '<button type="button" class="jn-btn-more" onclick="location.reload()">重新加载</button>' +
        '</div>' +
      '</div></div>';
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
    btn.addEventListener('click', function () {
      JN.toggleFav(a.id);
      sync();
      JN.toast(JN.isFav(a.id) ? '已收藏' : '已取消收藏', 'success');
    });
  }

  function buildSharePop() {
    if (document.getElementById('share-pop')) return document.getElementById('share-pop');
    var items = [
      { label: '复制链接', icon: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>', key: 'copy' },
      { label: '微信', icon: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/><path d="M8 10.5h.01M16 10.5h.01M9 14.5h.01M15 14.5h.01"/>', key: 'wechat' },
      { label: '微博', icon: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>', key: 'weibo' },
      { label: '系统分享', icon: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/>', key: 'system' }
    ];
    var pop = document.createElement('div');
    pop.id = 'share-pop';
    pop.className = 'jn-share-pop';
    pop.innerHTML = items.map(function (it) {
      return '<button type="button" class="jn-share-item" data-share="' + it.key + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + it.icon + '</svg>' +
        esc(it.label) + '</button>';
    }).join('');
    document.body.appendChild(pop);

    pop.addEventListener('click', function (e) {
      var item = e.target.closest('[data-share]');
      if (!item) return;
      var key = item.getAttribute('data-share');
      closeShare();
      if (key === 'copy') copyLink();
      else if (key === 'wechat') JN.toast('示例交互：微信分享（未接入真实接口）', 'info');
      else if (key === 'weibo') JN.toast('示例交互：微博分享（未接入真实接口）', 'info');
      else JN.toast('示例交互：系统分享（未接入真实接口）', 'info');
    });

    document.addEventListener('click', function (e) {
      if (!pop.classList.contains('is-open')) return;
      if (e.target.closest('#share-btn') || e.target.closest('#share-pop')) return;
      closeShare();
    });

    return pop;
  }

  function openShare(anchor) {
    var pop = buildSharePop();
    var r = anchor.getBoundingClientRect();
    pop.style.top = (r.bottom + 8) + 'px';
    pop.style.left = Math.max(12, r.right - 160) + 'px';
    pop.classList.add('is-open');
  }
  function closeShare() {
    var pop = document.getElementById('share-pop');
    if (pop) pop.classList.remove('is-open');
  }

  function copyLink() {
    var url = location.href;
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); JN.toast('链接已复制', 'success'); } catch (e) { JN.toast('复制失败', 'error'); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { JN.toast('链接已复制', 'success'); }).catch(fallback);
    } else fallback();
  }

  function bindShare() {
    var btn = document.getElementById('share-btn');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var pop = document.getElementById('share-pop');
      if (pop && pop.classList.contains('is-open')) closeShare();
      else openShare(btn);
    });
  }

  function bindAi() {
    var btn = document.getElementById('ai-expand');
    var body = document.getElementById('ai-expand-body');
    var card = document.getElementById('ai-card');
    if (!btn || !body) return;
    function scanOnce() {
      if (!card) return;
      card.classList.add('is-scanning');
      setTimeout(function () { card.classList.remove('is-scanning'); }, 2600);
    }
    btn.addEventListener('click', function () {
      var open = body.style.maxHeight && body.style.maxHeight !== '0px';
      if (open) {
        body.style.maxHeight = '0px';
        btn.classList.remove('is-open');
        btn.firstChild.nodeValue = '展开AI解读';
      } else {
        body.style.maxHeight = body.scrollHeight + 'px';
        btn.classList.add('is-open');
        btn.firstChild.nodeValue = '收起AI解读';
        scanOnce();
      }
    });
    // 首次进入轻扫一次
    setTimeout(scanOnce, 600);
  }

  function bindNavigation() {
    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest) {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('label')) return;
      }
      var card = e.target && e.target.closest ? e.target.closest('[data-go]') : null;
      if (!card) return;
      var id = card.getAttribute('data-go');
      if (id) location.href = 'detail.html?id=' + encodeURIComponent(id);
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    var id = currentId();
    var a = D.getArticle(id);
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
      JN.animateDataValues(main);
      bindFav(a);
      bindShare();
      bindAi();
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
