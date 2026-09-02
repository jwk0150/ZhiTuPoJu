const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const dir = path.join(__dirname, '../../frontend/_qa');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  async function measure(label) {
    const m = await page.evaluate(() => {
      const docH = document.documentElement.scrollHeight;
      const bodyH = document.body.scrollHeight;
      const board = document.querySelector('#dd-found-board.dd-mod-stage, #dd-fc-board.dd-mod-stage');
      const shell = document.querySelector('.dd-fc-duties-shell');
      const rowH = shell && getComputedStyle(shell).getPropertyValue('--dd-duty-row-h');
      const insight = document.querySelector('.dd-mod-insight-col > .dd-mod-insight.is-mod-active, .dd-mod-insight-col > .dd-mod-insight:not([hidden])');
      const deeper = document.querySelectorAll('.dd-insight-deep-card').length;
      const duties = document.querySelectorAll('.dd-fc-duty-item').length;
      const staticShell = !!(shell && shell.classList.contains('is-mod-static'));
      return {
        docH,
        bodyH,
        boardH: board ? board.getBoundingClientRect().height : 0,
        rowH: (rowH || '').trim(),
        deeper,
        duties,
        staticShell,
        insightH: insight ? insight.getBoundingClientRect().height : 0,
        insightScroll: insight ? insight.scrollHeight : 0
      };
    });
    console.log(label, JSON.stringify(m));
    return m;
  }

  // Duties: the previous blowup case
  await page.goto(
    'http://127.0.0.1:8888/pages/discovery-detail.html?id=disc_mock_1&mod=duties&v=86mod9',
    { waitUntil: 'networkidle', timeout: 60000 }
  );
  await page.waitForTimeout(1000);
  const dutiesM = await measure('found-duties');
  await page.screenshot({ path: path.join(dir, 'disc-mod9-found-duties.png'), fullPage: false });

  await page.click('#dd-found-rail .dd-mod-btn[data-mod="overview"]');
  await page.waitForTimeout(600);
  await measure('found-overview');
  await page.screenshot({ path: path.join(dir, 'disc-mod9-found-overview.png'), fullPage: false });

  await page.click('#dd-found-rail .dd-mod-btn[data-mod="skills"]');
  await page.waitForTimeout(600);
  await measure('found-skills');
  await page.screenshot({ path: path.join(dir, 'disc-mod9-found-skills.png'), fullPage: false });

  await page.click('#dd-found-rail .dd-mod-btn[data-mod="supply"]');
  await page.waitForTimeout(600);
  await measure('found-supply');
  await page.screenshot({ path: path.join(dir, 'disc-mod9-found-supply.png'), fullPage: false });

  // Click into duties from overview to catch switch path
  await page.click('#dd-found-rail .dd-mod-btn[data-mod="duties"]');
  await page.waitForTimeout(800);
  const duties2 = await measure('found-duties-switch');
  await page.screenshot({ path: path.join(dir, 'disc-mod9-found-duties-switch.png'), fullPage: false });

  await page.goto(
    'http://127.0.0.1:8888/pages/discovery-detail.html?id=forecast_mock_1&mod=duties&v=86mod9',
    { waitUntil: 'networkidle', timeout: 60000 }
  );
  await page.waitForTimeout(900);
  await measure('fc-duties');
  await page.screenshot({ path: path.join(dir, 'disc-mod9-fc-duties.png'), fullPage: false });

  await browser.close();

  if (dutiesM.docH > 5000 || duties2.docH > 5000) {
    console.error('FAIL: duties page height exploded');
    process.exit(2);
  }
  if (!dutiesM.staticShell) {
    console.error('FAIL: duties shell not static');
    process.exit(3);
  }
  if (dutiesM.deeper < 2) {
    console.error('FAIL: insight deeper too thin');
    process.exit(4);
  }
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
