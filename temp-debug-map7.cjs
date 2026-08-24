/* Temporary debug script - deleted after use */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
  await page.goto('http://127.0.0.1:8080/pages/map.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.talentMapState && window.talentMapState.allProvinces && window.talentMapState.allProvinces.length > 0, null, { timeout: 30000 });
  await page.evaluate(() => {
    const p = window.talentMapState.allProvinces.find(x => x.name === '广东');
    window.talentMapSelect(p);
  });
  await page.waitForFunction(() => window.talentMapState.mapLevel === 'province' && window.talentMapState.cityGeoLoaded, null, { timeout: 30000 });
  await page.waitForTimeout(2000);

  const r = await page.evaluate(() => {
    const chart = window.talentMapState.mapChart;
    const out = { roundtrips: {}, domRect: null, geoOpt: {} };
    ['广州市', '深圳市', '韶关市'].forEach(nm => {
      const f = window.talentMapState.cityGeoJSON.features.find(x => x.properties.name === nm);
      const c = f.properties.center;
      const px = chart.convertToPixel({ geoIndex: 0 }, c);
      const back = chart.convertFromPixel({ geoIndex: 0 }, px);
      out.roundtrips[nm] = { geo: c, px: px.map(v => Math.round(v)), back: back.map(v => Math.round(v * 1000) / 1000) };
    });
    const dom = chart.getDom();
    const rect = dom.getBoundingClientRect();
    out.domRect = { left: rect.left, top: rect.top, w: rect.width, h: rect.height };
    const opt = chart.getOption().geo[0];
    out.geoOpt = { zoom: opt.zoom, center: opt.center, layoutCenter: opt.layoutCenter, layoutSize: opt.layoutSize, aspectScale: opt.aspectScale };
    // zrender 实际画布尺寸
    const zr = chart.getZr();
    out.zrSize = { w: zr.getWidth(), h: zr.getHeight(), dpr: zr.getDevicePixelRatio ? zr.getDevicePixelRatio() : window.devicePixelRatio };
    // containPixel 检查：广州中心像素是否在 geo 内
    const gzPx = chart.convertToPixel({ geoIndex: 0 }, window.talentMapState.cityGeoJSON.features.find(x => x.properties.name === '广州市').properties.center);
    out.containGz = chart.containPixel({ geoIndex: 0 }, gzPx);
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
