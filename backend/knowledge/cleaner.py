# -*- coding: utf-8 -*-
"""招聘数据清洗 —— 复用 crawler/parser.py，不重造轮子。

已知真实数据问题（Phase 00 审计）：
- job_requirement 大量为空（51job 把任职要求混在 job_description 中）
  → 必须 description + requirement 联合处理
- skills 数组仅 ~6.9% 非空
  → 技能抽取走多源：skills + keywords + job_labels + 词典
- publish_time 仅 19 条
  → 缺失置 NULL，不编造

输出：统一 JobDocument（供 chunker/ingestion 使用）。
"""
from __future__ import annotations

import re
from typing import Any

from crawler.parser import clean_list, sha256  # noqa: F401  # 复用判重/清洗
from crawler.parser import parse_experience, parse_salary, normalize_education

# 技能词典（基础抽取框架用，不逐条调 LLM）
_SKILL_LEXICON: tuple[str, ...] = (
    "Python", "Java", "Go", "C++", "C语言", "C#", "JavaScript", "TypeScript", "Vue", "React",
    "Node.js", "Spring Boot", "Spring Cloud", "MySQL", "PostgreSQL", "Redis", "MongoDB",
    "Kafka", "Elasticsearch", "Docker", "Kubernetes", "Linux", "Git", "CI/CD", "微服务",
    "分布式", "高并发", "机器学习", "深度学习", "PyTorch", "TensorFlow", "NLP", "LLM",
    "大模型", "RAG", "LangChain", "Agent", "向量数据库", "Prompt工程", "数据分析",
    "SQL", "Pandas", "Spark", "Hadoop", "Flink", "自动化测试", "Playwright", "性能测试",
    "Redis", "RabbitMQ", "Nginx", "HBase", "ClickHouse", "数据仓库", "ETL",
)

# 词典之外的黑名单（避免把噪声当技能）
_SKIP_TOKENS: tuple[str, ...] = ("职责", "要求", "优先", "本科", "硕士", "经验", "及以上", "熟悉")


def _strip_html(text: str | None) -> str:
    """去除 HTML 标签（zhilian 少量记录含标签）。"""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "\n", text)
    text = re.sub(r"&nbsp;?", " ", text)
    return text


def _norm_text(text: str | None) -> str:
    text = _strip_html(text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t\xa0]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_skills(record: dict[str, Any]) -> list[str]:
    """多源技能抽取：skills[] + keywords[] + job_labels[] + 描述词典扫描。"""
    source_values: list[str] = []
    for key in ("skills", "keywords", "job_labels"):
        vals = record.get(key) or []
        if isinstance(vals, (list, tuple)):
            source_values.extend(str(v) for v in vals if v)
        elif isinstance(vals, str):
            source_values.extend(v for v in vals.split(",") if v)
    skills = clean_list(source_values)

    # 词典扫描 description + requirement（基础框架，不做 LLM 逐条抽取）
    body = _norm_text(
        (record.get("job_description") or "") + "\n" + (record.get("job_requirement") or "")
    ).lower()
    for token in _SKILL_LEXICON:
        if token.lower() in body and token not in skills:
            if token.lower() in ("python", "java", "go", "c++", "c#", "sql") and re.search(
                rf"\b{re.escape(token.lower())}\b", body
            ):
                skills.append(token)
            elif not any(skip in token for skip in _SKIP_TOKENS):
                skills.append(token)
    return skills[:30]


