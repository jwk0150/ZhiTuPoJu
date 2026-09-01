# -*- coding: utf-8 -*-
"""
智能发现爬虫服务（Discovery Service）

真实多源数据采集：后端作为代理绕过浏览器跨域 / 反爬限制，
并发抓取多个公开平台，返回结构化资讯。

主题域（2026-09-01 明确）：
本项目内容**全部围绕「计算机 / IT 行业」**，目标是提供**计算机行业形势的大新闻**，
让**求职者掌握前沿信息**（技术栈变迁、大模型/芯片动向、大厂裁员与招聘趋势、产业政策），
从而判断「学什么、去哪、会不会被替代」。

**岗位优先（2026-09-01 二次明确）**：平台主业是岗位。除招聘本身外，
其余分类的资讯也必须与岗位 / 求职 / 职业发展相关，否则不进发现结果。
实时抓取受反爬影响时，由 `backend/job_news_pool.py` 的「岗位资讯种子库」兜底，
保证五大类每类都有内容，且每次点击看到的组合不同。

因此相关性判据为：
① 主题域必须命中计算机 / IT（热搜聚合类源强制门禁）；
② 非招聘分类必须命中「岗位相关」词（JOB_KW）；
③ 再命中本分类关键词或强信号词。
泛娱乐、体育、非 IT 时政通稿、纯技术八卦、与求职无关的 IT 新闻，一律过滤。

接入的平台（不局限于此，可继续追加）：
- 学术论文：CSDN 技术社区（搜索 API）、掘金（推荐 API）
- 行业报告：少数派 RSS、IT之家 RSS、百度热搜、今日头条热榜
- 企业官网：GitHub 企业开源仓库（搜索 API）、GitHub 今日趋势、Hacker News 全球技术热点
- 政策文件：中国政府网政策库、新华网·时政 RSS
- 招聘平台：BOSS 直聘（反爬强，best-effort，失败如实标记）、Remotive 远程职位 API
"""
from __future__ import annotations

import asyncio
import html as _html
import random
import re
import time
import uuid
from typing import Any, Awaitable, Callable, Dict, List, Optional

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.job_news_pool import (
    PER_TYPE_LIMIT,
    SOURCE_TYPES,
    pick_seeds,
)

router = APIRouter()

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
TIMEOUT = 15.0

# 轮换关键词 / 标签池：每次「发现」随机选取，保证不同次点击拿到不同内容
CSDN_KEYWORDS = ["程序员", "前端开发", "后端开发", "算法", "人工智能", "大模型",
                 "计算机", "软件开发", "面试", "求职", "转行", "高薪",
                 "职业发展", "远程工作", "副业", "AIGC", "应届生"]
GITHUB_KEYWORDS = ["remote jobs", "ai agent", "developer jobs", "hiring",
                   "rust cli", "electron app", "kubernetes", "llm",
                   "react native", "golang", "docker compose", "wasm"]
HN_TAGS = ["front_page", "show_hn", "ask_hn", "best"]
JUEJIN_SORTS = [200, 300, 1]  # 推荐 / 最新 / 热门
# 招聘平台查询词：主题域限定在计算机 / IT 岗位
REMOTIVE_QUERIES = ["python", "frontend", "devops", "golang", "react",
                    "kubernetes", "data engineer", "backend"]


# ---------------- 工具函数 ----------------
def _strip_tags(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"<\/?[^>]+>", "", s or "")
    s = _html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def _tag(block: str, name: str) -> str:
    """从 RSS <item> 块里提取某个标签文本（兼容 CDATA）"""
    m = re.search(
        r"<%s>(?:<!\[CDATA\[(.*?)\]\]>|([^<]*))</%s>" % (name, name), block, re.S
    )
    if not m:
        return ""
    return _strip_tags(m.group(1) or m.group(2) or "")


def _short(s: str, n: int = 90) -> str:
    s = _strip_tags(s or "")
    return s[:n] + ("…" if len(s) > n else "")


