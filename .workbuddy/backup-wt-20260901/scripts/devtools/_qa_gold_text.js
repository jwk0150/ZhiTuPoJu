const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const outDir = path.join(__dirname, '_shots');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8088/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1200);

  const sample = async () => page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return { sel, color: getComputedStyle(el).color, text: (el.textContent || '').trim().slice(0, 24) };
    };
    return {
      phase: document.body.dataset.phase,
      body: getComputedStyle(document.body).color,
      brand: pick('.brand-name'),
      welcome: pick('.welcome-brand'),
      kicker: pick('.welcome-kicker'),
      lead: pick('.welcome-lead'),
      link: pick('.platform-link'),
      enter: pick('.platform-enter'),
      h2: pick('.section-header h2'),
      type: pick('#introTypewriter'),
      about: pick('.about-kicker'),
      login: pick('.login-card h2'),
      status: pick('.platform-status')
    };
  });

  console.log('s1', JSON.stringify(await sample(), null, 2));
  await page.screenshot({ path: path.join(outDir, 'goldtext-scene1-1440.png') });

  await page.mouse.click(720, 480);
  await page.waitForFunction(() => ['scene2', 'transition'].includes(document.body.dataset.phase), { timeout: 25000 });
  await page.waitForFunction(() => document.body.dataset.phase === 'scene2', { timeout: 25000 });
  await page.waitForTimeout(1600);
  console.log('s2', JSON.stringify(await sample(), null, 2));
  await page.screenshot({ path: path.join(outDir, 'goldtext-scene2-1440.png') });

  await page.click('.platform-enter', { force: true });
  await page.waitForFunction(() => ['scene3', 'transition-2-3'].includes(document.body.dataset.phase), { timeout: 25000 });
  if (await page.evaluate(() => document.body.dataset.phase === 'transition-2-3')) {
    await page.mouse.wheel(0, 900);
  }
  await page.waitForFunction(() => document.body.dataset.phase === 'scene3', { timeout: 25000 });
  await page.waitForTimeout(900);
  console.log('s3', JSON.stringify(await sample(), null, 2));
  await page.screenshot({ path: path.join(outDir, 'goldtext-scene3-1440.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'goldtext-scene3-390.png') });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
