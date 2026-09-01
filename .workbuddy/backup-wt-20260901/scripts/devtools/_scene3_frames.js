const { chromium } = require('./node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(`<!doctype html><video id="v" src="http://127.0.0.1:8088/assets/bg/scene3.mp4" muted playsinline style="width:100%;height:100%;object-fit:cover;background:#000"></video>`);
  await p.waitForFunction(() => {
    const v = document.querySelector('#v');
    return v && v.readyState >= 2 && Number.isFinite(v.duration);
  }, { timeout: 15000 });

  const dur = await p.evaluate(() => document.querySelector('#v').duration);
  const times = [0.3, 1.5, 3, 4.5, 6, 7.5, 8.5, 9.5, Math.max(0.1, dur - 0.15)];
  const out = path.join(__dirname, 'qa-screens');
  fs.mkdirSync(out, { recursive: true });

  for (const t of times) {
    await p.evaluate(async (t) => {
      const v = document.querySelector('#v');
      v.pause();
      v.currentTime = Math.min(t, v.duration - 0.05);
      await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
    }, t);
    await p.waitForTimeout(100);
    const name = `scene3-t${String(t).replace('.', '-')}.png`;
    await p.screenshot({ path: path.join(out, name) });
    console.log('shot', name);
  }
  console.log('duration', dur);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