# ---------------- 相关性过滤：只保留与「岗位 / 职业 / 就业」主题相关的内容 ----------------
# 每个信源分类对「相关」的定义不同，分别给出关键词集合，过滤掉泛娱乐 / 体育 / 时政杂项等无关资讯。
CAREER_KW = [
    "岗位", "职业", "就业", "招聘", "求职", "人才", "薪资", "工资", "薪酬",
    "面试", "转行", "跳槽", "裁员", "新职业", "应届", "实习", "远程", "灵活就业",
    "自由职业", "副业", "外包", "人工智能", "大模型", "机器学习", "自动化",
    "数字化", "转型", "创业", "职业发展", "高薪", "晋升", "履历", "简历", "offer",
]
POLICY_KW = [
    "就业", "劳动", "人才", "职业", "用工", "社保", "薪酬", "退休", "招募",
    "事业单位", "公务员", "毕业生", "职业技能", "培训", "劳动法", "就业优先", "稳就业", "高校毕业生",
    # 计算机 / IT 产业政策（求职者需要关注的行业政策面）
    "数字经济", "人工智能", "集成电路", "芯片", "数据要素", "算力", "信息化",
    "软件产业", "互联网", "科技创新", "专精特新", "新质生产力", "网络安全", "数据安全",
]
ACADEMIC_KW = [
    "论文", "研究", "算法", "模型", "神经网络", "深度学习", "大模型", "人工智能",
    "机器学习", "ai", "llm", "自然语言", "计算机", "技术", "开源", "框架", "综述", "数据集",
]
REPORT_KW = [
    "行业", "报告", "趋势", "市场", "白皮书", "蓝皮书", "调研", "分析", "规模",
    "增长", "赛道", "展望", "预测", "盘点",
]
ENTERPRISE_KW = [
    "招聘", "远程", "融资", "创业", "大模型", "自动化", "开发者", "框架",
    "团队", "外包", "研发", "灵活用工", "技术团队", "人才",
]
# ---------------- 岗位相关门禁（2026-09-01 用户明确要求）----------------
# 本平台主业是「岗位 / 求职」，所以除招聘本身以外的内容也必须**与岗位相关**
# （影响就业、影响技能选择、影响职业方向）才能进入发现结果。
# 纯技术八卦、纯工具发布、与求职无关的 IT 新闻一律不搜。
JOB_KW = [
    # 中文
    "岗位", "职位", "招聘", "求职", "应聘", "就业", "职业", "人才", "用人", "人力",
    "薪资", "工资", "薪酬", "待遇", "面试", "简历", "履历", "跳槽", "转行", "转岗",
    "裁员", "缩招", "扩招", "校招", "社招", "实习", "应届", "毕业生", "技能要求",
    "用人需求", "缺口", "紧缺", "就业率", "失业", "待业", "灵活就业", "自由职业",
    "副业", "远程工作", "远程办公", "远程岗位", "外包", "晋升", "职级", "职涯",
    "技术团队", "研发团队", "工作机会", "就业机会", "找工作", "招聘需求", "岗位需求",
    # 英文
    "hiring", "recruit", "recruiting", "job opening", "job market", "job search",
    "salary", "layoff", "layoffs", "career", "careers", "internship", "headcount",
    "workforce", "resume", "interview", "quit", "quit rate", "developer jobs",
]
# 强信号词：命中即视为相关，避免短英文词（如 ai）误匹配（如 available）
_STRONG_KW = [
    "人工智能", "ai", "大模型", "机器学习", "就业", "招聘", "求职", "远程工作",
    "远程办公", "hiring", "remote", "jobs", "career", "创业",
]
# ---------------- 主题域：本项目内容全部围绕「计算机 / IT / 软件」 ----------------
# 注意：不要把裸 "it" 当关键词（英文常见词，边界匹配也会大量误命中）。
IT_KW = [
    # 中文
    "计算机", "编程", "程序员", "开发", "前端", "后端", "全栈", "算法", "数据结构",
    "软件", "代码", "开源", "数据库", "操作系统", "芯片", "云计算", "运维", "测试",
    "互联网", "软件工程", "数字化", "算力", "网络安全", "大数据", "自然语言",
    "深度学习", "神经网络", "人工智能", "大模型", "机器学习", "智能化", "鸿蒙",
    "浏览器", "服务器", "小程序", "终端", "机器人", "显卡", "智能体",
    # 英文
    "software", "developer", "engineer", "programming", "coding", "algorithm",
    "database", "cloud", "devops", "frontend", "backend", "fullstack", "github",
    "linux", "python", "java", "javascript", "typescript", "rust", "golang",
    "kubernetes", "docker", "api", "llm", "compiler", "framework",
    "open source", "repository", "sdk", "browser", "app",
]
# 需要做「计算机主题域门禁」的分类：这些源是综合/热搜聚合，容易混入非 IT 内容
_NEED_IT_GATE = {"行业报告", "政策文件"}

