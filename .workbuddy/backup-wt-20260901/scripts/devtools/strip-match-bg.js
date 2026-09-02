const fs = require('fs');
const p = 'frontend/css/match.css';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(
  /url\("\.\.\/assets\/match\/match-hero-bg\.png"\)[^;]*/g,
  'linear-gradient(145deg,#071820 0%,#0b1c24 45%,#0a151c 100%)'
);
s = s.replace(/,\s*url\("\.\.\/assets\/match\/scene-[^"]+"\)/g, '');
s = s.replace(
  /url\("\.\.\/assets\/match\/scene-[^"]+"\)/g,
  'linear-gradient(135deg,#0b1c24,#102832)'
);
s = s.replace(/url\("\.\.\/assets\/match\/bench-station\.png"\)[^;]*/g, 'none');
s = s.replace(/url\("\.\.\/assets\/match\/(cat-squad|train-vines)\.png"\)[^;]*/g, 'none');
s = s.replace(/center \/ cover fixed no-repeat/g, 'center / cover no-repeat');
fs.writeFileSync(p, s);
const left = (s.match(/assets\/match/g) || []).length;
console.log('remaining match asset urls:', left);
