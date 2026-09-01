const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const out = path.join(__dirname, '../../frontend/_qa');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });

  // Seed user + resume + favs
  await page.goto('http://127.0.0.1:8888/pages/warehouse.html?v=20260826vault1', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('zhitu_user', JSON.stringify({ username: 'qa_user' }));
    const sections = [
      { id: 'basic', label: '个人信息', content: '王测\nJava 后端（杭州）\n电话：13900001111', ai_suggestion: '' },
      { id: 'education', label: '教育经历', content: '测试大学 · 软件工程 · 本科', ai_suggestion: '' },
      { id: 'projects', label: '项目经历', content: '校园商城 · 后端\nS · 需求\nT · 开发\nA · 实现\nR · 优化 30%', ai_suggestion: '' },
      { id: 'work', label: '工作经历', content: '暂无', ai_suggestion: '' },
      { id: 'skills', label: '专业技能', content: 'Java、Spring Boot', ai_suggestion: '' },
      { id: 'summary', label: '自我评价', content: '应届生，求职 Java 后端', ai_suggestion: '' }
    ];
    const payload = {
      id: 'VR-wizard-王测',
      source: 'resume-builder',
      updatedAt: Date.now(),
      fileName: '王测_简历.txt',
      size: 200,
      sections,
      text: sections.map((s) => '【' + s.label + '】\n' + s.content).join('\n\n')
    };
    // use vault API if loaded
    if (window.ZhituVault) {
      window.ZhituVault.saveMatchResume(payload);
      window.ZhituVault.toggleMatchFav({
        id: 'java-be', title: 'Java 后端开发', company: '某互联网大厂',
        city: '北京', salary: '25-45K', match_score: 88
      });
    } else {
      localStorage.setItem('zhitu_match_resume_v1', JSON.stringify(payload));
    }
    localStorage.setItem('jobnews_favs', JSON.stringify(['n1']));
    localStorage.setItem('jobnews_fav_meta', JSON.stringify({ n1: { title: 'AI 重塑人才市场', savedAt: Date.now() } }));
    localStorage.setItem('zhitu_disc_favs', JSON.stringify(['d1', 'f1']));
    localStorage.setItem('zhitu_disc_fav_meta', JSON.stringify({
      d1: { title: '提示词工程师', lane: 'found', conf: 0.82 },
      f1: { title: 'AI 合规官', lane: 'forecast', conf: 0.71 }
    }));
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const vaultCheck = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const nav = Array.from(document.querySelectorAll('[data-nav]'))
      .map((a) => a.getAttribute('data-nav'));
    return {
      hasWarehouseNav: nav.includes('warehouse'),
      hasNews: text.includes('AI 重塑人才市场'),
      hasDisc: text.includes('提示词工程师'),
      hasForecast: text.includes('AI 合规官'),
      hasMatch: text.includes('Java 后端开发'),
      userLine: document.getElementById('vault-user')?.textContent || '',
      resumeCount: (window.ZhituVault && window.ZhituVault.listVaultResumes().length) || 0
    };
  });
  console.log('VAULT', vaultCheck);
  await page.screenshot({ path: path.join(out, 'warehouse-favs.png'), fullPage: true });

  await page.click('.vault-tab[data-tab="resumes"]');
  await page.waitForTimeout(300);
  const resumeTab = await page.evaluate(() => ({
    resumes: document.querySelectorAll('.vault-resume').length,
    name: document.querySelector('.vault-resume-name')?.textContent || ''
  }));
  console.log('RESUMES', resumeTab);
  await page.screenshot({ path: path.join(out, 'warehouse-resumes.png'), fullPage: true });

  // Auto match from seeded resume
  await page.goto('http://127.0.0.1:8888/pages/match.html?v=20260826vault1&auto=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  const matchCheck = await page.evaluate(() => {
    const jobsView = document.getElementById('view-jobs');
    return {
      fileName: window.matchState && window.matchState.fileName,
      fromWizard: !!(window.matchState && window.matchState.file && window.matchState.file.fromWizard),
      jobsActive: !!(jobsView && jobsView.classList.contains('is-active')),
      jobCards: document.querySelectorAll('.job-card').length,
      stage: window.matchState && window.matchState.stage,
      hasResult: !!(window.matchState && window.matchState.result)
    };
  });
  console.log('AUTO_MATCH', matchCheck);
  await page.screenshot({ path: path.join(out, 'match-auto.png'), fullPage: true });

  // Fav second job (avoid toggling off seeded java-be)
  const favBtns = await page.$$('.job-fav');
  if (favBtns.length > 1) await favBtns[1].click();
  await page.waitForTimeout(200);

  await page.goto('http://127.0.0.1:8888/pages/warehouse.html?v=20260826vault1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const finalVault = await page.evaluate(() => {
    const snap = window.ZhituVault ? window.ZhituVault.snapshot() : null;
    return {
      userId: snap && snap.userId,
      resumeN: snap && snap.resumes && snap.resumes.length,
      matchFavN: snap && snap.favs && snap.favs.match && snap.favs.match.length,
      newsN: snap && snap.favs && snap.favs.news && snap.favs.news.length,
      navOk: !!document.querySelector('[data-nav="warehouse"].is-active, [data-nav="warehouse"].active, a[data-nav="warehouse"]')
    };
  });
  console.log('FINAL', finalVault);

  await b.close();
  const ok =
    vaultCheck.hasWarehouseNav &&
    vaultCheck.hasNews &&
    vaultCheck.hasDisc &&
    vaultCheck.hasForecast &&
    resumeTab.resumes >= 1 &&
    matchCheck.hasResult &&
    matchCheck.jobCards > 0 &&
    matchCheck.fromWizard &&
    finalVault.matchFavN >= 1;
  if (!ok) {
    console.error('QA_FAIL');
    process.exit(1);
  }
  console.log('QA_OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