# ---------------- 前沿 / 大新闻信号 ----------------
# 面向求职者：计算机行业形势、技术前沿、产业动向（决定「学什么、去哪、会不会被替代」）。
FRONTIER_KW = [
    # 中文
    "大模型", "AIGC", "智能体", "芯片", "算力", "量子", "自动驾驶", "机器人",
    "国产替代", "开源", "发布", "上线", "融资", "裁员", "收购", "财报", "市值",
    "份额", "排行", "趋势", "突破", "禁令", "监管", "禁令", "内测", "公测",
    "停服", "涨价", "降价", "迭代", "替代", "失业", "缩招", "扩招", "风口",
    # 英文
    "layoff", "funding", "acquisition", "ipo", "release", "launch",
    "open source", "breakthrough", "shuts down",
]


def _hit(text: str, kw: str) -> bool:
    """关键词命中判断：中文 / 长英文用子串；短英文词用边界匹配，防止 'ai' 误中 'available'。"""
    kw = kw.lower()
    if re.fullmatch(r"[a-z0-9]+", kw) and len(kw) <= 3:
        return bool(re.search(r"(?<![a-z0-9])" + re.escape(kw) + r"(?![a-z0-9])", text))
    return kw in text


# 各分类对应的相关性关键词集合；值为 None 表示「本身就是该主题，不过滤」
# 说明：IT_KW 只作为「主题域门禁」，不作为分类通过条件——
# 否则任意 IT 内容（如 lint 工具仓库）都能过，过滤就失去意义。
_SOURCE_KW = {
    "招聘平台": None,            # 岗位本身即主题（查询词已限定 IT 岗）
    "政策文件": POLICY_KW,       # 就业 / 劳动 / IT 产业政策
    "学术论文": ACADEMIC_KW,     # 计算机技术前沿研究（决定「学什么方向」）
    "行业报告": REPORT_KW,       # 行业趋势 / 薪资 / 供需
    "企业官网": ENTERPRISE_KW,   # 企业用人动向
}
# 必须命中「岗位相关」才允许通过的分类：平台主业是岗位，与求职无关的 IT 内容不进结果
_JOB_GATE = {"企业官网", "学术论文", "行业报告"}


def is_relevant(it: "DiscItem") -> bool:
    """过滤与主题无关的内容（泛娱乐、体育、非 IT 热搜、时政杂项等）。

    判据：① 主题域必须围绕「计算机 / IT」（热搜聚合类源做强制门禁）；
          ② 再按分类命中本类关键词（或强信号词）。
    """
    text = ((it.title or "") + " " + (it.summary or "")).lower()
    # ① 主题域门禁（热搜聚合类源必须命中计算机 / IT 词）
    if it.source_type in _NEED_IT_GATE:
        if not any(_hit(text, k) for k in IT_KW):
            # 政策文件例外：纯就业 / 劳动类政策即便不含 IT 词也算相关
            if not (it.source_type == "政策文件" and any(_hit(text, k) for k in POLICY_KW)):
                return False
    # ② 岗位相关门禁：平台主业是岗位，与求职 / 职业发展无关的内容不进发现结果
    if it.source_type in _JOB_GATE and not any(_hit(text, k) for k in JOB_KW):
        return False
    # ③ 分类关键词 / 强信号
    kws = _SOURCE_KW.get(it.source_type)
    if kws is None:
        return True
    if any(_hit(text, k) for k in _STRONG_KW):
        return True
    return any(_hit(text, k) for k in kws)


