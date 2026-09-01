# -*- coding: utf-8 -*-
"""执图顾问 ZhituAgent —— 统一对话大脑（与 DiscoveryAgent 隔离）。"""

from __future__ import annotations

import json
import os
import random
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from backend.llm import deepseek as ds

KNOWLEDGE_DIR = Path(__file__).resolve().parent / "knowledge"
POSTINGS_TBL = "job_postings"
DETAILS_TBL = "job_posting_details"

INTENT_RULES: list[tuple[str, list[str]]] = [
    ("procure", ["采购", "优先", "入库", "采纳", "先采", "推荐清单", "审核顺序"]),
    ("forecast", ["预测", "未来", "储备", "跟踪", "ETA", "窗口"]),
    ("skill", ["技能", "能力", "会什么", "掌握", "技术栈"]),
    ("compare", ["区别", "对比", "差异", "哪个好", "交集"]),
    ("salary", ["薪资", "薪水", "工资", "待遇", "多少钱"]),
    ("trend", ["趋势", "增长", "热度", "演化", "变化"]),
    ("process", ["怎么用", "流程", "重新扫描", "幻觉", "图谱", "匹配"]),
    ("time", ["几点", "时间", "日期", "今天", "星期", "周几", "现在", "多少号", "几月"]),
    ("chitchat", ["你好", "您好", "嗨", "在吗", "谢谢", "感谢", "早上好", "晚上好", "拜拜", "再见"]),
]


WEEKDAYS = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]


def server_now_payload() -> dict[str, str]:
    from datetime import datetime

    try:
        from zoneinfo import ZoneInfo
        now = datetime.now(ZoneInfo("Asia/Shanghai"))
        tz = "Asia/Shanghai"
    except Exception:
        now = datetime.now()
        tz = "local"
    return {
        "iso": now.isoformat(timespec="seconds"),
        "date": now.strftime("%Y年%m月%d日"),
        "time": now.strftime("%H:%M:%S"),
        "weekday": WEEKDAYS[now.weekday()],
        "timezone": tz,
    }


def try_basic_skills(message: str) -> str | None:
    """本地基础能力：时间/日期/寒暄。不经 LLM，保证稳定可用。"""
    text = (message or "").strip()
    if not text:
        return None
    low = text.lower()
    now = server_now_payload()

    time_ask = any(k in text for k in ("几点", "现在时间", "当前时间", "什么时间", "啥时候了")) or (
        "时间" in text and any(k in text for k in ("现在", "当前", "几", "多少"))
    )
    date_ask = any(k in text for k in ("几号", "日期", "今天是", "哪天", "多少号"))
    week_ask = any(k in text for k in ("星期几", "周几", "礼拜几", "星期"))

    if time_ask and not any(k in text for k in ("岗位", "采购", "技能", "扫描")):
        return f"现在是 {now['date']} {now['weekday']} {now['time']}（{now['timezone']}）。有业务问题也可以继续丢给我。"
    if date_ask and not any(k in text for k in ("岗位", "采购", "发布")):
        return f"今天是 {now['date']}，{now['weekday']}。"
    if week_ask and len(text) <= 20:
        return f"今天{now['weekday']}，日期 {now['date']}。"

    greetings = ("你好", "您好", "嗨", "hi", "hello", "在吗", "早上好", "中午好", "晚上好")
    if any(low.startswith(g) or text == g for g in greetings) and len(text) <= 12:
        return random.choice([
            "在的。我是执图顾问——问时间、问岗位、问采谁都行，直接说。",
            "嗨，我在。要拍采购优先级，还是先问点别的？",
            "你好。基础问题（时间/日期）和岗位采购我都能接，开说吧。",
        ])
    if text in ("谢谢", "感谢", "多谢", "谢了"):
        return random.choice(["客气。还有要拍板的岗就扔过来。", "嗯，随时叫我。"])
    if text in ("拜拜", "再见", "回见"):
        return "回见。需要再扫一轮或排采购时叫我。"
    return None


def detect_intents(message: str) -> list[str]:
    text = (message or "").strip().lower()
    hits = [name for name, kws in INTENT_RULES if any(k.lower() in text for k in kws)]
    return hits or ["general"]


def _build_pg_dsn() -> str:
    host = os.getenv("PG_HOST", "127.0.0.1") or "127.0.0.1"
    port = os.getenv("PG_PORT", "3309") or "3309"
    user = os.getenv("PG_USER", "postgres") or "postgres"
    password = os.getenv("PG_PASSWORD") or "123456"
    db = os.getenv("PG_DB", "zhilian_crawl_db") or "zhilian_crawl_db"
    return f"host={host} port={port} user={user} password={password} dbname={db}"


