const { chromium } = require('./node_modules/playwright');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:8088/', { waitUntil: 'domcontentloaded' });
  const log = await p.evaluate(async () => {
    const res = await fetch('/assets/bg/scene3.mp4');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    document.body.appendChild(v);
    await new Promise((r) => {
      if (v.readyState >= 1) r();
      else v.addEventListener('loadedmetadata', r, { once: true });
    });
    const seekableEnd = v.seekable.length ? v.seekable.end(v.seekable.length - 1) : 0;
    const LICK_START = 7.56;
    const LICK_END = 9.6;
    let seeking = false;
    v.addEventListener('timeupdate', () => {
      if (seeking) return;
      if (v.currentTime >= LICK_END) {
        seeking = true;
        v.currentTime = LICK_START;
        v.addEventListener('seeked', () => { seeking = false; }, { once: true });
        setTimeout(() => { seeking = false; }, 300);
      }
    });
    v.currentTime = 9.35;
    await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
    await v.play();
    const samples = [];
    for (let i = 0; i < 28; i++) {
      samples.push(Number(v.currentTime.toFixed(2)));
      await new Promise((r) => setTimeout(r, 150));
    }
    const wrapped = samples.some((t, i) => i > 0 && samples[i - 1] >= 9.4 && t < 8.2);
    const stayedInLick = samples.every((t) => t >= 7.4);
    return { seekableEnd, afterFirstSeek: samples[0], samples, wrapped, stayedInLick };
  });
  console.log(JSON.stringify(log, null, 2));
  await b.close();
  if (!log.wrapped || !log.stayedInLick) process.exit(1);
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
