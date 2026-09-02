"""智联招聘采集 CLI。

示例：
  # 首次建库
  python -m crawler.create_schema --prefix zhilian

  # 离线冒烟（用样本验证解析→落库→触发器）
  python -m crawler.ops.run --source fixture

  # 实时抓取：关键词 Java/Python，北京，每词最多 3 页，最多 100 条
  python -m crawler.ops.run --source live -k Java Python -c 530 --max-pages 3 --limit 100
"""

from __future__ import annotations

import argparse

from crawler.ops import pipeline


def main() -> None:
    ap = argparse.ArgumentParser(description="智联招聘数据采集")
    ap.add_argument("--source", choices=["live", "fixture"], default="fixture",
                    help="数据来源：live 实时抓取 / fixture 离线样本（默认）")
    ap.add_argument("--mode", choices=["playwright", "api"], default="playwright",
                    help="live 抓取方式：playwright 浏览器渲染（默认，过反爬）/ api 直连JSON接口")
    ap.add_argument("--bulk", action="store_true",
                    help="启用批量抓取：60关键词×20城市×10页（目标1万+，耗时30-60分钟）")
    ap.add_argument("--target", type=int, default=0,
                    help="入库达此条数自动停止（默认不限；与 --bulk 配合使用）")
    ap.add_argument("-k", "--keywords", nargs="*", help="搜索关键词，多个空格分隔")
    ap.add_argument("-c", "--cities", nargs="*", help="城市编码（如 530=北京）")
    ap.add_argument("--max-pages", type=int, default=None, help="单关键词×城市最大翻页数")
    ap.add_argument("--limit", type=int, default=None, help="最多入库条数（调试用）")
    ap.add_argument("--batch-size", type=int, default=50, help="批量落库大小")
    args = ap.parse_args()

    if args.source == "fixture":
        pipeline.run_fixture()
    else:
        pipeline.run_live(
            keywords=args.keywords,
            cities=args.cities,
            max_pages=args.max_pages,
            batch_size=args.batch_size,
            limit=args.limit,
            mode=args.mode,
            bulk=args.bulk,
            target=args.target,
        )


if __name__ == "__main__":
    main()
