const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'frontend');
const types = {
  '.html':'text/html; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.svg':'image/svg+xml',
  '.ico':'image/x-icon'
};
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(root, p);
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); res.end('404 Not Found'); return; }
    // 强制无缓存，确保每次刷新都拿到最新文件
    res.writeHead(200, {
      'Content-Type': types[path.extname(fp)] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(d);
  });
}).listen(8090, '0.0.0.0', () => console.log('Serving ' + root + ' on http://0.0.0.0:8090 (no-cache)'));
