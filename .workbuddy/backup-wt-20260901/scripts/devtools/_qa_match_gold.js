const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const out = path.join(__dirname, '../../frontend/_qa');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });

  await p.goto('http://127.0.0.1:8888/pages/match.html?v=20260826gold1', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => {
    localStorage.setItem('zhitu_match_resume_v1', JSON.stringify({
      source: 'resume-builder',
      fileName: '王测_简历.txt',
      size: 228,
      sections: [
        { id: 'basic', label: '个人信息', content: '王测\nJava开发工程师（杭州）\n电话：13900001111\n邮箱：w@test.com', ai_suggestion: '' },
        { id: 'education', label: '教育经历', content: '测试大学 · 软件工程 · 本科', ai_suggestion: '' },
        { id: 'projects', label: '项目经历', content: '校园商城 · 后端', ai_suggestion: '' },
        { id: 'work', label: '工作经历', content: '暂无', ai_suggestion: '' },
        { id: 'skills', label: '专业技能', content: 'Java、Spring Boot', ai_suggestion: '' },
        { id: 'summary', label: '自我评价', content: '希望从事后端开发', ai_suggestion: '' }
      ]
    }));
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(800);

  const info = await p.evaluate(() => ({
    guide: document.querySelector('#view-resume .wks-step-guide')?.innerText,
    previewOnly: document.getElementById('rw-grid')?.classList.contains('is-preview'),
    navHidden: document.getElementById('rw-col-nav')?.hidden,
    leftNavDisplay: getComputedStyle(document.getElementById('wks-leftnav')).display,
    cta: document.getElementById('md-start-match-top')?.innerText,
    refine: document.getElementById('md-refine-toggle')?.innerText,
    gold: getComputedStyle(document.documentElement).getPropertyValue('--rose').trim()
  }));
  console.log(JSON.stringify(info, null, 2));
  await p.screenshot({ path: path.join(out, 'match-gold-resume.png') });

  await p.click('#md-refine-toggle');
  await p.waitForTimeout(300);
  const refine = await p.evaluate(() => ({
    refineOn: document.getElementById('rw-grid')?.classList.contains('is-refine'),
    navHidden: document.getElementById('rw-col-nav')?.hidden
  }));
  console.log('REFINE', refine);
  await p.screenshot({ path: path.join(out, 'match-gold-refine.png') });

  await p.click('#md-start-match-top');
  await p.waitForTimeout(500);
  const matchV = await p.evaluate(() => ({
    guide: document.querySelector('#view-match .wks-step-guide')?.innerText,
    h1: document.querySelector('#view-match .wks-h1')?.innerText,
    activeProg: document.querySelector('.wks-prog-node.is-active')?.innerText
  }));
  console.log('MATCH', matchV);
  await p.screenshot({ path: path.join(out, 'match-gold-cond.png') });

  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
