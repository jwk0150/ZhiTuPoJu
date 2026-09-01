const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const outDir = path.join(__dirname, '../../frontend/_qa');

  await p.goto('http://127.0.0.1:8888/pages/resume.html?embed=1&v=fix5', {
    waitUntil: 'domcontentloaded'
  });
  await p.evaluate(() => {
    localStorage.removeItem('rb_builder_state_v2');
    localStorage.removeItem('rb_builder_state_v1');
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);

  const step1 = await p.evaluate(() => ({
    brand: document.querySelector('.rb-brand') && document.querySelector('.rb-brand').innerText,
    nav: [...document.querySelectorAll('#rb-topnav-steps .rb-step')].map((el) =>
      el.textContent.replace(/\s+/g, ' ').trim()
    ),
    steps: [...document.querySelectorAll('.rb-step-view')].map((el) => el.dataset.step),
    title: document.querySelector('.rb-step-view.is-active h2') &&
      document.querySelector('.rb-step-view.is-active h2').innerText
  }));
  console.log('STEP1', JSON.stringify(step1, null, 2));

  await p.fill('[data-bind="basicInfo.name"]', '测试用户');
  await p.fill('[data-bind="basicInfo.phone"]', '13800000000');
  await p.fill('[data-bind="basicInfo.email"]', 't@example.com');
  await p.fill('[data-bind="basicInfo.city"]', '上海');
  await p.fill('[data-bind="basicInfo.school"]', '测试大学');
  await p.fill('[data-bind="basicInfo.major"]', '软件工程');
  await p.selectOption('[data-bind="basicInfo.degree"]', '本科');
  await p.fill('[data-bind="basicInfo.graduate"]', '2025.06');
  await p.click('#rb-step-next');
  await p.waitForTimeout(500);

  const step2 = await p.evaluate(() => ({
    h2: document.querySelector('.rb-step-view.is-active h2') &&
      document.querySelector('.rb-step-view.is-active h2').innerText,
    persona: document.querySelector('#rb-persona-text') &&
      document.querySelector('#rb-persona-text').innerText,
    eyebrow: document.querySelector('.rb-profile-card-eyebrow') &&
      document.querySelector('.rb-profile-card-eyebrow').innerText,
    posCount: document.querySelectorAll('.rb-position').length
  }));
  console.log('STEP2', JSON.stringify(step2, null, 2));
  await p.screenshot({ path: path.join(outDir, 'resume-5step-persona.png') });

  await p.evaluate(() => {
    localStorage.removeItem('rb_builder_state_v2');
    localStorage.removeItem('rb_builder_state_v1');
    localStorage.setItem(
      'rb_builder_state_v2',
      JSON.stringify({
        currentStep: 2,
        completedSteps: { 1: true },
        basicInfo: {
          name: '',
          phone: '',
          email: '',
          city: '',
          degree: '',
          school: '',
          major: '',
          graduate: ''
        },
        jobDirection: { positions: [] },
        experiences: [],
        starExperiences: [],
        profile: { personality: '', intent: '', dislike: '', skills: [], summary: '' },
        photo: null,
        ai: { expHint: '' },
        polish: { complete: false },
        generated: false
      })
    );
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  const emptyPersona = await p.evaluate(
    () => document.querySelector('#rb-persona-text') && document.querySelector('#rb-persona-text').innerText
  );
  console.log('EMPTY', emptyPersona);
  await p.screenshot({ path: path.join(outDir, 'resume-5step-empty-persona.png') });
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
