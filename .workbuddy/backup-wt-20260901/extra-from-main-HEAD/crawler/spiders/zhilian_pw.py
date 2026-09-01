"""智联招聘 Playwright 爬虫（sou.zhaopin.com 渲染 + XHR 拦截）。

思路
====
纯 HTTP 打接口会被反爬拦（返回 405 / 验证页）。这里用真实 Chromium：
1. 打开 sou.zhaopin.com 搜索页（kw × city × page），浏览器自己带上正确的
   签名/cookie 去请求真实数据接口；
2. 监听 page 的 response 事件，拦截那条返回岗位列表的 JSON XHR，取出 results；
3. 复用 ZhilianSpider.map_result 把 raw → JobItem。

反爬处理
========
- headful（可见浏览器）默认开启，更易过滑块/点选验证；
- 去除 navigator.webdriver 指纹；随机 UA；zh-CN locale；
- 检测到验证页（captcha/验证）时暂停，留时间给人工处理后自动继续；
- 导航后等待 networkidle + 额外 settle 时间，确保 XHR 落地。

依赖：pip install playwright==1.48.* && python -m playwright install chromium
"""

from __future__ import annotations

import random
import time
from typing import Iterator

from crawler.config import CRAWL
from crawler.models import JobItem
from crawler.spiders.zhilian import ZhilianSpider, get_any


class ZhilianPlaywrightSpider:
    def __init__(self, cfg=CRAWL) -> None:
        self.cfg = cfg
        self._mapper = ZhilianSpider(cfg)  # 复用 map_result

    # ---------- 判定一条 response 是否是岗位数据接口 ----------
    @staticmethod
    def _is_data_url(url: str) -> bool:
        u = url.lower()
        return (
            "search/positions" in u
            or "/c/i/sou" in u
            or "positionlist" in u
            or u.rstrip("/").endswith("/positions")
        )

    @staticmethod
    def _extract_results(data) -> list[dict]:
        results = get_any(data, "positionList", "data.results", "results", "data.list",
                          "data.positionList", default=[])
        return results if isinstance(results, list) else []

    def crawl(
        self,
        keywords: list[str] | None = None,
        cities: list[str] | None = None,
        max_pages: int | None = None,
    ) -> Iterator[JobItem]:
        from playwright.sync_api import sync_playwright  # 延迟导入

        keywords = keywords or list(self.cfg.keywords)
        cities = cities or list(self.cfg.cities)
        max_pages = max_pages or self.cfg.max_pages

        with sync_playwright() as pw:
            # 持久化 context：复用 warmup 时手动过验证留下的 cookie，避免每次都撞验证页
            context = pw.chromium.launch_persistent_context(
                user_data_dir=self.cfg.pw_profile_dir,
                headless=self.cfg.pw_headless,
                args=["--disable-blink-features=AutomationControlled", "--start-maximized"],
                user_agent=random.choice(self.cfg.user_agents),
                locale="zh-CN",
                viewport={"width": 1440, "height": 900},
            )
            # 抹掉自动化指纹
            context.add_init_script(
                "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
            )
            page = context.pages[0] if context.pages else context.new_page()

            captured: list[dict] = []
            seen_json_urls: list[str] = []
            debug_hits: list[str] = []  # 含 position/search 的所有响应（诊断用）

            def on_response(resp) -> None:
                try:
                    url = resp.url
                    ct = resp.headers.get("content-type", "")
                    low = url.lower()
                    if ("position" in low or "search" in low) and "report" not in low:
                        debug_hits.append(f"[{resp.status}][{ct.split(';')[0]}] {url.split('?')[0]}")
                    if "json" not in ct or resp.status != 200:
                        return
                    seen_json_urls.append(url)
                    if self._is_data_url(url):
                        rows = self._extract_results(resp.json())
                        if rows:
                            captured.extend(rows)
                except Exception:  # noqa: BLE001
                    pass

            page.on("response", on_response)

            try:
                for kw in keywords:
                    for city in cities:
                        empty_streak = 0
                        for pageno in range(1, max_pages + 1):
                            captured.clear()
                            seen_json_urls.clear()
                            debug_hits.clear()
                            url = self.cfg.search_page_tpl.format(kw=kw, city=city, page=pageno)
                            print(f"  · 打开 [{kw}/{city}/p{pageno}] {url}")
                            try:
                                page.goto(url, timeout=self.cfg.pw_nav_timeout,
                                          wait_until="domcontentloaded")
                            except Exception as e:  # noqa: BLE001
                                print(f"    导航失败: {e}")
                                empty_streak += 1
                                if empty_streak >= 2:
                                    break
                                continue

                            # 先等页面稳定，让数据 XHR 有机会落地
                            self._settle(page)
                            got = list(captured)

                            # 没抓到 → 兜底读 __INITIAL_STATE__
                            if not got:
                                got = self._from_initial_state(page)

                            # 仍没抓到 → 可能是验证页，给人工处理时间后再取一次
                            if not got and self._is_captcha(page):
                                print(f"    ⚠ 疑似验证页，暂停 {self.cfg.pw_captcha_wait_ms/1000:.0f}s，"
                                      f"请在浏览器中手动完成验证…")
                                captured.clear()
                                page.wait_for_timeout(self.cfg.pw_captcha_wait_ms)
                                self._settle(page)
                                got = list(captured) or self._from_initial_state(page)

                            if not got:
                                empty_streak += 1
                                print(f"    未捕获到岗位数据。")
                                print(f"    含 position/search 的响应: {sorted(set(debug_hits))}")
                                if empty_streak >= 2:
                                    break
                                continue

                            empty_streak = 0
                            print(f"    捕获 {len(got)} 条")
                            for raw in got:
                                yield self._mapper.map_result(raw, kw)
                            time.sleep(random.uniform(
                                self.cfg.request_min_interval, self.cfg.request_max_interval))
                        # 每个城市结束后刷新页面（释放内存，防崩溃）
                        try:
                            page.goto("about:blank", timeout=5000)
                            page.wait_for_timeout(500)
                        except Exception:  # noqa: BLE001
                            pass
            finally:
                context.close()

    # ---------- 验证页判定 ----------
    def _is_captcha(self, page) -> bool:
        try:
            html = page.content()
        except Exception:  # noqa: BLE001
            return False
        low = html.lower()
        # 真结果页很大；验证页通常很小且含 captcha/验证关键词
        return len(html) < 20000 and (
            "captcha" in low or "安全验证" in html or "拖动滑块" in html or "点选" in html
        )

    def _settle(self, page) -> None:
        try:
            page.wait_for_load_state("networkidle", timeout=self.cfg.pw_nav_timeout)
        except Exception:  # noqa: BLE001
            pass
        page.wait_for_timeout(self.cfg.pw_settle_ms)

    # ---------- __INITIAL_STATE__ 兜底 ----------
    def _from_initial_state(self, page) -> list[dict]:
        try:
            state = page.evaluate("() => window.__INITIAL_STATE__ || null")
        except Exception:  # noqa: BLE001
            return []
        if not isinstance(state, dict):
            return []
        return self._extract_results(state)
