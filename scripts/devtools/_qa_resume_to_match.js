const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const out = path.join(__dirname, '../../frontend/_qa');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });

  // 1) empty match
  await p.goto('http://127.0.0.1:8888/pages/match.html?v=20260826rx3', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => {
    localStorage.removeItem('zhitu_match_resume_v1');
    localStorage.removeItem('rb_builder_state_v2');
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  const empty = await p.evaluate(() => ({
    uploadHidden: document.getElementById('resume-upload-card')?.hidden,
    paper: document.querySelector('#rw-preview')?.innerText?.slice(0, 80),
    hasZhang: (document.body.innerText || '').includes('张三')
  }));
  console.log('EMPTY', empty);
  await p.screenshot({ path: path.join(out, 'match-empty.png') });

  // 2) wizard flow generate → match
  await p.goto('http://127.0.0.1:8888/pages/resume.html?embed=1&v=20260826rx3', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => {
    localStorage.removeItem('rb_builder_state_v2');
    localStorage.removeItem('zhitu_match_resume_v1');
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(500);

  // brandbar clutter gone?
  const brand = await p.evaluate(() => ({
    brand: document.querySelector('.rb-brand')?.innerText?.trim(),
    hasOnline: (document.body.innerText || '').includes('在线 ·'),
    hasDraft: (document.body.innerText || '').includes('草稿 ·'),
    meta: !!document.querySelector('.rb-brandbar-meta')
  }));
  console.log('BRAND', brand);

  // fill step1
  await p.fill('[data-bind="basicInfo.name"]', '王测');
  await p.fill('[data-bind="basicInfo.phone"]', '13900001111');
  await p.fill('[data-bind="basicInfo.email"]', 'w@test.com');
  await p.fill('[data-bind="basicInfo.city"]', '杭州');
  await p.fill('[data-bind="basicInfo.school"]', '测试大学');
  await p.fill('[data-bind="basicInfo.major"]', '软件工程');
  await p.selectOption('[data-bind="basicInfo.degree"]', '本科');
  await p.click('#rb-step-next');
  await p.waitForTimeout(400);

  // step2 pick job
  await p.waitForSelector('.rb-position');
  await p.click('.rb-position');
  await p.click('#rb-step-next');
  await p.waitForTimeout(400);

  // step3 experiences already has one
  await p.fill('.rb-exp input[placeholder="公司名或项目名"]', '校园项目').catch(() => {});
  // fill via evaluate if selectors differ
  await p.evaluate(() => {
    const inputs = document.querySelectorAll('.rb-exp input, .rb-exp textarea, .rb-exp select');
    inputs.forEach((el) => {
      if (el.tagName === 'SELECT') { el.value = '项目'; el.dispatchEvent(new Event('change', { bubbles: true })); }
      else if (el.placeholder && el.placeholder.includes('公司')) { el.value = '校园商城'; el.dispatchEvent(new Event('input', { bubbles: true })); }
      else if (el.placeholder && el.placeholder.includes('角色')) { el.value = '后端开发'; el.dispatchEvent(new Event('input', { bubbles: true })); }
      else if (el.tagName === 'TEXTAREA' && el.placeholder && el.placeholder.includes('做了什么')) {
        el.value = '负责订单接口开发'; el.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (el.tagName === 'TEXTAREA') {
        el.value = '接口响应优化 30%'; el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });
  await p.click('#rb-step-next');
  await p.waitForTimeout(3500); // polish animation

  // step4 → next after polish
  await p.click('#rb-step-next');
  await p.waitForTimeout(400);

  // step5 generate
  await p.click('#rb-step-next');
  await p.waitForTimeout(5500);

  const gen = await p.evaluate(() => ({
    success: !!document.querySelector('#rb-success.is-on'),
    matchKey: !!localStorage.getItem('zhitu_match_resume_v1'),
    goMatch: !!document.getElementById('rb-go-match'),
    payload: (() => {
      try { return JSON.parse(localStorage.getItem('zhitu_match_resume_v1') || 'null'); } catch { return null; }
    })()
  }));
  console.log('GEN', {
    success: gen.success,
    matchKey: gen.matchKey,
    goMatch: gen.goMatch,
    name: gen.payload && gen.payload.sections && gen.payload.sections[0] && gen.payload.sections[0].content
  });
  await p.screenshot({ path: path.join(out, 'resume-generated.png') });

  // 3) match with wizard resume
  await p.goto('http://127.0.0.1:8888/pages/match.html?v=20260826rx3b', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(700);
  const filled = await p.evaluate(() => ({
    uploadHidden: document.getElementById('resume-upload-card')?.hidden,
    paper: document.querySelector('#rw-preview')?.innerText?.slice(0, 120),
    tag: document.getElementById('resume-head-metrics')?.innerText,
    hasWang: (document.querySelector('#rw-preview')?.innerText || '').includes('王测')
  }));
  console.log('FILLED', filled);
  await p.screenshot({ path: path.join(out, 'match-from-wizard.png') });

  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
