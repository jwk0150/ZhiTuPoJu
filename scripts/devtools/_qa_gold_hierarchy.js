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
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        const ext = path.extname(filePath);
        const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
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
  await page.goto(`http://127.0.0.1:${port}/index.html?v=49`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  // jump to scene2 UI without waiting full video
  await page.evaluate(() => {
    document.body.setAttribute('data-phase', 'scene2');
    document.body.classList.add('is-ready');
    const v = document.getElementById('scene2Video');
    if (v) { try { v.pause(); } catch (_) {} }
    const idle = document.getElementById('scene2IdleVideo');
    if (idle) {
      idle.classList.add('is-active');
      idle.play?.().catch(() => {});
    }
  });
  // force typewriter done text for hierarchy check
  await page.evaluate(() => {
    const el = document.getElementById('introTypewriter');
    const panel = document.querySelector('.intro-panel');
    if (el) {
      el.textContent = '把散落的招聘文本收成\n可核对的岗位—能力结构。\n看分布、读变化、发现新岗位，\n再把人和岗位放到同一套语言里对照。';
    }
    panel?.classList.add('is-typed');
  });
  await page.waitForTimeout(1200);
  const colors = await page.evaluate(() => {
    const cs = (sel) => {
      const n = document.querySelector(sel);
      return n ? getComputedStyle(n).color : null;
    };
    return {
      brand: cs('.brand-name'),
      h2: cs('.intro-panel h2'),
      lead: cs('.platform-lead'),
      about: cs('.about-kicker'),
      atlas: cs('.atlas-title'),
      navHidden: getComputedStyle(document.querySelector('.platform-nav')).display
    };
  });
  console.log(JSON.stringify(colors));
  await page.screenshot({ path: path.join(outDir, 'scene2-gold-hierarchy-1440.png') });
  server.close();
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
