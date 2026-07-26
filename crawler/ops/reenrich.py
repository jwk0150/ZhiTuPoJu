"""用新映射重新解析已有的 raw_html，更新细节表（不重新抓取）。"""
from __future__ import annotations
import json
from crawler import db
from crawler.config import CRAWL
from crawler.spiders.zhilian import ZhilianSpider


def main() -> None:
    spider = ZhilianSpider(CRAWL)
    items = []
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT raw_html, source_url FROM job_posting_details WHERE raw_html IS NOT NULL"
        ).fetchall()
    print(f"待重算 {len(rows)} 条")
    for raw_html, _ in rows:
        try:
            d = json.loads(raw_html)
            items.append(spider.map_result(d, keyword="reenrich"))
        except Exception as e:
            print("  skip:", e)
    res = db.save_batch(items)
    print(f"完成: 重算 {len(items)} · 入库 {res['saved']} · 失败 {res['failed']}")


if __name__ == "__main__":
    main()
