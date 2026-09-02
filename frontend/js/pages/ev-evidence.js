/* 岗位能力演化工作台 · 数据证据抽屉 (ev-evidence.js) */
(function () {
  'use strict';
  var A = window.EVApp;
  var D = window.EVData;
  var $ = A.$, esc = A.esc;
  var store = A.store;

  function highlight(text, kws) {
    var out = esc(text);
    (kws || []).forEach(function (k) {
      var re = new RegExp(esc(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      out = out.replace(re, '<mark>' + esc(k) + '</mark>');
    });
    return out;
  }

  function closeDrawer() {
    var m = $('#ce-drawer-mask'), d = $('#ce-drawer');
    if (m) m.classList.remove('show');
    if (d) d.classList.remove('show');
  }

  function bindClose() {
    var close = $('#ce-drawer-close');
    var mask = $('#ce-drawer-mask');
    if (close) close.addEventListener('click', closeDrawer);
    if (mask) mask.addEventListener('click', function (e) { if (e.target === mask) closeDrawer(); });
    var onKey = function (e) { if (e.key === 'Escape') { closeDrawer(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
  }

  // 打开某能力的数据证据抽屉
  function openEvidence(skillId) {
    var skill = D.SKILL_MAP[skillId];
    if (!skill) return;
    var counts = D.evidenceCounts(skill, store.version);
    var rel = D.relevance(skill, store.version);
    var growth = D.futureGrowth(skill);
    var conf = Math.round((skill.confidence || 0.85) * 100);
    var mask = $('#ce-drawer-mask'), drawer = $('#ce-drawer');
    if (!mask || !drawer) return;

    var srcRows = [
      { t: '招聘平台', k: 'recruit', v: counts.recruit, ev: 'jd-recruit' },
      { t: '企业岗位', k: 'corp', v: counts.corp, ev: 'corp' },
      { t: '行业报告', k: 'report', v: counts.report, ev: 'report' },
      { t: '政策文件', k: 'policy', v: counts.policy, ev: 'policy' },
      { t: '技术趋势', k: 'trend', v: counts.recruit, ev: 'trend-tech' },
    ];

    drawer.innerHTML =
      '<div class="ce-drawer-head"><div class="ce-drawer-title">' + esc(skill.name) + ' · 数据证据</div>' +
      '<button class="ce-drawer-close" id="ce-drawer-close" type="button">×</button></div>' +
      '<div class="ce-drawer-body">' +
        '<div class="ce-ev-summary">' +
          '<div class="ce-ev-sum-name">' + esc(skill.name) + '</div>' +
          '<div class="ce-ev-sum-nums">' +
            '<div><span>岗位相关度</span><b>' + rel + '%</b></div>' +
            '<div><span>未来增长</span><b class="' + (growth >= 0 ? 'up' : 'down') + '">' + (growth >= 0 ? '+' : '') + growth + '%</b></div>' +
            '<div><span>数据可信度</span><b>' + conf + '%</b></div>' +
          '</div>' +
        '</div>' +
        '<div class="ce-ev-list">' +
        srcRows.map(function (row) {
          var e = D.EVIDENCE_MAP[row.ev];
          return '<div class="ce-ev-item" data-ev="' + row.ev + '">' +
            '<div class="ce-ev-item-head"><span class="ce-ev-type">' + esc(row.t) + '</span><b>× ' + row.v + '</b></div>' +
            (e ? '<p class="ce-ev-quote">' + highlight(e.excerpt, e.keywords) + '</p>' : '') +
            '<div class="ce-ev-item-foot"><span>更新时间 ' + esc(e ? e.updated : '—') + '</span><em>可信度 ' + Math.round((e ? e.confidence : 0.8) * 100) + '%</em></div>' +
          '</div>';
        }).join('') +
        '</div>' +
        '<div class="ce-ev-foot-note">证据计数由需求强度推导（Demo 数据）；后端就绪后接入真实 JD 检索结果。</div>' +
      '</div>';

    mask.classList.add('show');
    drawer.classList.add('show');
    bindClose();
  }

  window.EVEvidence = { open: openEvidence, close: closeDrawer };
})();
