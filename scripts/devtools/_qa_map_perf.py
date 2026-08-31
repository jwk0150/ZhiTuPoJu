# -*- coding: utf-8 -*-
"""Measure map first-paint timing + heap after load."""
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
            "http://127.0.0.1:8888/pages/map.html?v=20260826perf",
            wait_until="domcontentloaded",
            timeout=60000,
        )
        # Wait for first paint log / map canvas
        for _ in range(50):
            ready = await page.evaluate(
                """() => !!(window.talentMapState && window.talentMapState.mapChart)
                    || !!(document.querySelector('#talent-layer-map canvas'))"""
            )
            if ready:
                break
            await page.wait_for_timeout(200)
        await page.wait_for_timeout(2500)

        metrics = await page.evaluate(
            """() => {
              const mem = performance.memory ? {
                usedMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
                totalMB: Math.round(performance.memory.totalJSHeapSize / 1048576),
                limitMB: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
              } : null;
              const marks = performance.getEntriesByType('mark').map(m => ({name:m.name, start: Math.round(m.startTime)}));
              const nav = performance.getEntriesByType('navigation')[0];
              const canvas = document.querySelector('#talent-layer-map canvas');
              const dpr = window.devicePixelRatio || 1;
              return {
                hasChart: !!(window.talentMapState && window.talentMapState.mapChart),
                provinces: (window.talentMapState && window.talentMapState.allProvinces || []).length,
                geoReleased: window.talentMapState && window.talentMapState.geoJSON === true,
                canvasW: canvas && canvas.width,
                canvasH: canvas && canvas.height,
                cssW: canvas && canvas.clientWidth,
                cssH: canvas && canvas.clientHeight,
                dpr,
                mem,
                marks,
                domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
                loadEvent: nav ? Math.round(nav.loadEventEnd) : null
              };
            }"""
        )
        print(json.dumps(metrics, ensure_ascii=False, indent=2))
        await page.screenshot(path=str(OUT / "perf-map-loaded.png"))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
