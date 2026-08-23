/* Temporary debug script - deleted after use */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('http://127.0.0.1:8090/pages/map.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.talentMapState && window.talentMapState.allProvinces && window.talentMapState.allProvinces.length > 0, null, { timeout: 30000 });
  await page.evaluate(() => { const p = window.talentMapState.allProvinces.find(x => x.name === '广东'); return window.talentMapSelect(p); });
  await page.waitForFunction(() => window.talentMapState.mapLevel === 'province' && window.talentMapState.cityGeoLoaded, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const chart = window.talentMapState.mapChart;
    const geoModel = chart.getModel().getComponent('geo', 0);
    const opt = geoModel.option;
    const regionNames = (opt.regions || []).map(r => r.name);
    let mapKeys = [];
    try { mapKeys = Array.from(geoModel._optionModelMap.keys()); } catch (e) { mapKeys = 'ERR ' + e.message; }
    const qy = geoModel.getRegionModel('清远市');
    return {
      regionCount: regionNames.length,
      firstRegionNames: regionNames.slice(0, 25),
      mapKeyCount: Array.isArray(mapKeys) ? mapKeys.length : mapKeys,
      mapKeysSample: Array.isArray(mapKeys) ? mapKeys.slice(0, 30) : mapKeys,
      qingyuanOption: qy && qy.option,
      qingyuanArea: qy && qy.get('itemStyle.areaColor'),
      geoLevelArea: opt.itemStyle && opt.itemStyle.areaColor
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
