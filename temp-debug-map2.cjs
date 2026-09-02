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
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const chart = window.talentMapState.mapChart;
    const zr = chart.getZr();
    const list = zr.storage.getDisplayList(false);
    const shapes = [];
    list.forEach(el => {
      if (el.style && el.style.fill !== undefined && el.shape) {
        shapes.push({ type: el.type, fill: el.style.fill, stroke: el.style.stroke, ignored: el.ignore, silent: el.silent, zlevel: el.zlevel });
      }
    });
    // count canvases in dom
    const dom = chart.getDom();
    const canvases = Array.from(dom.querySelectorAll('canvas')).map(c => ({ w: c.width, h: c.height, cls: c.className, id: c.getAttribute('_zr-dom-id') || c.id }));
    return { shapeCount: shapes.length, fills: shapes.reduce((m, s) => { const k = String(s.fill); m[k] = (m[k] || 0) + 1; return m; }, {}), sample: shapes.slice(0, 30), canvases };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
