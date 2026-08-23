const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8888/pages/discovery.html', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2200);

  const metrics = await page.evaluate(() => {
    const main = document.getElementById('page-main');
    const shell = document.querySelector('.disc-proto-shell');
    const ws = document.getElementById('disc-workspace');
    const bodyScroll = document.documentElement.scrollHeight > window.innerHeight + 2;
    const mainScroll = main ? main.scrollHeight > main.clientHeight + 4 : null;
    return {
      vh: window.innerHeight,
      bodyScroll,
      mainClient: main?.clientHeight,
      mainScrollH: main?.scrollHeight,
      mainOverflow: main ? getComputedStyle(main).overflow : null,
      shellH: shell?.clientHeight,
      wsH: ws?.clientHeight,
      browsePane: document.getElementById('disc-browse')?.getAttribute('data-pane'),
      kind: document.getElementById('disc-workspace')?.getAttribute('data-kind'),
      foundVisible: !document.getElementById('disc-sec-found')?.hidden,
      forecastHidden: !!document.getElementById('disc-sec-forecast')?.hidden,
      detailTitle: document.getElementById('disc-inline-title')?.textContent,
      cards: document.querySelectorAll('#discovery-grid .job-card').length
    };
  });
  console.log('LIST', JSON.stringify(metrics, null, 2));
  await page.screenshot({ path: path.join(dir, 'discovery-cockpit-list-1440.png'), fullPage: false });

  await page.click('.disc-mode-btn[data-mode="graph"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(dir, 'discovery-cockpit-graph-1440.png'), fullPage: false });

  await page.click('.disc-kind-btn[data-kind="forecast"]');
  await page.waitForTimeout(500);
  await page.click('.disc-mode-btn[data-mode="list"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, 'discovery-cockpit-forecast-1440.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, 'discovery-cockpit-390.png'), fullPage: false });

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
