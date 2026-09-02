/* 岗位能力演化工作台 · 岗位洞察面板 (ev-insight.js) */
(function () {
  'use strict';
  var A = window.EVApp;
  var D = window.EVData;
  var $ = A.$, $$ = A.$$, esc = A.esc;
  var store = A.store;

  function sparkSvg(r) {
    var w = 48, h = 16, pts = [];
    var base = Math.max(1, r.current);
    var endV = Math.max(base + 1, base * (1 + r.growth / 100));
    for (var i = 0; i < 8; i++) {
      var k = i / 7;
      var v = base + (endV - base) * k;
      pts.push((2 + k * (w - 4)).toFixed(1) + ',' + (h - 2 - (v / endV) * (h - 4)).toFixed(1));
    }
    var stroke = r.growth >= 0 ? '#3E9C77' : '#CF6B62';
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + stroke + '" stroke-width="1.4"/></svg>';
  }

  function renderOverview() {
    var body = $('#ce-insight-body');
    if (!body) return;
    var ver = A.currentVersion();
    var sub = $('#ce-insight-version');
    if (sub) sub.textContent = store.version;

    var snap = D.getCapabilitySnapshot('Java开发工程师', store.version);
    var top5 = snap.skills.slice().sort(function (a, b) { return b.demand - a.demand; }).slice(0, 5);
    var incr = D.forecastRanking(store.horizon).filter(function (r) { return r.growth > 0; }).slice(0, 4);

    body.innerHTML =
      '<div class="ce-ip-block">' +
        '<div class="ce-ip-meta">' +
          '<div class="ce-ip-meta-cell"><span>当前版本</span><b>' + store.version + '</b></div>' +
          '<div class="ce-ip-meta-cell"><span>能力成熟度</span><b class="maturity">' + ver.maturity + '%</b></div>' +
        '</div>' +
        '<div class="ce-ip-bar"><i style="width:' + ver.maturity + '%"></i></div>' +
      '</div>' +
      '<div class="ce-ip-block">' +
        '<div class="ce-ip-h">核心能力<span class="ce-ip-sub">需求强度 · ' + store.version + '</span></div>' +
        '<div class="ce-ip-list">' +
        top5.map(function (s) {
          return '<div class="ce-ip-row skill" data-skill="' + s.id + '">' +
            '<span class="ce-ip-name">' + esc(s.name) + '</span>' +
            '<span class="ce-ip-barrow"><i style="width:' + Math.min(100, s.demand) + '%"></i></span>' +
            '<b>' + s.demand + '</b></div>';
        }).join('') +
        '</div></div>' +
      '<div class="ce-ip-block">' +
        '<div class="ce-ip-h">未来增量能力<span class="ce-ip-sub">未来 ' + store.horizon + ' 个月 · Demo 预测</span></div>' +
        '<div class="ce-ip-list">' +
        incr.map(function (r) {
          return '<div class="ce-ip-row trend" data-skill="' + r.id + '">' +
            '<span class="ce-ip-name">' + esc(r.name) + '</span>' +
            '<span class="ce-ip-spark">' + sparkSvg(r) + '</span>' +
            '<b class="up">+' + r.growth + '%</b></div>';
        }).join('') +
        '</div></div>' +
      '<div class="ce-ip-block">' +
        '<div class="ce-ip-h">AI 岗位判断</div>' +
        '<div class="ce-ip-role">' +
          '<span class="ce-ip-role-from">' + esc(D.JOB_META.fromRole) + '</span>' +
          '<span class="ce-ip-role-arrow">→</span>' +
          '<span class="ce-ip-role-to">' + esc(D.JOB_META.toRole) + '</span>' +
        '</div>' +
        '<button class="ce-ip-evid" id="ce-ip-evid-btn" type="button">查看演化依据 →</button>' +
      '</div>';

    $$('.ce-ip-row.skill', body).forEach(function (row) { row.addEventListener('click', function () { openSkillInsight(row.dataset.skill); }); });
    $$('.ce-ip-row.trend', body).forEach(function (row) { row.addEventListener('click', function () { openSkillInsight(row.dataset.skill); }); });
    var evBtn = $('#ce-ip-evid-btn');
    if (evBtn) evBtn.addEventListener('click', function () { if (window.EVEvidence) window.EVEvidence.open('ai-coding'); });
  }

  function renderSkill() {
    var body = $('#ce-insight-body');
    if (!body) return;
    var skill = D.SKILL_MAP[store.selectedSkill];
    if (!skill) { store.selectedSkill = null; renderOverview(); return; }
    var counts = D.evidenceCounts(skill, store.version);
    var rel = D.relevance(skill, store.version);
    var growth = D.futureGrowth(skill);
    var status = D.chartStatusAt(skill, A.currentCol());
    var sub = $('#ce-insight-version');
    if (sub) sub.textContent = store.version;
    var stLabel = A.STATUS_LABELS[status] || '稳定';

    body.innerHTML =
      '<button class="ce-ip-back" id="ce-ip-back" type="button">← 返回总览</button>' +
      '<div class="ce-ip-detail">' +
        '<div class="ce-ip-d-head">' +
          '<div class="ce-ip-d-name">' + esc(skill.name) + (skill.en ? '<em>' + esc(skill.en) + '</em>' : '') + '</div>' +
          '<span class="ce-ip-d-status s-' + status + '">' + stLabel + '</span>' +
        '</div>' +
        '<div class="ce-ip-d-stat">' +
          '<div><span>岗位相关度</span><b>' + rel + '%</b></div>' +
          '<div class="' + (growth >= 0 ? 'up' : 'down') + '"><span>未来增长</span><b>' + (growth >= 0 ? '+' : '') + growth + '%</b></div>' +
          '<div><span>首次出现</span><b>' + esc(skill.versionAdded || '—') + '</b></div>' +
        '</div>' +
        '<div class="ce-ip-d-block"><h4>为什么重要？</h4><p>' + esc(skill.reason) + '</p></div>' +
        '<div class="ce-ip-d-block"><h4>关联岗位</h4><div class="ce-tag-row">' +
          '<span class="ce-tag">Java 开发工程师</span><span class="ce-tag">Python 开发工程师</span><span class="ce-tag">AI 应用工程师</span>' +
        '</div></div>' +
        '<div class="ce-ip-d-block"><h4>关联技能</h4><div class="ce-tag-row">' +
          (skill.related || []).map(function (rid) {
            var r = D.SKILL_MAP[rid];
            return r ? '<span class="ce-tag link" data-rel="' + rid + '">' + esc(r.name) + '</span>' : '';
          }).join('') +
        '</div></div>' +
        '<div class="ce-ip-d-block"><h4>数据证据</h4><div class="ce-ip-evidence">' +
          '<div class="ce-ip-ev-row"><span>招聘需求</span><b>× ' + counts.recruit + '</b></div>' +
          '<div class="ce-ip-ev-row"><span>企业岗位</span><b>× ' + counts.corp + '</b></div>' +
          '<div class="ce-ip-ev-row"><span>行业报告</span><b>× ' + counts.report + '</b></div>' +
          '<div class="ce-ip-ev-row"><span>政策文件</span><b>× ' + counts.policy + '</b></div>' +
        '</div>' +
        '<button class="ce-btn primary sm" id="ce-ip-ev-btn" type="button">查看证据</button></div>' +
        '<div class="ce-ip-d-block"><div class="ce-ip-conf">数据可信度 <b>' + Math.round((skill.confidence || 0.85) * 100) + '%</b></div></div>' +
      '</div>';

    var back = $('#ce-ip-back');
    if (back) back.addEventListener('click', function () { store.selectedSkill = null; renderOverview(); if (window.EVChart) window.EVChart.render(); });
    $$('[data-rel]', body).forEach(function (t) {
      t.addEventListener('click', function () { var rid = t.dataset.rel; if (rid && D.SKILL_MAP[rid]) openSkillInsight(rid); });
    });
    var evBtn = $('#ce-ip-ev-btn');
    if (evBtn) evBtn.addEventListener('click', function () { if (window.EVEvidence) window.EVEvidence.open(skill.id); });
  }

  function render() {
    if (store.selectedSkill) renderSkill();
    else renderOverview();
  }

  function openSkillInsight(skillId) {
    if (!D.SKILL_MAP[skillId]) return;
    store.selectedSkill = skillId;
    if (store.tab !== 'evolution') A.switchTab('evolution');
    renderSkill();
    if (window.EVChart) window.EVChart.render();
  }

  window.EVInsight = { render: render, openSkillInsight: openSkillInsight };
})();
