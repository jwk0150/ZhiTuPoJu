const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const out = path.join(__dirname, '../../frontend/_qa');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:8888/pages/match.html?v=20260826vd1', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('zhitu_user', JSON.stringify({ username: 'developer' }));
    const mk = (name, createdAt, source, extra) => {
      const sections = [
        { id: 'basic', label: '个人信息', content: name + '\nIoT', ai_suggestion: '' },
        { id: 'education', label: '教育经历', content: '某高校', ai_suggestion: '' },
        { id: 'projects', label: '项目经历', content: '项目A', ai_suggestion: '' },
        { id: 'work', label: '工作经历', content: '—', ai_suggestion: '' },
        { id: 'skills', label: '专业技能', content: 'Java', ai_suggestion: '' },
        { id: 'summary', label: '自我评价', content: '求职', ai_suggestion: '' }
      ];
      const text = sections.map((s) => '【' + s.label + '】\n' + s.content).join('\n\n');
      const id = 'VR-' + name;
      const v1 = { id: id + '-v1', label: '初稿', source, createdAt, sections, text, fileName: name + '_简历.txt', parentVersionId: null };
      const item = {
        id,
        name: name + '_简历.txt',
        source,
        createdAt,
        updatedAt: createdAt + 1000,
        fileName: name + '_简历.txt',
        size: text.length,
        sections,
        text,
        versions: [v1],
        currentVersionId: v1.id
      };
      if (extra && extra.optimize) {
        const sections2 = sections.map((s) => s.id === 'basic' ? Object.assign({}, s, { content: name + '\n优化后' }) : s);
        const text2 = sections2.map((s) => '【' + s.label + '】\n' + s.content).join('\n\n');
        const v2 = {
          id: id + '-v2', label: '优化 v1', source: 'optimize', createdAt: createdAt + 5000,
          sections: sections2, text: text2, fileName: name + '_简历.txt', parentVersionId: v1.id
        };
        item.versions.push(v2);
        item.currentVersionId = v2.id;
        item.sections = sections2;
        item.text = text2;
        item.updatedAt = createdAt + 5000;
      }
      return item;
    };
    const list = [
      mk('早鸟', Date.now() - 86400000 * 3, 'resume-builder'),
      mk('123', Date.now() - 3600000, 'resume-builder', { optimize: true })
    ];
    const key = 'zhitu_vault_resumes_v1__developer';
    localStorage.setItem(key, JSON.stringify(list));
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const entry = await page.evaluate(() => ({
    refineBtn: !!document.getElementById('md-refine-toggle'),
    pickBtn: !!document.getElementById('md-pick-resume'),
    fileName: window.matchState && window.matchState.fileName,
    previewMode: document.getElementById('rw-grid')?.classList.contains('is-preview'),
    navHidden: document.getElementById('rw-col-nav')?.hidden,
    editorHidden: document.getElementById('rw-col-editor')?.hidden,
    hasEarlyBird: (document.getElementById('rw-preview')?.innerText || '').includes('早鸟')
  }));
  console.log('ENTRY', entry);
  await page.screenshot({ path: path.join(out, 'match-preview-only.png'), fullPage: true });

  await page.click('#md-pick-resume');
  await page.waitForTimeout(500);
  const drawer = await page.evaluate(() => ({
    open: document.getElementById('vault-drawer')?.classList.contains('is-open'),
    title: document.getElementById('vd-title')?.textContent,
    resumes: document.querySelectorAll('.vd-resume').length,
    underTop: (() => {
      const panel = document.querySelector('.vault-drawer-panel');
      if (!panel) return false;
      const top = panel.getBoundingClientRect().top;
      return top >= 50 && top <= 80;
    })()
  }));
  console.log('DRAWER', drawer);
  await page.screenshot({ path: path.join(out, 'vault-drawer-pick.png'), fullPage: true });

  // expand history on resume that has multiple versions
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('[data-vd-expand]'));
    const multi = btns.find((b) => /·\s*2|历史版本/.test(b.textContent || '') && (b.textContent || '').includes('2'));
    (multi || btns[btns.length - 1] || btns[0])?.click();
  });
  await page.waitForTimeout(300);
  const hist = await page.evaluate(() => document.querySelectorAll('.vd-ver').length);
  console.log('HIST', hist);
  await page.screenshot({ path: path.join(out, 'vault-history.png'), fullPage: true });

  // pick earliest via first 选用
  await page.click('.vd-btn--solid[data-vd-pick]');
  await page.waitForTimeout(400);
  const afterPick = await page.evaluate(() => ({
    drawerClosed: !document.getElementById('vault-drawer')?.classList.contains('is-open'),
    fileName: window.matchState && window.matchState.fileName,
    preview: (document.getElementById('rw-preview')?.innerText || '').slice(0, 40)
  }));
  console.log('AFTER_PICK', afterPick);

  // nav warehouse opens drawer browse
  await page.click('a[data-nav="warehouse"]');
  await page.waitForTimeout(500);
  const navVault = await page.evaluate(() => ({
    open: document.getElementById('vault-drawer')?.classList.contains('is-open'),
    urlStillMatch: /match\.html/.test(location.pathname),
    uploadBtn: !!document.getElementById('vd-upload-btn')
  }));
  console.log('NAV_VAULT', navVault);
  await page.screenshot({ path: path.join(out, 'vault-drawer-browse.png'), fullPage: true });

  await b.close();
  const ok =
    !entry.refineBtn &&
    entry.pickBtn &&
    entry.previewMode &&
    entry.navHidden &&
    entry.editorHidden &&
    entry.hasEarlyBird &&
    drawer.open &&
    drawer.underTop &&
    hist >= 2 &&
    navVault.open &&
    navVault.urlStillMatch &&
    navVault.uploadBtn;
  if (!ok) {
    console.error('QA_FAIL');
    process.exit(1);
  }
  console.log('QA_OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
