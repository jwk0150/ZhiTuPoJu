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

  await page.goto(`http://127.0.0.1:${port}/pages/match.html?cb=${Date.now()}`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.evaluate(() => localStorage.setItem('zhitu_user', JSON.stringify({ username: 'demo', name: '演示用户' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const diagnose = await page.evaluate(() => {
    const hall = document.getElementById('match-hall');
    const music = document.querySelector('.cinema-music-btn');
    const stage = document.querySelector('.app-stage');
    return {
      hallBg: hall ? getComputedStyle(hall).backgroundColor : null,
      musicBtn: !!music,
      stageBg: stage ? getComputedStyle(stage).backgroundColor : null,
      panelBg: (() => {
        const p = document.querySelector('.career-panel');
        return p ? getComputedStyle(p).backgroundColor : null;
      })()
    };
  });
  console.log('diagnose', diagnose);
  await page.screenshot({ path: path.join(outDir, 'match-diagnose-dark-1440.png') });

  await page.click('[data-hub-tab="profile"]');
  await page.waitForTimeout(1200);
  const frame = page.frameLocator('iframe.profile-embed-frame');
  const profile = await page.evaluate(async () => {
    const iframe = document.querySelector('iframe.profile-embed-frame');
    const doc = iframe && iframe.contentDocument;
    if (!doc) return { ok: false };
    const body = doc.body;
    const hero = doc.querySelector('.hero');
    return {
      ok: true,
      bodyBg: body ? getComputedStyle(body).backgroundColor : null,
      heroBg: hero ? getComputedStyle(hero).backgroundColor : null,
      embedClass: body ? body.className : null
    };
  });
  console.log('profile', profile);
  await page.screenshot({ path: path.join(outDir, 'match-profile-dark-1440.png') });

  server.close();
  await browser.close();
})();
