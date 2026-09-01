const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Forecast lane
  await page.goto('http://127.0.0.1:8890/pages/discovery-forecast.html', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(1500);
  const fc = await page.evaluate(() => ({
    title: document.querySelector('.df-title')?.textContent,
    hasEvolveLink: !!document.querySelector('a[href*="discovery-evolve"]'),
    howto: document.querySelector('.df-howto')?.innerText?.replace(/\s+/g, ' ').trim()
  }));
  console.log('forecast', JSON.stringify(fc, null, 2));
  await page.screenshot({ path: path.join(dir, 'lane-forecast-1440.png'), fullPage: false });

  await page.click('#df-go-detail');
  await page.waitForTimeout(1800);
  const detailPred = await page.evaluate(() => ({
    tag: document.getElementById('dd-tag')?.textContent,
    evolveHidden: !!document.getElementById('dd-open-evolve')?.hidden,
    backForecastVisible: !document.getElementById('dd-back-forecast')?.hidden,
    hasForecastCta: !!document.getElementById('dd-open-forecast')
  }));
  console.log('detail-pred', JSON.stringify(detailPred, null, 2));
  await page.screenshot({ path: path.join(dir, 'lane-detail-forecast-1440.png'), fullPage: false });

  // Real discovery detail
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
  await page.waitForTimeout(1500);
  const detailReal = await page.evaluate(() => ({
    tag: document.getElementById('dd-tag')?.textContent,
    evolveVisible: !document.getElementById('dd-open-evolve')?.hidden,
    backForecastHidden: !!document.getElementById('dd-back-forecast')?.hidden,
    hasForecastCta: !!document.getElementById('dd-open-forecast')
  }));
  console.log('detail-real', JSON.stringify(detailReal, null, 2));
  await page.screenshot({ path: path.join(dir, 'lane-detail-found-1440.png'), fullPage: false });

  // Evolve: no forecast CTA
  await page.goto('http://127.0.0.1:8890/pages/discovery-evolve.html?id=disc_mock_1', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(1500);
  const evolve = await page.evaluate(() => ({
    laneNote: document.querySelector('.de-lane-note')?.textContent,
    hasForecastBtn: !!document.getElementById('de-open-forecast'),
    hasForecastCrumb: !!document.getElementById('de-crumb-forecast'),
    sub: document.querySelector('.de-sub')?.textContent
  }));
  console.log('evolve', JSON.stringify(evolve, null, 2));
  await page.screenshot({ path: path.join(dir, 'lane-evolve-found-1440.png'), fullPage: false });

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
