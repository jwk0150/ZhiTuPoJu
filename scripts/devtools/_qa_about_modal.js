const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const outDir = path.join(__dirname, '_shots');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8088/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  await page.mouse.click(720, 480);
  await page.waitForFunction(() => ['scene2', 'transition'].includes(document.body.dataset.phase), { timeout: 25000 });
  await page.waitForFunction(() => document.body.dataset.phase === 'scene2', { timeout: 25000 });
  await page.waitForSelector('.atlas-plate', { timeout: 10000 });
  await page.waitForTimeout(900);

  await page.click('.atlas-plate[data-project-id="talent-map"]');
  await page.waitForSelector('.project-modal-overlay.is-open', { timeout: 8000 });
  await page.waitForTimeout(1400);

  const info = await page.evaluate(() => {
    const overlay = document.getElementById('projectModal');
    return {
      open: overlay?.classList.contains('is-open'),
      title: document.getElementById('projectModalTitle')?.textContent,
      summary: document.getElementById('projectModalSummary')?.textContent,
      summaryLen: (document.getElementById('projectModalSummary')?.textContent || '').length,
      sections: [...document.querySelectorAll('.project-detail-section h4')].map((el) => el.textContent),
      demo: document.getElementById('projectModalDemo')?.textContent,
      github: !!document.getElementById('projectModalGithub')
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: path.join(outDir, 'about-modal-map-1440.png') });

  await page.click('#projectModalClose');
  await page.waitForFunction(() => !document.getElementById('projectModal')?.classList.contains('is-open'), { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.click('.atlas-plate[data-project-id="job-match"]');
  await page.waitForSelector('.project-modal-overlay.is-open', { timeout: 8000 });
  await page.waitForTimeout(1800);
  const summaryDone = await page.evaluate(() => (document.getElementById('projectModalSummary')?.textContent || '').length);
  console.log('matchSummaryLen', summaryDone);
  await page.screenshot({ path: path.join(outDir, 'about-modal-match-1440.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'about-modal-match-390.png') });

  const ok = info.open && info.title === '数字人才地图' && info.sections.includes('模块定位') && summaryDone > 20;
  console.log(ok ? 'PASS' : 'FAIL');
  await browser.close();
  if (!ok) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
