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
  await page.waitForTimeout(2600);

  // 基线：显示列表中 compound 元素的 fill 分布
  const fills = () => page.evaluate(() => {
    const list = window.talentMapState.mapChart.getZr().storage.getDisplayList();
    const m = {};
    list.forEach(el => { if (el.type === 'compound') { const f = String((el.style && el.style.fill) || ''); m[f] = (m[f] || 0) + 1; } });
    return m;
  });
  console.log('BASELINE FILLS:', JSON.stringify(await fills()));

  const centers = await page.evaluate(() => {
    const chart = window.talentMapState.mapChart;
    const out = {};
    ['广州市', '深圳市', '清远市', '韶关市'].forEach(nm => {
      const f = window.talentMapState.cityGeoJSON.features.find(x => x.properties.name === nm);
      if (f && f.properties.center) { const px = chart.convertToPixel({ geoIndex: 0 }, f.properties.center); out[nm] = { x: px[0], y: px[1] }; }
    });
    return out;
  });

  let i = 0;
  for (const nm of Object.keys(centers)) {
    i++;
    await page.mouse.move(centers[nm].x, centers[nm].y, { steps: 8 });
    await page.waitForTimeout(800);
    const f = await fills();
    const unique = Object.keys(f).length;
    console.log('HOVER#' + i + ' ' + nm + ': uniqueFills=' + unique, JSON.stringify(f));
  }
  await page.mouse.move(30, 500, { steps: 5 });
  await page.waitForTimeout(800);
  console.log('MOUSEOUT FILLS:', JSON.stringify(await fills()));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