# ---------------- 数据模型 ----------------
class DiscItem:
    def __init__(self, title, url, summary, source_type, source_name, source_mark,
                 published_at=None, seeded=False):
        self.id = uuid.uuid4().hex[:10]
        self.title = title
        self.url = url
        self.summary = summary
        self.source_type = source_type
        self.source_name = source_name
        self.source_mark = source_mark
        self.published_at = published_at
        # seeded=True 表示来自「岗位资讯种子库」（人工整理的岗位索引），
        # 非本轮实时抓取——前端可据此加「精选」标记，统计里单独计数。
        self.seeded = seeded

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "url": self.url,
            "summary": self.summary,
            "source_type": self.source_type,
            "source_name": self.source_name,
            "source_mark": self.source_mark,
            "published_at": self.published_at,
            "is_new": True,
            "seeded": bool(self.seeded),
        }


class SourceResult:
    def __init__(self, sid, stype, name, status, count, error=None):
        self.id = sid
        self.type = stype
        self.name = name
        self.status = status  # ok | blocked | error
        self.count = count
        self.error = error

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "name": self.name,
            "status": self.status,
            "count": self.count,
            "error": self.error,
        }


# ---------------- 各数据源爬虫 ----------------
async def crawl_csdn(client: httpx.AsyncClient) -> List[DiscItem]:
    items: List[DiscItem] = []
    kw = random.choice(CSDN_KEYWORDS)
    page = random.randint(1, 3)
    url = (
        "https://so.csdn.net/api/v3/search?q=%s&t=blog&p=%d&s=0&tm=0&lv=-1&ft=0&dt=0&pn=10"
        % (kw, page)
    )
    r = await client.get(
        url, headers={"User-Agent": UA, "Referer": "https://so.csdn.net"}
    )
    data = r.json()
    for it in data.get("result_vos", [])[:8]:
        title = _strip_tags(it.get("title") or it.get("show_title") or "")
        link = it.get("url") or it.get("link") or ""
        if not (title and link):
            continue
        items.append(
            DiscItem(
                title=title,
                url=link,
                summary=_short(it.get("body", ""), 90),
                source_type="学术论文",
                source_name="CSDN · " + kw,
                source_mark="CSDN",
            )
        )
    return items


async def crawl_juejin(client: httpx.AsyncClient) -> List[DiscItem]:
    items: List[DiscItem] = []
    sort_type = random.choice(JUEJIN_SORTS)
    cursor = str(random.randint(0, 20))
    r = await client.post(
        "https://api.juejin.cn/recommend_api/v1/article/recommend_all_feed?aid=2608&spider=0&limit=10",
        headers={
            "User-Agent": UA,
            "Referer": "https://juejin.cn",
            "Content-Type": "application/json",
        },
        json={"id_type": 2, "sort_type": sort_type, "cursor": cursor, "limit": 10},
    )
    data = r.json()
    for it in data.get("data", []):
        ai = it.get("item_info", {}).get("article_info", {})
        title = ai.get("title", "")
        aid = ai.get("article_id", "")
        if not (title and aid):
            continue
        items.append(
            DiscItem(
                title=title,
                url="https://juejin.cn/post/%s" % aid,
                summary=_short(ai.get("brief_content", ""), 90),
                source_type="学术论文",
                source_name="掘金",
                source_mark="掘金",
            )
        )
    return items


