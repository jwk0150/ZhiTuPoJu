const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const dir = path.join(__dirname, '../../frontend/_qa');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const shots = [
    ['overview', 'disc-mod7-found-overview.png'],
    ['skills', 'disc-mod7-found-skills.png'],
    ['duties', 'disc-mod7-found-duties.png'],
    ['trend', 'disc-mod7-found-trend.png'],
    ['supply', 'disc-mod7-found-supply.png']
  ];

  for (const [mod, file] of shots) {
    await page.goto(
      'http://127.0.0.1:8888/pages/discovery-detail.html?id=disc_mock_1&mod=' + mod + '&v=86mod7',
      { waitUntil: 'networkidle', timeout: 60000 }
    );
    await page.waitForTimeout(900);
    const bubbles = await page.locator('.dd-bubble-stat').count();
    const jumps = await page.locator('.dd-mod-jump').count();
    console.log(mod, 'stats', bubbles, 'jumps', jumps);
    await page.screenshot({ path: path.join(dir, file), fullPage: false });
  }

  await page.goto(
    'http://127.0.0.1:8888/pages/discovery-detail.html?id=forecast_mock_1&mod=overview&v=86mod7',
    { waitUntil: 'networkidle', timeout: 60000 }
  );
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(dir, 'disc-mod7-fc-overview.png'), fullPage: false });

  await page.click('#dd-fc-rail .dd-mod-btn[data-mod="evolve"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(dir, 'disc-mod7-fc-evolve.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    'http://127.0.0.1:8888/pages/discovery-detail.html?id=disc_mock_1&mod=overview&v=86mod7',
    { waitUntil: 'networkidle', timeout: 60000 }
  );
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(dir, 'disc-mod7-found-overview-390.png'), fullPage: false });

  await browser.close();
  console.log('done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
