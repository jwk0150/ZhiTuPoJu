# -*- coding: utf-8 -*-
"""Visual QA: city panel layout with long/dup content + graph soft switch."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("frontend/_qa")
OUT.mkdir(parents=True, exist_ok=True)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto(
            "http://127.0.0.1:8888/pages/map.html?v=20260826panel",
            wait_until="domcontentloaded",
            timeout=60000,
        )
        await page.wait_for_timeout(1500)

        # Force exclusive city hover + dense/long content (reproduces overflow/dup cases)
        layout = await page.evaluate(
            """() => {
              const empty = document.getElementById('talent-detail-empty');
              const prov = document.getElementById('talent-detail-province');
              const hover = document.getElementById('talent-detail-hover');
              const job = document.getElementById('talent-detail-job');
              if (empty) empty.style.display = 'none';
              if (prov) {
                prov.style.display = 'block';
                prov.innerHTML = '<h3>新疆 · 数字人才洞察</h3><div>这是不该与城市预览同时出现的省份面板</div>';
              }
              if (job) job.style.display = 'none';
              // apply fixed exclusivity path
              if (prov) prov.style.display = 'none';
              hover.style.display = 'block';
              document.getElementById('talent-hover-name').textContent = '乌鲁木齐市高新区（新市区）特别长名称测试';
              document.getElementById('talent-hover-badge').textContent = '地区';
              document.getElementById('talent-hover-hot-wrap').style.display = 'none';
              document.getElementById('talent-hover-growth-wrap').style.display = 'none';
              document.getElementById('talent-hover-city-block').style.display = 'block';
              document.getElementById('talent-hover-jobs').textContent = '1280';
              document.getElementById('talent-hover-salary').textContent = '¥18,500/月';
              const d = {
                hotJobs: [
                  {name:'深度学习算法工程师（计算机视觉方向）', count:88, avgSalary:28000},
                  {name:'深度学习算法工程师（计算机视觉方向）', count:88, avgSalary:28000},
                  {name:'自然语言处理工程师', count:64, avgSalary:25000},
                  {name:'云计算平台运维开发工程师高级', count:51, avgSalary:22000},
                  {name:'大数据开发工程师', count:40, avgSalary:20000},
                  {name:'应被截断的第6个', count:1}
                ],
                hotSkills: ['PyTorch','PyTorch','TensorFlow','Kubernetes','超长技术名称ABCDEFGHIJKLMNOP','Docker','Java','Spring Boot','Redis','Go'],
                industryDist: [
                  {name:'互联网/电子商务超长行业名', pct:32.5},
                  {name:'计算机软件', pct:24},
                  {name:'人工智能', pct:18},
                  {name:'通信', pct:12},
                  {name:'金融', pct:8},
                  {name:'其他', pct:5.5},
                  {name:'应被截断', pct:1}
                ],
                educationDist: [
                  {name:'本科', pct:55}, {name:'硕士', pct:30}, {name:'大专', pct:10}, {name:'博士', pct:5}
                ],
                totalJobs: 1280,
                avgSalary: 18500
              };
              window.talentRenderCityPreview('乌鲁木齐', d);
              const jobs = [...document.querySelectorAll('#talent-hover-hotjobs .name')].map(n => n.textContent);
              const skills = [...document.querySelectorAll('#talent-hover-skills .talent-hover-skill')].map(s => s.textContent);
              const industry = document.querySelectorAll('#talent-hover-industry .talent-hover-pct-row').length;
              return {
                exclusive: getComputedStyle(prov).display === 'none' && getComputedStyle(hover).display !== 'none',
                jobsText: document.getElementById('talent-hover-jobs').textContent,
                hasDupLabel: /岗位总数/.test(document.getElementById('talent-hover-jobs').textContent || ''),
                jobCount: jobs.length,
                jobs,
                dupJobs: jobs.length !== new Set(jobs).size,
                skills,
                dupSkills: skills.length !== new Set(skills).size,
                industryRows: industry,
                overflowX: hover.scrollWidth > hover.clientWidth + 2,
                nameEllipsis: [...document.querySelectorAll('#talent-hover-hotjobs .name')].some(n => n.scrollWidth > n.clientWidth + 1),
                panelScrollable: document.getElementById('talent-detail-panel').scrollHeight > document.getElementById('talent-detail-panel').clientHeight
              };
            }"""
        )
        print("layout", json.dumps(layout, ensure_ascii=False))
        await page.screenshot(path=str(OUT / "panel-city-dense.png"))

        # Soft graph
        await page.evaluate(
            """() => {
              window.talentMapState.selectedProvince = {name:'新疆', id:'650000'};
              window.talentMapState.currentProvinceName = '新疆';
              window.talentMapState.selectedJob = {name:'深度学习工程师'};
              window.talentMapEnterGraph('深度学习工程师');
            }"""
        )
        await page.wait_for_timeout(3200)
        await page.evaluate("() => window.talentSetJobGraphView('level')")
        await page.wait_for_timeout(180)
        mid = await page.evaluate(
            """() => ({
              fading: !!(document.getElementById('talent-graph-container')||{}).classList?.contains?.('graph-fading'),
              view: window.techDetailState && window.techDetailState.graphView
            })"""
        )
        print("soft-mid", json.dumps(mid, ensure_ascii=False))
        await page.screenshot(path=str(OUT / "panel-graph-fade.png"))
        await page.wait_for_timeout(1600)
        await page.screenshot(path=str(OUT / "panel-graph-level.png"))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
