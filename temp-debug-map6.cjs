/* Temporary debug script - deleted after use */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('http://127.0.0.1:8080/pages/map.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.talentMapState && window.talentMapState.allProvinces && window.talentMapState.allProvinces.length > 0, null, { timeout: 30000 });

  await page.evaluate(() => {
    const p = window.talentMapState.allProvinces.find(x => x.name === '广东');
    window.talentMapSelect(p);
  });
  await page.waitForFunction(() => window.talentMapState.mapLevel === 'province' && window.talentMapState.cityGeoLoaded, null, { timeout: 30000 });
  await page.waitForTimeout(2200);

  // 安装事件探针
  await page.evaluate(() => {
    window.__evts = [];
    const chart = window.talentMapState.mapChart;
    ['mousemove', 'mouseout', 'click'].forEach(t => {
      chart.on(t, function(params) {
        window.__evts.push({ t: t, name: params && params.name, ct: params && params.componentType });
        if (window.__evts.length > 400) window.__evts.shift();
      });
    });
  });

  const centers = await page.evaluate(() => {
    const chart = window.talentMapState.mapChart;
    const out = {};
    ['广州市', '深圳市', '清远市', '韶关市'].forEach(nm => {
      const f = window.talentMapState.cityGeoJSON.features.find(x => x.properties.name === nm);
      if (f && f.properties.center) { const px = chart.convertToPixel({ geoIndex: 0 }, f.properties.center); out[nm] = { x: px[0], y: px[1] }; }
    });
    return out;
  });

  for (const nm of Object.keys(centers)) {
    await page.evaluate(() => { window.__evts.length = 0; });
    await page.mouse.move(centers[nm].x, centers[nm].y, { steps: 10 });
    await page.waitForTimeout(600);
    const st = await page.evaluate(() => ({
      hoveredCityName: window.talentMapState.hoveredCityName,
      lastEvents: window.__evts.slice(-6),
      totalEvents: window.__evts.length
    }));
    console.log(nm + ' →', JSON.stringify(st));
  }

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
