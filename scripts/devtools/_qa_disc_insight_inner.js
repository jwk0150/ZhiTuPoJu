const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(
    'http://127.0.0.1:8888/pages/discovery-detail.html?id=disc_mock_1&mod=duties&v=86mod10',
    { waitUntil: 'networkidle', timeout: 60000 }
  );
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => {
    const insight = document.querySelector('#dd-found-insight-col .dd-mod-insight.is-mod-active');
    const top = insight.querySelector('.dd-insight-top');
    const foot = insight.querySelector('.dd-insight-foot');
    const kids = [...top.children].map((el) => ({
      cls: el.className || el.tagName,
      h: Math.round(el.getBoundingClientRect().height),
      mt: getComputedStyle(el).marginTop
    }));
    return {
      insightH: Math.round(insight.getBoundingClientRect().height),
      topH: Math.round(top.getBoundingClientRect().height),
      topScroll: top.scrollHeight,
      topFlex: getComputedStyle(top).flex,
      footH: Math.round(foot.getBoundingClientRect().height),
      footMT: getComputedStyle(foot).marginTop,
      kids,
      gap: Math.round(top.getBoundingClientRect().height) - top.scrollHeight
    };
  });
  console.log(JSON.stringify(m, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
