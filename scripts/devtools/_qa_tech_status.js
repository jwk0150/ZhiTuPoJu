const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8088/?cb=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.mouse.click(720, 480);
  await page.waitForFunction(() => document.body.dataset.phase === 'scene2', { timeout: 25000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(__dirname, '_shots/status-bar-1440.png') });

  await page.click('[data-project-id=talent-map]');
  await page.waitForSelector('.project-modal-overlay.is-open');
  await page.waitForTimeout(1400);
  const info = await page.evaluate(() => {
    const box = document.querySelector('.project-detail-section:has(#projectModalTech)');
    const tech = document.getElementById('projectModalTech');
    const tags = [...tech.querySelectorAll('span')];
    const br = box.getBoundingClientRect();
    const overflows = tags.some((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > br.bottom + 1 || r.right > br.right + 1;
    });
    return {
      count: tags.length,
      labels: tags.map((t) => t.textContent),
      overflows,
      status: document.querySelector('.platform-status')?.innerText.replace(/\s+/g, ' ').trim()
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: path.join(__dirname, '_shots/tech-six-fit-1440.png') });
  await browser.close();
  if (info.count < 5 || info.overflows) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