async def crawl_rss(
    client: httpx.AsyncClient, feed_url: str, name: str, mark: str, stype: str,
    limit: int = 8,
) -> List[DiscItem]:
    items: List[DiscItem] = []
    r = await client.get(feed_url, headers={"User-Agent": UA})
    text = r.text
    for m in re.finditer(r"<item>(.*?)</item>", text, re.S):
        block = m.group(1)
        title = _tag(block, "title")
        link = _tag(block, "link")
        desc = _tag(block, "description") or _tag(block, "summary")
        if not (title and link):
            continue
        items.append(
            DiscItem(
                title=title,
                url=link,
                summary=_short(desc, 90),
                source_type=stype,
                source_name=name,
                source_mark=mark,
                published_at=_tag(block, "pubDate") or None,
            )
        )
    return items[:limit]


async def crawl_github(client: httpx.AsyncClient) -> List[DiscItem]:
    items: List[DiscItem] = []
    kw = random.choice(GITHUB_KEYWORDS).replace(" ", "+")
    page = random.randint(1, 3)
    r = await client.get(
        "https://api.github.com/search/repositories?q=%s&sort=stars&per_page=8&page=%d"
        % (kw, page),
        headers={"User-Agent": UA, "Accept": "application/vnd.github+json"},
    )
    data = r.json()
    for it in data.get("items", []):
        items.append(
            DiscItem(
                title=it.get("name", ""),
                url=it.get("html_url", ""),
                summary=_short(it.get("description", ""), 90),
                source_type="企业官网",
                source_name="GitHub 企业开源 · " + (it.get("owner", {}) or {}).get("login", ""),
                source_mark="GitHub",
                published_at=it.get("pushed_at"),
            )
        )
    return items


async def crawl_gov(client: httpx.AsyncClient) -> List[DiscItem]:
    """中国政府网政策 RSS。

    注意：原 `https://www.gov.cn/zhengce/zuixin/` 与 `/zhengce/xxgk/` 都是 JS 渲染，
    静态 HTML 里没有任何 /zhengce/ 链接，正则永远匹配不到（恒为 0 条）。
    改用服务端渲染的 pushinfo RSS，多取一些条目再交给相关性过滤挑选。
    """
    return await crawl_rss(
        client,
        "https://www.gov.cn/pushinfo/v150203/rss.xml",
        "中国政府网",
        "政策",
        "政策文件",
        limit=40,
    )


async def crawl_boss(client: httpx.AsyncClient) -> List[DiscItem]:
    """BOSS 直聘反爬极严（返回空 body），best-effort，失败如实返回空。"""
    items: List[DiscItem] = []
    try:
        r = await client.get(
            "https://www.zhipin.com/web/geek/job?query=%E5%89%8D%E7%AB%AF%E5%BC%80%E5%8F%91&city=100010000",
            headers={"User-Agent": UA, "Accept": "text/html"},
            timeout=10,
        )
        if r.status_code == 200 and len(r.text) > 800:
            for m in re.finditer(
                r'<a[^>]+href="/job_detail/[^"]+"[^>]*>([^<]{2,40})</a>', r.text
            ):
                title = _strip_tags(m.group(1))
                if title:
                    items.append(
                        DiscItem(
                            title=title,
                            url="https://www.zhipin.com",
                            summary="",
                            source_type="招聘平台",
                            source_name="BOSS 直聘",
                            source_mark="BOSS",
                        )
                    )
    except Exception:
        pass
    return items


async def crawl_xinhua(client: httpx.AsyncClient) -> List[DiscItem]:
    """新华网时政 RSS（服务器渲染，稳定可用）—— 作为「政策文件」真实来源。"""
    return await crawl_rss(
        client,
        "http://www.xinhuanet.com/politics/news_politics.xml",
        "新华网·时政",
        "新华",
        "政策文件",
    )


