const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const root = path.join(__dirname, '../../frontend');
const outDir = path.join(__dirname, '_shots');
fs.mkdirSync(outDir, { recursive: true });

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let url = req.url.split('?')[0];
      if (url === '/') url = '/index.html';
      const filePath = path.join(root, url.replace(/^\//, ''));
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        const ext = path.extname(filePath);
        const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.mp4': 'video/mp4' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/pages/home.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => localStorage.setItem('zhitu_user', JSON.stringify({ username: 'demo', name: '演示用户' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const metrics = await page.evaluate(() => {
    const brand = document.querySelector('.topnav-brand-title');
    const logo = document.querySelector('.topnav-brand-logo');
    const stage = document.querySelector('.app-stage');
    const globe = document.querySelector('.home-globe');
    const banner = document.querySelector('.home-banner');
    return {
      hasStage: !!stage,
      brandColor: brand ? getComputedStyle(brand).color : null,
      logoSrc: logo?.getAttribute('src') || null,
      globeSrc: globe?.getAttribute('src') || null,
      bannerBg: banner ? getComputedStyle(banner).backgroundColor : null,
      stageBg: stage ? getComputedStyle(stage).backgroundColor : null
    };
  });
  console.log(metrics);

  await page.locator('.topnav').screenshot({ path: path.join(outDir, 'shell-brand-fix-1440.png') });
  await page.locator('.home-banner').screenshot({ path: path.join(outDir, 'home-globe-fix-1440.png') });
  await page.screenshot({ path: path.join(outDir, 'shell-unified-plate-1440.png') });

  server.close();
  await browser.close();
})();