@lru_cache(maxsize=1)
def load_knowledge() -> dict[str, Any]:
    playbook = ""
    cards: list[dict] = []
    examples: list[dict] = []
    try:
        playbook = (KNOWLEDGE_DIR / "playbook.md").read_text(encoding="utf-8")
    except OSError:
        playbook = ""
    try:
        cards = json.loads((KNOWLEDGE_DIR / "domain_cards.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        cards = []
    try:
        examples = json.loads((KNOWLEDGE_DIR / "style_examples.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        examples = []
    return {"playbook": playbook, "cards": cards, "examples": examples}


def _compact_jobs(jobs: list[dict], limit: int = 12) -> list[dict]:
    out = []
    for d in (jobs or [])[:limit]:
        out.append({
            "id": d.get("id"),
            "title": d.get("title"),
            "status": d.get("status") or "pending",
            "confidence": d.get("confidence"),
            "category": d.get("category"),
            "city": d.get("city"),
            "salary": d.get("salary"),
            "level": d.get("level"),
            "skills": (d.get("core_skills") or d.get("requiredSkills") or [])[:8],
            "definition": (d.get("definition") or d.get("description") or "")[:220],
            "reasoning": (d.get("reasoning") or "")[:160],
            "is_forecast": bool(d.get("is_forecast") or d.get("status") == "forecast"),
            "eta_months": d.get("eta_months"),
        })
    return out


def _keywords_from_message(message: str) -> list[str]:
    raw = re.findall(r"[\u4e00-\u9fffA-Za-z0-9+#.]{2,}", message or "")
    stop = {"什么", "哪些", "怎么", "如何", "需要", "岗位", "请问", "一下", "这个", "那个", "可以", "我们", "你们"}
    out = []
    for w in raw:
        if w in stop:
            continue
        if w not in out:
            out.append(w)
        if len(out) >= 6:
            break
    return out


def retrieve_cards(intents: list[str], message: str, limit: int = 3) -> list[dict]:
    cards = load_knowledge().get("cards") or []
    kws = _keywords_from_message(message)
    scored: list[tuple[int, dict]] = []
    for c in cards:
        tags = [str(t).lower() for t in (c.get("tags") or [])]
        title = str(c.get("title") or "").lower()
        body = str(c.get("body") or "").lower()
        score = 0
        for intent in intents:
            if any(intent in t or t in intent for t in tags):
                score += 2
        for kw in kws:
            kl = kw.lower()
            if kl in title or kl in body or any(kl in t for t in tags):
                score += 3
        if score:
            scored.append((score, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    if not scored:
        return cards[:limit]
    return [c for _, c in scored[:limit]]


def retrieve_playbook_snippet(intents: list[str], max_chars: int = 1200) -> str:
    text = load_knowledge().get("playbook") or ""
    if not text:
        return ""
    # Prefer sections that mention intent-related words
    chunks = re.split(r"\n(?=## )", text)
    picked = []
    for ch in chunks:
        low = ch.lower()
        if any(
            k in low
            for intent in intents
            for k in {
                "procure": ["采购", "审核", "采纳"],
                "forecast": ["预测", "跟踪"],
                "skill": ["技能", "匹配"],
                "process": ["流程", "扫描", "幻觉", "图谱"],
                "general": ["定位", "原则"],
                "compare": ["原则", "匹配"],
                "salary": ["原则"],
                "trend": ["预测", "演化"],
            }.get(intent, ["原则"])
        ):
            picked.append(ch.strip())
    blob = "\n\n".join(picked) if picked else text
    return blob[:max_chars]


def retrieve_jd_signals(message: str, limit: int = 8) -> list[dict]:
    """Lightweight PG lookup; failures return []. Never blocks chat."""
    kws = _keywords_from_message(message)
    if not kws:
        return []
    try:
        import psycopg
    except ImportError:
        return []
    dsn = _build_pg_dsn()
    # Build OR ilike on title; keep query simple and bounded
    clauses = []
    params: list[Any] = []
    for kw in kws[:4]:
        clauses.append("p.job_title ILIKE %s")
        params.append(f"%{kw}%")
    where = " OR ".join(clauses) if clauses else "TRUE"
    sql = f"""
        SELECT p.job_title, p.city, p.salary_min, p.salary_max, d.skills
        FROM {POSTINGS_TBL} p
        LEFT JOIN {DETAILS_TBL} d ON d.job_id = p.id
        WHERE p.status = 0 AND ({where})
        ORDER BY p.crawl_time DESC NULLS LAST
        LIMIT %s
    """
    params.append(limit)
    try:
        with psycopg.connect(dsn, connect_timeout=2) as conn:
            rows = conn.execute(sql, params).fetchall()
    except Exception:
        return []
    out = []
    for r in rows:
        title, city, smin, smax, skills = r
        if not title:
            continue
        skill_list = list(skills or [])[:6] if isinstance(skills, (list, tuple)) else []
        salary = None
        if smin or smax:
            salary = f"{int(smin or 0)//1000}-{int(smax or 0)//1000}K" if (smin or smax) else None
        out.append({
            "title": str(title)[:80],
            "city": city or "",
            "salary": salary,
            "skills": skill_list,
        })
    return out


def _style_examples(channel: str, n: int = 2) -> list[dict]:
    examples = load_knowledge().get("examples") or []
    matched = [e for e in examples if (e.get("channel") or "suggest") == channel]
    pool = matched or examples
    if len(pool) <= n:
        return pool
    return random.sample(pool, n)


def _system_prompt(channel: str) -> str:
    channel_hint = (
        "当前入口：采购顾问抽屉。业务上重点给审核/采购优先级；普通闲聊与基础问题也要正常回答。"
        "回复尽量像微信对话：先给一句拍板结论，再给不超过 5 条短理由；少用长段落和大标题。"
        if channel == "suggest"
        else "当前入口：智能问答。可谈技能、对比、趋势、流程，也可回答时间/日期等基础问题；保持猎头口吻；答复宜短、分段清晰。"
    )
    return (
        "你是「执图破局」的执图顾问：资深猎头 / 人才采购顾问，同时也是可用的对话助手。"
        "产品从招聘库发现新兴岗位，支持审核采购与预测跟踪；并有能力图谱与人岗匹配。"
        f"{channel_hint}"
        "能力边界："
        "A) 基础能力：时间/日期（上下文有 server_now，必须据此如实回答）、寒暄、概念解释、一般常识；"
        "B) 业务能力：采购优先级、预测跟踪、技能/趋势/匹配；"
        "C) 禁止编造上下文中不存在的岗位名称或 id；无扫描数据时，仅在用户问采购/发现岗时催重新扫描，不要对「几点了」之类基础问题催扫描。"
        "表达：先结论后依据；中文口语专业；回答形态有变化；你与 DiscoveryAgent 是不同角色，不要声称自己正在扫库。"
    )


def _heuristic_reply(
    *,
    channel: str,
    message: str,
    discoveries: list[dict],
    forecasts: list[dict],
    cards: list[dict],
) -> str:
    basic = try_basic_skills(message)
    if basic:
        return basic

    pending = [j for j in discoveries if (j.get("status") or "pending") == "pending"]
    pending.sort(key=lambda j: j.get("confidence") or 0, reverse=True)
    intents = detect_intents(message)
    business_need = any(i in intents for i in ("procure", "forecast", "skill", "salary", "trend", "compare", "process"))

    if not discoveries and not forecasts:
        if not business_need:
            return random.choice([
                "这题偏业务外也行——你换成具体问题我接着答。若要谈采购清单，先点「重新扫描」拉本轮岗位。",
                "我在。基础问题直接问；要排发现岗采购的话，先扫描一轮给我上下文。",
            ])
        templates_empty = [
            "先点「重新扫描」。库里这轮还没岗位上下文，我没法凭空给你岗位名——那是猎头大忌。",
            "这轮没有可谈的发现/预测。扫完再来，我按置信度和技能信号给你排采购顺序。",
            "上下文是空的。先扫描，再问我采谁、跟谁、储备什么。",
        ]
        base = random.choice(templates_empty)
        if cards:
            base += f"\n补充一句业务常识：{cards[0].get('title')}——{(cards[0].get('body') or '')[:80]}"
        return base

    if any(k in (message or "") for k in ("预测", "跟踪", "储备")) or (channel == "qa" and "预测" in (message or "")):
        if forecasts:
            tops = "、".join((f.get("title") or "?") for f in forecasts[:3])
            opts = [
                f"预测方向先盯着：{tops}。别急着采购，先跟踪；等发现池里出现成簇 JD 再审。",
                f"我会把 {tops} 当成窗口，不是现货。储备对应技能，采购留给已验证的发现岗。",
            ]
            return random.choice(opts)
        return random.choice([
            "这轮预测列表是空的。可以问发现岗怎么排，或先重新扫描拉趋势。",
            "暂时没有预测岗可聊窗口。先看发现岗，或再扫一轮。",
        ])

    if pending and business_need:
        lines = [random.choice([
            "结论：先拿高置信度待审岗开刀，别一口气全采。",
            "我的排法：置信度高、技能信号清楚的先入库。",
            "拍板思路：先 1–2 个稳的，验证流程再扩面。",
        ])]
        for i, j in enumerate(pending[:5], 1):
            skills = "、".join(j.get("skills") or [])[:36]
            lines.append(
                f"{i}. {j.get('title')}（{j.get('confidence') or 0}%）"
                + (f" — {skills}" if skills else "")
            )
        lines.append(random.choice([
            "预测岗另说：只跟踪，不直接采。",
            "要细聊某个岗，把岗位名丢给我。",
        ]))
        return "\n".join(lines)

    return random.choice([
        f"发现 {len(discoveries)} 个、预测 {len(forecasts)} 个。想排采购直接说「优先采谁」；问时间/技能也行。",
        "我在听。可以继续问采购顺序、预测窗口，或任意基础问题。",
    ])


def chat(
    *,
    message: str,
    channel: str = "suggest",
    history: list[dict] | None = None,
    discoveries: list[dict] | None = None,
    forecasts: list[dict] | None = None,
    summary: str = "",
) -> dict[str, Any]:
    channel = "qa" if channel == "qa" else "suggest"
    message = (message or "").strip() or (
        "请给出本轮采购建议" if channel == "suggest" else "请基于业务手册介绍岗位发现能力"
    )
    discoveries = discoveries or []
    forecasts = forecasts or []
    history = history or []

    # 基础能力优先本地工具，保证「几点了」等稳定可用
    basic = try_basic_skills(message)
    if basic:
        return {
            "reply": basic,
            "recommendations": [],
            "llm": "none",
            "error": None,
            "mode": "basic",
            "channel": channel,
            "intents": detect_intents(message),
        }

    compact_d = _compact_jobs(discoveries, 12)
    compact_f = _compact_jobs(forecasts, 8)
    pending = [j for j in compact_d if (j.get("status") or "pending") == "pending"]
    pending.sort(key=lambda j: j.get("confidence") or 0, reverse=True)

    intents = detect_intents(message)
    playbook = retrieve_playbook_snippet(intents)
    cards = retrieve_cards(intents, message, limit=3)
    need_jd = any(i in intents for i in ("skill", "salary", "compare", "trend", "general"))
    jd_signals = retrieve_jd_signals(message, limit=8) if need_jd else []
    examples = _style_examples(channel, n=2)
    now = server_now_payload()

    context_blob = {
        "server_now": now,
        "summary": (summary or "")[:500],
        "discoveries": compact_d,
        "forecasts": compact_f,
        "pending_top": pending[:6],
        "intents": intents,
        "playbook_excerpt": playbook,
        "domain_cards": cards,
        "jd_market_signals": jd_signals,
        "style_examples": examples,
    }

    temperature = 0.55 if channel == "suggest" else 0.65
    messages: list[dict[str, str]] = [
        {"role": "system", "content": _system_prompt(channel)},
        {"role": "system", "content": "业务与市场上下文(JSON):\n" + json.dumps(context_blob, ensure_ascii=False)},
    ]
    for h in history[-8:]:
        role = h.get("role")
        content = (h.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content[:1200]})
    messages.append({"role": "user", "content": message})

    reply, meta = ds.chat_completions(messages, temperature=temperature, timeout=60.0)
    if reply:
        return {
            "reply": reply,
            "recommendations": pending[:5],
            "llm": meta.get("llm") or "none",
            "error": None,
            "mode": "llm",
            "channel": channel,
            "intents": intents,
        }

    reply = _heuristic_reply(
        channel=channel,
        message=message,
        discoveries=compact_d,
        forecasts=compact_f,
        cards=cards,
    )
    if meta.get("error"):
        reply += f"\n（模型暂不可用，已用顾问兜底）"

    return {
        "reply": reply,
        "recommendations": pending[:5],
        "llm": "none",
        "error": meta.get("error"),
        "mode": "heuristic",
        "channel": channel,
        "intents": intents,
    }
