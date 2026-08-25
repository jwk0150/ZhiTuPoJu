const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const blobFetches = [];
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('scene3.mp4')) blobFetches.push({ type: req.resourceType(), u });
  });

  const t0 = Date.now();
  await page.goto('http://127.0.0.1:8080/pages/news/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const newsReady = Date.now() - t0;

  const t1 = Date.now();
  await page.goto('http://127.0.0.1:8080/pages/map.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const mapReady = Date.now() - t1;

  await page.waitForTimeout(1500);
  const hasBlobBoot = await page.evaluate(() => {
    const v = document.querySelector('.cinema-bg-video');
    return {
      src: v ? (v.getAttribute('src') || v.src || '').slice(0, 80) : null,
      isBlob: !!(v && (v.src || '').startsWith('blob:'))
    };
  });

  const g6Scripts = await page.evaluate(() =>
    Array.from(document.scripts).filter((s) => /g6/i.test(s.src)).map((s) => s.src)
  );

  console.log(JSON.stringify({ newsReady, mapReady, hasBlobBoot, g6Scripts, scene3Reqs: blobFetches.length }, null, 2));
  await browser.close();
})();
