const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const root = path.join(__dirname, '../../frontend');
const outDir = path.join(__dirname, '_shots');

(async () => {
  const server = await new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let url = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(root, url.replace(/^\//, ''));
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        const ext = path.extname(filePath);
        const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.includes('cdn.jsdelivr.net') || u.includes('echarts')) return route.abort();
    return route.continue();
  });
  await page.goto(`http://127.0.0.1:${port}/pages/home.html?v=49`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => localStorage.setItem('zhitu_user', JSON.stringify({ username: 'demo', name: '演示用户' })));
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('.home-globe-wrap', { timeout: 20000 });
  await page.waitForTimeout(1200);

  const bleed = await page.evaluate(() => {
    const frame = document.querySelector('.app-frame');
    const stage = document.querySelector('.app-stage');
    const fr = frame.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    return {
      framePad: getComputedStyle(frame).padding,
      stageRadius: getComputedStyle(stage).borderRadius,
      gaps: {
        frame: { t: fr.top, l: fr.left, r: innerWidth - fr.right, b: innerHeight - fr.bottom },
        stage: { t: sr.top, l: sr.left, r: innerWidth - sr.right, b: innerHeight - sr.bottom }
      }
    };
  });
  console.log('bleed', JSON.stringify(bleed));
  await page.locator('.home-globe-wrap').screenshot({ path: path.join(outDir, 'home-globe-deepblue-crop.png') });
  await page.screenshot({ path: path.join(outDir, 'home-deepblue-fullbleed-1440.png') });

  await page.click('#qa-fab');
  await page.waitForFunction(() => {
    const f = document.querySelector('#qa-drawer-frame');
    try {
      return f && f.contentDocument && f.contentDocument.querySelector('.chat-bubble');
    } catch (e) { return false; }
  }, { timeout: 20000 });
  await page.waitForTimeout(600);
  const drawerQa = await page.evaluate(() => {
    const doc = document.querySelector('#qa-drawer-frame').contentDocument;
    const bubble = doc.querySelector('.chat-bubble');
    return {
      body: getComputedStyle(doc.body).backgroundColor,
      bubble: bubble ? getComputedStyle(bubble).backgroundColor : null,
      area: getComputedStyle(doc.querySelector('.chat-area')).backgroundColor,
      input: getComputedStyle(doc.querySelector('.chat-input-area')).backgroundColor
    };
  });
  console.log('drawer', JSON.stringify(drawerQa));
  await page.screenshot({ path: path.join(outDir, 'qa-drawer-dark-1440.png') });
  server.close();
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
