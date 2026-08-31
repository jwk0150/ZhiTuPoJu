# -*- coding: utf-8 -*-
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("frontend/_qa")
OUT.mkdir(parents=True, exist_ok=True)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto("http://127.0.0.1:8888/pages/map.html?v=20260825c3", wait_until="domcontentloaded", timeout=60000)
        await page.evaluate(
            """() => localStorage.setItem('zhitu_user', JSON.stringify({username:'qa_map3', name:'测试同学'}))"""
        )
        await page.wait_for_timeout(2000)

        # Graph toolbar overlap
        await page.evaluate(
            """() => {
              window.talentMapState.selectedProvince={name:'新疆',id:'650000'};
              window.talentMapState.currentProvinceName='新疆';
              window.talentMapState.selectedJob={name:'深度学习工程师'};
              window.talentMapEnterGraph('深度学习工程师');
            }"""
        )
        await page.wait_for_timeout(4000)
        toolbar = await page.evaluate(
            """() => {
              const back = document.getElementById('talent-graph-back-btn');
              const nat = document.getElementById('talent-back-btn');
              const label = document.getElementById('talent-graph-city-label');
              const br = back?.getBoundingClientRect();
              const lr = label?.getBoundingClientRect();
              const overlap = !!(br && lr && !(br.right < lr.left || br.left > lr.right || br.bottom < lr.top || br.top > lr.bottom));
              return {
                backDisp: getComputedStyle(back).display,
                natDisp: getComputedStyle(nat).display,
                label: label?.textContent,
                backRight: br && Math.round(br.right),
                labelLeft: lr && Math.round(lr.left),
                overlap,
                canvasClass: document.getElementById('talent-map-canvas')?.className
              };
            }"""
        )
        print("toolbar", toolbar)
        await page.screenshot(path=str(OUT / "fix-graph-toolbar.png"))

        # Ability flow
        await page.evaluate("() => window.talentOpenAbility()")
        await page.wait_for_timeout(4000)
        bodyText = await page.evaluate(
            """() => ({
              title: document.getElementById('ability-modal-title-text')?.textContent,
              chips: document.querySelectorAll('.ability-tech-chip').length,
              body: (document.getElementById('ability-modal-body')?.innerText || '').slice(0, 180),
              hasConfirm: !!document.querySelector('.ability-confirm-btn')
            })"""
        )
        print("ability open", bodyText)

        if bodyText["chips"] > 0:
            await page.evaluate(
                """() => {
                  [...document.querySelectorAll('.ability-tech-chip')].slice(0, 8).forEach(c => c.click());
                }"""
            )
            await page.click(".ability-confirm-btn")
            await page.wait_for_timeout(5000)
            after = await page.evaluate(
                """() => ({
                  title: document.getElementById('ability-modal-title-text')?.textContent,
                  h: document.getElementById('ability-graph-container')?.clientHeight,
                  w: document.getElementById('ability-graph-container')?.clientWidth,
                  canvas: !!document.querySelector('#ability-graph-container canvas'),
                  summary: document.getElementById('ability-graph-summary')?.textContent
                })"""
            )
            print("after save", after)
            await page.screenshot(path=str(OUT / "fix-ability-graph.png"))

            # edit then confirm again
            await page.evaluate("() => window.talentAbilityEdit()")
            await page.wait_for_timeout(800)
            await page.evaluate(
                """() => {
                  const chips=[...document.querySelectorAll('.ability-tech-chip')];
                  if (chips[8]) chips[8].click();
                }"""
            )
            await page.click(".ability-confirm-btn")
            await page.wait_for_timeout(5000)
            afterEdit = await page.evaluate(
                """() => ({
                  title: document.getElementById('ability-modal-title-text')?.textContent,
                  h: document.getElementById('ability-graph-container')?.clientHeight,
                  canvas: !!document.querySelector('#ability-graph-container canvas'),
                  summary: document.getElementById('ability-graph-summary')?.textContent
                })"""
            )
            print("after edit save", afterEdit)
            await page.screenshot(path=str(OUT / "fix-ability-after-edit.png"))

        await browser.close()


asyncio = asyncio
if __name__ == "__main__":
    asyncio.run(main())
