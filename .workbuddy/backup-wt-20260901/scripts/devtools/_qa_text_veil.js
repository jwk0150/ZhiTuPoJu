const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const outDir = path.join(__dirname, '_shots');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8088/?cb=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(outDir, 'veil-scene1-1440.png') });

  await page.mouse.click(720, 480);
  await page.waitForFunction(() => document.body.dataset.phase === 'scene2', { timeout: 25000 });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(outDir, 'veil-scene2-1440.png') });

  await page.click('.platform-enter', { force: true });
  await page.waitForFunction(() => ['scene3', 'transition-2-3'].includes(document.body.dataset.phase), { timeout: 25000 });
  if (await page.evaluate(() => document.body.dataset.phase === 'transition-2-3')) {
    await page.mouse.wheel(0, 900);
  }
  await page.waitForFunction(() => document.body.dataset.phase === 'scene3', { timeout: 25000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, 'veil-scene3-1440.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'veil-scene3-390.png') });
  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
