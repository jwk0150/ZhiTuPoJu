const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto('http://127.0.0.1:8888/pages/discovery-detail.html?id=disc_mock_1', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  await page.waitForTimeout(2000);

  const layout = await page.evaluate(() => {
    const compose = document.querySelector('.dd-compose');
    const cards = compose ? compose.querySelectorAll('.dd-card').length : 0;
    const evidence = document.querySelectorAll('.dd-ev').length;
    const metrics = document.querySelectorAll('.dd-metrics .dd-metric').length;
    return {
      composeCols: compose ? getComputedStyle(compose).gridTemplateColumns : null,
      cards,
      evidence,
      metrics,
      evidenceVisible: !document.getElementById('sec-evidence')?.hidden
    };
  });
  console.log(JSON.stringify(layout, null, 2));

  await page.screenshot({ path: path.join(dir, 'discovery-detail-proto-top-1440.png'), fullPage: false });
  await page.evaluate(() => window.scrollTo(0, 520));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, 'discovery-detail-proto-mid-1440.png'), fullPage: false });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, 'discovery-detail-proto-evidence-1440.png'), fullPage: false });

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
