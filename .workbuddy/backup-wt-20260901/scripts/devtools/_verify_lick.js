const { chromium } = require('./node_modules/playwright');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://127.0.0.1:8088/', { waitUntil: 'domcontentloaded', timeout: 20000 });

  // Jump directly to scene3 playback path used by entry.js
  const log = await p.evaluate(async () => {
    const v = document.getElementById('scene3Video');
    const LICK_START = 7.56;
    const LICK_END = 9.6;
    v.muted = true;
    v.loop = false;
    v.preload = 'auto';
    try { v.load(); } catch (_) {}
    await new Promise((r) => {
      if (v.readyState >= 2) r();
      else v.addEventListener('canplay', r, { once: true });
      setTimeout(r, 8000);
    });

    // mimic armScene3LickLoop
    let seeking = false;
    const wrap = () => {
      if (seeking) return;
      seeking = true;
      v.currentTime = LICK_START;
      v.play().catch(() => {});
      setTimeout(() => { seeking = false; }, 120);
    };
    v.addEventListener('timeupdate', () => {
      if (!seeking && v.currentTime >= LICK_END) wrap();
    });
    v.addEventListener('ended', wrap);

    // start near end of intro lick
    v.currentTime = 9.2;
    await v.play();

    const samples = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 4500) {
      samples.push(Number(v.currentTime.toFixed(2)));
      await new Promise((r) => setTimeout(r, 200));
    }
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const wrapped = samples.some((t, i) => i > 0 && samples[i - 1] > 9.4 && t < 8.2);
    const neverJump = samples.every((t) => t >= 7.4); // after wrap should stay in lick
    return { samples, min, max, wrapped, neverJump, dur: v.duration };
  });

  console.log(JSON.stringify(log, null, 2));
  await p.screenshot({ path: 'scripts/devtools/qa-screens/scene3_lick_verify.png', fullPage: false });
  await b.close();
  if (!log.wrapped) {
    console.error('FAIL: did not wrap into lick loop');
    process.exit(1);
  }
  console.log('OK lick loop wrap detected');
})().catch((e) => { console.error(e); process.exit(1); });
