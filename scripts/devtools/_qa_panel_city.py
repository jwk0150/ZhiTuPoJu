# -*- coding: utf-8 -*-
"""QA city right-panel exclusivity + graph soft motion."""
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
        await page.evaluate(
            """() => localStorage.setItem('zhitu_user', JSON.stringify({username:'qa_panel', name:'面板'}))"""
        )
        await page.wait_for_timeout(2200)
        await page.evaluate(
            """() => {
          document.querySelectorAll('button').forEach(b => {
            const t = (b.textContent||'').trim();
            if (t.includes('跳过') || t === '关闭') try { b.click(); } catch (e) {}
          });
        }"""
        )

        # Enter a province so city hover path is available
        await page.evaluate(
            """async () => {
          const regions = (window.talentMapState && window.talentMapState.regions) || [];
          const xin = regions.find(r => (r.name||'').includes('新疆')) || regions[0];
          if (xin && window.talentSelectProvince) await window.talentSelectProvince(xin);
          else if (xin) {
            window.talentMapState.selectedProvince = xin;
            window.talentMapState.currentProvinceName = xin.name;
            if (window.renderProvinceMap) await window.renderProvinceMap(xin);
            if (window.renderProvinceDetail) await window.renderProvinceDetail(xin);
          }
        }"""
        )
        await page.wait_for_timeout(2500)

        # Simulate city hover panel exclusivity
        panel = await page.evaluate(
            """() => {
          const cities = window.talentMapState.cityData || [];
          const city = cities[0] || { name: '乌鲁木齐', jobCount: 120, avgSalary: 15000 };
          // mimic mousemove handler core
          document.getElementById('talent-detail-empty').style.display = 'none';
          document.getElementById('talent-detail-province').style.display = 'none';
          document.getElementById('talent-detail-hover').style.display = 'block';
          document.getElementById('talent-hover-name').textContent = (String(city.name).split('·').pop());
          document.getElementById('talent-hover-hot-wrap').style.display = 'none';
          document.getElementById('talent-hover-growth-wrap').style.display = 'none';
          document.getElementById('talent-hover-city-block').style.display = 'block';
          document.getElementById('talent-hover-jobs').textContent = (city.jobCount || 0).toLocaleString();
          document.getElementById('talent-hover-salary').textContent = window.talentFormatSalary(city.avgSalary);
          if (window.talentShowCityPreview) window.talentShowCityPreview(city);
          return {
            city: city.name,
            provDisp: document.getElementById('talent-detail-province').style.display,
            hoverDisp: document.getElementById('talent-detail-hover').style.display,
            jobsText: document.getElementById('talent-hover-jobs').textContent
          };
        }"""
        )
        print("hover-start", json.dumps(panel, ensure_ascii=False))
        await page.wait_for_timeout(1800)

        after = await page.evaluate(
            """() => {
          const prov = document.getElementById('talent-detail-province');
          const hover = document.getElementById('talent-detail-hover');
          const jobs = document.getElementById('talent-hover-hotjobs');
          const skills = document.getElementById('talent-hover-skills');
          const jobItems = [...(jobs||[]).querySelectorAll('.detail-rel-item')];
          const names = jobItems.map(el => el.querySelector('.name')?.textContent || '');
          const dup = names.length !== new Set(names).size;
          const overflowX = hover && (hover.scrollWidth > hover.clientWidth + 2);
          const skillOverflow = skills && [...skills.querySelectorAll('.talent-hover-skill')].some(s => s.scrollWidth > s.clientWidth + 1);
          return {
            provDisp: getComputedStyle(prov).display,
            hoverDisp: getComputedStyle(hover).display,
            exclusive: getComputedStyle(prov).display === 'none' && getComputedStyle(hover).display !== 'none',
            jobsText: document.getElementById('talent-hover-jobs').textContent,
            has岗位总数文案: /岗位总数/.test(document.getElementById('talent-hover-jobs').textContent||''),
            jobNames: names.slice(0, 6),
            dupNames: dup,
            overflowX,
            skillCount: skills ? skills.querySelectorAll('.talent-hover-skill').length : 0,
            skillEllipsis: skillOverflow,
            panelH: Math.round(hover.getBoundingClientRect().height),
            detailH: Math.round(document.getElementById('talent-detail-panel').getBoundingClientRect().height)
          };
        }"""
        )
        print("hover-after", json.dumps(after, ensure_ascii=False))
        await page.screenshot(path=str(OUT / "panel-city-hover.png"))

        # mouseout restore
        restore = await page.evaluate(
            """() => {
          // fire same restore logic as mouseout
          document.getElementById('talent-detail-hover').style.display = 'none';
          if (window.talentMapState.selectedProvince) {
            document.getElementById('talent-detail-empty').style.display = 'none';
            document.getElementById('talent-detail-province').style.display = 'block';
          }
          return {
            prov: document.getElementById('talent-detail-province').style.display,
            hover: document.getElementById('talent-detail-hover').style.display
          };
        }"""
        )
        print("restore", json.dumps(restore, ensure_ascii=False))
        await page.screenshot(path=str(OUT / "panel-city-restore.png"))

        # Soft graph switch check
        await page.evaluate(
            """() => {
          window.talentMapState.selectedJob = {name:'深度学习工程师'};
          window.talentMapEnterGraph('深度学习工程师');
        }"""
        )
        await page.wait_for_timeout(2800)
        await page.evaluate("() => window.talentSetJobGraphView('stack')")
        await page.wait_for_timeout(200)
        soft = await page.evaluate(
            """() => {
          const c = document.getElementById('talent-graph-container');
          return {
            fading: c && c.classList.contains('graph-fading'),
            view: window.techDetailState && window.techDetailState.graphView
          };
        }"""
        )
        print("soft-switch", json.dumps(soft, ensure_ascii=False))
        await page.wait_for_timeout(1600)
        await page.screenshot(path=str(OUT / "panel-graph-soft.png"))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
