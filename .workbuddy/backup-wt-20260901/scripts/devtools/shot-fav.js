const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('http://127.0.0.1:8890/pages/discovery-detail.html?id=disc_mock_1', {
    waitUntil: 'networkidle'
  });
  await page.waitForTimeout(1200);

  const empty = await page.locator('#dd-fav-bar .dd-fav-bar-empty').count();
  console.log('empty state:', empty);

  await page.evaluate(() => {
    window.DiscoveryFavs.toggleFav('disc_mock_1', {
      title: 'AI 产品经理',
      lane: 'found',
      conf: 92
    });
    window.DiscoveryFavs.toggleFav('forecast_mock_1', {
      title: '空间计算架构师',
      lane: 'forecast',
      conf: 78
    });
    window.DiscoveryFavs.initBar({ activeId: 'disc_mock_1' });
  });
  await page.waitForTimeout(400);

  const chips = await page.locator('.dd-fav-chip').count();
  const active = await page.locator('.dd-fav-chip-wrap.is-active').count();
  const scrollH = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log('chips:', chips, 'active:', active, 'scrollHeight:', scrollH);

  await page.screenshot({ path: '../../frontend/_qa/disc-fav-v77.png', fullPage: false });

  await page.goto('http://127.0.0.1:8890/pages/discovery.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const listChips = await page.locator('#dd-fav-bar .dd-fav-chip').count();
  console.log('list page chips:', listChips);
  await page.screenshot({ path: '../../frontend/_qa/disc-fav-list-v77.png', fullPage: false });

  await browser.close();
})();
