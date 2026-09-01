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
  await page.goto(`http://127.0.0.1:${port}/index.html?v=46`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!document.body.dataset.phase, { timeout: 15000 });
  await page.mouse.click(720, 480);
  await page.waitForFunction(() => document.body.dataset.phase === 'scene2', { timeout: 25000 });
  await page.waitForTimeout(1200);

  const metrics = await page.evaluate(() => {
    const link = document.querySelector('.platform-link');
    const enter = document.querySelector('.platform-enter');
    const lcs = link ? getComputedStyle(link) : null;
    const ecs = enter ? getComputedStyle(enter) : null;
    return {
      linkSize: lcs?.fontSize,
      linkWeight: lcs?.fontWeight,
      linkColor: lcs?.color,
      enterSize: ecs?.fontSize,
      enterWeight: ecs?.fontWeight
    };
  });
  console.log(metrics);

  const topbar = await page.locator('.topbar');
  await topbar.screenshot({ path: path.join(outDir, 'scene2-nav-font-1440.png') });

  server.close();
  await browser.close();
})();
