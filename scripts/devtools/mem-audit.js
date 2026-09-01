const { chromium } = require('playwright');

const PAGES = [
  '/pages/news/index.html',
  '/pages/map.html',
  '/pages/insight.html',
  '/pages/discovery.html',
  '/pages/match.html',
  '/pages/home.html',
  '/pages/more/data.html',
  '/pages/qa.html'
];

(async () => {
  const browser = await chromium.launch({
    args: ['--enable-precise-memory-info', '--js-flags=--expose-gc']
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const rows = [];

  async function mem() {
    try {
      await cdp.send('Performance.enable');
    } catch (_) {}
    const m = await cdp.send('Performance.getMetrics');
    const map = Object.fromEntries(m.metrics.map((x) => [x.name, x.value]));
    const jsHeap = (map.JSHeapUsedSize || 0) / (1024 * 1024);
    const nodes = map.Nodes || 0;
    const listeners = map.JSEventListeners || 0;
    let perfMem = null;
    try {
      perfMem = await page.evaluate(() => {
        const p = performance.memory;
        if (!p) return null;
        return {
          usedMB: +(p.usedJSHeapSize / 1048576).toFixed(1),
          totalMB: +(p.totalJSHeapSize / 1048576).toFixed(1),
          limitMB: +(p.jsHeapSizeLimit / 1048576).toFixed(1)
        };
      });
    } catch (_) {}
    return {
      jsHeapMB: +jsHeap.toFixed(1),
      nodes,
      listeners,
      perfMem
    };
  }

  for (const path of PAGES) {
    const t0 = Date.now();
    await page.goto('http://127.0.0.1:8080' + path, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    await page.waitForTimeout(2500);
    const m = await mem();
    rows.push({
      path,
      readyMs: Date.now() - t0,
      ...m,
      hasVideo: await page.evaluate(() => !!document.querySelector('.cinema-bg-video[src], .cinema-bg-video source')),
      videoPlaying: await page.evaluate(() => {
        const v = document.querySelector('.cinema-bg-video');
        return !!(v && !v.paused && v.readyState >= 2);
      }),
      echarts: await page.evaluate(() => typeof window.echarts !== 'undefined'),
      g6: await page.evaluate(() => typeof window.G6 !== 'undefined')
    });
  }

  console.log(JSON.stringify(rows, null, 2));
  await browser.close();
})();
