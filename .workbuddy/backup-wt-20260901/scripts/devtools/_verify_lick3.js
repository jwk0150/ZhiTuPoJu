const { chromium } = require('./node_modules/playwright');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.setContent('<!doctype html><video id="v" src="http://127.0.0.1:8088/assets/bg/scene3.mp4" muted playsinline preload="auto"></video>');
  const log = await p.evaluate(async () => {
    const v = document.getElementById('v');
    const wait = (ev, ms = 15000) => new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout ' + ev)), ms);
      v.addEventListener(ev, () => { clearTimeout(t); resolve(); }, { once: true });
    });
    try { await wait('loadedmetadata'); } catch (_) {}
    // force buffer
    await v.play().catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    v.pause();

    const seek = async (t) => {
      v.currentTime = t;
      await Promise.race([
        wait('seeked', 5000),
        new Promise((r) => setTimeout(r, 800))
      ]);
      return v.currentTime;
    };

    const after1 = await seek(9.25);
    await v.play();
    await new Promise((r) => setTimeout(r, 500));
    const mid = v.currentTime;

    // arm wrap
    const LICK_START = 7.56;
    const LICK_END = 9.6;
    let seeking = false;
    v.ontimeupdate = () => {
      if (seeking) return;
      if (v.currentTime >= LICK_END) {
        seeking = true;
        v.currentTime = LICK_START;
        v.onseeked = () => { seeking = false; v.onseeked = null; };
        setTimeout(() => { seeking = false; }, 250);
      }
    };

    // jump near end again
    await seek(9.45);
    await v.play();
    const samples = [];
    for (let i = 0; i < 30; i++) {
      samples.push(Number(v.currentTime.toFixed(2)));
      await new Promise((r) => setTimeout(r, 150));
    }
    const wrapped = samples.some((t, i) => i > 0 && samples[i - 1] >= 9.4 && t < 8.2);
    return { after1, mid, samples, wrapped, ready: v.readyState, seekable: v.seekable.length ? [v.seekable.start(0), v.seekable.end(0)] : null };
  });
  console.log(JSON.stringify(log, null, 2));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
