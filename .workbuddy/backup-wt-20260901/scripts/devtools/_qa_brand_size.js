const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const outDir = path.join(__dirname, '_shots');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8088/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1400);

  const measure = async () => page.evaluate(() => {
    const name = document.querySelector('.brand-name');
    const mark = document.querySelector('.brand-mark');
    const img = document.querySelector('.brand-mark-core img');
    const ns = getComputedStyle(name);
    return {
      phase: document.body.dataset.phase,
      nameColor: ns.color,
      nameSize: ns.fontSize,
      mark: getComputedStyle(mark).width,
      img: img?.getBoundingClientRect().width
    };
  });

  console.log('scene1', await measure());
  await page.screenshot({ path: path.join(outDir, 'brand-scene1-1440.png') });

  await page.mouse.click(720, 480);
  await page.waitForFunction(() => document.body.dataset.phase === 'scene2' || document.body.dataset.phase === 'transition', { timeout: 25000 });
  await page.waitForFunction(() => document.body.dataset.phase === 'scene2', { timeout: 25000 });
  await page.waitForTimeout(800);
  console.log('scene2', await measure());
  await page.screenshot({ path: path.join(outDir, 'brand-scene2-1440.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  console.log('scene2-mobile', await measure());
  await page.screenshot({ path: path.join(outDir, 'brand-scene2-390.png') });

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
