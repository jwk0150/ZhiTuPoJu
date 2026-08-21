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
      if (url === '/') url = '/index.html';
      const filePath = path.join(root, url.replace(/^\//, ''));
      if (!filePath.startsWith(root)) {
        res.writeHead(403);
        return res.end();
      }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); return res.end('nf'); }
        const ext = path.extname(filePath);
        const types = {
          '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
          '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4'
        };
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

  await page.goto(`${base}/pages/home.html?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate(() => {
    localStorage.setItem('zhitu_user', JSON.stringify({ username: 'demo', name: '演示用户' }));
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForSelector('.home-globe-wrap', { timeout: 20000 });
  await page.waitForTimeout(1500);

  const layout = await page.evaluate(() => {
    const frame = document.querySelector('.app-frame');
    const stage = document.querySelector('.app-stage');
    return {
      framePad: frame ? getComputedStyle(frame).padding : null,
      stageRadius: stage ? getComputedStyle(stage).borderRadius : null,
      hasCinema: !!document.getElementById('cinema-bg'),
      globeSrc: document.querySelector('.home-globe')?.getAttribute('src')
    };
  });
  console.log('layout', JSON.stringify(layout));
  await page.screenshot({ path: path.join(outDir, 'home-deepblue-fullbleed-1440.png') });
  await page.locator('.home-globe-wrap').screenshot({ path: path.join(outDir, 'home-globe-deepblue-crop.png') });

  await page.goto(`${base}/pages/qa-embed.html?cb=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const qa = await page.evaluate(() => {
    const bubble = document.querySelector('.chat-bubble');
    return {
      body: getComputedStyle(document.body).backgroundColor,
      area: getComputedStyle(document.querySelector('.chat-area')).backgroundColor,
      bubble: bubble ? getComputedStyle(bubble).backgroundColor : null,
      input: getComputedStyle(document.querySelector('.chat-input-area')).backgroundColor
    };
  });
  console.log('qa', JSON.stringify(qa));
  await page.screenshot({ path: path.join(outDir, 'qa-dark-standalone-1440.png') });

  // drawer path
  await page.goto(`${base}/pages/home.html?cb=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const d = document.querySelector('.qa-drawer');
    if (d) d.classList.add('is-open');
  });
  await page.waitForTimeout(1200);
  const drawerQa = await page.evaluate(() => {
    const iframe = document.querySelector('.qa-drawer-frame');
    if (!iframe || !iframe.contentDocument) return { err: 'no doc' };
    const doc = iframe.contentDocument;
    const bubble = doc.querySelector('.chat-bubble');
    return {
      body: getComputedStyle(doc.body).backgroundColor,
      bubble: bubble ? getComputedStyle(bubble).backgroundColor : null,
      area: getComputedStyle(doc.querySelector('.chat-area')).backgroundColor
    };
  });
  console.log('drawer', JSON.stringify(drawerQa));
  await page.screenshot({ path: path.join(outDir, 'qa-drawer-dark-1440.png') });

  server.close();
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
