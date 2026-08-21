const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto('http://127.0.0.1:8888/pages/discovery.html', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(dir, 'discovery-proto-top-1440.png'), fullPage: false });
  const card = page.locator('#discovery-results .job-card').first();
  if (await card.count()) await card.click();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, 'discovery-proto-bottom-1440.png'), fullPage: false });
  const info = await page.evaluate(() => ({
    kpi: !!document.getElementById('kpi-discovered'),
    found: document.querySelectorAll('#discovery-grid .job-card').length,
    forecast: document.querySelectorAll('#forecast-grid .job-card').length,
    graph: !!document.querySelector('#disc-graph-chart canvas, #disc-graph-chart > div'),
    inlineTitle: document.getElementById('disc-inline-title')?.textContent || '',
    rail: !!document.getElementById('disc-rail-gauge'),
    exploreCols: getComputedStyle(document.getElementById('disc-explore')).gridTemplateColumns
  }));
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