async def crawl_remotive(client: httpx.AsyncClient) -> List[DiscItem]:
    """Remotive 公开远程职位 API（真实职位数据，作为「招聘平台」可采集来源）。"""
    items: List[DiscItem] = []
    try:
        r = await client.get(
            "https://remotive.com/api/remote-jobs?search=%s&limit=8"
            % random.choice(REMOTIVE_QUERIES).replace(" ", "%20"),
            headers={"User-Agent": UA},
            timeout=10,
        )
        data = r.json()
        jobs = data.get("jobs", []) if isinstance(data, dict) else data
        for it in jobs[:8]:
            title = _strip_tags(it.get("title", ""))
            url = it.get("url", "")
            company = _strip_tags(it.get("company_name", ""))
            if not (title and url):
                continue
            items.append(
                DiscItem(
                    title=title,
                    url=url,
                    summary=_short(it.get("description", ""), 90),
                    source_type="招聘平台",
                    source_name="远程职位 · " + (company or "Remotive"),
                    source_mark="BOSS",
                )
            )
    except Exception:
        pass
    return items


async def crawl_baidu_hot(client: httpx.AsyncClient) -> List[DiscItem]:
    """百度实时热搜榜 API（真实热点数据，作为「行业报告」的补充来源）。"""
    items: List[DiscItem] = []
    try:
        r = await client.get(
            "https://top.baidu.com/api/board?platform=wise&tab=realtime",
            headers={"User-Agent": UA, "Referer": "https://top.baidu.com"},
            timeout=10,
        )
        data = r.json()
        for card in data.get("data", {}).get("cards", []):
            for grp in card.get("content", []):
                for it in grp.get("content", []):
                    word = _strip_tags(it.get("word", ""))
                    url = it.get("url", "")
                    desc = _strip_tags(it.get("desc", ""))
                    if word and url:
                        items.append(
                            DiscItem(
                                title=word,
                                url=url,
                                summary=_short(desc, 90),
                                source_type="行业报告",
                                source_name="百度热搜",
                                source_mark="百度",
                            )
                        )
    except Exception:
        pass
    return items[:8]


async def crawl_hackernews(client: httpx.AsyncClient) -> List[DiscItem]:
    """Hacker News 全球技术热点（Algolia 公开 API，无需鉴权，稳定可用）。"""
    items: List[DiscItem] = []
    try:
        tag = random.choice(HN_TAGS)
        r = await client.get(
            "https://hn.algolia.com/api/v1/search?tags=%s&hitsPerPage=10" % tag,
            headers={"User-Agent": UA},
            timeout=10,
        )
        data = r.json()
        for it in data.get("hits", [])[:8]:
            title = _strip_tags(it.get("title", ""))
            if not title:
                continue
            oid = it.get("objectID", "")
            url = it.get("url") or ("https://news.ycombinator.com/item?id=" + str(oid))
            points = it.get("points")
            author = it.get("author", "") or "HN"
            summary = "▲ %s · %s" % (points if points is not None else "—", author)
            items.append(
                DiscItem(
                    title=title,
                    url=url,
                    summary=_short(summary, 90),
                    source_type="企业官网",
                    source_name="Hacker News",
                    source_mark="HN",
                    published_at=it.get("created_at"),
                )
            )
    except Exception:
        pass
    return items


async def crawl_github_trending(client: httpx.AsyncClient) -> List[DiscItem]:
    """GitHub 今日趋势仓库（HTML 解析，真实开源热点）。"""
    items: List[DiscItem] = []
    try:
        r = await client.get(
            "https://github.com/trending",
            headers={"User-Agent": UA, "Accept": "text/html"},
            timeout=5,
        )
        text = r.text
        for m in re.finditer(r'<article class="Box-row">(.*?)</article>', text, re.S):
            block = m.group(1)
            h2 = re.search(r"<h2[^>]*>(.*?)</h2>", block, re.S)
            if not h2:
                continue
            repo = re.search(r'href="(/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)"', h2.group(1))
            if not repo:
                continue
            path = repo.group(1)
            desc_m = re.search(r"</h2>\s*<p[^>]*>(.*?)</p>", block, re.S)
            desc = _strip_tags(desc_m.group(1)) if desc_m else ""
            items.append(
                DiscItem(
                    title=path.strip("/"),
                    url="https://github.com" + path,
                    summary=_short(desc, 90),
                    source_type="企业官网",
                    source_name="GitHub 热门仓库",
                    source_mark="GitHub",
                )
            )
    except Exception:
        pass
    return items[:8]


