const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8888/pages/discovery.html', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => ({
    title: document.querySelector('.dh-title')?.textContent,
    panels: document.querySelectorAll('.dh-panel').length,
    cards: document.querySelectorAll('.dh-card').length,
    hasGraph: !!document.getElementById('disc-graph-chart'),
    hasInline: !!document.getElementById('disc-inline-detail'),
    hasRail: !!document.querySelector('.disc-proto-rail'),
    drawerHidden: document.getElementById('disc-drawer')?.getAttribute('aria-hidden')
  }));
  console.log(JSON.stringify(info, null, 2));

  await page.screenshot({ path: path.join(dir, 'discovery-home-1440.png'), fullPage: false });
  await page.evaluate(() => window.scrollTo(0, 420));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, 'discovery-home-cards-1440.png'), fullPage: false });

  await page.locator('.dh-card').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, 'discovery-home-detail-drawer-1440.png'), fullPage: false });
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => window.closeDiscoveryDrawer && window.closeDiscoveryDrawer());

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, 'discovery-home-390.png'), fullPage: false });

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
