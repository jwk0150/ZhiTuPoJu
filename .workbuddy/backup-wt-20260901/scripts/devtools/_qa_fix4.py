# -*- coding: utf-8 -*-
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
        await page.goto("http://127.0.0.1:8888/pages/map.html?v=20260825c4", wait_until="domcontentloaded", timeout=60000)
        await page.evaluate("""() => localStorage.setItem('zhitu_user', JSON.stringify({username:'qa_fix4', name:'测试'}))""")
        await page.wait_for_timeout(2000)

        # ability flow
        await page.evaluate("() => window.talentOpenAbility()")
        for _ in range(30):
            n = await page.evaluate("() => document.querySelectorAll('.ability-tech-chip').length")
            if n > 0:
                break
            await page.wait_for_timeout(400)
        info = await page.evaluate("""() => {
          const chips = [...document.querySelectorAll('.ability-tech-chip')];
          chips.slice(0, 8).forEach(c => c.click());
          return {chips: chips.length, selected: document.querySelectorAll('.ability-tech-chip.selected').length};
        }""")
        print("survey", info)
        await page.click(".ability-confirm-btn")
        await page.wait_for_timeout(5000)
        after = await page.evaluate("""() => {
          const c = document.getElementById('ability-graph-container');
          return {
            title: document.getElementById('ability-modal-title-text')?.textContent,
            h: c?.clientHeight, w: c?.clientWidth,
            canvas: !!c?.querySelector('canvas'),
            summary: document.getElementById('ability-graph-summary')?.textContent,
            err: document.querySelector('.ability-error,.ability-state-title')?.textContent
          };
        }""")
        print("graph", after)
        await page.screenshot(path=str(OUT / "fix4-ability-graph.png"))

        # edit -> save again
        await page.evaluate("() => window.talentAbilityEdit && window.talentAbilityEdit()")
        await page.wait_for_timeout(1000)
        await page.evaluate("""() => {
          const chips = [...document.querySelectorAll('.ability-tech-chip')];
          if (chips[8]) chips[8].click();
          if (chips[9]) chips[9].click();
        }""")
        await page.click(".ability-confirm-btn")
        await page.wait_for_timeout(4500)
        after2 = await page.evaluate("""() => ({
          title: document.getElementById('ability-modal-title-text')?.textContent,
          canvas: !!document.querySelector('#ability-graph-container canvas'),
          h: document.getElementById('ability-graph-container')?.clientHeight
        })""")
        print("after edit save", after2)
        await page.screenshot(path=str(OUT / "fix4-ability-after-edit.png"))
        await page.evaluate("() => window.talentAbilityClose && window.talentAbilityClose()")

        # graph toolbar layout
        await page.evaluate("""() => {
          window.talentMapState.selectedProvince={name:'新疆',id:'650000'};
          window.talentMapState.currentProvinceName='新疆';
          window.talentMapState.selectedJob={name:'深度学习工程师'};
          window.talentMapEnterGraph('深度学习工程师');
        }""")
        await page.wait_for_timeout(4000)
        layout = await page.evaluate("""() => {
          const back = document.getElementById('talent-graph-back-btn');
          const label = document.getElementById('talent-graph-city-label');
          const br = back?.getBoundingClientRect();
          const lr = label?.getBoundingClientRect();
          const overlap = !!(br && lr && !(br.right <= lr.left + 1 || br.left >= lr.right - 1 || br.bottom <= lr.top || br.top >= lr.bottom));
          return {
            backParent: back?.parentElement?.className,
            backDisplay: back && getComputedStyle(back).display,
            label: label?.textContent,
            backRight: br && Math.round(br.right),
            labelLeft: lr && Math.round(lr.left),
            overlap,
            inToolbar: !!(back && back.closest('.graph-toolbar-left'))
          };
        }""")
        print("toolbar", layout)
        await page.screenshot(path=str(OUT / "fix4-toolbar.png"))

        # click a tech node via API mock of renderTechDetail
        await page.evaluate("() => window.renderTechDetail('流量投放', 10, 0.5)")
        await page.wait_for_timeout(1500)
        detail = await page.evaluate("""() => {
          const p = document.getElementById('talent-detail-province');
          const tags = [...p.querySelectorAll('.tech-detail-tag,.tech-detail-path-item')].slice(0,3).map(el => ({
            text: el.textContent, color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor
          }));
          const cities = p.innerText.includes('关联城市') ? (p.innerText.match(/关联城市[\\s\\S]{0,80}/)||[''])[0] : '';
          return { tags, cities, hasPurple: /99,\s*102,\s*241|91,\s*99,\s*211/.test(p.innerHTML) };
        }""")
        print("detail", json.dumps(detail, ensure_ascii=False)[:800])
        await page.screenshot(path=str(OUT / "fix4-tech-detail.png"))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
