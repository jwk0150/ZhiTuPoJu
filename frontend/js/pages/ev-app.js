/* 岗位能力演化工作台 · 主控 v2 */
(function () {
  'use strict';
  const D = window.EVData;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const store = {
    tab: 'evolution', version: 'V2025.07', selectedSkill: null, filter: 'all', zoom: 1, hover: null,
    compareSkills: D.COMPARE_SKILLS.slice(), timeRange: '12', granularity: 'month', metric: 'demand',
    showForecast: true, horizon: 6,
  };
  const STATUS_COLORS = { stable: '#5B8DB8', added: '#3E9C77', declining: '#CF6B62', predicted: '#9B7BD4', modified: '#D98E3C' };
  const STATUS_LABELS = { stable: '稳定', added: '新增', declining: '衰减', predicted: '预测', modified: '修改' };

  const chartInstances = {};
  function disposeChart(k) { if (chartInstances[k]) { try { chartInstances[k].dispose(); } catch (e) {} delete chartInstances[k]; } }
  function toast(msg, tone) {
    const el = $('#ce-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'ce-toast show ' + (tone || 'mint');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.className = 'ce-toast'; }, 2600);
  }
  function currentVersion() { return D.versionById(store.version); }
  function currentCol() { return D.VERSIONS.indexOf(currentVersion()); }

  const TABS = [
    { id: 'evolution', label: '能力演化' }, { id: 'changes', label: '能力变更' },
    { id: 'trends', label: '技术趋势' }, { id: 'forecast', label: '未来预测' },
    { id: 'evidence', label: '数据证据' }, { id: 'gap', label: '我的差距' },
  ];

  function renderTabs() {
    const el = $('#ce-tabs');
    if (!el) return;
    el.innerHTML = TABS.map(function (t) {
      return '<button class="ce-tab' + (store.tab === t.id ? ' active' : '') + '" data-tab="' + t.id + '" type="button">' + t.label + '</button>';
    }).join('');
    $$('.ce-tab', el).forEach(function (b) { b.addEventListener('click', function () { switchTab(b.dataset.tab); }); });
  }

  function setActiveView(id) {
    $$('.ce-view').forEach(function (v) {
      var on = v.id === 'ce-view-' + id;
      v.classList.toggle('active', on);
      if (on) { v.classList.remove('ce-anim-in'); void v.offsetWidth; v.classList.add('ce-anim-in'); }
    });
    var ev = $('#ce-view-evolution');
    if (ev) ev.classList.toggle('active', id === 'evolution');
  }

  function switchTab(id) {
    if (!TABS.find(function (t) { return t.id === id; })) return;
    store.tab = id;
    $$('.ce-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === id); });
    setActiveView(id);
    if (id === 'evolution') {
      if (window.EVChart) window.EVChart.render();
      if (window.EVInsight) window.EVInsight.render();
    } else if (window.EVViews) {
      window.EVViews.render(id);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderSourceBadge() {
    var el = $('#ce-data-source');
    if (!el) return;
    var meta = window.__EV_DB_META || null;
    if (D.isDemo()) {
      el.textContent = 'Demo 演示数据';
      el.title = '当前为内置演示数据；后端就绪后自动切换为真实数据锚定';
    } else {
      el.textContent = '真实数据锚定 · 模型估计';
      el.title = '招聘 JD 语料来自真实数据库（' + ((meta && meta.jdCount) || '') + ' 条），演化曲线为多源模型估计';
    }
  }

  function renderHeader() {
    var ver = currentVersion();
    function set(id, t) { var x = $('#' + id); if (x) x.textContent = t; }
    set('ce-job-en', D.JOB_META.en);
    set('ce-updated', D.JOB_META.dataUpdated);
    set('ce-confidence', D.JOB_META.confidence + '%');
    set('ce-cur-version', store.version);
    set('ce-cur-maturity', ver.maturity + '%');
    renderSourceBadge();
  }

  function renderVersionStrip() {
    var el = $('#ce-version-strip');
    if (!el) return;
    el.innerHTML = '<div class="ce-vs-line"></div>' + D.VERSIONS.map(function (v, i) {
      var cls = ['ce-vs-node'];
      if (v.id === store.version) cls.push('active');
      if (v.isForecast) cls.push('forecast');
      if (i === 0) cls.push('first');
      if (i === D.VERSIONS.length - 1) cls.push('last');
      return '<button class="' + cls.join(' ') + '" data-ver="' + v.id + '" type="button">' +
        '<span class="ce-vs-dot"></span>' +
        '<span class="ce-vs-label">' + v.label + (v.isForecast ? '<em class="ce-vs-fc">预测</em>' : '') + '</span>' +
        '<span class="ce-vs-sub">' + esc(v.note) + '</span>' +
      '</button>';
    }).join('');
    $$('.ce-vs-node', el).forEach(function (b) { b.addEventListener('click', function () { selectVersion(b.dataset.ver); }); });
  }

  function selectVersion(vid) {
    if (store.version === vid) return;
    store.version = vid;
    renderHeader();
    renderVersionStrip();
    if (window.EVChart) window.EVChart.render();
    if (window.EVInsight) window.EVInsight.render();
    toast('已切换到能力模型版本 ' + vid, 'info');
  }

  window.EVApp = {
    store: store, $: $, $$: $$, esc: esc, toast: toast,
    STATUS_COLORS: STATUS_COLORS, STATUS_LABELS: STATUS_LABELS,
    currentVersion: currentVersion, currentCol: currentCol,
    disposeChart: disposeChart, chartInstances: chartInstances,
    switchTab: switchTab, selectVersion: selectVersion,
  };

  function init() {
    D.fetchServer('Java开发工程师').then(function () {
      renderHeader();
      renderTabs();
      renderVersionStrip();
      if (window.EVChart) window.EVChart.render();
      if (window.EVInsight) window.EVInsight.render();
      try {
        var q = new URLSearchParams(location.search);
        var tab = q.get('tab');
        if (tab && TABS.find(function (t) { return t.id === tab; })) switchTab(tab);
      } catch (e) {}
    });
  }

  window.EvolutionWorkbench = { init: init, switchTab: switchTab, selectVersion: selectVersion };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
