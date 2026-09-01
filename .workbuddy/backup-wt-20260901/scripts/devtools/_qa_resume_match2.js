const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://127.0.0.1:8888/pages/resume.html?embed=1&v=20260826rx3', {
    waitUntil: 'domcontentloaded'
  });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);
  await p.fill('[data-bind="basicInfo.name"]', '王测');
  await p.fill('[data-bind="basicInfo.phone"]', '13900001111');
  await p.fill('[data-bind="basicInfo.email"]', 'w@test.com');
  await p.fill('[data-bind="basicInfo.city"]', '杭州');
  await p.fill('[data-bind="basicInfo.school"]', '测试大学');
  await p.fill('[data-bind="basicInfo.major"]', '软件工程');
  await p.click('#rb-step-next');
  await p.waitForTimeout(800);
  const s2 = await p.evaluate(() => ({
    step: document.querySelector('.rb-step-view.is-active')?.dataset.step,
    pos: document.querySelectorAll('.rb-position').length,
    nextDisabled: document.querySelector('#rb-step-next')?.disabled,
    state: JSON.parse(localStorage.getItem('rb_builder_state_v2') || '{}')
  }));
  console.log('S2', JSON.stringify({
    step: s2.step,
    pos: s2.pos,
    nextDisabled: s2.nextDisabled,
    positions: s2.state.jobDirection,
    cur: s2.state.currentStep
  }));
  if (s2.pos) {
    await p.locator('.rb-position').first().click();
    await p.waitForTimeout(300);
  }
  const after = await p.evaluate(() => ({
    nextDisabled: document.querySelector('#rb-step-next')?.disabled,
    positions: JSON.parse(localStorage.getItem('rb_builder_state_v2') || '{}').jobDirection
  }));
  console.log('after', after);
  await p.click('#rb-step-next', { force: true }).catch(() => {});
  await p.waitForTimeout(400);
  const s3 = await p.evaluate(() => ({
    step: document.querySelector('.rb-step-view.is-active')?.dataset.step,
    nextDisabled: document.querySelector('#rb-step-next')?.disabled,
    expLen: (JSON.parse(localStorage.getItem('rb_builder_state_v2') || '{}').experiences || []).length
  }));
  console.log('S3', s3);

  // inject complete state and generate
  await p.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('rb_builder_state_v2') || '{}');
    st.currentStep = 5;
    st.completedSteps = { 1: true, 2: true, 3: true, 4: true };
    st.polish = { complete: true };
    st.jobDirection = { positions: (st.jobDirection && st.jobDirection.positions && st.jobDirection.positions[0])
      ? st.jobDirection.positions
      : ['java'] };
    st.experiences = [{
      id: 1, type: '项目', time: '2024.06-2024.09', title: '校园商城',
      org: '测试大学', role: '后端', brief: '做接口', result: '上线'
    }];
    st.starExperiences = [{
      title: '校园商城', S: '校园场景', T: '开发后端', A: 'Spring Boot', R: '上线使用'
    }];
    st.profile = Object.assign({ skills: ['Java'], summary: '测试评价', personality: '', intent: '', dislike: '' }, st.profile || {});
    st.basicInfo = Object.assign({}, st.basicInfo, {
      name: '王测', phone: '13900001111', email: 'w@test.com', city: '杭州',
      school: '测试大学', major: '软件工程', degree: '本科'
    });
    localStorage.setItem('rb_builder_state_v2', JSON.stringify(st));
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(500);
  await p.click('#rb-step-next');
  await p.waitForTimeout(5500);
  const gen = await p.evaluate(() => {
    const raw = localStorage.getItem('zhitu_match_resume_v1');
    const payload = raw ? JSON.parse(raw) : null;
    return {
      successOn: document.querySelector('#rb-success')?.classList.contains('is-on'),
      hasKey: !!raw,
      basic: payload && payload.sections && payload.sections[0] && payload.sections[0].content
    };
  });
  console.log('GEN', gen);

  await p.goto('http://127.0.0.1:8888/pages/match.html?v=rx3qa', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  const match = await p.evaluate(() => ({
    uploadHidden: document.getElementById('resume-upload-card')?.hidden,
    paper: document.querySelector('#rw-preview')?.innerText?.slice(0, 100),
    tag: document.getElementById('resume-head-metrics')?.innerText
  }));
  console.log('MATCH', match);
  await p.screenshot({ path: 'frontend/_qa/match-from-wizard.png' });
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
