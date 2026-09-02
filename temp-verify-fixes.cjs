/* Temporary verification script - deleted after use */
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8090/pages/map.html';
const results = [];
function log(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + ' | ' + (detail || ''));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.talentMapState && window.talentMapState.allProvinces && window.talentMapState.allProvinces.length > 0, null, { timeout: 30000 });

  // ---------- Part 1: city map hover color stability ----------
  const provName = await page.evaluate(() => {
    const p = window.talentMapState.allProvinces.find(x => x.name === '广东') || window.talentMapState.allProvinces[0];
    window.talentMapSelect(p);
    return p.name;
  });
  // wait until city map rendered
  await page.waitForFunction(() => window.talentMapState.mapLevel === 'province' && window.talentMapState.cityGeoLoaded && window.talentMapState.mapChart, null, { timeout: 30000 });
  await page.waitForTimeout(1400); // let render + animations settle

  // compute sample points for the 6 largest cities
  const points = await page.evaluate(() => {
    const geo = window.talentMapState.cityGeoJSON;
    const chart = window.talentMapState.mapChart;
    function ringArea(ring) { let a = 0; for (let i = 0; i < ring.length - 1; i++) a += ring[i][0]*ring[i+1][1] - ring[i+1][0]*ring[i][1]; return Math.abs(a/2); }
    function featArea(f) {
      const g = f.geometry; if (!g) return 0;
      const polys = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []);
      let t = 0; polys.forEach(p => p.forEach((r, ri) => { t += ri === 0 ? ringArea(r) : -ringArea(r); }));
      return Math.max(0, t);
    }
    const items = [];
    geo.features.forEach(f => {
      const nm = f.properties && f.properties.name; if (!nm) return;
      const c = (f.properties.center && f.properties.center.slice()) || (f.properties.centroid && f.properties.centroid.slice());
      if (!c) return;
      items.push({ name: nm, center: c, area: featArea(f) });
    });
    items.sort((a, b) => b.area - a.area);
    return items.slice(0, 6).map(it => {
      const px = chart.convertToPixel({ geoIndex: 0 }, it.center);
      return { name: it.name, x: px[0], y: px[1] };
    }).filter(p => isFinite(p.x) && isFinite(p.y));
  });
  log('city sample points', points.length >= 4, JSON.stringify(points));

  async function sampleAll(label) {
    return await page.evaluate(({ pts, label }) => {
      const chart = window.talentMapState.mapChart;
      const dom = chart.getDom();
      const canvases = Array.from(dom.querySelectorAll('canvas'));
      const w = dom.clientWidth, h = dom.clientHeight;
      const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
      const ctx = tmp.getContext('2d');
      canvases.forEach(c => { try { ctx.drawImage(c, 0, 0, w, h); } catch (e) {} });
      function patchColor(x, y) {
        x = Math.round(x); y = Math.round(y);
        const R = 5, counts = {};
        for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) {
          const sx = Math.min(w - 1, Math.max(0, x + dx)), sy = Math.min(h - 1, Math.max(0, y + dy));
          const d = ctx.getImageData(sx, sy, 1, 1).data;
          if (d[3] < 200) continue;
          // skip dark label text pixels (dark ink) so text glyphs don't pollute fill color
          if (d[0] + d[1] + d[2] < 240) continue;
          const key = [d[0], d[1], d[2]].map(v => v >> 3).join(',');
          counts[key] = (counts[key] || [0, 0, 0, 0]);
          counts[key][0]++; counts[key][1] += d[0]; counts[key][2] += d[1]; counts[key][3] += d[2];
        }
        let best = null; Object.keys(counts).forEach(k => { if (!best || counts[k][0] > counts[best][0]) best = k; });
        if (!best) return null;
        const c = counts[best];
        return [Math.round(c[1]/c[0]), Math.round(c[2]/c[0]), Math.round(c[3]/c[0])];
      }
      const out = {};
      pts.forEach(p => { out[p.name] = patchColor(p.x, p.y); });
      return out;
    }, { pts: points, label });
}
  function dist(a, b) {
    if (!a || !b) return Infinity;
    return Math.max(Math.abs(a[0]-b[0]), Math.abs(a[1]-b[1]), Math.abs(a[2]-b[2]));
  }

  const box = await page.evaluate(() => {
    const dom = window.talentMapState.mapChart.getDom();
    const r = dom.getBoundingClientRect();
    return { left: r.left, top: r.top };
  });
  async function hover(pt) {
    await page.mouse.move(box.left + pt.x, box.top + pt.y, { steps: 4 });
    await page.waitForTimeout(320);
  }
  async function leaveMap() {
    // move to right detail panel (outside map canvas) to trigger mouseout
    await page.mouse.move(1680 - 150, 500, { steps: 4 });
    await page.waitForTimeout(320);
  }

  const base = await sampleAll('baseline');
  log('baseline readable', Object.values(base).every(v => v), JSON.stringify(base));

  // distinct baseline colors?
  const uniq = new Set(Object.values(base).map(v => v.join(',')));
  log('baseline colors distinct', uniq.size >= Math.min(4, points.length), 'unique=' + uniq.size);

  // hover each city in turn; verify current brightens & previously visited restore
  let allOk = true; const details = [];
  for (let i = 0; i < points.length; i++) {
    await hover(points[i]);
    const cur = await sampleAll('hover' + i);
    const curName = points[i].name;
    const dCur = dist(cur[curName], base[curName]);
    if (!(dCur > 14)) { allOk = false; details.push(curName + ' not highlighted(d=' + dCur + ')'); }
    for (let j = 0; j < points.length; j++) {
      if (j === i) continue;
      const n = points[j].name;
      const d = dist(cur[n], base[n]);
      if (d > 10) { allOk = false; details.push(n + ' drifted while hovering ' + curName + '(d=' + d + ')'); }
    }
  }
  log('hover keeps other cities unchanged + hovered brightens', allOk, details.join('; ') || 'all stable');

  // leave map -> everything restores
  await leaveMap();
  const restored = await sampleAll('restored');
  let restOk = true; const restDetails = [];
  points.forEach(p => {
    const d = dist(restored[p.name], base[p.name]);
    if (d > 10) { restOk = false; restDetails.push(p.name + ' d=' + d); }
  });
  log('mouse-out restores original colors', restOk, restDetails.join('; ') || 'all restored');

  // second pass: hover first city again then leave (stability beyond first entry)
  await hover(points[0]);
  await leaveMap();
  const restored2 = await sampleAll('restored2');
  let ok2 = true;
  points.forEach(p => { if (dist(restored2[p.name], base[p.name]) > 10) ok2 = false; });
  log('second hover/out cycle restores', ok2, '');

  await page.screenshot({ path: 'temp-city-map.png' });

  // ---------- Part 2: enter city job analysis page ----------
  const cityName = await page.evaluate(() => {
    const c = (window.talentMapState.cityData || [])[0] || { name: Object.keys(window.talentMapState.cityGeoJSON.features.reduce((m, f) => (m[f.properties.name] = 1, m), {}))[0] };
    window.talentHandleCityClick(c.name);
    return c.name;
  });
  await page.waitForSelector('#talent-province-jobs .talent-job-card', { timeout: 30000 });
  await page.waitForTimeout(900);

  const layout = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#talent-province-jobs .talent-job-card'));
    const pick = (card, sel) => { const el = card.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { sel, left: r.left, right: r.right, top: r.top, height: r.height, text: (el.textContent || '').trim().slice(0, 18) }; };
    const report = { cardCount: cards.length, heights: cards.map(c => Math.round(c.getBoundingClientRect().height)), first: [], overflow: 0 };
    const sels = ['.talent-job-name', '.talent-job-salary', '.talent-job-hot', '.talent-job-category', '.talent-job-skills', '.talent-job-top', '.talent-job-count', '.talent-job-btn'];
    report.first = sels.map(s => pick(cards[0], s)).filter(Boolean);
    const layer = document.getElementById('talent-layer-province');
    report.overflow = layer ? (layer.scrollWidth - layer.clientWidth) : -1;
    const docOv = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    report.docOverflow = docOv;
    const h1 = document.querySelector('#view-map .page-title-block h1');
    const back = document.getElementById('talent-back-btn');
    report.titleLeft = h1 ? h1.getBoundingClientRect().left : null;
    report.backLeft = back && back.style.display !== 'none' ? back.getBoundingClientRect().left : null;
    report.cardLeft = cards[0].getBoundingClientRect().left;
    return report;
  });
  log('cards rendered', layout.cardCount > 0, 'count=' + layout.cardCount);
  log('uniform card heights', Math.max(...layout.heights) - Math.min(...layout.heights) <= 2, layout.heights.join(','));
  log('no horizontal overflow', layout.overflow <= 0 && layout.docOverflow <= 0, 'layer=' + layout.overflow + ' doc=' + layout.docOverflow);

  const xs = layout.first;
  let orderOk = true;
  for (let i = 1; i < xs.length; i++) { if (xs[i].left < xs[i-1].left - 1) { orderOk = false; } }
  log('horizontal info flow order', orderOk, xs.map(x => x.sel.replace('.talent-job-', '') + '@' + Math.round(x.left)).join(' → '));
  const btn = xs.find(x => x.sel === '.talent-job-btn');
  const cardRight = await page.evaluate(() => document.querySelector('#talent-province-jobs .talent-job-card').getBoundingClientRect().right);
  log('button pinned right', btn && Math.abs(cardRight - 18 - btn.right) < 8, 'btnRight=' + Math.round(btn.right) + ' cardRight=' + Math.round(cardRight));

  const alignTol = 4;
  log('title/card left aligned', Math.abs(layout.titleLeft - layout.cardLeft) <= alignTol, 'title=' + Math.round(layout.titleLeft) + ' card=' + Math.round(layout.cardLeft));
  if (layout.backLeft != null) log('back button aligned', Math.abs(layout.backLeft - layout.cardLeft) <= alignTol, 'back=' + Math.round(layout.backLeft));
  log('left safe spacing >=22px', layout.cardLeft >= 22, 'cardLeft=' + Math.round(layout.cardLeft));

  await page.screenshot({ path: 'temp-analysis-page.png', fullPage: false });

  // font hierarchy spot-check
  const fonts = await page.evaluate(() => {
    const g = sel => { const el = document.querySelector('#talent-province-jobs ' + sel); return el ? parseFloat(getComputedStyle(el).fontSize) : null; };
    return { name: g('.talent-job-name'), salary: g('.talent-job-salary'), hot: g('.talent-job-hot'), skill: g('.talent-job-skill'), top: g('.talent-job-top'), btn: g('.talent-job-btn') };
  });
  log('font hierarchy', fonts.name > fonts.salary && fonts.salary >= fonts.hot && fonts.hot >= fonts.skill, JSON.stringify(fonts));

  // ---------- Part 3: back to province list still works ----------
  await page.evaluate(() => window.talentMapCityBack());
  await page.waitForTimeout(800);
  const provCards = await page.evaluate(() => document.querySelectorAll('#talent-province-jobs .talent-job-card').length);
  log('province job list renders after back', provCards > 0, 'cards=' + provCards);

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n==== SUMMARY: ' + (results.length - failed.length) + '/' + results.length + ' passed ====');
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