async def crawl_toutiao(client: httpx.AsyncClient) -> List[DiscItem]:
    """今日头条实时热榜（JSON 接口，真实热点话题，作为「行业报告」补充）。"""
    items: List[DiscItem] = []
    try:
        r = await client.get(
            "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc",
            headers={"User-Agent": UA, "Referer": "https://www.toutiao.com"},
            timeout=10,
        )
        data = r.json()
        for it in data.get("data", [])[:8]:
            title = _strip_tags(it.get("Title", ""))
            url = it.get("Url", "")
            if not (title and url):
                continue
            hot = it.get("HotValue")
            summary = ("热度 %s" % hot) if hot else "今日头条热榜"
            items.append(
                DiscItem(
                    title=title,
                    url=url,
                    summary=_short(summary, 90),
                    source_type="行业报告",
                    source_name="今日头条热榜",
                    source_mark="头条",
                )
            )
    except Exception:
        pass
    return items


# ---------------- 数据源注册表（易扩展）----------------
# 每个条目：id（对应前端 chip）、分类 type、展示名、标记、爬虫函数
CRAWLERS = [
    {"id": "boss", "type": "招聘平台", "name": "BOSS 直聘", "mark": "BOSS",
     "fn": crawl_boss},
    {"id": "boss2", "type": "招聘平台", "name": "远程职位 Remotive", "mark": "BOSS",
     "fn": crawl_remotive},
    {"id": "csdn", "type": "学术论文", "name": "CSDN / 掘金", "mark": "学术",
     "fn": crawl_csdn},
    {"id": "csdn2", "type": "学术论文", "name": "掘金", "mark": "掘金",
     "fn": crawl_juejin},
    {"id": "co", "type": "企业官网", "name": "GitHub 企业开源", "mark": "企业",
     "fn": crawl_github},
    {"id": "co2", "type": "企业官网", "name": "GitHub 热门仓库", "mark": "GitHub",
     "fn": crawl_github_trending},
    {"id": "hn", "type": "企业官网", "name": "Hacker News", "mark": "HN",
     "fn": crawl_hackernews},
    {"id": "gov", "type": "政策文件", "name": "中国政府网", "mark": "政策",
     "fn": crawl_gov},
    {"id": "gov2", "type": "政策文件", "name": "新华网·时政", "mark": "新华",
     "fn": crawl_xinhua},
    {"id": "rpt", "type": "行业报告", "name": "少数派", "mark": "报告",
     "fn": lambda c: crawl_rss(c, "https://sspai.com/feed", "少数派", "sspai", "行业报告")},
    {"id": "rpt2", "type": "行业报告", "name": "IT之家", "mark": "IT",
     "fn": lambda c: crawl_rss(c, "https://www.ithome.com/rss/", "IT之家", "IT", "行业报告")},
    {"id": "rpt3", "type": "行业报告", "name": "百度热搜", "mark": "百度",
     "fn": crawl_baidu_hot},
    {"id": "rpt4", "type": "行业报告", "name": "今日头条热榜", "mark": "头条",
     "fn": crawl_toutiao},
]


