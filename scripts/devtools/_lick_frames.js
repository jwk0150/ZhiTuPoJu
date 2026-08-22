const { chromium } = require('./node_modules/playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(`<!doctype html><video id="v" src="http://127.0.0.1:8088/assets/bg/scene3.mp4" muted playsinline style="width:100%;height:100%;object-fit:cover;background:#000"></video>`);
  await p.waitForFunction(() => document.querySelector('#v').readyState >= 2, { timeout: 15000 });
  const dur = await p.evaluate(() => document.querySelector('#v').duration);
  const out = path.join(__dirname, 'qa-screens', 'lick');
  fs.mkdirSync(out, { recursive: true });

  // focus end half where lick likely lives
  const times = [];
  for (let t = 5.0; t <= dur - 0.05; t += 0.35) times.push(Number(t.toFixed(2)));
  times.push(Number((dur - 0.08).toFixed(2)));

  for (const t of times) {
    await p.evaluate(async (t) => {
      const v = document.querySelector('#v');
      v.pause();
      v.currentTime = Math.min(t, v.duration - 0.04);
      await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
    }, t);
    await p.waitForTimeout(60);
    await p.screenshot({
      path: path.join(out, `t${String(t).replace('.', '_')}.png`),
      clip: { x: 0, y: 240, width: 480, height: 360 }
    });
    console.log('shot', t);
  }
  console.log('dur', dur);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
