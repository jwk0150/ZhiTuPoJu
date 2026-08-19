const { chromium } = require('playwright');
const path = require('path');
const outDir = path.join(__dirname, '_shots');
const fs = require('fs');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8088/?v=27', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'scene1-logo-1440.png'), animations: 'disabled' });
  const scene1Logo = await page.evaluate(() => {
    const mark = document.querySelector('.brand-mark');
    const r = mark.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), font: getComputedStyle(document.querySelector('.brand-name')).fontSize };
  });

  await page.evaluate(async () => {
    document.body.dataset.phase = 'scene2';
    const track = document.getElementById('contentTrack');
    if (track) {
      track.classList.remove('is-moving');
      track.style.transition = 'none';
      track.style.transform = 'translate3d(-100vw, 0, 0)';
    }
    document.querySelectorAll('.bg-video').forEach((v) => v.classList.remove('is-visible'));
    const idle = document.getElementById('scene2IdleVideo');
    const scene2 = document.getElementById('scene2Video');
    const v = idle || scene2;
    if (v) {
      v.classList.add('is-visible');
      v.muted = true;
      try { v.currentTime = 1.2; } catch (_) {}
      try { await v.play(); } catch (_) {}
    }
  });

  await page.waitForTimeout(1400);
  const info = await page.evaluate(() => ({
    phase: document.body.dataset.phase,
    nav: !!document.querySelector('.platform-nav'),
    navDisplay: getComputedStyle(document.querySelector('.platform-nav')).display,
    statusDisplay: getComputedStyle(document.querySelector('.platform-status')).display,
    titles: [...document.querySelectorAll('.orb-label')].map((el) => el.textContent.trim()),
    about: document.querySelector('.about-kicker')?.textContent.trim(),
    radius: getComputedStyle(document.querySelector('.orb-core')).borderRadius,
    size: getComputedStyle(document.querySelector('.orb-core')).width,
    bgFilter: getComputedStyle(document.querySelector('.bg-video.is-visible')).filter,
    logo: (() => {
      const mark = document.querySelector('.brand-mark');
      const r = mark.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), font: getComputedStyle(document.querySelector('.brand-name')).fontSize };
    })()
  }));
  console.log('scene1Logo', JSON.stringify(scene1Logo));
  console.log(JSON.stringify(info, null, 2));

  await page.screenshot({ path: path.join(outDir, 'scene2-platform-1440.png'), animations: 'disabled' });

  const insight = page.locator('.project-card[data-project-id="job-insight"]');
  await insight.hover({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'scene2-hover-1440.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'scene2-platform-390.png'), animations: 'disabled' });

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
