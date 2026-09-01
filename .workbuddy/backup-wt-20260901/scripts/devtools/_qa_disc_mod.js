const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const dir = path.join(__dirname, '../../frontend/_qa');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:8888/pages/discovery-detail.html?id=disc_mock_1&mod=skills&v=86mod2', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  await page.waitForTimeout(1400);
  const n = await page.locator('#dd-found-skills .dd-skill-item').count();
  const w = await page
    .locator('#dd-found-skills .dd-skill-fill')
    .first()
    .evaluate((el) => getComputedStyle(el).width)
    .catch(() => null);
  console.log('skill items', n, 'first fill width', w);
  await page.screenshot({ path: path.join(dir, 'disc-mod-found-skills-fixed.png'), fullPage: false });

  await page.click('#dd-found-rail .dd-mod-btn[data-mod="trend"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(dir, 'disc-mod-found-trend-fixed.png'), fullPage: false });

  await page.goto('http://127.0.0.1:8888/pages/discovery-detail.html?id=forecast_mock_1&mod=skills&v=86mod2', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  await page.waitForTimeout(1400);
  const fn = await page.locator('#dd-fc-skills .dd-skill-item').count();
  console.log('fc skill items', fn);
  await page.screenshot({ path: path.join(dir, 'disc-mod-fc-skills-fixed.png'), fullPage: false });

  await browser.close();
  console.log('done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
