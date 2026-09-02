const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:8888/pages/discovery-detail.html?id=disc_mock_1', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  await page.waitForTimeout(2200);

  const metrics = await page.evaluate(() => {
    const main = document.getElementById('page-main');
    return {
      title: document.getElementById('dd-title')?.textContent,
      guide: document.getElementById('dd-guide')?.textContent?.trim(),
      hasHero: !!document.querySelector('.dd-hero'),
      tabActive: document.querySelector('.dd-tabs button.is-active')?.textContent?.trim(),
      pager: document.getElementById('dd-skills-page-label')?.textContent,
      hint: document.getElementById('dd-skills-more-hint')?.textContent,
      bodyScroll: document.body.scrollHeight > document.body.clientHeight + 2,
      mainScroll: main ? main.scrollHeight > main.clientHeight + 2 : null,
      cta: document.querySelector('.dd-rail-cta-label')?.textContent
    };
  });
  console.log(JSON.stringify(metrics, null, 2));

  await page.screenshot({
    path: path.join(dir, 'discovery-detail-guided-1440.png'),
    fullPage: false
  });

  await page.click('.dd-tabs button[data-sec="skills"]');
  await page.waitForTimeout(500);
  const g2 = await page.evaluate(() => document.getElementById('dd-guide')?.textContent?.trim());
  console.log('skills guide:', g2);
  await page.screenshot({
    path: path.join(dir, 'discovery-detail-guided-skills-1440.png'),
    fullPage: false
  });

  await browser.close();
  if (metrics.bodyScroll || metrics.mainScroll) {
    console.error('FAIL: page scrolls');
    process.exit(2);
  }
  console.log('PASS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
