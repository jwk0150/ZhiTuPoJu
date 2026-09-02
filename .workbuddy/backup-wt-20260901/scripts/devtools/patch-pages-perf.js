const fs = require('fs');
const path = require('path');

const roots = ['frontend/pages'];
const files = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (name.endsWith('.html')) files.push(p);
  }
}
roots.forEach(walk);

let n = 0;
for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  const before = s;

  s = s.replace(
    /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/echarts@5\.5\.0\/dist\/echarts\.min\.js"><\/script>/g,
    '<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js" defer></script>'
  );
  s = s.replace(
    /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@antv\/g6@4\.8\.24\/dist\/g6\.min\.js"><\/script>\s*/g,
    ''
  );
  s = s.replace(
    /cinema-bg\.js(\?v=[^"']+)?/g,
    'cinema-bg.js?v=20260824mem'
  );
  s = s.replace(
    /cinema-music\.js(\?v=[^"']+)?/g,
    'cinema-music.js?v=20260824mem'
  );

  if (!s.includes('perf-guard.js') && s.includes('cinema-bg.js')) {
    s = s.replace(
      /(<script src="[^"]*cinema-bg\.js[^"]*"><\/script>)/,
      '$1\n  <script src="' +
        (file.replace(/\\/g, '/').includes('/news/') || file.replace(/\\/g, '/').includes('/more/')
          ? '../../js/perf-guard.js?v=1'
          : '../js/perf-guard.js?v=1') +
        '"></script>'
    );
  }

  if (s !== before) {
    fs.writeFileSync(file, s);
    n++;
    console.log('updated', file);
  }
}
console.log('files changed', n);
