/* Temporary debug script - deleted after use */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('http://127.0.0.1:8080/pages/map.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.talentMapState && window.talentMapState.allProvinces && window.talentMapState.allProvinces.length > 0, null, { timeout: 30000 });

  const sample = () => page.evaluate(() => {
    const chart = window.talentMapState.mapChart;
    const dom = chart.getDom();
    const canvases = Array.from(dom.querySelectorAll('canvas'));
    const w = dom.clientWidth, h = dom.clientHeight;
    const off = document.createElement('canvas');
    off.width = w * 2; off.height = h * 2;
    const ctx = off.getContext('2d');
    ctx.scale(2, 2);
    canvases.forEach(c => { try { ctx.drawImage(c, 0, 0, w, h); } catch (e) {} });
    const names = ['广州市', '深圳市', '清远市', '韶关市', '肇庆市'];
    const pts = {};
    names.forEach(nm => {
      const f = window.talentMapState.cityGeoJSON.features.find(x => x.properties.name === nm);
      if (!f || !f.properties.center) return;
      const px = chart.convertToPixel({ geoIndex: 0 }, f.properties.center);
      if (!px) return;
      const d = ctx.getImageData(Math.round(px[0] * 2), Math.round(px[1] * 2), 1, 1).data;
      pts[nm] = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    });
    return pts;
  });

  await page.evaluate(() => {
    const p = window.talentMapState.allProvinces.find(x => x.name === '广东');
    window.talentMapSelect(p);
  });
  await page.waitForFunction(() => window.talentMapState.mapLevel === 'province' && window.talentMapState.cityGeoLoaded, null, { timeout: 30000 });

  for (const delay of [200, 1100, 2000, 2900, 4800]) {
    await page.waitForTimeout(delay === 200 ? 200 : delay === 4800 ? 1900 : 900);
    console.log('T+' + delay + 'ms:', JSON.stringify(await sample()));
  }

  // 连续悬停 城市 A→B→C→D（真实鼠标移动）
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
    await page.mouse.move(centers[nm].x, centers[nm].y, { steps: 6 });
    await page.waitForTimeout(350);
    console.log('HOVER#' + i + ' ' + nm + ':', JSON.stringify(await sample()));
  }
  await page.mouse.move(30, 500, { steps: 4 });
  await page.waitForTimeout(400);
  console.log('MOUSEOUT:', JSON.stringify(await sample()));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
