const { chromium } = require('./node_modules/playwright');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const videoPath = path.resolve(__dirname, '../../frontend/assets/bg/scene3.mp4');
  const src = pathToFileURL(videoPath).href;
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(`<!doctype html><video id="v" src="${src}" muted playsinline autoplay style="width:100%;height:100%;object-fit:cover;background:#000"></video><canvas id="c" width="320" height="240"></canvas>`);
  await p.waitForFunction(() => {
    const v = document.querySelector('#v');
    return v && v.readyState >= 2 && Number.isFinite(v.duration) && v.duration > 0;
  }, { timeout: 60000 });

  const samples = await p.evaluate(async () => {
    const v = document.querySelector('#v');
    const c = document.querySelector('#c');
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const dur = v.duration;
    const step = 1 / 12;
    const rows = [];
    let prev = null;

    async function seek(t) {
      v.pause();
      v.currentTime = Math.min(Math.max(t, 0), dur - 0.02);
      await new Promise((r) => {
        const done = () => r();
        v.addEventListener('seeked', done, { once: true });
        setTimeout(done, 400);
      });
      const vw = v.videoWidth, vh = v.videoHeight;
      const sx = 0, sy = Math.floor(vh * 0.35), sw = Math.floor(vw * 0.42), sh = Math.floor(vh * 0.65);
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
      return ctx.getImageData(0, 0, c.width, c.height).data;
    }

    function diff(a, b) {
      let s = 0, n = 0;
      for (let i = 0; i < a.length; i += 16) {
        s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
        n++;
      }
      return s / n;
    }

    for (let t = 0; t < dur - 0.02; t += step) {
      const img = await seek(t);
      const d = prev ? diff(prev, img) : 0;
      rows.push({ t: Number(t.toFixed(3)), d: Number(d.toFixed(2)) });
      prev = img;
    }
    return { dur, rows };
  });

  const { dur, rows } = samples;
  console.log('dur', dur);
  console.log('top motion:');
  [...rows].sort((a, b) => b.d - a.d).slice(0, 30).forEach((r) => console.log(r.t.toFixed(3), r.d));
  console.log('timeline:');
  for (let t0 = 0; t0 < dur; t0 += 0.5) {
    const slice = rows.filter((r) => r.t >= t0 && r.t < t0 + 0.5);
    const avg = slice.reduce((s, r) => s + r.d, 0) / (slice.length || 1);
    const max = Math.max(0, ...slice.map((r) => r.d));
    console.log(`${t0.toFixed(1)}-${(t0 + 0.5).toFixed(1)} avg=${avg.toFixed(1)} max=${max.toFixed(1)}`);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
