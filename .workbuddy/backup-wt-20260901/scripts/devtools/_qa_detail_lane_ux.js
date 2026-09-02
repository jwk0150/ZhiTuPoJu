const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  async function loadJob(job) {
    await page.goto('http://127.0.0.1:8890/pages/discovery-detail.html?id=' + job.id, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.evaluate((j) => sessionStorage.setItem('zhitu_disc_job', JSON.stringify(j)), job);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
  }

  await loadJob({
    id: 'disc_mock_1',
    title: 'AI Agent 架构师',
    confidence: 88,
    category: '人工智能',
    status: 'found'
  });
  const found = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('#dd-tabs button')].filter((b) => !b.hidden);
    return {
      tabs: tabs.map((b) => b.innerText.replace(/\s+/g, ' ').trim()),
      etaHidden: !!document.getElementById('dd-eta')?.hidden,
      skillsOv: !document.getElementById('dd-card-skills-overview')?.hidden,
      trendOv: !document.getElementById('dd-card-trend-overview')?.hidden,
      firstLab: document.getElementById('dd-lab-first')?.textContent
    };
  });
  console.log('found', JSON.stringify(found, null, 2));
  await page.screenshot({ path: path.join(dir, 'detail-lane-found-ux-1440.png'), fullPage: false });

  await loadJob({
    id: 'forecast_mock_1',
    title: 'AI Agent 协作工程师',
    confidence: 92,
    category: '人工智能',
    is_forecast: true,
    status: 'forecast',
    eta_months: '8-12'
  });
  const pred = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('#dd-tabs button')].filter((b) => !b.hidden);
    return {
      tabs: tabs.map((b) => b.innerText.replace(/\s+/g, ' ').trim()),
      etaHidden: !!document.getElementById('dd-eta')?.hidden,
      etaVal: document.getElementById('dd-eta-value')?.textContent,
      skillsOv: !document.getElementById('dd-card-skills-overview')?.hidden,
      trendOv: !document.getElementById('dd-card-trend-overview')?.hidden,
      firstLab: document.getElementById('dd-lab-first')?.textContent,
      deriveHidden: !!document.getElementById('dd-rail-derived-card')?.hidden,
      guide: document.getElementById('dd-guide')?.innerText?.replace(/\s+/g, ' ').trim()
    };
  });
  console.log('forecast', JSON.stringify(pred, null, 2));
  await page.screenshot({ path: path.join(dir, 'detail-lane-forecast-ux-1440.png'), fullPage: false });

  await page.click('#dd-tabs button[data-sec="skills"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(dir, 'detail-lane-forecast-skills-1440.png'), fullPage: false });

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
