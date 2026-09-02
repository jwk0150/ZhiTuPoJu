const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:8888/pages/discovery-evolve.html?id=disc_mock_1', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  await page.waitForTimeout(2200);

  const info = await page.evaluate(() => ({
    title: document.getElementById('de-job-title')?.textContent,
    crumb: document.querySelector('.de-crumb')?.textContent?.replace(/\s+/g, ' ').trim(),
    nodes: document.querySelectorAll('.de-node').length,
    center: !!document.querySelector('.de-node.is-center'),
    pred: document.querySelectorAll('.de-node.is-pred').length,
    hist: document.querySelectorAll('.de-node.is-hist').length,
    hasBack: !!document.getElementById('de-back-btn')?.href?.includes('discovery-detail'),
    err: window.__deErr || null
  }));
  console.log(JSON.stringify(info, null, 2));

  await page.screenshot({
    path: path.join(dir, 'discovery-evolve-1440.png'),
    fullPage: false
  });

  await page.goto('http://127.0.0.1:8888/pages/discovery-detail.html?id=disc_mock_1', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  await page.waitForTimeout(1200);
  const href = await page.getAttribute('#dd-open-evolve', 'href');
  console.log('detail evolve href', href);

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
