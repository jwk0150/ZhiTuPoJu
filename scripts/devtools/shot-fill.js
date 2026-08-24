const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('http://127.0.0.1:8890/pages/discovery-detail.html?id=disc_mock_1', {
    waitUntil: 'networkidle',
    timeout: 15000
  });
  await page.waitForTimeout(2800);
  const cmp = await page.$('.dd-panel-cmp');
  const graph = await page.$('.dd-panel-graph');
  const skills = await page.$('.dd-fc-skills');
  if (cmp) await cmp.screenshot({ path: '../../frontend/_qa/disc-cmp-fill.png' });
  if (graph) await graph.screenshot({ path: '../../frontend/_qa/disc-graph-fill.png' });
  if (skills) await skills.screenshot({ path: '../../frontend/_qa/disc-skills-fill.png' });
  const info = await page.evaluate(() => {
    const lanes = document.querySelectorAll('.dd-cmp-lane').length;
    const chips = document.querySelectorAll('.dd-skill-chip').length;
    const podium = document.querySelectorAll('.dd-skill-podium-card').length;
    const wrap = document.querySelector('.dd-cmp-lanes-wrap');
    const list = document.querySelector('.dd-cmp-lanes');
    return {
      sh: document.body.scrollHeight,
      vh: window.innerHeight,
      lanes,
      podium,
      chips,
      cmpFill: wrap && list ? Math.round((list.scrollHeight / wrap.clientHeight) * 100) : 0,
      legendItems: document.querySelectorAll('.dd-graph-leg-item').length
    };
  });
  console.log(JSON.stringify(info));
  await browser.close();
})();
