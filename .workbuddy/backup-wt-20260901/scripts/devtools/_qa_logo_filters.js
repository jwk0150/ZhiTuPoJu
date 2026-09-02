const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 400 } });
  const src = 'file:///' + path.join(__dirname, '../../frontend/assets/brand/logo.png').replace(/\\/g, '/');
  const filters = [
    'sepia(1) saturate(2.4) hue-rotate(350deg) brightness(1.05)',
    'sepia(1) saturate(2.8) hue-rotate(345deg) brightness(1.08)',
    'brightness(1.1) sepia(1) hue-rotate(355deg) saturate(2.6)',
    'hue-rotate(-150deg) saturate(1.6) brightness(1.15) sepia(0.4)',
    'hue-rotate(-165deg) saturate(1.8) brightness(1.2) contrast(1.05)'
  ];
  for (let i = 0; i < filters.length; i++) {
    await p.setContent(`<body style="margin:0;background:#0a1210;display:grid;place-items:center;height:100vh"><img id="l" src="${src}?v=${i}" style="width:140px;height:140px;filter:${filters[i]}"></body>`);
    await p.waitForTimeout(250);
    await p.locator('#l').screenshot({ path: path.join(__dirname, `_shots/logo-f${i}.png`) });
  }
  await b.close();
  console.log('done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
