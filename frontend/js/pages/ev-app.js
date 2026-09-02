/* ============================================================
 * 岗位能力演化 · 「Career Git」主控 v3
 * 取代旧版 dashboard + 节点图 / 折线图 / 能力网络
 * 业务核心保留：+ 新增 / − 移除 / ~ 修改 / ◇ 预测
 * 视觉：暖金 + 米白 + 灰青 — 编辑型高级数据门户
 * ============================================================ */
(function () {
  'use strict';

  const D = window.EVData;

  // 工具函数
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const fmt = (n) => (n == null || isNaN(n) ? '—' : Math.round(Number(n)));

  // ============================================================
  // Store — 在 EVViews 加载之前由 ev-app.js 创建
  // ============================================================
  const store = {
    currentVersion: 'V2025.07',     // 当前查看的版本
    prevVersion: 'V2025.01',         // 与之对比的上一版本
    selectedSkill: null,             // 详情查看的能力 id
    filter: 'all',                   // 当前过滤(add/del/mod/pred/all)
    diff: null,                      // 当前 diff 数据
    coreSkills: [],
    emergingSkills: [],
    stableSkills: [],
    predictions: [],
  };

  // ============================================================
  // Toast
  // ============================================================
  function toast(msg, tone) {
    const el = document.getElementById('git-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'git-toast show' + (tone ? ' ' + tone : '');
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'git-toast'; }, 2400);
  }

  // ============================================================
  // Public
  // ============================================================
  window.EVApp = {
    store: store,
    $: $, $$: $$, esc: esc, fmt: fmt, toast: toast,
  };

  // ============================================================
  // 后端数据加载（不阻塞 UI 渲染）
  // ============================================================
  if (D.fetchServer) {
    D.fetchServer('Java开发工程师').then(() => {
      // 数据源切换：未来如需切换 UI 标识,在这里更新
      document.documentElement.setAttribute('data-ev-source', D.isDemo() ? 'demo' : 'db');
    });
  }
})();
