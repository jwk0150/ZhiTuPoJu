const { chromium } = require('./node_modules/playwright');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.setContent('<!doctype html><video id="v" src="http://127.0.0.1:8088/assets/bg/scene3.mp4" muted playsinline></video>');
  const log = await p.evaluate(async () => {
    const v = document.getElementById('v');
    const LICK_START = 7.56;
    const LICK_END = 9.6;
    await new Promise((r) => {
      if (v.readyState >= 1) r();
      else v.addEventListener('loadedmetadata', r, { once: true });
    });
    let seeking = false;
    const wrap = () => {
      if (seeking) return;
      seeking = true;
      v.currentTime = LICK_START;
      const done = () => { seeking = false; };
      v.addEventListener('seeked', done, { once: true });
      setTimeout(done, 300);
      v.play().catch(() => {});
    };
    v.addEventListener('timeupdate', () => {
      if (!seeking && v.currentTime >= LICK_END) wrap();
    });
    v.addEventListener('ended', wrap);
    v.currentTime = 9.25;
    await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
    await v.play();
    const samples = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 5000) {
      samples.push(Number(v.currentTime.toFixed(2)));
      await new Promise((r) => setTimeout(r, 180));
    }
    const wrapped = samples.some((t, i) => i > 0 && samples[i - 1] >= 9.4 && t < 8.2);
    return { samples, wrapped, min: Math.min(...samples), max: Math.max(...samples) };
  });
  console.log(JSON.stringify(log, null, 2));
  await b.close();
  process.exit(log.wrapped ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
