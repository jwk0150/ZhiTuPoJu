const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://127.0.0.1:8080/assets/brand/login-bg.png', { waitUntil: 'load' });
  await p.setViewportSize({ width: 1440, height: 900 });
  // show as cover in a blank page
  await p.setContent(`<!DOCTYPE html><html><body style="margin:0;width:1440px;height:900px;background:#E8F4FA url('http://127.0.0.1:8080/assets/brand/login-bg.png') center / cover no-repeat;"></body></html>`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'qa-screens/06-bg-only.png' });
  await b.close();
  console.log('ok');
})();
