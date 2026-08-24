const { chromium } = require('playwright');

const PAGES = [
  '/pages/news/index.html',
  '/pages/map.html',
  '/pages/insight.html',
  '/pages/discovery.html',
  '/pages/match.html',
  '/pages/home.html',
  '/pages/more/data.html',
  '/pages/discovery-detail.html?id=disc_mock_1'
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const rows = [];

  for (const path of PAGES) {
    const t0 = Date.now();
    await page.goto('http://127.0.0.1:8080' + path, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    await page.waitForTimeout(2200);
    const info = await page.evaluate(() => {
      const v = document.querySelector('.cinema-bg-video');
      const imgs = Array.from(document.images || []).filter((i) => i.complete && i.naturalWidth);
      let imgBytes = 0;
      imgs.forEach((i) => {
        imgBytes += (i.naturalWidth * i.naturalHeight * 4) / (1024 * 1024);
      });
      return {
        staticBg: !!(document.querySelector('.cinema-bg.is-static')),
        hasVideoEl: !!v,
        videoSrc: !!(v && (v.getAttribute('src') || v.src)),
        echarts: typeof window.echarts !== 'undefined',
        g6: typeof window.G6 !== 'undefined',
        heapMB: performance.memory
          ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1)
          : null,
        estDecodedImgMB: +imgBytes.toFixed(1),
        imgCount: imgs.length
      };
    });
    rows.push({ path, readyMs: Date.now() - t0, ...info });
  }

  // rapid nav stress
  const navT0 = Date.now();
  await page.goto('http://127.0.0.1:8080/pages/news/index.html', { waitUntil: 'domcontentloaded' });
  await page.goto('http://127.0.0.1:8080/pages/map.html', { waitUntil: 'domcontentloaded' });
  await page.goto('http://127.0.0.1:8080/pages/match.html', { waitUntil: 'domcontentloaded' });
  await page.goto('http://127.0.0.1:8080/pages/insight.html', { waitUntil: 'domcontentloaded' });
  const navMs = Date.now() - navT0;

  console.log(JSON.stringify({ rows, navRoundtripMs: navMs }, null, 2));
  await browser.close();
})();
