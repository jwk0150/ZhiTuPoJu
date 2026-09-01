const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const root = path.resolve(__dirname, '../..');
  const svg = fs.readFileSync(path.join(root, 'frontend/assets/brand/logo.svg'), 'utf8');
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 512, height: 512 } });

  async function render(size, out) {
    await p.setViewportSize({ width: size, height: size });
    const html =
      '<!doctype html><html><body style="margin:0;background:transparent">' +
      svg.replace('<svg', `<svg width="${size}" height="${size}"`) +
      '</body></html>';
    await p.setContent(html, { waitUntil: 'load' });
    await p.locator('svg').screenshot({ path: out, omitBackground: true });
  }

  await render(512, path.join(root, 'frontend/assets/brand/logo.png'));
  await render(128, path.join(root, 'frontend/assets/brand/logo-128.png'));
  await b.close();
  console.log('rendered clean png');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
