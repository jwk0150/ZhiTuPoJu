const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, '_shots');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:8890/pages/discovery-detail.html?id=disc_mock_1', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.evaluate(() => {
    sessionStorage.setItem(
      'zhitu_disc_job',
      JSON.stringify({
        id: 'disc_mock_1',
        title: 'AI Agent 架构师',
        confidence: 88,
        status: 'found',
        requiredSkills: ['LangChain', 'RAG']
      })
    );
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const found = await page.evaluate(() => ({
    mode: document.getElementById('view-discovery-detail')?.getAttribute('data-mode'),
    tabs: [...document.querySelectorAll('#dd-tabs button')]
      .filter((b) => !b.hidden)
      .map((b) => b.innerText.replace(/\s+/g, ' ').trim()),
    crumb: document.getElementById('dd-crumb-page')?.textContent
  }));
  console.log('found', JSON.stringify(found, null, 2));
  await page.screenshot({ path: path.join(dir, 'found-tabs-aligned-1440.png'), fullPage: false });

  await page.click('#dd-tabs button[data-sec="skills"]');
  await page.waitForTimeout(600);
  console.log('skills', await page.evaluate(() => document.getElementById('view-discovery-detail')?.getAttribute('data-mode')));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
