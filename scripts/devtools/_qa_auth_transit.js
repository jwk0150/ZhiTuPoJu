const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const out = path.join(__dirname, '../../frontend/_qa');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8080/login.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.ZhituAuthTransit.go('pages/resume.html'));
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(out, 'auth-transit-exit.png') });
  await page.waitForURL('**/pages/resume.html', { timeout: 15000 });
  await page.waitForTimeout(280);
  await page.screenshot({ path: path.join(out, 'auth-transit-enter.png') });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, 'auth-transit-done.png') });
  const info = await page.evaluate(() => ({
    cls: document.documentElement.className,
    overlay: !!document.getElementById('zhitu-transit'),
    appOpacity: getComputedStyle(document.querySelector('.rb-app') || document.body).opacity
  }));
  console.log(JSON.stringify(info));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
