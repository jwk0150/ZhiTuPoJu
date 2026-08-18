const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const outDir = path.join(__dirname, '_shots');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8088/?v=30', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(500);
  await page.mouse.click(720, 480);
  await page.waitForTimeout(800);
  await page.mouse.click(720, 480);
  await page.waitForFunction(() => document.body.dataset.phase === 'scene2', { timeout: 12000 });
  await page.waitForTimeout(1400);

  const info = await page.evaluate(() => {
    const h2 = document.getElementById('work-title');
    const kicker = document.querySelector('.about-kicker');
    const tiles = [...document.querySelectorAll('.about-matrix .project-card')];
    const lead = document.getElementById('introTypewriter');
    const kr = kicker.getBoundingClientRect();
    const matrix = document.querySelector('.about-matrix').getBoundingClientRect();
    const leadStyle = getComputedStyle(document.querySelector('.platform-lead'));
    return {
      phase: document.body.dataset.phase,
      h2: h2.innerText,
      typed: lead?.textContent,
      typedLines: (lead?.textContent || '').split('\n').length,
      leadAlign: leadStyle.textAlign,
      leadWhiteSpace: leadStyle.whiteSpace,
      kicker: kicker?.textContent,
      kickerSize: getComputedStyle(kicker).fontSize,
      kickerX: Math.round(kr.left),
      kickerRight: Math.round(kr.right),
      tiles: tiles.map((el) => el.querySelector('.orb-label')?.textContent),
      tileCount: tiles.length,
      hasLines: !!document.querySelector('.constellation-links'),
      matrixTop: Math.round(matrix.top),
      kickerBottom: Math.round(kr.bottom),
      row: tiles.length ? Math.abs(tiles[0].getBoundingClientRect().top - tiles[tiles.length - 1].getBoundingClientRect().top) < 8 : false,
      bgFilter: getComputedStyle(document.querySelector('.bg-video.is-visible')).filter
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: path.join(outDir, 'scene2-about-1440.png') });

  await page.waitForTimeout(3800);
  await page.screenshot({ path: path.join(outDir, 'scene2-about-done-1440.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'scene2-about-390.png') });
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
