/* 复现：打开数字人才地图 → 进入内蒙古 → 模拟点击呼伦贝尔市 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleMsgs = [];
  const netFails = [];
  page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => consoleMsgs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => netFails.push(`${r.method()} ${r.url()} -> ${r.failure() && r.failure().errorText}`));

  try {
    await page.goto('http://127.0.0.1:8080/pages/map.html', { waitUntil: 'networkidle', timeout: 60000 });
    console.log('PAGE_TITLE=', await page.title());
    // 等待地图数据加载
    await page.waitForFunction(() => window.talentMapState && window.talentMapState.dataLoaded, { timeout: 30000 });
    console.log('STATE_LOADED provinces=', await page.evaluate(() => window.talentMapState.allProvinces.length));

    // 进入内蒙古
    const prov = await page.evaluate(() => {
      const p = window.talentMapState.allProvinces.find(x => x.name === '内蒙古');
      return p ? p : null;
    });
    console.log('PROV=', JSON.stringify(prov && prov.name));
    if (!prov) { console.log('NO_PROV_FOUND'); await browser.close(); return; }
    await page.evaluate((p) => window.talentMapSelect(p), prov);
    await page.waitForTimeout(4000);

    // 查看城市列表 cityData
    const cityData = await page.evaluate(() => window.talentMapState.cityData.map(c => c.name));
    console.log('CITY_DATA=', JSON.stringify(cityData));

    // 模拟点击呼伦贝尔市
    console.log('CALL talentHandleCityClick(呼伦贝尔市)');
    await page.evaluate(() => window.talentHandleCityClick('呼伦贝尔市'));
    await page.waitForTimeout(5000);

    // 抓取右侧面板/信息框显示内容
    const ui = await page.evaluate(() => {
      const grab = (id) => { const el = document.getElementById(id); return el ? el.textContent.trim().slice(0, 300) : null; };
      return {
        detailEmpty: grab('talent-detail-empty'),
        hoverName: grab('talent-hover-name'),
        hoverJobs: grab('talent-hover-jobs'),
        hoverSalary: grab('talent-hover-salary'),
        provStats: grab('talent-province-stats'),
        jobFound: grab('talent-job-found-label'),
        provinceJobs: grab('talent-province-jobs'),
        title: grab('talent-province-title'),
        pageTitle: document.title,
      };
    });
    console.log('UI=' + JSON.stringify(ui, null, 1));
  } catch (e) {
    console.log('SCRIPT_ERROR', e.message);
  }

  console.log('=====CONSOLE=====');
  consoleMsgs.slice(0, 60).forEach(m => console.log(m));
  console.log('=====NETFAIL=====');
  netFails.slice(0, 20).forEach(m => console.log(m));

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
