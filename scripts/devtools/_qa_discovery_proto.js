const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const out = path.join(__dirname, '_shots', 'discovery-proto-structure-1440.png');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto('http://127.0.0.1:8888/pages/discovery.html', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1800);
  // click first job card if present
  const card = page.locator('#discovery-results .job-card').first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(600);
  }
  // scroll explore into view for full structure shot
  await page.evaluate(() => {
    document.getElementById('disc-explore')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: out, fullPage: true });
  console.log('wrote', out);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
