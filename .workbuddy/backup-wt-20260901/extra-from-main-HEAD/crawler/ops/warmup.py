"""会话预热 —— 手动过一次智联验证，cookie 存入持久化配置，后续抓取复用。

在你自己的终端运行（会弹出浏览器，需要交互）：

  python -m crawler.warmup

流程：
  1. 打开智联搜索页；
  2. 你在弹出的浏览器里手动完成滑块/点选验证（或登录）；
  3. 看到正常的岗位列表后，回到终端按回车；
  4. 会话 cookie 已存入 crawler/.pw_profile，之后运行：
        python -m crawler.run --source live --mode playwright -k Java -c 530 --max-pages 3
     即可免验证直接抓取。
"""

from __future__ import annotations

from crawler.config import CRAWL


def main() -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            user_data_dir=CRAWL.pw_profile_dir,
            headless=False,
            args=["--disable-blink-features=AutomationControlled", "--start-maximized"],
            locale="zh-CN",
            viewport={"width": 1440, "height": 900},
        )
        context.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto("https://sou.zhaopin.com/?kw=Java&jl=530", wait_until="domcontentloaded")

        print("\n浏览器已打开：")
        print("  1) 在窗口里完成验证（滑块/点选），直到能看到正常的岗位列表")
        print("  2) 然后回到这里按回车，保存会话并退出\n")
        try:
            input("完成验证后按回车关闭…")
        except EOFError:
            page.wait_for_timeout(CRAWL.pw_captcha_wait_ms)
        context.close()
        print(f"✅ 会话已保存到 {CRAWL.pw_profile_dir}")


if __name__ == "__main__":
    main()
