/* 集成测试：验证「首页五大信源 → 第二屏智能发现」真实爬虫数据串联
 * 覆盖：
 *   1. 首屏五大信源卡片只呈现「五大类」，不出现具体平台名（BOSS/CSDN/GitHub/新华网…）
 *   2. 逐个点击五大信源（招聘/企业/行业/政策/学术），校验各自展示对应平台的实时结果
 *   3. 每条结果外链真实源站 URL
 *   4. 发现结果每类最多展示 6 条（用户要求「展示六条即可」）
 *   5. chip 聚合点亮；「查看全部信源」可重置
 * 数据：scripts/disco_payload.json（真实爬取结果快照，五大类各 6 条，含种子库补齐）
 * 运行：NODE_PATH=<jsdom 所在 node_modules> node scripts/test_discovery_wiring.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = 'C:/Users/Dsy/ZhiTuPoJu';
const html = fs.readFileSync(path.join(ROOT, 'frontend/pages/news/index.html'), 'utf-8');
const dataJs = fs.readFileSync(path.join(ROOT, 'frontend/pages/news/js/data.js'), 'utf-8');
const commonJs = fs.readFileSync(path.join(ROOT, 'frontend/pages/news/js/common.js'), 'utf-8');
const homeJs = fs.readFileSync(path.join(ROOT, 'frontend/pages/news/js/home.js'), 'utf-8');
const payload = fs.readFileSync(path.join(ROOT, 'scripts/disco_payload.json'), 'utf-8');

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://127.0.0.1:8090/pages/news/index.html' });
const { window } = dom;

const errors = [];
window.onerror = (msg) => { errors.push(String(msg)); };
const origErr = console.error;
console.error = (...a) => { const s = a.map(String).join(' '); if (/DeprecationWarning|punycode|trace-deprecation/.test(s)) return; errors.push(s); origErr(...a); };

// ---- stubs ----
window.Shell = { mount() {} };
window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
window.cancelAnimationFrame = (id) => clearTimeout(id);
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
window.scrollTo = () => {};
window.open = () => {};
if (window.Element && window.Element.prototype) window.Element.prototype.scrollIntoView = function () {};
window.XMLHttpRequest = function () {
  this.readyState = 0; this.status = 0; this.responseText = '';
  this.open = function (m, u) { this.method = m; this.url = u; this.readyState = 1; };
  this.setRequestHeader = function () {};
  this.send = function () {
    const self = this;
    setTimeout(() => {
      try { self.responseText = payload; self.status = 200; self.readyState = 4; if (self.onreadystatechange) self.onreadystatechange(); }
      catch (e) { self.status = 500; self.readyState = 4; if (self.onerror) self.onerror(); }
    }, 50);
  };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try {
    window.eval(dataJs);
    window.eval(commonJs);
    window.eval(homeJs);
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  } catch (e) { errors.push('EVAL: ' + e.message); }

  await sleep(700); // renderAll (setTimeout 380)

  const doc = window.document;
  const assert = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' - ' + msg); if (!cond) process.exitCode = 1; };

  // Hero chips exist with correct source types
  const heroItems = [...doc.querySelectorAll('.jn-hero-source-item')];
  const heroTypes = heroItems.map((el) => el.getAttribute('data-source-type'));
  assert(heroItems.length === 5, '首页有 5 个信源卡片 (实际 ' + heroItems.length + ')');
  assert(JSON.stringify(heroTypes) === JSON.stringify(['招聘平台','企业官网','行业报告','政策文件','学术论文']),
    '信源类型 = 招聘/企业/行业/政策/学术 (实际 ' + JSON.stringify(heroTypes) + ')');

  // 用户要求：卡片正面不特指 boss直聘 / csdn 等平台名，只呈现五大类
  const BANNED = ['BOSS', '直聘', 'CSDN', '掘金', 'GitHub', 'Hacker', '新华网', '今日头条', '百度热搜', '少数派', 'Remotive'];
  const heroText = heroItems.map((el) => el.textContent || '').join('\n');
  const leaked = BANNED.filter((w) => heroText.indexOf(w) >= 0);
  assert(leaked.length === 0, '首屏五大类卡片不含平台名 (泄漏: ' + (leaked.join(',') || '无') + ')');
  assert(heroItems.every((el) => el.querySelector('.jn-hero-source-tag')), '每张卡片都带细分标签（补齐视觉层次）');

  // real payload sanity
  const pj = JSON.parse(payload);
  const byType = {};
  pj.data.items.forEach((it) => { byType[it.source_type] = (byType[it.source_type] || 0) + 1; });
  const MAX_ROWS = 6; // 前端「只展示六条」上限

  const lc = doc.getElementById('latest-cols');
  const grid = doc.getElementById('home-disc-grid');

  // ---- 逐个点击五大信源，验证各自展示对应平台的实时结果 ----
  const TYPES = ['招聘平台', '企业官网', '行业报告', '政策文件', '学术论文'];
  for (const t of TYPES) {
    const target = doc.querySelector('.jn-hero-source-item[data-source-type="' + t + '"]');
    assert(!!target, '存在「' + t + '」信源卡片');
    target.click();
    await sleep(3600); // discovery run completes (~2.9s) + render

    assert(lc && lc.classList.contains('is-discovery-mode'), t + '：点击后进入单信源视图 (is-discovery-mode)');
    const rows = grid ? [...grid.querySelectorAll('a.jn-disc-row')] : [];
    const expect = Math.min(byType[t] || 0, MAX_ROWS); // 页面最多渲染 6 条
    assert(rows.length === expect, t + ' 结果条数 = ' + expect + ' (实际 ' + rows.length + ')');
    assert(rows.length <= MAX_ROWS, t + ' 不超过「只展示 6 条」上限 (实际 ' + rows.length + ')');
    if (expect === 0) {
      // 该分类本轮无数据（信源被反爬 / 网络抖动）：只需不报错、展示空态即可，
      // 不校验上下文标题（空态下不渲染）。
      console.log('SKIP - ' + t + ' 本轮无数据（信源限流），已校验空态不报错');
    } else {
      assert(rows.every((a) => /^https?:\/\//.test(a.getAttribute('href') || '')), t + ' 每条结果都外链到真实源站 URL');
      const ctx = grid ? grid.querySelector('.jn-disc-context-title') : null;
      assert(ctx && ctx.textContent.indexOf(t) >= 0, t + ' 上下文标题显示「实时发现 · ' + t + '」');
    }
  }

  // chip aggregation: boss chip should reflect type 招聘平台 count
  const bossChip = doc.querySelector('#home-disc-chips .jn-disc-chip[data-source="boss"]');
  assert(bossChip && bossChip.classList.contains('is-done'), '招聘平台 chip 点亮为 done');

  // ---- reset → 全部信源 ----
  const reset = doc.getElementById('home-disc-reset-cat');
  assert(!!reset, '存在「查看全部信源」重置入口');
  reset.click();
  await sleep(3600);
  const rowsAll = grid ? [...grid.querySelectorAll('a.jn-disc-row')] : [];
  const expectAll = Math.min(pj.data.items.length, MAX_ROWS);
  assert(rowsAll.length === expectAll, '重置后展示全部信源（上限 6 条）= ' + expectAll + ' 条 (实际 ' + rowsAll.length + ')');
  assert(lc && !lc.classList.contains('is-discovery-mode'), '重置后退出单信源视图');

  console.log('\nERRORS captured:', errors.length);
  errors.slice(0, 8).forEach((e) => console.log('  ! ' + e));
  if (errors.length) process.exitCode = 1;
  console.log(process.exitCode ? '\n==> TEST FAILED' : '\n==> TEST PASSED');
})();
