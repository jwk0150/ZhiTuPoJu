const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:8888/pages/discovery-detail.html?id=disc_mock_1', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  await page.waitForTimeout(2000);

  const metrics = await page.evaluate(() => {
    const body = document.body;
    const main = document.getElementById('page-main');
    const skills = document.getElementById('dd-skills');
    const pager = document.getElementById('dd-skills-pager');
    const scrollEl = document.getElementById('dd-skills-scroll');
    return {
      title: document.getElementById('dd-title')?.textContent,
      bodyOverflow: getComputedStyle(body).overflow,
      bodyScroll: body.scrollHeight > body.clientHeight + 2,
      mainScroll: main ? main.scrollHeight > main.clientHeight + 2 : null,
      mainClientH: main?.clientHeight,
      mainScrollH: main?.scrollHeight,
      skillRows: skills?.querySelectorAll('.dd-skill').length || 0,
      pagerHidden: pager?.hidden ?? null,
      pagerLabel: document.getElementById('dd-skills-page-label')?.textContent,
      skillsScrollable: scrollEl ? scrollEl.scrollHeight > scrollEl.clientHeight + 2 : null
    };
  });
  console.log(JSON.stringify(metrics, null, 2));

  await page.screenshot({
    path: path.join(dir, 'discovery-detail-cockpit-1440.png'),
    fullPage: false
  });

  if (!metrics.pagerHidden) {
    await page.click('#dd-skills-pager button[data-skills-page="1"]');
    await page.waitForTimeout(400);
    const page2 = await page.evaluate(() => ({
      label: document.getElementById('dd-skills-page-label')?.textContent,
      skillRows: document.querySelectorAll('#dd-skills .dd-skill').length
    }));
    console.log('skills page2', page2);
    await page.screenshot({
      path: path.join(dir, 'discovery-detail-skills-page2-1440.png'),
      fullPage: false
    });
  }

  await browser.close();
  if (metrics.bodyScroll || metrics.mainScroll) {
    console.error('FAIL: page still scrolls vertically');
    process.exit(2);
  }
  console.log('PASS: no page scroll');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
