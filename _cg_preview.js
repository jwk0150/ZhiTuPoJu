const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('[CONSOLE.ERROR]', msg.text()); });
  page.on('pageerror', (err) => console.log('[PAGE.ERROR]', err.message));
  await page.goto('http://localhost:8666/pages/match.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.click('.wks-nav-item[data-nav="jobs"]');
  await page.waitForSelector('.cg-wrap', { timeout: 6000 });
  await page.waitForTimeout(1600); // 等待进场动画
  await page.screenshot({ path: '_cg_preview_default.png' });
  // 展开 Java 诊断
  await page.locator('.cg-item[data-skill="Java"]').first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: '_cg_preview_expanded.png' });
  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