async def run_discovery() -> dict:
    started = time.time()
    run_id = uuid.uuid4().hex[:8]
    source_results: List[SourceResult] = []
    all_items: List[DiscItem] = []
    pages = 0
    raw = 0

    async with httpx.AsyncClient(
        timeout=TIMEOUT, follow_redirects=True, headers={"User-Agent": UA}
    ) as client:
        tasks = [c["fn"](client) for c in CRAWLERS]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    per_source_items: List[List[DiscItem]] = []
    for cfg, res in zip(CRAWLERS, results):
        items: List[DiscItem] = []
        err = None
        if isinstance(res, Exception):
            err = str(res)[:120]
        else:
            items = res
        pages += 1
        raw += len(items)
        # 相关性过滤：只保留与本分类主题（岗位 / 职业 / 就业）相关的内容
        kept: List[DiscItem] = [it for it in items if is_relevant(it)]
        status = "ok" if kept else ("error" if err else "blocked")
        source_results.append(
            SourceResult(cfg["id"], cfg["type"], cfg["name"], status, len(kept), err)
        )
        for it in kept:
            it.source_type = cfg["type"]
        per_source_items.append(kept)

    # 去重（按标题），并按来源轮询交织，保证每个分类都能出现在前列
    seen_titles = set()
    deduped: List[DiscItem] = []
    queues = [list(src) for src in per_source_items if src]
    while any(queues):
        for q in queues:
            if q:
                it = q.pop(0)
                if it.title in seen_titles:
                    continue
                seen_titles.add(it.title)
                deduped.append(it)

    # ---- 岗位资讯补齐 + 每类轮换截取 ----------------------------------------
    # 目标：五大类每类都稳定给出 PER_TYPE_LIMIT 条「岗位相关」资讯；
    # 实时抓取够就用实时的，不够就从岗位资讯种子库补（每次随机抽取，连点会看到不同内容）。
    by_type: Dict[str, List[DiscItem]] = {t: [] for t in SOURCE_TYPES}
    for it in deduped:
        by_type.setdefault(it.source_type, []).append(it)
    seeded_count = 0
    for t in SOURCE_TYPES:
        bucket = by_type[t]
        random.shuffle(bucket)          # 每轮打乱 → 截取的子集不同，视觉上「真的换了一批」
        bucket = bucket[:PER_TYPE_LIMIT]
        need = PER_TYPE_LIMIT - len(bucket)
        if need > 0:
            for seed in pick_seeds(t, need, used_titles=seen_titles):
                bucket.append(
                    DiscItem(
                        title=seed["title"],
                        url=seed["url"],
                        summary=seed["summary"],
                        source_type=seed["source_type"],
                        source_name=seed["source_name"],
                        source_mark=seed["source_mark"],
                        seeded=True,
                    )
                )
                seen_titles.add(seed["title"])
                seeded_count += 1
        by_type[t] = bucket

    # 按分类轮询交织，保证「全部信源」视图里五大类均匀出现
    deduped = []
    qs = [by_type[t] for t in SOURCE_TYPES if by_type[t]]
    while any(qs):
        for q in qs:
            if q:
                deduped.append(q.pop(0))

    duration_ms = int((time.time() - started) * 1000)
    total = len(deduped)
    valid = sum(1 for s in source_results if s.status == "ok")

    stats = {
        "sources": len(CRAWLERS),
        "pages": pages,
        "raw": raw,
        "valid": valid,
        "seeded": seeded_count,
        "new": total,
        "duration": "%02d:%02d" % (duration_ms // 60000, (duration_ms // 1000) % 60),
    }

    return {
        "code": 0,
        "message": "success",
        "data": {
            "run_id": run_id,
            "started_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "duration_ms": duration_ms,
            "sources": [s.to_dict() for s in source_results],
            "items": [it.to_dict() for it in deduped],
            "stats": stats,
        },
    }


@router.get("/run")
async def discovery_run():
    """触发一次真实多源发现，返回结构化结果。"""
    data = await run_discovery()
    return JSONResponse(
        content=data,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get("/health")
async def discovery_health():
    return {"code": 0, "message": "discovery service ok"}
