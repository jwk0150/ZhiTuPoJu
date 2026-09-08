const { chromium } = require('playwright');
const exe = process.env.LOCALAPPDATA + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe';

(async () => {
  const b = await chromium.launch({ executablePath: exe, headless: true });
  const p = await b.newPage();

  // 1) 无 token 直接调管理接口
  let r = await p.request.get('http://127.0.0.1:5000/api/admin/overview');
  console.log('无 token /api/admin/overview ->', r.status(), '(期望 401)');

  // 2) 伪造 token（自己签的假 JWT）
  r = await p.request.get('http://127.0.0.1:5000/api/admin/overview', {
    headers: { Authorization: 'Bearer fake.token.here' }
  });
  console.log('伪造 token ->', r.status(), '(期望 401)');

  // 3) 普通用户登录 → 调管理接口
  r = await p.request.post('http://127.0.0.1:5000/api/auth/login', {
    data: { username: 'user', password: 'user123' }
  });
  let jb = await r.json();
  const userToken = (jb.data && jb.data.token) || jb.token;
  console.log('普通用户登录 ->', r.status(), '有token:', !!userToken);
  r = await p.request.get('http://127.0.0.1:5000/api/admin/overview', {
    headers: { Authorization: 'Bearer ' + userToken }
  });
  console.log('普通用户 /api/admin/overview ->', r.status(), '(期望 403)');

  // 4) 管理员登录 → 调管理接口
  r = await p.request.post('http://127.0.0.1:5000/api/auth/login', {
    data: { username: 'shangshanruoshui', password: 'ssrs123' }
  });
  jb = await r.json();
  const adminToken = (jb.data && jb.data.token) || jb.token;
  console.log('管理员登录 ->', r.status(), '有token:', !!adminToken);
  r = await p.request.get('http://127.0.0.1:5000/api/admin/overview', {
    headers: { Authorization: 'Bearer ' + adminToken }
  });
  const body = await r.json();
  console.log('管理员 /api/admin/overview ->', r.status(), '(期望 200) 数据源:', JSON.stringify(body).includes('live') ? 'live' : 'demo/fallback');

  // 5) 其余 admin 接口抽查
  for (const u of ['/api/admin/session', '/api/admin/users', '/api/admin/audit']) {
    const r1 = await p.request.get('http://127.0.0.1:5000' + u);
    const r2 = await p.request.get('http://127.0.0.1:5000' + u, { headers: { Authorization: 'Bearer ' + adminToken } });
    console.log(u, '无token:', r1.status(), '| admin:', r2.status());
  }
  await b.close();
})();
