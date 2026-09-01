"""采集流水线 —— 编排 抓取 → 批量落库 → 统计。

支持两种数据来源：
  * live    ：走 ZhilianSpider 实时抓取
  * fixture ：读 fixtures/zhilian_sample.json 离线跑通链路（冒烟/演示用）
"""

from __future__ import annotations

import json
from pathlib import Path

from crawler import db
from crawler.config import CRAWL
from crawler.models import JobItem
from crawler.spiders.zhilian import ZhilianSpider

FIXTURE = Path(__file__).parent / "fixtures" / "zhilian_sample.json"


def run_live(keywords=None, cities=None, max_pages=None, batch_size=50, limit=None,
             mode="playwright", bulk=False, target=0) -> dict:
    if mode == "playwright":
        from crawler.spiders.zhilian_pw import ZhilianPlaywrightSpider
        spider = ZhilianPlaywrightSpider(CRAWL)
    else:
        spider = ZhilianSpider(CRAWL)

    if bulk:
        keywords = list(CRAWL.bulk_keywords)
        cities = list(CRAWL.bulk_cities)
        max_pages = max_pages or CRAWL.bulk_max_pages
        print(f"📦 bulk 模式：{len(keywords)} 关键词 × {len(cities)} 城市 × {max_pages} 页")
        print(f"   理论上限 ≈ {len(keywords) * len(cities) * max_pages * 20} 条"
              f"（去重后约 50%-70%）")
    else:
        keywords = keywords or list(CRAWL.keywords)
        cities = cities or list(CRAWL.cities)
        max_pages = max_pages or CRAWL.max_pages

    batch: list[JobItem] = []
    total = {"saved": 0, "failed": 0, "crawled": 0, "pages": 0}
    import time as _t
    started = _t.time()
    for item in spider.crawl(keywords, cities, max_pages):
        batch.append(item)
        total["crawled"] += 1
        if len(batch) >= batch_size:
            _flush(batch, total)
        if target and total["saved"] >= target:
            print(f"  🎯 已达目标 {target} 条，提前结束")
            break
        if limit and total["crawled"] >= limit:
            break
        # 每 100 条进度报告
        if total["crawled"] % 100 == 0:
            elapsed = _t.time() - started
            rate = total["crawled"] / max(elapsed, 1) * 60
            print(f"  📊 进度: 已抓 {total['crawled']} · 入库 {total['saved']} · "
                  f"失败 {total['failed']} · 速度 {rate:.1f} 条/min · 用时 {elapsed:.0f}s")
    _flush(batch, total)
    elapsed = _t.time() - started
    print(f"\n=== 完成：抓取 {total['crawled']} · 入库 {total['saved']} · "
          f"失败 {total['failed']} · 用时 {elapsed:.0f}s ===")
    return total


def run_fixture() -> dict:
    """离线：读样本 JSON，走完整 map → 落库链路。"""
    raw_list = json.loads(FIXTURE.read_text(encoding="utf-8"))
    spider = ZhilianSpider(CRAWL)
    items = [spider.map_result(raw, keyword="样本") for raw in raw_list]
    print(f"• 样本解析 {len(items)} 条，开始落库…")
    for it in items:
        print(f"  - {it.job_title} @ {it.company_name} | {it.city} | "
              f"{it.salary_min}-{it.salary_max} | 技能={it.skills}")
    res = db.save_batch(items)
    print(f"\n=== 完成：样本 {len(items)} · 入库 {res['saved']} · 失败 {res['failed']} ===")
    return res


def _flush(batch: list[JobItem], total: dict) -> None:
    if not batch:
        return
    res = db.save_batch(batch)
    total["saved"] += res["saved"]
    total["failed"] += res["failed"]
    print(f"  · 批量落库 {res['saved']}/{len(batch)}（累计入库 {total['saved']}）")
    batch.clear()
