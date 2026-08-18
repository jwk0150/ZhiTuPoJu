const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const outDir = path.join(__dirname, '_shots');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8088/?v=33', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(500);
  await page.mouse.click(720, 480);
  await page.waitForTimeout(800);
  await page.mouse.click(720, 480);
  await page.waitForFunction(() => document.body.dataset.phase === 'scene2', { timeout: 12000 });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(outDir, 'scene2-six-1440.png') });

  const scene2 = await page.evaluate(() => ({
    nav: [...document.querySelectorAll('.platform-nav .platform-link')].map((el) => el.textContent.trim()),
    hasWorkbench: [...document.querySelectorAll('.platform-nav .platform-link')].some((el) => el.textContent.includes('工作台')),
    titles: [...document.querySelectorAll('.atlas-title')].map((el) => el.textContent.trim()),
    names: [...document.querySelectorAll('.atlas-name')].map((el) => el.textContent.trim()),
    cards: document.querySelectorAll('.atlas-plate').length,
    glass: !!document.querySelector('.orb-core'),
    found: document.querySelector('.platform-status')?.innerText.replace(/\s+/g, ' ').trim(),
    bgFilter: getComputedStyle(document.querySelector('.bg-video.is-visible')).filter
  }));
  console.log('SCENE2', JSON.stringify(scene2, null, 2));

  await page.locator('.platform-enter').click();
  await page.waitForFunction(() => document.body.dataset.phase === 'scene3', { timeout: 20000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, 'scene3-login-1440.png') });
  const scene3 = await page.evaluate(() => ({
    phase: document.body.dataset.phase,
    title: document.getElementById('loginTitle')?.textContent,
    radius: getComputedStyle(document.querySelector('.login-card')).borderRadius,
    bg: getComputedStyle(document.querySelector('.login-card')).backgroundImage,
    submitRadius: getComputedStyle(document.querySelector('.login-submit')).borderRadius
  }));
  console.log('SCENE3', JSON.stringify(scene3, null, 2));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'scene3-login-390.png') });
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
