const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(
    'http://127.0.0.1:8888/pages/discovery-detail.html?id=disc_mock_1&mod=duties&v=86mod10',
    { waitUntil: 'networkidle', timeout: 60000 }
  );
  await page.waitForTimeout(1000);
  const m = await page.evaluate(() => {
    const layout = document.getElementById('dd-found-mod-layout');
    const rail = layout && layout.querySelector('.dd-mod-rail');
    const stage = document.getElementById('dd-found-board');
    const col = document.getElementById('dd-found-insight-col');
    const insight = col && col.querySelector('.dd-mod-insight.is-mod-active');
    const panel = stage && stage.querySelector('[data-mod="duties"].is-mod-active');
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        h: Math.round(r.height),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        display: getComputedStyle(el).display,
        alignSelf: getComputedStyle(el).alignSelf
      };
    };
    return {
      layout: box(layout),
      layoutAI: layout && getComputedStyle(layout).alignItems,
      rail: box(rail),
      stage: box(stage),
      col: box(col),
      insight: insight
        ? Object.assign(box(insight), { scroll: insight.scrollHeight })
        : null,
      panel: box(panel),
      dutiesCount: document.querySelectorAll('#dd-found-duties .dd-fc-duty-item').length,
      deepH: insight
        ? [...insight.querySelectorAll('.dd-insight-deep-card')].map((c) =>
            Math.round(c.getBoundingClientRect().height)
          )
        : [],
      next: !!(insight && insight.querySelector('.dd-insight-next')),
      colChildren: col ? col.children.length : 0
    };
  });
  console.log(JSON.stringify(m, null, 2));
  await page.screenshot({
    path: path.join(__dirname, '../../frontend/_qa/disc-mod10-duties-tall.png'),
    fullPage: true
  });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
