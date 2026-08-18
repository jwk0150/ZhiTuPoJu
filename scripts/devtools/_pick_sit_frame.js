const { chromium } = require('./node_modules/playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(`<!doctype html><video id="v" src="http://127.0.0.1:8088/assets/bg/scene3.mp4" muted playsinline style="width:100%;height:100%;object-fit:cover;background:#000"></video>`);
  await p.waitForFunction(() => document.querySelector('#v').readyState >= 2, { timeout: 15000 });
  const dur = await p.evaluate(() => document.querySelector('#v').duration);
  const out = path.join(__dirname, 'qa-screens', 'sit-pick');
  fs.mkdirSync(out, { recursive: true });

  // dense sample 1.5s ~ 9.0s for stable sit
  const times = [];
  for (let t = 1.5; t <= 9.0; t += 0.25) times.push(Number(t.toFixed(2)));

  for (const t of times) {
    await p.evaluate(async (t) => {
      const v = document.querySelector('#v');
      v.pause();
      v.currentTime = t;
      await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
    }, t);
    await p.waitForTimeout(50);
    await p.screenshot({
      path: path.join(out, `t${String(t).replace('.', '_')}.png`),
      clip: { x: 0, y: 260, width: 460, height: 340 }
    });
  }
  console.log({ dur, n: times.length, out });
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
