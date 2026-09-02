/* Temporary debug script - deleted after use */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE[' + m.type() + ']:', m.text().slice(0, 300)); });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('http://127.0.0.1:8090/pages/map.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.talentMapState && window.talentMapState.allProvinces && window.talentMapState.allProvinces.length > 0, null, { timeout: 30000 });
  await page.evaluate(() => {
    const p = window.talentMapState.allProvinces.find(x => x.name === '广东');
    return window.talentMapSelect(p);
  });
  await page.waitForFunction(() => window.talentMapState.mapLevel === 'province' && window.talentMapState.cityGeoLoaded, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const chart = window.talentMapState.mapChart;
    const opt = chart.getOption();
    const geo = opt.geo && opt.geo[0];
    const regions = (geo.regions || []).map(r => ({ name: r.name, area: r.itemStyle && r.itemStyle.areaColor, emph: r.emphasis && r.emphasis.itemStyle && r.emphasis.itemStyle.areaColor }));
    // also inspect internal geo model region styles
    let internal = null;
    try {
      const model = chart.getModel().getComponent('geo', 0);
      internal = model.regions.slice(0, 8).map(r => ({
        name: r.name,
        getAreaStyle: (r.getRegionStyle ? JSON.stringify(r.getRegionStyle(['fill'])) : null)
      }));
    } catch (e) { internal = 'ERR:' + e.message; }
    return {
      geoMap: geo.map,
      regionCount: regions.length,
      firstRegions: regions.slice(0, 25),
      globalAreaColor: geo.itemStyle && geo.itemStyle.areaColor,
      seriesCount: opt.series.length,
      series0: { type: opt.series[0].type, map: opt.series[0].map, geoIndex: opt.series[0].geoIndex, dataLen: (opt.series[0].data || []).length, dataSample: (opt.series[0].data || []).slice(0, 3) },
      internal
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
