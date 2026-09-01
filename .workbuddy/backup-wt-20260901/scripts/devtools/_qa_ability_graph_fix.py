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
        await page.goto("http://127.0.0.1:8888/pages/map.html", wait_until="domcontentloaded", timeout=60000)
        await page.evaluate(
            """() => localStorage.setItem('zhitu_user', JSON.stringify({username:'qa_map2', name:'测试同学'}))"""
        )
        await page.wait_for_timeout(1800)

        # open ability -> survey -> select 5 -> submit -> expect graph
        await page.evaluate("() => window.talentOpenAbility()")
        await page.wait_for_timeout(2500)
        info1 = await page.evaluate(
            """() => {
              const chips = [...document.querySelectorAll('.ability-tech-chip')];
              chips.slice(0, 6).forEach(c => c.click());
              return { chips: chips.length, selected: document.querySelectorAll('.ability-tech-chip.selected').length };
            }"""
        )
        print("survey", info1)
        await page.click(".ability-confirm-btn")
        await page.wait_for_timeout(4500)
        info2 = await page.evaluate(
            """() => {
              const c = document.getElementById('ability-graph-container');
              const canvas = c && c.querySelector('canvas');
              const s = c && getComputedStyle(c);
              return {
                title: document.getElementById('ability-modal-title-text')?.textContent,
                wrapH: c && c.clientHeight,
                wrapW: c && c.clientWidth,
                hasCanvas: !!canvas,
                minH: s && s.minHeight,
                pageH: document.querySelector('.ability-graph-page')?.clientHeight,
                summary: document.getElementById('ability-graph-summary')?.textContent,
                err: document.querySelector('.ability-error')?.innerText || null
              };
            }"""
        )
        print("after save", info2)
        await page.screenshot(path=str(OUT / "ability-graph-after-edit.png"))

        # edit again then cancel should still show graph
        await page.evaluate("() => window.talentAbilityEdit && window.talentAbilityEdit()")
        await page.wait_for_timeout(800)
        await page.evaluate("() => window.talentAbilityCancelSurvey && window.talentAbilityCancelSurvey()")
        await page.wait_for_timeout(3000)
        info3 = await page.evaluate(
            """() => ({
              title: document.getElementById('ability-modal-title-text')?.textContent,
              hasCanvas: !!document.querySelector('#ability-graph-container canvas'),
              h: document.getElementById('ability-graph-container')?.clientHeight
            })"""
        )
        print("after cancel edit", info3)
        await page.screenshot(path=str(OUT / "ability-graph-after-cancel-edit.png"))

        # graph toolbar overlap check
        await page.evaluate("() => window.talentAbilityClose && window.talentAbilityClose()")
        await page.evaluate(
            """() => {
              window.talentMapState.selectedProvince={name:'新疆',id:'650000'};
              window.talentMapState.currentProvinceName='新疆';
              window.talentMapState.selectedJob={name:'深度学习工程师'};
              window.talentMapEnterGraph('深度学习工程师');
            }"""
        )
        await page.wait_for_timeout(3500)
        overlap = await page.evaluate(
            """() => {
              const back = document.getElementById('talent-graph-back-btn');
              const label = document.getElementById('talent-graph-city-label');
              const br = back?.getBoundingClientRect();
              const lr = label?.getBoundingClientRect();
              const overlap = br && lr && !(br.right < lr.left || br.left > lr.right || br.bottom < lr.top || br.top > lr.bottom);
              return {
                backDisplay: back && getComputedStyle(back).display,
                nationalBack: document.getElementById('talent-back-btn') && getComputedStyle(document.getElementById('talent-back-btn')).display,
                label: label?.textContent,
                labelLeft: lr && lr.left,
                backRight: br && br.right,
                overlap
              };
            }"""
        )
        print("toolbar", overlap)
        await page.screenshot(path=str(OUT / "graph-toolbar-no-overlap.png"))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
