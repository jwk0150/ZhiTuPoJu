const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('http://127.0.0.1:8890/pages/discovery-detail.html?id=disc_mock_1', {
    waitUntil: 'networkidle',
    timeout: 15000
  });
  await page.waitForTimeout(3500);
  const el = await page.$('.dd-fc-skills');
  if (el) await el.screenshot({ path: '../../frontend/_qa/disc-skills-v70.png' });
  const info = await page.evaluate(() => ({
    sh: document.body.scrollHeight,
    vh: window.innerHeight,
    items: document.querySelectorAll('.dd-skill-item').length,
    tracks: document.querySelectorAll('.dd-skill-track').length,
    fills: document.querySelectorAll('.dd-skill-fill').length,
    gsap: !!window.gsap
  }));
  console.log(JSON.stringify(info));
  await browser.close();
})();