def split_jd_sections(text: str | None) -> list[dict[str, str]]:
    """把 JD 文本按语义 section 切分。

    识别：岗位职责 / 任职要求 / 加分项 / 福利待遇 / 岗位亮点 / 公司简介 等。
    无明确标题时整段落入 overview，由 chunker 的 fallback 处理。
    """
    text = _norm_text(text)
    if not text:
        return []

    # 标题 → 规范 section 名（按长度倒序，优先匹配长标题）
    _HEADER_MAP: dict[str, str] = {
        "岗位职责": "duty", "工作职责": "duty", "职责描述": "duty", "工作内容": "duty",
        "岗位描述": "duty", "职位描述": "duty", "工作责任": "duty", "职责要求": "duty",
        "任职要求": "requirement", "岗位要求": "requirement", "任职资格": "requirement",
        "任职条件": "requirement", "职位要求": "requirement", "技能要求": "requirement",
        "能力要求": "requirement", "资格要求": "requirement", "我们希望你": "requirement",
        "加分项": "bonus", "加分条件": "bonus", "优先考虑": "bonus", "优先条件": "bonus",
        "有经验者优先": "bonus", "经验优先": "bonus",
        "福利待遇": "benefit", "薪酬福利": "benefit", "薪资福利": "benefit", "公司福利": "benefit",
        "岗位亮点": "highlight", "工作亮点": "highlight", "职位亮点": "highlight",
        "公司简介": "company", "关于我们": "company", "公司介绍": "company",
    }
    pattern = re.compile(
        "(" + "|".join(sorted(_HEADER_MAP, key=len, reverse=True)) + ")"
    )

    # 收集标题出现位置，切分文本
    matches = list(pattern.finditer(text))
    sections: list[dict[str, str]] = []
    cursor = 0
    current = "overview"
    for m in matches:
        prefix = text[cursor:m.start()].strip()
        if prefix:
            sections.append({"section": current, "text": prefix})
        current = _HEADER_MAP[m.group(1)]
        cursor = m.end()
    tail = text[cursor:].strip()
    if tail:
        sections.append({"section": current, "text": tail})
    elif sections:
        # 标题后无内容：丢弃空 section
        pass

    # 合并相邻同 section，过滤过短碎片
    merged: list[dict[str, str]] = []
    for sec in sections:
        t = sec["text"].strip()
        if not t:
            continue
        if len(t) < 6 and sec["section"] == "overview":
            continue
        if merged and merged[-1]["section"] == sec["section"]:
            merged[-1]["text"] = merged[-1]["text"] + "\n" + t
        else:
            merged.append({"section": sec["section"], "text": t})
    return merged


def clean_job(record: dict[str, Any]) -> dict[str, Any]:
    """单条 job（总表+细节表已 join 的 dict）→ 清洗后的 JobDocument。

    record 期望字段：id, job_title, company_name, city, district, salary_min,
    salary_max, experience, education, source_name, publish_time, crawl_time,
    job_description, job_requirement, job_highlights, skills, keywords,
    job_labels, company_industry, source_url, ...
    """
    description = _norm_text(record.get("job_description"))
    requirement = _norm_text(record.get("job_requirement"))

    # description + requirement 联合文本（requirement 为空时由 section 检测从 description 中拆出）
    joined = description
    if requirement:
        joined = f"{description}\n{requirement}" if description else requirement
    sections = split_jd_sections(joined)

    # 若 requirement 字段非空且 description 中未检出 requirement section，追加一段
    if requirement and not any(s["section"] == "requirement" for s in sections):
        sections.append({"section": "requirement", "text": requirement})

    skills = extract_skills(record)

    # 薪资/经验/学历结构化（复用 parser；DB 已有值则直接用，parser 仅兜底解析）
    salary = parse_salary(record.get("salary_description"))
    salary_min = record.get("salary_min")
    salary_max = record.get("salary_max")
    if salary_min is None:
        salary_min = salary.get("salary_min")
    if salary_max is None:
        salary_max = salary.get("salary_max")

    education = record.get("education") or normalize_education(record.get("education_required"))
    experience = record.get("experience")
    if not experience:
        exp_parsed = parse_experience(record.get("experience"))
        experience = exp_parsed.get("experience")

    title = record.get("job_title") or ""
    city = record.get("city") or ""
    source_name = record.get("source_name") or ""
    source_url = record.get("source_url") or ""
    company_name = record.get("company_name") or ""
    industry = record.get("company_industry") or ""

    # 文档正文：标题 + sections 文本 + 技能标签（保证向量内容完整可检索）
    section_text = "\n\n".join(f"[{s['section']}] {s['text']}" for s in sections)
    raw_text = f"{title}\n{company_name}\n{industry}\n{section_text}"
    if skills:
        raw_text += "\n[技能] " + "、".join(skills)
    raw_text = _norm_text(raw_text)

    return {
        "job_id": record.get("id"),
        "source_type": "recruitment",
        "source_name": source_name,
        "source_url": source_url,
        "title": title,
        "company_name": company_name,
        "city": city,
        "industry": industry,
        "published_at": record.get("publish_time"),
        "crawl_time": record.get("crawl_time"),
        "raw_text": raw_text,
        "text_hash": sha256(raw_text),
        "data_version": "1",
        "education": education,
        "experience": experience,
        "salary_min": salary_min,
        "salary_max": salary_max,
        "skills": skills,
        "sections": sections,
        "extra": {
            "company_size": record.get("company_size"),
            "company_nature": record.get("company_nature"),
            "job_type": record.get("job_type"),
            "job_category_l1": record.get("job_category_l1"),
        },
    }
