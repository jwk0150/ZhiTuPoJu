const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:8890/pages/discovery-detail.html?id=disc_mock_1&v=17', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  await page.waitForTimeout(1800);

  const metrics = await page.evaluate(() => {
    const found = document.getElementById('dd-found');
    const forecast = document.getElementById('dd-forecast-shell');
    const skills = document.querySelectorAll('#dd-found-skills .dd-found-skill');
    const duties = document.querySelectorAll('#dd-found-duties li');
    const firstSkill = skills[0]?.textContent || '';
    return {
      title: document.getElementById('dd-found-title')?.textContent,
      heat: document.getElementById('dd-found-heat')?.textContent,
      growth: document.getElementById('dd-found-meta')?.textContent,
      level: document.querySelector('#dd-found-basics dd')?.parentElement?.textContent,
      basics: [...document.querySelectorAll('#dd-found-basics > div')].map((d) => d.textContent),
      firstSkill,
      foundHidden: found?.hidden,
      forecastHidden: forecast?.hidden,
      skillCount: skills.length,
      dutyCount: duties.length,
      isFound: document.getElementById('view-discovery-detail')?.classList.contains('is-found')
    };
  });
  console.log(JSON.stringify(metrics, null, 2));

  await page.screenshot({
    path: path.join(dir, 'discovery-found-unified-1440.png'),
    fullPage: false
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(dir, 'discovery-found-unified-390.png'),
    fullPage: true
  });

  await browser.close();

  if (metrics.foundHidden || !metrics.forecastHidden) {
    console.error('FAIL: found board not shown');
    process.exit(2);
  }
  if (metrics.skillCount < 8 || metrics.dutyCount < 5) {
    console.error('FAIL: incomplete panels');
    process.exit(2);
  }
  if (metrics.hasTabs) {
    console.error('FAIL: tabs still in found lane');
    process.exit(2);
  }
  console.log('PASS: found unified board');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
