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
    const zr = chart.getZr();
    const list = zr.storage.getDisplayList();
    const out = {};
    ['广州市', '深圳市', '韶关市'].forEach(nm => {
      const f = window.talentMapState.cityGeoJSON.features.find(x => x.properties.name === nm);
      const px = chart.convertToPixel({ geoIndex: 0 }, f.properties.center);
      const hits = [];
      list.forEach((el, i) => {
        if (el.type !== 'compound') return;
        let contained = false;
        try { contained = el.contain(px[0], px[1]); } catch (e) { contained = 'ERR'; }
        if (contained === true) {
          hits.push({
            idx: i,
            fill: String(el.style && el.style.fill),
            silent: el.silent,
            hasTransform: !!el.transform,
            invTransform: el.transform ? el.transform.slice(0, 6).map(v => Math.round(v * 1000) / 1000) : null,
            zlevel: el.zlevel, z: el.z, z2: el.z2
          });
        }
      });
      // zrender 自己的命中检测
      let hoverInfo = null;
      try {
        const hovered = zr.handler.findHover(px[0], px[1]);
        if (hovered && hovered.topTarget) {
          hoverInfo = { fill: String(hovered.topTarget.style && hovered.topTarget.style.fill), type: hovered.topTarget.type };
        }
      } catch (e) { hoverInfo = 'ERR ' + e.message; }
      out[nm] = { px: px.map(Math.round), hits: hits, zrenderHover: hoverInfo };
    });
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
