const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'frontend');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.geo.json': 'application/json'
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let fp = path.normalize(path.join(root, url));
  if (!fp.startsWith(root)) { res.writeHead(403); return res.end('403'); }
  if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, 'index.html');
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8666, () => console.log('SERVING 8666 root=' + root));
