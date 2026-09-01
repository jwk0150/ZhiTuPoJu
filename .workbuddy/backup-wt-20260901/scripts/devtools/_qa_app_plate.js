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
      if (!filePath.startsWith(root)) {
        res.writeHead(403);
        return res.end();
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          return res.end('Not found');
        }
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
  const base = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    localStorage.setItem('zhitu_user', JSON.stringify({ username: 'demo', name: '演示用户' }));
  } catch (_) {}

  await page.goto(`${base}/pages/home.html?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('zhitu_user', JSON.stringify({ username: 'demo', name: '演示用户' }));
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1800);

  const homeMetrics = await page.evaluate(() => {
    const plate = document.querySelector('.page-main');
    const quick = document.querySelector('.home-quick');
    const panel = document.querySelector('.home-panel');
    const bg = document.getElementById('cinema-bg');
    const pcs = plate ? getComputedStyle(plate) : null;
    const qcs = quick ? getComputedStyle(quick) : null;
    const pnl = panel ? getComputedStyle(panel) : null;
    return {
      hasBg: !!bg,
      plateBg: pcs?.backgroundColor,
      plateBlur: pcs?.backdropFilter,
      quickBg: qcs?.backgroundColor,
      panelBg: pnl?.backgroundColor,
      plateRadius: pcs?.borderRadius
    };
  });
  console.log('home', homeMetrics);
  await page.screenshot({ path: path.join(outDir, 'app-plate-home-1440.png'), fullPage: false });

  await page.goto(`${base}/pages/insight.html?cb=${Date.now()}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const insightMetrics = await page.evaluate(() => {
    const plate = document.querySelector('.page-main');
    const card = document.querySelector('.card');
    const pcs = plate ? getComputedStyle(plate) : null;
    const ccs = card ? getComputedStyle(card) : null;
    return { plateBg: pcs?.backgroundColor, cardBg: ccs?.backgroundColor };
  });
  console.log('insight', insightMetrics);
  await page.screenshot({ path: path.join(outDir, 'app-plate-insight-1440.png'), fullPage: false });

  await page.goto(`${base}/pages/map.html?cb=${Date.now()}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, 'app-plate-map-1440.png'), fullPage: false });

  server.close();
  await browser.close();
  console.log('done');
})();
