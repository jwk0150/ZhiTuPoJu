const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const outDir = path.join(__dirname, '../../frontend/_qa');
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });

  // Simulate login → news → resume explorer
  await p.goto('http://127.0.0.1:8888/login.html', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => {
    localStorage.setItem('zhitu_user', JSON.stringify({ username: 'developer', role: 'dev', loginTime: Date.now() }));
    sessionStorage.setItem('zhitu_open_resume', '1');
    localStorage.removeItem('rb_builder_state_v1');
    localStorage.removeItem('rb_builder_state_v2');
  });
  await p.goto('http://127.0.0.1:8888/pages/news/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);

  // Wait for resume iframe
  const frame = p.frameLocator('#rx-frame');
  await p.waitForSelector('#rx-modal:not([hidden])', { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(800);

  const info = await p.evaluate(async () => {
    const iframe = document.querySelector('#rx-frame');
    const src = iframe && iframe.getAttribute('src');
    let doc = null;
    try { doc = iframe && iframe.contentDocument; } catch (e) {}
    if (!doc) return { src, err: 'no-doc' };
    return {
      src,
      brand: (doc.querySelector('.rb-brand') || {}).innerText || '',
      nexus: !!doc.body && doc.body.innerHTML.indexOf('NEXUS') >= 0,
      zhitu: !!doc.body && doc.body.innerHTML.indexOf('执图破局') >= 0,
      leftHead: !!doc.querySelector('.rb-left-head'),
      brandbar: !!doc.querySelector('.rb-brandbar'),
      brandbarDisplay: doc.querySelector('.rb-brandbar')
        ? getComputedStyle(doc.querySelector('.rb-brandbar')).display
        : null,
      nav: [...doc.querySelectorAll('#rb-topnav-steps .rb-step')].map((el) =>
        el.textContent.replace(/\s+/g, ' ').trim()
      ),
      h2: (doc.querySelector('.rb-step-view.is-active h2') || {}).innerText || '',
      choice: [...doc.querySelectorAll('.rb-choice-btn b')].map((el) => el.textContent.trim())
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await p.screenshot({ path: path.join(outDir, 'login-resume-shell.png') });

  // Also open embed directly at step 3
  await p.goto('http://127.0.0.1:8888/pages/resume.html?embed=1&v=20260826r5', {
    waitUntil: 'domcontentloaded'
  });
  await p.evaluate(() => {
    localStorage.setItem(
      'rb_builder_state_v2',
      JSON.stringify({
        currentStep: 3,
        completedSteps: { 1: true, 2: true },
        basicInfo: {
          name: '测', phone: '1', email: 'a@b.c', city: '上海',
          degree: '本科', school: '测大', major: '软件工程', graduate: '2025.06'
        },
        jobDirection: { positions: ['java'] },
        experiences: [{ id: 1, type: '', time: '2024.06 - 2024.09', title: '', org: '', role: '', brief: '', result: '' }],
        starExperiences: [],
        profile: { personality: '', intent: '', dislike: '', skills: ['Java'], summary: '' },
        photo: null,
        ai: { expHint: '' },
        polish: { complete: false },
        generated: false
      })
    );
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  const step3 = await p.evaluate(() => ({
    brand: (document.querySelector('.rb-brand') || {}).innerText || '',
    nexus: document.body.innerHTML.indexOf('NEXUS') >= 0,
    h2: (document.querySelector('.rb-step-view.is-active h2') || {}).innerText || '',
    choice: [...document.querySelectorAll('.rb-choice-btn b')].map((el) => el.textContent.trim()),
    leftHead: !!document.querySelector('.rb-left-head'),
    goHome: (document.querySelector('#rb-go-home') || {}).innerText || ''
  }));
  console.log('STEP3', JSON.stringify(step3, null, 2));
  await p.screenshot({ path: path.join(outDir, 'resume-step3-zhitu.png') });
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
