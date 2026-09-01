const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('http://127.0.0.1:8890/pages/discovery-detail.html?id=forecast_mock_1', {
    waitUntil: 'networkidle'
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '../../frontend/_qa/disc-fc-v84.png', fullPage: false });
  const duties = await page.$('#dd-fc-board .dd-fc-duties');
  if (duties) await duties.screenshot({ path: '../../frontend/_qa/disc-fc-duties-v84.png' });
  const box = await page.evaluate(() => {
    const sels = ['.dd-fc-prob', '.dd-fc-industry', '.dd-fc-supply', '.dd-fc-risk'];
    const els = sels.map((s) => document.querySelector('#dd-fc-board ' + s)).filter(Boolean);
    const rects = els.map((e) => e.getBoundingClientRect());
    return {
      x: Math.min(...rects.map((r) => r.left)),
      y: Math.min(...rects.map((r) => r.top)),
      width: Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left)),
      height: Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top))
    };
  });
  await page.screenshot({ path: '../../frontend/_qa/disc-fc-bottom-v84.png', clip: box });
  const info = await page.evaluate(() => {
    const shell = document.getElementById('dd-fc-duties-shell');
    const vp = document.getElementById('dd-fc-duties-viewport');
    const item = document.querySelector('#dd-fc-duties .dd-fc-duty-item');
    const cs = item ? getComputedStyle(item) : null;
    return {
      sh: document.documentElement.scrollHeight,
      shellH: shell.clientHeight,
      vpH: vp.clientHeight,
      rowH: shell.style.getPropertyValue('--dd-duty-row-h'),
      itemH: item ? item.clientHeight : 0,
      computedH: cs ? cs.height : '',
      boxSizing: cs ? cs.boxSizing : '',
      fillRatio: item && vp ? ((item.clientHeight * 3 + 8) / vp.clientHeight).toFixed(3) : ''
    };
  });
  console.log(JSON.stringify(info));
  await browser.close();
})();
