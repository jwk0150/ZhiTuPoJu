const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Found → detail → tab 05 embeds graph
  await page.goto('http://127.0.0.1:8890/pages/discovery-detail.html?id=disc_mock_1', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.evaluate(() => {
    sessionStorage.setItem(
      'zhitu_disc_job',
      JSON.stringify({
        id: 'disc_mock_1',
        title: 'AI Agent 架构师',
        confidence: 88,
        category: '人工智能',
        status: 'found'
      })
    );
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const foundHero = await page.evaluate(() => ({
    hasEvolveBtn: !!document.getElementById('dd-open-evolve'),
    evolveTabHidden: !!document.querySelector('.dd-tabs button[data-sec="evolve"]')?.hidden
  }));
  console.log('found-hero', foundHero);

  await page.click('.dd-tabs button[data-sec="evolve"]');
  await page.waitForTimeout(1200);
  const evolve = await page.evaluate(() => ({
    mode: document.getElementById('view-discovery-detail')?.getAttribute('data-mode'),
    nodes: document.querySelectorAll('#de-nodes .de-node').length,
    canvas: !!document.getElementById('de-canvas'),
    railHidden: getComputedStyle(document.querySelector('.dd-rail')).display === 'none'
  }));
  console.log('evolve-tab', evolve);
  await page.screenshot({ path: path.join(dir, 'detail-evolve-embed-1440.png'), fullPage: false });

  // Forecast → detail directly, no evolve tab
  await page.goto('http://127.0.0.1:8890/pages/discovery-detail.html?id=forecast_mock_1', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.evaluate(() => {
    sessionStorage.setItem(
      'zhitu_disc_job',
      JSON.stringify({
        id: 'forecast_mock_1',
        title: 'AI Agent 协作工程师',
        confidence: 92,
        category: '人工智能',
        is_forecast: true,
        status: 'forecast'
      })
    );
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const pred = await page.evaluate(() => ({
    tag: document.getElementById('dd-tag')?.textContent,
    evolveTabHidden: !!document.querySelector('.dd-tabs button[data-sec="evolve"]')?.hidden,
    hasEvolveBtn: !!document.getElementById('dd-open-evolve'),
    backHome: !document.getElementById('dd-back-home')?.hidden
  }));
  console.log('forecast-detail', pred);
  await page.screenshot({ path: path.join(dir, 'detail-forecast-direct-1440.png'), fullPage: false });

  // Old evolve URL redirects
  await page.goto('http://127.0.0.1:8890/pages/discovery-evolve.html?id=disc_mock_1', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(1500);
  console.log('redirect', page.url());

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
