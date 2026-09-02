const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  async function shot(job, name) {
    await page.goto('http://127.0.0.1:8890/pages/discovery-detail.html?id=' + job.id, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.evaluate((j) => sessionStorage.setItem('zhitu_disc_job', JSON.stringify(j)), job);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1400);
    const info = await page.evaluate(() => ({
      brief: (document.getElementById('dd-brief')?.textContent || '').slice(0, 80),
      who: document.querySelectorAll('#dd-who li').length,
      day: document.querySelectorAll('#dd-day li').length,
      scenes: document.querySelectorAll('#dd-scenes .dd-scene').length,
      eta: !document.getElementById('dd-eta')?.hidden
    }));
    console.log(name, JSON.stringify(info));
    await page.screenshot({ path: path.join(dir, name + '.png'), fullPage: false });
  }

  await shot(
    {
      id: 'disc_mock_1',
      title: 'AI Agent 架构师',
      confidence: 88,
      category: '人工智能',
      status: 'found'
    },
    'portrait-found-rich-1440'
  );

  await shot(
    {
      id: 'forecast_mock_1',
      title: '端侧AI部署工程师',
      confidence: 86,
      category: '人工智能',
      is_forecast: true,
      status: 'forecast',
      eta_months: '8-12',
      definition: '负责端侧模型部署、更新与运行保障，打通边缘设备与中心编排。'
    },
    'portrait-forecast-rich-1440'
  );

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
