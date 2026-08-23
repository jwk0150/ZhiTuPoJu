const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(
    'http://127.0.0.1:8890/pages/discovery-detail.html?id=forecast_1&lane=forecast&v=18',
    { waitUntil: 'networkidle', timeout: 60000 }
  );
  await page.waitForTimeout(2200);

  const metrics = await page.evaluate(() => {
    const fc = document.getElementById('dd-forecast-shell');
    const found = document.getElementById('dd-found');
    return {
      title: document.getElementById('dd-fc-title')?.textContent,
      conf: document.getElementById('dd-fc-conf')?.textContent,
      fcHidden: fc?.hidden,
      foundHidden: found?.hidden,
      isForecast: document.getElementById('view-discovery-detail')?.classList.contains('is-forecast'),
      skillCount: document.querySelectorAll('#dd-fc-skills .dd-fc-skill').length,
      dutyCount: document.querySelectorAll('#dd-fc-duties li').length,
      hasFav: !!document.getElementById('dd-fc-fav'),
      hasCompare: !!document.getElementById('dd-fc-compare'),
      hasTabs: !!document.querySelector('#dd-forecast-shell .dd-tabs')
    };
  });
  console.log(JSON.stringify(metrics, null, 2));

  await page.screenshot({
    path: path.join(dir, 'discovery-forecast-unified-1440.png'),
    fullPage: false
  });

  await page.click('#dd-fc-compare');
  await page.waitForTimeout(500);
  const modalOpen = await page.evaluate(() => !document.getElementById('dd-resume-modal')?.hidden);
  console.log('resume modal', modalOpen);
  await page.screenshot({
    path: path.join(dir, 'discovery-forecast-resume-compare-1440.png'),
    fullPage: false
  });

  await browser.close();
  if (metrics.fcHidden || !metrics.foundHidden || !metrics.isForecast) {
    console.error('FAIL: forecast board not shown');
    process.exit(2);
  }
  if (!metrics.hasFav || !metrics.hasCompare || metrics.hasTabs) {
    console.error('FAIL: actions/tabs');
    process.exit(2);
  }
  if (!modalOpen) {
    console.error('FAIL: resume compare modal');
    process.exit(2);
  }
  console.log('PASS: forecast unified board');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
