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
        category: '人工智能',
        status: 'found',
        requiredSkills: ['LangChain', 'Function Calling', 'RAG', 'Python']
      })
    );
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => ({
    crumb: document.getElementById('dd-crumb-page')?.textContent,
    mode: document.getElementById('view-discovery-detail')?.getAttribute('data-mode'),
    tabs: [...document.querySelectorAll('#dd-tabs button')]
      .filter((b) => !b.hidden)
      .map((b) => b.innerText.replace(/\s+/g, ' ').trim()),
    cards: document.querySelectorAll('.dd-skill-card').length,
    brief: (document.getElementById('dd-skills-brief')?.textContent || '').slice(0, 40),
    hasPortraitTab: [...document.querySelectorAll('#dd-tabs button')]
      .filter((b) => !b.hidden)
      .some((b) => b.textContent.indexOf('画像') >= 0)
  }));
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: path.join(dir, 'found-skills-page-1440.png'), fullPage: false });

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
