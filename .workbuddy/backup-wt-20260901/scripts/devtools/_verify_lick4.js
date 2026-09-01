const { chromium } = require('./node_modules/playwright');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.setContent('<!doctype html><video id="v" src="http://127.0.0.1:8088/assets/bg/scene3.mp4" muted playsinline preload="auto"></video>');
  const log = await p.evaluate(async () => {
    const v = document.getElementById('v');
    await new Promise((r) => {
      if (v.readyState >= 1) r();
      else v.addEventListener('loadedmetadata', r, { once: true });
    });
    // wait until seekable covers lick range
    const t0 = performance.now();
    let last = null;
    while (performance.now() - t0 < 30000) {
      const end = v.seekable.length ? v.seekable.end(v.seekable.length - 1) : 0;
      last = { end, ready: v.readyState, buffered: v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0, t: v.currentTime };
      if (end >= 9.7) break;
      // nudge download
      if (v.paused) v.play().catch(() => {});
      await new Promise((r) => setTimeout(r, 300));
    }
    v.pause();
    v.currentTime = 9.3;
    await new Promise((r) => setTimeout(r, 400));
    const afterSeek = v.currentTime;
    const seekableEnd = v.seekable.length ? v.seekable.end(v.seekable.length - 1) : 0;

    // now test wrap
    let seeking = false;
    const LICK_START = 7.56, LICK_END = 9.6;
    v.addEventListener('timeupdate', () => {
      if (seeking) return;
      if (v.currentTime >= LICK_END) {
        seeking = true;
        v.currentTime = LICK_START;
        setTimeout(() => { seeking = false; }, 200);
      }
    });
    await v.play();
    const samples = [];
    for (let i = 0; i < 25; i++) {
      samples.push(Number(v.currentTime.toFixed(2)));
      await new Promise((r) => setTimeout(r, 160));
    }
    return { last, afterSeek, seekableEnd, samples, wrapped: samples.some((t, i) => i > 0 && samples[i - 1] >= 9.4 && t < 8.2) };
  });
  console.log(JSON.stringify(log, null, 2));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
