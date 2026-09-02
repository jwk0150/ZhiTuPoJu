const { chromium } = require('playwright');
const { execSync } = require('child_process');

function chromeRssMB(pid) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -eq ${pid} -or $_.ParentProcessId -eq ${pid} } | Measure-Object -Property WorkingSetSize -Sum).Sum / 1MB"`,
      { encoding: 'utf8' }
    );
    return +(+out.trim()).toFixed(1);
  } catch (_) {
    return null;
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-dev-shm-usage']
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const browserPid = browser.process().pid;

  async function sample(label) {
    await page.waitForTimeout(3000);
    const rss = chromeRssMB(browserPid);
    const heap = await page.evaluate(() =>
      performance.memory
        ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1)
        : null
    );
    const video = await page.evaluate(() => {
      const v = document.querySelector('.cinema-bg-video');
      if (!v) return { present: false };
      return {
        present: true,
        src: !!(v.getAttribute('src') || v.src),
        paused: v.paused,
        w: v.videoWidth,
        h: v.videoHeight
      };
    });
    console.log(JSON.stringify({ label, rssMB: rss, heapMB: heap, video }));
  }

  await page.goto('http://127.0.0.1:8080/pages/map.html', { waitUntil: 'domcontentloaded' });
  await sample('map+video-boot');

  await page.goto('http://127.0.0.1:8080/pages/news/index.html', { waitUntil: 'domcontentloaded' });
  await sample('news');

  await page.goto('http://127.0.0.1:8080/pages/insight.html', { waitUntil: 'domcontentloaded' });
  await sample('insight');

  await page.goto('http://127.0.0.1:8080/pages/match.html', { waitUntil: 'domcontentloaded' });
  await sample('match');

  await browser.close();
})();
