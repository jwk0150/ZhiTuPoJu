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

  await page.goto(`http://127.0.0.1:${port}/pages/home.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('zhitu_user', JSON.stringify({ username: 'demo', name: '演示用户' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('.home-banner').screenshot({ path: path.join(outDir, 'home-globe-clean-1440.png') });

  await page.goto(`http://127.0.0.1:${port}/pages/discovery.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const disc = await page.evaluate(() => {
    const input = document.querySelector('.proto-search input');
    return input ? getComputedStyle(input).backgroundColor : null;
  });
  console.log('discovery search bg', disc);
  await page.screenshot({ path: path.join(outDir, 'discovery-dark-1440.png') });

  await page.goto(`http://127.0.0.1:${port}/pages/qa-embed.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const qa = await page.evaluate(() => ({
    bodyBg: getComputedStyle(document.body).backgroundColor,
    suggestBg: getComputedStyle(document.querySelector('.qa-suggest')).backgroundColor,
    bubble: (() => {
      const b = document.querySelector('.chat-bubble');
      return b ? getComputedStyle(b).backgroundColor : null;
    })()
  }));
  console.log('qa', qa);
  await page.screenshot({ path: path.join(outDir, 'qa-dark-1440.png') });

  await page.goto(`http://127.0.0.1:${port}/pages/map.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, 'map-canvas-rich-1440.png') });

  server.close();
  await browser.close();
})();
