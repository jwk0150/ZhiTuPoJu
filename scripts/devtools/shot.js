const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('http://127.0.0.1:8890/pages/discovery-detail.html?id=forecast_1&lane=forecast', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: '../../frontend/_qa/disc-fc-merged.png' });
  await browser.close();
})();
