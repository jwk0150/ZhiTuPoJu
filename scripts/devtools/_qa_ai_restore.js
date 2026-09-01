const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const out = path.join(__dirname, '../../frontend/_qa');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });

  await p.goto('http://127.0.0.1:8888/pages/match.html?v=20260826ai1', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => {
    localStorage.setItem('zhitu_user', JSON.stringify({ username: 'developer' }));
    const sections = [
      { id: 'basic', label: '个人信息', content: '123\n物联网开发工程师（上海）\n电话：13800000000', ai_suggestion: '可补充期望城市与到岗时间。' },
      { id: 'education', label: '教育经历', content: '某211高校 · 软件工程 · 本科\n2025-06 毕业', ai_suggestion: '' },
      { id: 'projects', label: '项目经历', content: '经历 1\nS · 需求\nT · 开发\nA · 实现\nR · 稳定', ai_suggestion: '' },
      { id: 'work', label: '工作经历', content: '暂无', ai_suggestion: '' },
      { id: 'skills', label: '专业技能', content: 'Java、嵌入式', ai_suggestion: '' },
      { id: 'summary', label: '自我评价', content: '应届生', ai_suggestion: '' }
    ];
    const payload = {
      id: 'VR-123', source: 'resume-builder', fileName: '123_简历.txt', size: 1330,
      sections, text: sections.map((s) => '【' + s.label + '】\n' + s.content).join('\n\n'), updatedAt: Date.now()
    };
    if (window.ZhituVault) window.ZhituVault.saveMatchResume(payload);
    else localStorage.setItem('zhitu_match_resume_v1', JSON.stringify(payload));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(800);

  const m = await p.evaluate(() => {
    const ed = document.getElementById('rw-editor');
    const t = (ed && ed.innerText) || '';
    return {
      refine: document.getElementById('rw-grid')?.classList.contains('is-refine'),
      navHidden: document.getElementById('rw-col-nav')?.hidden,
      editorHidden: document.getElementById('rw-col-editor')?.hidden,
      hasAI: t.includes('亮点') || t.includes('AI'),
      fileName: window.matchState && window.matchState.fileName,
      noRefineToggle: !document.getElementById('md-refine-toggle'),
      pick: !!document.getElementById('md-pick-resume'),
      has123: ((document.getElementById('rw-preview') || {}).innerText || '').includes('123')
    };
  });
  console.log('MATCH', m);
  await p.screenshot({ path: path.join(out, 'match-ai-restore.png'), fullPage: true });

  await p.goto('http://127.0.0.1:8888/pages/warehouse.html?v=20260826ai1', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const w = await p.evaluate(() => ({
    fullTitle: !!document.querySelector('.vault-title'),
    drawer: !!document.getElementById('vault-drawer'),
    upload: !!document.getElementById('vault-upload-btn'),
    pageText: (document.querySelector('.vault-title') || {}).textContent || ''
  }));
  console.log('WAREHOUSE', w);
  await p.screenshot({ path: path.join(out, 'warehouse-full.png'), fullPage: true });

  await b.close();
  const ok = m.refine && !m.navHidden && !m.editorHidden && m.hasAI && m.fileName === '123_简历.txt' && m.noRefineToggle && m.has123 && w.fullTitle && !w.drawer && w.upload;
  if (!ok) {
    console.error('QA_FAIL');
    process.exit(1);
  }
  console.log('QA_OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
