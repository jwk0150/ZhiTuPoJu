# -*- coding: utf-8 -*-
"""QA: map/graph/province switches stay responsive."""
import asyncio
import json
import time
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("frontend/_qa")
OUT.mkdir(parents=True, exist_ok=True)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto(
            "http://127.0.0.1:8888/pages/map.html?v=20260826switch",
            wait_until="domcontentloaded",
            timeout=60000,
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

        # Enter graph
        t0 = time.perf_counter()
        await page.evaluate(
            """() => {
              window.talentMapState.selectedProvince = {name:'新疆', id:'650000'};
              window.talentMapState.currentProvinceName = '新疆';
              window.talentMapState.selectedJob = {name:'深度学习工程师'};
              window.talentMapEnterGraph('深度学习工程师');
            }"""
        )
        await page.wait_for_timeout(2200)
        enterMs = round((time.perf_counter() - t0) * 1000)
        layer1 = await page.evaluate("() => window.talentMapState.currentLayer")

        # Switch views quickly
        times = []
        for view in ["stack", "level", "overview"]:
            t1 = time.perf_counter()
            await page.evaluate("(v) => window.talentSetJobGraphView(v)", view)
            # wait until lock clears or timeout
            for _ in range(40):
                locked = await page.evaluate("() => !!window.__dbgGraphLock")
                # probe via eval of internal if exposed; fallback wait
                done = await page.evaluate(
                    """(v) => (window.techDetailState && window.techDetailState.graphView) === v
                      && !(document.getElementById('talent-graph-container')||{}).classList?.contains?.('graph-fading')"""
                , view)
                if done:
                    break
                await page.wait_for_timeout(50)
            times.append({"view": view, "ms": round((time.perf_counter() - t1) * 1000)})

        # Back
        t2 = time.perf_counter()
        await page.evaluate("() => window.talentGraphBack()")
        await page.wait_for_timeout(500)
        backLayer = await page.evaluate("() => window.talentMapState.currentLayer")
        backMs = round((time.perf_counter() - t2) * 1000)

        # CSS vars
        css = await page.evaluate(
            """() => ({
              exit: getComputedStyle(document.documentElement).getPropertyValue('--tm-layer-exit').trim(),
              fade: getComputedStyle(document.documentElement).getPropertyValue('--tm-graph-fade').trim(),
              hasFilterEnter: getComputedStyle(document.querySelector('.talent-map-layer')||document.body).transitionProperty
            })"""
        )

        out = {
            "enterMs": enterMs,
            "layerAfterEnter": layer1,
            "viewSwitches": times,
            "backLayer": backLayer,
            "backMs": backMs,
            "css": css,
        }
        print(json.dumps(out, ensure_ascii=False, indent=2))
        await page.screenshot(path=str(OUT / "switch-after-back.png"))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
