const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('http://127.0.0.1:8890/pages/discovery-detail.html?id=disc_mock_1', {
    waitUntil: 'networkidle',
    timeout: 15000
  });
  await page.waitForTimeout(2800);
  const basics = await page.$('.dd-fc-basics');
  const cmp = await page.$('.dd-panel-cmp');
  if (basics) await basics.screenshot({ path: '../../frontend/_qa/disc-basics-v63.png' });
  if (cmp) await cmp.screenshot({ path: '../../frontend/_qa/disc-cmp-v63.png' });
  const info = await page.evaluate(() => {
    const scroll = document.getElementById('dd-found-basics-scroll');
    const brief = document.getElementById('dd-found-brief');
    return {
      lanes: document.querySelectorAll('.dd-cmp-lane').length,
      scrollH: scroll && scroll.scrollHeight,
      clientH: scroll && scroll.clientHeight,
      briefLines: brief ? brief.getBoundingClientRect().height : 0,
      hasMore: document.getElementById('dd-found-basics-scroll-wrap')?.classList.contains('has-more')
    };
  });
  console.log(JSON.stringify(info));
  await browser.close();
})();
