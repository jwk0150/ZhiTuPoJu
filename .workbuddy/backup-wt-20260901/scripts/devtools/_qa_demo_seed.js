const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://127.0.0.1:8888/pages/match.html?v=20260826demo1', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => {
    localStorage.setItem('zhitu_user', JSON.stringify({ username: 'developer' }));
    Object.keys(localStorage).forEach((k) => {
      if (k.indexOf('zhitu_vault_demo_seeded') >= 0) localStorage.removeItem(k);
    });
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const m = await p.evaluate(() => {
    const text = (document.getElementById('rw-preview') || {}).innerText || '';
    return {
      fileName: window.matchState && window.matchState.fileName,
      isZhang: text.indexOf('张三') >= 0,
      isJava: text.indexOf('Java') >= 0,
      tag: (document.getElementById('resume-head-metrics') || {}).innerText || ''
    };
  });
  console.log('MATCH', m);

  await p.goto('http://127.0.0.1:8888/pages/warehouse.html?v=20260826demo1', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.click('.vault-tab[data-tab="resumes"]');
  await p.waitForTimeout(200);
  const w = await p.evaluate(() => {
    const names = Array.from(document.querySelectorAll('.vault-resume-name')).map((e) => e.textContent.trim());
    const ids = window.ZhituVault ? window.ZhituVault.listVaultResumes().map((r) => r.id) : [];
    return { names, n: names.length, ids };
  });
  console.log('WAREHOUSE', w);
  await b.close();
  const ok = m.isZhang && m.isJava && /Java/.test(m.fileName || '') && w.n >= 4 && w.ids.indexOf('VR-demo-java') >= 0;
  if (!ok) {
    console.error('FAIL');
    process.exit(1);
  }
  console.log('OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
