/* Temporary verification script - deleted after use */
const { chromium } = require('playwright');

const results = [];
function report(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name + ' | ' + detail);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('http://127.0.0.1:8080/pages/map.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.talentMapState && window.talentMapState.allProvinces && window.talentMapState.allProvinces.length > 0, null, { timeout: 30000 });

  // ===== 工具函数 =====
  const enterCityMap = async (provName) => {
    await page.evaluate((pn) => {
      const p = window.talentMapState.allProvinces.find(x => x.name === pn);
      window.talentMapSelect(p);
    }, provName);
    await page.waitForFunction(() => window.talentMapState.mapLevel === 'province' && window.talentMapState.cityGeoLoaded, null, { timeout: 30000 });
    await page.waitForTimeout(600);
  };
  const fillStats = () => page.evaluate(() => {
    const list = window.talentMapState.mapChart.getZr().storage.getDisplayList();
    const m = {};
    let total = 0;
    list.forEach(el => {
      if (el.type === 'compound') {
        const f = String((el.style && el.style.fill) || '');
        m[f] = (m[f] || 0) + 1; total++;
      }
    });
    return { unique: Object.keys(m).length, total, dist: m };
  });

  // ===== 测试 1: 全国 → 点击省份 → 市级地图颜色独立 =====
  await enterCityMap('广东');
  let s = await fillStats();
  report('T1 进入市级地图颜色独立', s.unique >= 8, 'unique=' + s.unique + '/' + s.total);

  // ===== 测试 2: 刚进入后立即鼠标移动 → 颜色仍存在 =====
  const centers = await page.evaluate(() => {
    const chart = window.talentMapState.mapChart;
    const rect = chart.getDom().getBoundingClientRect();
    const out = { ox: rect.left, oy: rect.top };
    ['广州市', '深圳市', '清远市', '韶关市'].forEach(nm => {
      const f = window.talentMapState.cityGeoJSON.features.find(x => x.properties.name === nm);
      if (f && f.properties.center) {
        const px = chart.convertToPixel({ geoIndex: 0 }, f.properties.center);
        out[nm] = { x: Math.round(rect.left + px[0]), y: Math.round(rect.top + px[1]) };
      }
    });
    return out;
  });
  await page.mouse.move(centers['广州市'].x, centers['广州市'].y, { steps: 6 });
  await page.waitForTimeout(300);
  await page.mouse.move(centers.ox + 60, centers.oy + 700, { steps: 5 });
  await page.waitForTimeout(500);
  s = await fillStats();
  report('T2 立即移动鼠标颜色仍存在', s.unique >= 8, 'unique=' + s.unique);

  // ===== 测试 3: 连续 Hover A→B→C→D =====
  let allKept = true, hovOk = true, details = [];
  for (const nm of ['广州市', '深圳市', '清远市', '韶关市']) {
    await page.mouse.move(centers[nm].x, centers[nm].y, { steps: 8 });
    await page.waitForTimeout(650);
    const st = await page.evaluate(() => window.talentMapState.hoveredCityName);
    const fs = await fillStats();
    if (st !== nm) hovOk = false;
    if (fs.unique < 8 || fs.dist['#6FA9A4'] === fs.total) allKept = false;
    details.push(nm + '→hov=' + st + ',unique=' + fs.unique);
  }
  report('T3 连续Hover状态联动', hovOk, details.join('; '));
  report('T3b Hover中各城市保持独立颜色', allKept, details.map(d => d.split(',')[1]).join('; '));

  // 移出恢复
  await page.mouse.move(centers.ox + 30, centers.oy + 720, { steps: 5 });
  await page.waitForTimeout(700);
  s = await fillStats();
  report('T3c 移出后颜色恢复', s.unique >= 8, 'unique=' + s.unique);

  // ===== 测试 4: 进入岗位页面 → 返回 → 颜色依旧正常 =====
  await page.evaluate(() => window.talentHandleCityClick('广州市'));
  await page.waitForFunction(() => window.talentMapState.selectedCity, null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  const analysisVisible = await page.evaluate(() => document.getElementById('talent-layer-province').style.display !== 'none');
  await page.evaluate(() => window.talentMapBack());
  await page.waitForTimeout(1500);
  s = await fillStats();
  report('T4 岗位页返回后颜色正常', analysisVisible && s.unique >= 8, 'analysisVisible=' + analysisVisible + ',unique=' + s.unique);

  // ===== 测试 5: 切换其他省份 =====
  await page.evaluate(() => { window.talentMapState.hoveredCityName = null; window.talentUnfocusProvince(); });
  await page.waitForTimeout(1400);
  await enterCityMap('浙江');
  s = await fillStats();
  report('T5 切换其他省份颜色正常', s.unique >= 8, 'unique=' + s.unique);

  // ===== 卡片布局测试（进入杭州岗位分析）=====
  await page.evaluate(() => window.talentHandleCityClick('杭州市'));
  await page.waitForFunction(() => window.talentMapState.selectedCity, null, { timeout: 15000 });
  await page.waitForTimeout(1500);

  const cardInfo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#talent-province-jobs .talent-job-card'));
    const heights = cards.map(c => c.offsetHeight);
    const skillsEl = document.querySelector('.talent-job-skills');
    const nameEl = document.querySelector('.talent-job-name');
    const wrap = getComputedStyle(skillsEl).flexWrap;
    const nameColor = getComputedStyle(nameEl).color;
    const nameWeight = getComputedStyle(nameEl).fontWeight;
    const bodyOverflow = document.documentElement.scrollWidth <= window.innerWidth;
    return {
      count: cards.length,
      heights,
      uniform: new Set(heights).size === 1,
      wrap, nameColor, nameWeight, bodyOverflow,
      skillCount: document.querySelectorAll('.talent-job-skill').length
    };
  });
  report('C1 卡片渲染数量', cardInfo.count >= 10, 'count=' + cardInfo.count + ',skills=' + cardInfo.skillCount);
  report('C2 卡片高度增加且统一', cardInfo.uniform && Math.max(...cardInfo.heights) >= 70, 'heights=' + JSON.stringify(cardInfo.heights.slice(0, 5)) + ' max=' + Math.max(...cardInfo.heights));
  report('C3 技术标签允许换行', cardInfo.wrap === 'wrap', 'flexWrap=' + cardInfo.wrap);
  report('C4 岗位名称金色加粗', cardInfo.nameColor === 'rgb(240, 199, 92)' && parseInt(cardInfo.nameWeight) >= 700, 'color=' + cardInfo.nameColor + ',weight=' + cardInfo.nameWeight);
  report('C5 无横向溢出', cardInfo.bodyOverflow, 'scrollWidth<=innerWidth=' + cardInfo.bodyOverflow);

  // ===== Hover 岗位详情测试 =====
  const hoverDetail = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#talent-province-jobs .talent-job-card'));
    const r1 = cards[0].getBoundingClientRect();
    const r2 = cards[1].getBoundingClientRect();
    return {
      c1: { x: r1.left + r1.width / 2, y: r1.top + r1.height / 2, name: cards[0].querySelector('.talent-job-name').textContent },
      c2: { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2, name: cards[1].querySelector('.talent-job-name').textContent }
    };
  });
  await page.mouse.move(hoverDetail.c1.x, hoverDetail.c1.y, { steps: 4 });
  await page.waitForTimeout(400);
  let jd = await page.evaluate(() => {
    const p = document.getElementById('talent-detail-job');
    return { visible: p.style.display === 'block', text: p.textContent };
  });
  report('H1 Hover卡片1右侧显示详情', jd.visible && jd.text.includes(hoverDetail.c1.name), 'visible=' + jd.visible + ',nameMatch=' + jd.text.includes(hoverDetail.c1.name));
  report('H1b 详情含完整字段', ['岗位数量', '平均薪资', '热度', '岗位类别', '核心技术'].every(k => jd.text.includes(k)), jd.text.slice(0, 80));

  await page.mouse.move(hoverDetail.c2.x, hoverDetail.c2.y, { steps: 4 });
  await page.waitForTimeout(400);
  jd = await page.evaluate(() => {
    const p = document.getElementById('talent-detail-job');
    return { visible: p.style.display === 'block', text: p.textContent };
  });
  report('H2 Hover切换自动更新', jd.visible && jd.text.includes(hoverDetail.c2.name), 'nameMatch=' + jd.text.includes(hoverDetail.c2.name));

  await page.mouse.move(hoverDetail.c2.x + 900, hoverDetail.c2.y, { steps: 4 });
  await page.waitForTimeout(400);
  jd = await page.evaluate(() => {
    const p = document.getElementById('talent-detail-job');
    return { visible: p.style.display === 'block', text: p.textContent };
  });
  report('H3 移出保持最后岗位信息', jd.visible && jd.text.includes(hoverDetail.c2.name), 'kept=' + jd.text.includes(hoverDetail.c2.name));

  // ===== 图谱双模式测试 =====
  await page.evaluate(() => window.talentSelectJob(0));
  await page.evaluate(() => window.talentMapEnterGraph());
  await page.waitForTimeout(2500);
  let g = await page.evaluate(() => {
    const inst = window.talentMapState.jobGraphInstance;
    if (!inst) return { err: 'no instance' };
    const center = inst.getNodes().map(n => n.getModel()).find(m => m.id === 'center');
    const linkEdges = inst.getEdges().map(e => e.getModel()).filter(e => String(e.id).indexOf('link-') === 0);
    return {
      centerLabel: center && center.label,
      jobName: window.talentMapState.selectedJob && window.talentMapState.selectedJob.name,
      cityName: window.talentMapState.selectedCity.displayName || window.talentMapState.selectedCity.name,
      toggleVisible: document.getElementById('talent-graph-mode-toggle').style.display,
      jobActive: document.getElementById('talent-graph-mode-job').classList.contains('active'),
      cityActive: document.getElementById('talent-graph-mode-city').classList.contains('active'),
      linkEdgeCount: linkEdges.length,
      quadType: linkEdges.length ? linkEdges[0].type : null,
      nodeCount: inst.getNodes().length
    };
  });
  report('G1 默认岗位技术图谱(中心=岗位)', g.centerLabel === g.jobName, 'center=' + g.centerLabel + ',job=' + g.jobName);
  report('G2 气泡可见且默认选中岗位图谱', g.toggleVisible === 'flex' && g.jobActive && !g.cityActive, 'toggle=' + g.toggleVisible);
  report('G3 技术关联曲线保留', g.linkEdgeCount >= 3 && g.quadType === 'quadratic', 'linkEdges=' + g.linkEdgeCount + ',type=' + g.quadType + ',nodes=' + g.nodeCount);

  // 切换到市级知识图谱
  await page.evaluate(() => window.talentSetGraphMode('city'));
  await page.waitForTimeout(1600);
  g = await page.evaluate(() => {
    const inst = window.talentMapState.jobGraphInstance;
    const center = inst.getNodes().map(n => n.getModel()).find(m => m.id === 'center');
    const linkEdges = inst.getEdges().map(e => e.getModel()).filter(e => String(e.id).indexOf('link-') === 0);
    return {
      centerLabel: center && center.label,
      cityName: window.talentMapState.selectedCity.displayName || window.talentMapState.selectedCity.name,
      cityActive: document.getElementById('talent-graph-mode-city').classList.contains('active'),
      jobActive: document.getElementById('talent-graph-mode-job').classList.contains('active'),
      fading: document.getElementById('talent-graph-container').classList.contains('graph-fading'),
      transition: getComputedStyle(document.getElementById('talent-graph-container')).transitionDuration,
      nodeCount: inst.getNodes().length,
      linkEdgeCount: linkEdges.length
    };
  });
  report('G4 切换市级图谱中心=城市名', g.centerLabel === g.cityName, 'center=' + g.centerLabel + ',city=' + g.cityName);
  report('G5 市级气泡选中态', g.cityActive && !g.jobActive, 'cityActive=' + g.cityActive);
  report('G6 平滑过渡(无残留fading+transition)', !g.fading && parseFloat(g.transition) > 0, 'transition=' + g.transition);
  report('G7 市级图谱仍有关联曲线', g.linkEdgeCount >= 3, 'linkEdges=' + g.linkEdgeCount + ',nodes=' + g.nodeCount);

  // 切回岗位技术图谱
  await page.evaluate(() => window.talentSetGraphMode('job'));
  await page.waitForTimeout(1600);
  g = await page.evaluate(() => {
    const inst = window.talentMapState.jobGraphInstance;
    const center = inst.getNodes().map(n => n.getModel()).find(m => m.id === 'center');
    return { centerLabel: center && center.label, jobName: window.talentMapState.selectedJob.name };
  });
  report('G8 切回岗位图谱中心=岗位名', g.centerLabel === g.jobName, 'center=' + g.centerLabel);

  // ===== 省级总图谱不受影响 =====
  await page.evaluate(() => window.talentGraphBack());
  await page.waitForTimeout(800);
  await page.evaluate(() => window.talentMapBack()); // 回到市级地图
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window.talentUnfocusProvince(); }); // 回全国
  await page.waitForTimeout(1300);
  // 省级分析入口：悬停省份 → 右侧进入省份岗位分析 → 进入知识图谱
  await page.evaluate(() => {
    const p = window.talentMapState.allProvinces.find(x => x.name === '湖南');
    window.talentMapSelect(p);
  });
  await page.waitForFunction(() => window.talentMapState.mapLevel === 'province' && window.talentMapState.cityGeoLoaded, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.talentMapEnterProvince());
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.talentMapEnterGraph());
  await page.waitForTimeout(2200);
  g = await page.evaluate(() => {
    const inst = window.talentMapState.jobGraphInstance;
    if (!inst) return { err: 'no instance' };
    const center = inst.getNodes().map(n => n.getModel()).find(m => m.id === 'center');
    return {
      centerLabel: center && center.label,
      toggleVisible: document.getElementById('talent-graph-mode-toggle').style.display,
      nodeCount: inst.getNodes().length
    };
  });
  report('P1 省级总图谱入口正常渲染', !!g.centerLabel && g.nodeCount > 5, 'center=' + g.centerLabel + ',nodes=' + g.nodeCount);
  report('P2 省级入口不显示切换气泡', g.toggleVisible === 'none', 'toggle=' + g.toggleVisible);

  const passCount = results.filter(r => r.pass).length;
  console.log('\n===== SUMMARY: ' + passCount + '/' + results.length + ' PASSED =====');
  results.filter(r => !r.pass).forEach(r => console.log('FAILED: ' + r.name + ' (' + r.detail + ')'));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
