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
  await page.waitForTimeout(1800);

  const info = await page.evaluate(() => ({
    title: document.getElementById('dd-title')?.textContent,
    tag: document.getElementById('dd-tag')?.textContent,
    heat: document.getElementById('dd-heat')?.textContent,
    hasListGrid: !!document.querySelector('.dh-grid'),
    hasBigGraph: !!document.getElementById('disc-graph-chart'),
    panels: [...document.querySelectorAll('.dd-tabs button')].map((b) => b.textContent.trim())
  }));
  console.log(JSON.stringify(info, null, 2));

  await page.screenshot({ path: path.join(dir, 'discovery-detail-overview-1440.png'), fullPage: false });

  await page.click('.dd-tabs button[data-sec="skills"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, 'discovery-detail-skills-1440.png'), fullPage: false });

  await page.click('.dd-tabs button[data-sec="trend"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(dir, 'discovery-detail-trend-1440.png'), fullPage: false });

  await page.click('.dd-tabs button[data-sec="evidence"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, 'discovery-detail-evidence-1440.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('.dd-tabs button[data-sec="overview"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, 'discovery-detail-390.png'), fullPage: false });

  // homepage → detail navigation
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:8888/pages/discovery.html', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await Promise.all([
    page.waitForURL(/discovery-detail\.html/, { timeout: 8000 }),
    page.locator('.dh-card').first().click()
  ]);
  await page.waitForTimeout(800);
  console.log('nav ok', page.url());
  await page.screenshot({ path: path.join(dir, 'discovery-detail-from-home-1440.png'), fullPage: false });

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
