# -*- coding: utf-8 -*-
"""QA Soft Ink Gold graph module switch motion."""
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
            "http://127.0.0.1:8888/pages/map.html?v=20260825motion",
            wait_until="domcontentloaded",
            timeout=60000,
        )
        await page.evaluate(
            """() => localStorage.setItem('zhitu_user', JSON.stringify({username:'qa_motion', name:'动效'}))"""
        )
        await page.wait_for_timeout(1800)
        await page.evaluate(
            """() => {
          document.querySelectorAll('button').forEach(b => {
            const t = (b.textContent||'').trim();
            if (t.includes('跳过') || t === '关闭') try { b.click(); } catch (e) {}
          });
        }"""
        )

        # Enter graph layer
        await page.evaluate(
            """() => {
          window.talentMapState.selectedProvince = {name:'新疆', id:'650000'};
          window.talentMapState.currentProvinceName = '新疆';
          window.talentMapState.selectedJob = {name:'深度学习工程师'};
          window.talentMapEnterGraph('深度学习工程师');
        }"""
        )
        await page.wait_for_timeout(220)
        mid = await page.evaluate(
            """() => {
          const g = document.getElementById('talent-layer-graph');
          const c = document.getElementById('talent-graph-container');
          const pill = document.getElementById('talent-graph-mode-pill');
          return {
            layerClasses: g && g.className,
            graphClasses: c && c.className,
            fading: !!(c && c.classList.contains('graph-fading')),
            chrome: !!(g && g.classList.contains('tm-graph-chrome-enter')),
            pillW: pill && Math.round(pill.getBoundingClientRect().width),
            cssHas: !!document.styleSheets.length
          };
        }"""
        )
        print("mid-enter", json.dumps(mid, ensure_ascii=False))
        await page.screenshot(path=str(OUT / "motion-enter-mid.png"))

        await page.wait_for_timeout(3500)
        settled = await page.evaluate(
            """() => {
          const c = document.getElementById('talent-graph-container');
          const toggle = document.getElementById('talent-graph-mode-toggle');
          const pill = document.getElementById('talent-graph-mode-pill');
          const active = toggle && toggle.querySelector('.graph-mode-bubble.active');
          const pr = pill && pill.getBoundingClientRect();
          const ar = active && active.getBoundingClientRect();
          const aligned = !!(pr && ar && Math.abs(pr.left - ar.left) < 3 && Math.abs(pr.width - ar.width) < 4);
          return {
            canvas: !!(c && c.querySelector('canvas')),
            active: active && active.textContent,
            pillW: pr && Math.round(pr.width),
            aligned,
            layer: window.talentMapState.currentLayer,
            hasMotionCss: !!getComputedStyle(document.documentElement).getPropertyValue('--tm-ease-out').trim()
          };
        }"""
        )
        print("settled", json.dumps(settled, ensure_ascii=False))
        await page.screenshot(path=str(OUT / "motion-graph-settled.png"))

        # Switch to stack mid-fade
        await page.evaluate("() => window.talentSetJobGraphView('stack')")
        await page.wait_for_timeout(160)
        fade = await page.evaluate(
            """() => {
          const c = document.getElementById('talent-graph-container');
          const op = c && getComputedStyle(c).opacity;
          return {
            fading: !!(c && c.classList.contains('graph-fading')),
            opacity: op,
            view: window.techDetailState && window.techDetailState.graphView
          };
        }"""
        )
        print("stack-fade", json.dumps(fade, ensure_ascii=False))
        await page.screenshot(path=str(OUT / "motion-stack-fade.png"))

        await page.wait_for_timeout(1400)
        stack = await page.evaluate(
            """() => {
          const c = document.getElementById('talent-graph-container');
          const active = document.querySelector('#talent-graph-mode-toggle .graph-mode-bubble.active');
          return {
            view: window.techDetailState && window.techDetailState.graphView,
            active: active && active.textContent,
            entering: !!(c && c.classList.contains('graph-view-entering')),
            canvas: !!(c && c.querySelector('canvas'))
          };
        }"""
        )
        print("stack-done", json.dumps(stack, ensure_ascii=False))
        await page.screenshot(path=str(OUT / "motion-stack-done.png"))

        # Level switch + back
        await page.evaluate("() => window.talentSetJobGraphView('level')")
        await page.wait_for_timeout(1600)
        await page.screenshot(path=str(OUT / "motion-level.png"))
        await page.evaluate("() => window.talentGraphBack()")
        await page.wait_for_timeout(200)
        backMid = await page.evaluate(
            """() => ({
              fading: !!(document.getElementById('talent-graph-container')||{}).classList?.contains?.('graph-fading'),
              layer: window.talentMapState.currentLayer
            })"""
        )
        print("back-mid", json.dumps(backMid, ensure_ascii=False))
        await page.wait_for_timeout(700)
        backDone = await page.evaluate(
            """() => ({
              layer: window.talentMapState.currentLayer,
              graphDisplay: document.getElementById('talent-layer-graph')?.style.display
            })"""
        )
        print("back-done", json.dumps(backDone, ensure_ascii=False))
        await page.screenshot(path=str(OUT / "motion-back-province.png"))

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
