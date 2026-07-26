"""爬虫全局配置。

连接参数默认读环境变量，缺省回落到本地开发值（PG 3309 / postgres）。
业务代码统一从这里取配置，禁止散落 os.getenv。
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class DBConfig:
    host: str = os.getenv("PG_HOST", "127.0.0.1")
    port: int = int(os.getenv("PG_PORT", "3309"))
    user: str = os.getenv("PG_USER", "postgres")
    password: str = os.getenv("PG_PASSWORD", "123456")
    dbname: str = os.getenv("PG_DB", "zhilian_crawl_db")
    # 建库时连入的维护库
    admin_dbname: str = os.getenv("PG_ADMIN_DB", "postgres")
    # 表前缀（按站名拼音缩写，如 zhilian / boss / lagou），用于本机采集库
    prefix: str = os.getenv("PG_PREFIX", "zhilian")

    @property
    def dsn(self) -> str:
        return (
            f"host={self.host} port={self.port} user={self.user} "
            f"password={self.password} dbname={self.dbname}"
        )

    @property
    def admin_dsn(self) -> str:
        return (
            f"host={self.host} port={self.port} user={self.user} "
            f"password={self.password} dbname={self.admin_dbname}"
        )

    def tables(self, prefix: str | None = None) -> tuple[str, str]:
        """返回 (postings, details) 完整表名。"""
        p = (prefix or self.prefix).strip().rstrip("_") + "_"
        return f"{p}job_postings", f"{p}job_posting_details"

    @property
    def postings_table(self) -> str:
        return self.tables()[0]

    @property
    def details_table(self) -> str:
        return self.tables()[1]


@dataclass(frozen=True)
class CrawlConfig:
    source_name: str = "zhilian"
    # 智联搜索接口（JSON）。列表页数据来源。
    search_api: str = "https://fe-api.zhaopin.com/c/i/search/positions"
    # 备用/新版搜索页（Playwright 兜底时使用）
    search_page: str = "https://sou.zhaopin.com/"
    page_size: int = 60                 # 智联单页最大 60/90
    request_min_interval: float = 1.0   # 请求间隔下限（秒）
    request_max_interval: float = 3.0   # 请求间隔上限（秒）
    max_retries: int = 3                # 单请求最大重试
    retry_backoff: float = 2.0          # 指数退避基数
    timeout: float = 15.0               # 单请求超时（秒）
    max_pages: int = 10                 # 单个关键词×城市最大翻页数（防跑飞）
    # 默认抓取范围（可被 CLI 覆盖）
    keywords: tuple[str, ...] = ("Java", "Python", "算法工程师", "前端开发")
    cities: tuple[str, ...] = ("530",)  # 530=北京；智联城市编码

    # ===== 大批量抓取默认范围（可达 1万+ 条）=====
    bulk_keywords: tuple[str, ...] = (
        "Java", "Python", "算法工程师", "前端开发", "后端开发",
        "数据分析师", "产品经理", "运维工程师", "测试工程师", "数据开发",
        "Android", "iOS", "嵌入式", "UI设计师", "运营",
        "市场策划", "销售", "财务", "HRBP", "项目经理",
        "机器学习", "深度学习", "自然语言处理", "推荐算法", "搜索算法",
        "大数据", "数据仓库", "ETL工程师", "DBA", "安全工程师",
        "C++", "Go", "Rust", "PHP", "Node.js",
        "Web前端", "Vue", "React", "小程序", "游戏开发",
        "Unity3D", "Cocos", "测试开发", "性能测试", "自动化测试",
        "技术支持", "售前", "售后", "采购", "供应链",
        "新媒体运营", "内容运营", "用户运营", "电商运营", "活动策划",
        "平面设计", "视觉设计", "交互设计", "用户体验", "品牌设计",
    )
    bulk_cities: tuple[str, ...] = (
        "530",  # 北京
        "538",  # 上海
        "763",  # 广州
        "765",  # 深圳
        "736",  # 杭州
        "703",  # 成都
        "635",  # 武汉
        "613",  # 西安
        "702",  # 重庆
        "801",  # 南京
        "639",  # 苏州
        "719",  # 青岛
        "854",  # 宁波
        "656",  # 长沙
        "749",  # 厦门
        "622",  # 天津
        "600",  # 郑州
        "707",  # 福州
        "757",  # 济南
        "599",  # 合肥
    )
    bulk_max_pages: int = 10            # bulk 模式每组合翻页数（20条×10=200条/组合）

    # ===== Playwright 兜底（sou.zhaopin.com 渲染 + XHR 拦截）=====
    pw_headless: bool = True        # bulk 大批量默认 headless（无窗口、可后台跑）；
                                     # 反爬严时可改 False 走可见浏览器+人工过验证
    pw_nav_timeout: int = 30000     # 单页导航超时（ms）
    pw_settle_ms: int = 8000        # 导航后等待 XHR/渲染的额外时间（ms）
    pw_captcha_wait_ms: int = 60000 # 检测到验证页时，留给人工处理的时间（ms）
    search_page_tpl: str = "https://sou.zhaopin.com/?kw={kw}&jl={city}&p={page}"
    # 持久化浏览器配置目录：手动过一次验证后 cookie 留存，后续复用免验证
    pw_profile_dir: str = os.path.join(os.path.dirname(__file__), ".pw_profile")

    user_agents: tuple[str, ...] = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    )


DB = DBConfig()
CRAWL = CrawlConfig()
