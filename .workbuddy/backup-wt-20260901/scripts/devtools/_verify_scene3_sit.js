const { chromium } = require('./node_modules/playwright');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://127.0.0.1:8088/', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => {
    const v = document.getElementById('scene3Video');
    v.preload = 'auto';
    v.load();
  });
  await p.waitForTimeout(600);
  await p.click('#enterBtn');
  // scene2 intro ~8s then idle
  await p.waitForFunction(() => {
    const bar = document.getElementById('stateText');
    return bar && /项目介绍/.test(bar.textContent || '');
  }, { timeout: 25000 });
  await p.waitForTimeout(10000);
  await p.click('[data-go="scene3"]');
  await p.waitForFunction(() => document.body.dataset.phase === 'scene3', { timeout: 20000 });
  await p.waitForTimeout(1500);

  const during = await p.evaluate(() => {
    const v = document.getElementById('scene3Video');
    return { loop: v.loop, t: Number(v.currentTime.toFixed(2)), phase: document.body.dataset.phase };
  });
  console.log('during', during);

  await p.evaluate(async () => {
    const v = document.getElementById('scene3Video');
    await new Promise((r) => {
      if (v.readyState >= 1 && v.duration) return r();
      v.addEventListener('loadedmetadata', r, { once: true });
      setTimeout(r, 4000);
    });
    v.currentTime = Math.max(0, v.duration - 0.08);
  });
  await p.waitForTimeout(2000);

  // allow a couple seconds in sit loop
  await p.waitForTimeout(2500);
  const samples = await p.evaluate(async () => {
    const v = document.getElementById('scene3Video');
    const out = [];
    for (let i = 0; i < 5; i++) {
      out.push(Number(v.currentTime.toFixed(2)));
      await new Promise((r) => setTimeout(r, 400));
    }
    return { loop: v.loop, samples: out, phase: document.body.dataset.phase };
  });
  console.log('sit-loop', samples);
  await b.close();
  if (samples.loop) throw new Error('scene3 still looping attribute');
  const bad = samples.samples.filter((t) => t < 2.5 || t > 9.8);
  if (bad.length) throw new Error('left sit range: ' + JSON.stringify(samples.samples));
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
