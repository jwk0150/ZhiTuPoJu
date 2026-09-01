const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('http://127.0.0.1:8890/pages/discovery-detail.html?id=disc_mock_1', {
    waitUntil: 'networkidle',
    timeout: 15000
  });
  await page.waitForTimeout(2500);
  const el = await page.$('.dd-panel-cmp');
  if (el) await el.screenshot({ path: '../../frontend/_qa/disc-cmp-issue.png' });
  await page.screenshot({ path: '../../frontend/_qa/disc-cmp-full.png', fullPage: false });
  await browser.close();
})();
