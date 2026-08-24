const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:8890/pages/discovery-forecast.html?id=disc_mock_1', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => ({
    title: document.querySelector('.df-title')?.textContent,
    howtoNow: document.querySelector('.df-howto li.is-now')?.textContent?.replace(/\s+/g, ' ').trim(),
    rows: document.querySelectorAll('.df-row').length,
    selected: document.querySelector('.df-row.is-selected .name')?.textContent,
    ctaEnabled: !document.getElementById('df-go-detail')?.disabled,
    whyHidden: document.getElementById('df-why-panel')?.hidden
  }));
  console.log(JSON.stringify(info, null, 2));

  await page.screenshot({ path: path.join(dir, 'discovery-forecast-ops-1440.png'), fullPage: false });

  await page.click('#df-toggle-why');
  await page.waitForTimeout(600);
  const whyOpen = await page.evaluate(() => !document.getElementById('df-why-panel')?.hidden);
  console.log('whyOpen', whyOpen);
  await page.screenshot({ path: path.join(dir, 'discovery-forecast-ops-why-1440.png'), fullPage: false });

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
