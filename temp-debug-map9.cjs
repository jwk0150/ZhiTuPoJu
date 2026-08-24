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

  const centers = await page.evaluate(() => {
    const chart = window.talentMapState.mapChart;
    const rect = chart.getDom().getBoundingClientRect();
    const out = { ox: rect.left, oy: rect.top };
    ['广州市', '深圳市', '清远市', '韶关市'].forEach(nm => {
      const f = window.talentMapState.cityGeoJSON.features.find(x => x.properties.name === nm);
      if (f && f.properties.center) {
        const px = chart.convertToPixel({ geoIndex: 0 }, f.properties.center);
        out[nm] = { x: Math.round(rect.left + px[0]), y: Math.round(rect.top + px[1]) };
      }
    });
    return out;
  });
  console.log('page coords:', JSON.stringify(centers));

  // 基线 fills
  const fills = () => page.evaluate(() => {
    const list = window.talentMapState.mapChart.getZr().storage.getDisplayList();
    const m = {};
    list.forEach(el => { if (el.type === 'compound') { const f = String((el.style && el.style.fill) || ''); m[f] = (m[f] || 0) + 1; } });
    return m;
  });
  console.log('BASELINE:', JSON.stringify(await fills()));

  let i = 0;
  for (const nm of ['广州市', '深圳市', '清远市', '韶关市']) {
    i++;
    await page.mouse.move(centers[nm].x, centers[nm].y, { steps: 8 });
    await page.waitForTimeout(700);
    const st = await page.evaluate(() => ({ hov: window.talentMapState.hoveredCityName }));
    console.log('HOVER#' + i + ' ' + nm + ' state.hov=' + st.hov, JSON.stringify(await fills()));
  }
  await page.mouse.move(centers.ox + 20, centers.oy + 700, { steps: 5 });
  await page.waitForTimeout(700);
  console.log('MOUSEOUT:', JSON.stringify(await fills()));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
