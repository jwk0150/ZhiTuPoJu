# -*- coding: utf-8 -*-
"""QA city right-panel with real province select."""
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
            "() => localStorage.setItem('zhitu_user', JSON.stringify({username:'qa_panel2', name:'面板'}))"
        )
        await page.wait_for_timeout(2500)
        await page.evaluate(
            """() => {
              document.querySelectorAll('button').forEach(b => {
                const t = (b.textContent || '').trim();
                if (t.includes('跳过') || t === '关闭') try { b.click(); } catch (e) {}
              });
            }"""
        )

        info = await page.evaluate(
            """async () => {
              for (let i = 0; i < 40; i++) {
                if ((window.talentMapState.allProvinces || []).length) break;
                await new Promise(r => setTimeout(r, 200));
              }
              const regions = window.talentMapState.allProvinces || [];
              const xin = regions.find(r => (r.name || '').includes('新疆'))
                || regions.find(r => (r.name || '').includes('广东'))
                || regions[0];
              if (!xin) return { err: 'no province', n: regions.length };
              await window.talentMapSelect(xin);
              return { name: xin.name, n: regions.length };
            }"""
        )
        print("select", json.dumps(info, ensure_ascii=False))
        await page.wait_for_timeout(5000)

        info2 = await page.evaluate(
            """() => ({
              n: (window.talentMapState.cityData || []).length,
              cities: (window.talentMapState.cityData || []).slice(0, 5).map(c => c.name),
              prov: !!(window.talentMapState.selectedProvince),
              mapLevel: window.talentMapState.mapLevel
            })"""
        )
        print("cities", json.dumps(info2, ensure_ascii=False))

        hover = await page.evaluate(
            """() => {
              const cities = window.talentMapState.cityData || [];
              const city = cities[0];
              if (!city) return { err: 'no city' };
              document.getElementById('talent-detail-empty').style.display = 'none';
              document.getElementById('talent-detail-province').style.display = 'none';
              document.getElementById('talent-detail-hover').style.display = 'block';
              document.getElementById('talent-hover-name').textContent = String(city.name).split('·').pop();
              document.getElementById('talent-hover-hot-wrap').style.display = 'none';
              document.getElementById('talent-hover-growth-wrap').style.display = 'none';
              document.getElementById('talent-hover-city-block').style.display = 'block';
              document.getElementById('talent-hover-jobs').textContent = (city.jobCount || 0).toLocaleString();
              document.getElementById('talent-hover-salary').textContent = window.talentFormatSalary(city.avgSalary);
              window.talentMapState.hoveredCityName = String(city.name).indexOf('·') >= 0
                ? String(city.name).split('·').pop() : city.name;
              window.talentShowCityPreview(city);
              return { city: city.name };
            }"""
        )
        print("hover", json.dumps(hover, ensure_ascii=False))
        await page.wait_for_timeout(2800)

        after = await page.evaluate(
            """() => {
              const prov = document.getElementById('talent-detail-province');
              const hoverEl = document.getElementById('talent-detail-hover');
              const jobs = [...document.querySelectorAll('#talent-hover-hotjobs .detail-rel-item .name')].map(n => n.textContent);
              const skills = [...document.querySelectorAll('#talent-hover-skills .talent-hover-skill')].map(s => s.textContent);
              return {
                exclusive: getComputedStyle(prov).display === 'none' && getComputedStyle(hoverEl).display !== 'none',
                jobsText: document.getElementById('talent-hover-jobs').textContent,
                hasDupLabel: /岗位总数/.test(document.getElementById('talent-hover-jobs').textContent || ''),
                jobNames: jobs,
                dupJobs: jobs.length !== new Set(jobs).size,
                skills: skills.slice(0, 10),
                dupSkills: skills.length !== new Set(skills).size,
                overflowX: hoverEl.scrollWidth > hoverEl.clientWidth + 2,
                nameOverflow: [...document.querySelectorAll('#talent-hover-hotjobs .name')].some(n => n.scrollWidth > n.clientWidth + 2)
              };
            }"""
        )
        print("after", json.dumps(after, ensure_ascii=False))
        await page.screenshot(path=str(OUT / "panel-city-hover2.png"))

        rest = await page.evaluate(
            """() => {
              document.getElementById('talent-detail-hover').style.display = 'none';
              if (window.talentMapState.selectedProvince) {
                document.getElementById('talent-detail-empty').style.display = 'none';
                document.getElementById('talent-detail-province').style.display = 'block';
              }
              return {
                prov: getComputedStyle(document.getElementById('talent-detail-province')).display,
                hover: getComputedStyle(document.getElementById('talent-detail-hover')).display
              };
            }"""
        )
        print("restore", json.dumps(rest, ensure_ascii=False))
        await page.screenshot(path=str(OUT / "panel-city-restore2.png"))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
