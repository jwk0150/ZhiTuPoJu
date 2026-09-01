# -*- coding: utf-8 -*-
"""QA: map knowledge graph + ability modal screenshots."""
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

OUT = Path("frontend/_qa")
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://127.0.0.1:8888"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto(f"{BASE}/pages/map.html", wait_until="domcontentloaded", timeout=60000)
        # seed a logged-in user for ability
        await page.evaluate(
            """() => {
              localStorage.setItem('zhitu_user', JSON.stringify({
                username: 'qa_map', displayName: 'QA', token: 'qa'
              }));
              localStorage.setItem('token', 'qa');
            }"""
        )
        await page.wait_for_timeout(2500)
        await page.screenshot(path=str(OUT / "map-graph-ability-0-map.png"), full_page=False)

        # Wait provinces API-driven map
        await page.wait_for_timeout(2000)

        # Enter graph programmatically with a known job
        ok = await page.evaluate(
            """async () => {
              try {
                if (typeof window.talentShowLayer === 'function') {
                  window.talentMapState = window.talentMapState || {};
                  window.talentMapState.selectedProvince = { name: '广东', id: '440000' };
                  window.talentMapState.currentProvinceName = '广东';
                  window.talentMapState.selectedJob = { name: '数据分析师' };
                  window.talentMapEnterGraph('数据分析师');
                  return true;
                }
                return false;
              } catch (e) { return String(e); }
            }"""
        )
        print("enterGraph", ok)
        await page.wait_for_timeout(4500)
        await page.screenshot(path=str(OUT / "map-graph-ability-1-graph.png"), full_page=False)

        # Open ability modal
        await page.evaluate("() => { if (window.talentOpenAbility) window.talentOpenAbility(); }")
        await page.wait_for_timeout(3500)
        await page.screenshot(path=str(OUT / "map-graph-ability-2-ability.png"), full_page=False)

        # Check ability DOM
        info = await page.evaluate(
            """() => {
              const modal = document.getElementById('ability-modal');
              const body = document.getElementById('ability-modal-body');
              const chips = document.querySelectorAll('.ability-tech-chip');
              const cs = modal ? getComputedStyle(modal) : null;
              const mcs = document.querySelector('.ability-modal');
              const mstyle = mcs ? getComputedStyle(mcs) : null;
              return {
                modalDisplay: cs && cs.display,
                modalZ: cs && cs.zIndex,
                bodyText: (body && body.innerText || '').slice(0, 200),
                chipCount: chips.length,
                modalWidth: mstyle && mstyle.width,
                modalBg: mstyle && mstyle.backgroundColor,
                graphVisible: !!(document.getElementById('talent-layer-graph') &&
                  document.getElementById('talent-layer-graph').style.display !== 'none'),
                g6Nodes: !!(window.talentMapState && window.talentMapState.jobGraphInstance)
              };
            }"""
        )
        print("info", info)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
