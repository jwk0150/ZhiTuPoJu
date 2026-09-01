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
      let url = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(root, url.replace(/^\//, ''));
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); return res.end('nf'); }
        const ext = path.extname(filePath);
        const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' };
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
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.includes('cdn.jsdelivr.net')) return route.continue();
    return route.continue();
  });
  await page.goto(`http://127.0.0.1:${port}/pages/discovery.html?v=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => localStorage.setItem('zhitu_user', JSON.stringify({ username: 'demo', name: '演示用户' })));
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('#discovery-grid .job-card, #discovery-grid .empty-state', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, 'discovery-workbench-1440.png') });
  const metrics = await page.evaluate(() => ({
    realPill: !!document.querySelector('.disc-pill.is-real'),
    predPill: !!document.querySelector('.disc-pill.is-pred'),
    cards: document.querySelectorAll('#discovery-grid .job-card').length,
    fcCards: document.querySelectorAll('#forecast-grid .job-card').length,
    mode: document.getElementById('discovery-results')?.getAttribute('data-view-mode')
  }));
  console.log(JSON.stringify(metrics));
  await page.click('.disc-mode-btn[data-mode="graph"]');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, 'discovery-graph-1440.png') });
  server.close();
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
