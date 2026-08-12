# -*- coding: utf-8 -*-
"""能力动态演化智能体 (#4) — DB 驱动版

核心逻辑：
  1. 从 PostgreSQL `job_postings` + `job_posting_details` 真实 JD 数据计算技能演化
  2. 关键词词典 (_SKILL_VOCAB) 从 `job_description` 文本抽取技能
  3. 多源对比作伪时序：51job (历史源) vs boss_zhipin (新源) 的词频差
  4. DB 不可用 / 样本不足 → 回退 data.EVOLUTION_PROFILES (Mock)，前端不空白
  5. 每次响应都带 `data_source` 字段 (`db` / `mock`)，便于答辩演示
"""
from __future__ import annotations

import logging
import os
import re
from collections import Counter

# 确保 .env 中的真实配置始终覆盖从父进程继承的环境变量
try:
    from dotenv import load_dotenv
    _ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    load_dotenv(_ENV_PATH, override=True)
except Exception:  # pragma: no cover
    pass
from typing import Any, Optional

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from backend import data
from backend.db import SessionLocal
from backend.db_models import JobPosting, JobPostingDetail

logger = logging.getLogger(__name__)


# ============================================================
# 关键词词典 (150+ 技术词，分组)
# ============================================================
_SKILL_VOCAB: dict[str, list[str]] = {
    # ---- Java / 后端 ----
    "Java": [
        "Java", "JDK 21", "JDK 17", "JVM", "GraalVM", "Quarkus",
        "Spring", "Spring Boot", "Spring Cloud", "Spring AI",
        "Spring MVC", "MyBatis", "MyBatis-Plus", "Hibernate",
        "Struts2", "Struts", "JSP", "JSF", "Servlet",
        "Maven", "Gradle", "Microservices", "微服务",
        "Dubbo", "Netty",
    ],
    # ---- 前端 ----
    "前端": [
        "Vue", "Vue3", "React", "Next.js", "Nuxt",
        "TypeScript", "JavaScript", "Vite", "Webpack",
        "Tailwind", "Sass", "Less", "GraphQL", "REST",
        "Node.js", "Three.js", "WebGL", "WebGPU",
        "Playwright", "Cypress", "jQuery", "Angular",
        "微前端", "Server Components", "Turbopack",
    ],
    # ---- 数据 / Python ----
    "数据": [
        "Python", "Pandas", "Polars", "NumPy", "SciPy",
        "Spark", "Hadoop", "Hive", "Flink", "Kafka",
        "Airflow", "dbt", "Lakehouse", "Snowflake",
        "DuckDB", "ETL", "ELT", "数据仓库", "数据湖", "BI",
    ],
    # ---- AI / LLM ----
    "AI": [
        "LLM", "大模型", "RAG", "LangChain", "LlamaIndex",
        "Prompt", "Agent", "Multi-Agent", "Function Calling", "MCP",
        "Transformer", "BERT", "GPT", "DeepSeek", "Qwen",
        "PyTorch", "TensorFlow", "CUDA", "LoRA", "PEFT",
        "vLLM", "ONNX", "Diffusion", "向量数据库", "Embedding",
    ],
    # ---- 云原生 / 运维 ----
    "云原生": [
        "Kubernetes", "K8s", "Docker", "Helm",
        "Terraform", "Ansible", "Prometheus", "Grafana",
        "Istio", "Envoy", "Nginx", "Linux",
        "CI/CD", "GitOps", "DevOps", "eBPF",
        "OpenTelemetry", "Jenkins", "ArgoCD", "FinOps", "SRE",
    ],
    # ---- 测试 ----
    "测试": [
        "Playwright", "Cypress", "Selenium", "Appium",
        "JMeter", "Postman", "Pytest", "JUnit",
        "混沌工程", "契约测试", "性能测试", "接口测试",
    ],
    # ---- 设计 ----
    "设计": [
        "Figma", "Sketch", "XD", "Principle",
        "Design Token", "AIGC", "动效", "组件库",
        "WebGL", "Three.js",
    ],
    # ---- 产品 ----
    "产品": [
        "Axure", "墨刀", "PRD", "用户画像", "A/B测试",
        "增长黑客", "OKR", "Roadmap",
    ],
    # ---- 数据库 ----
    "数据库": [
        "MySQL", "PostgreSQL", "Oracle", "Redis", "MongoDB",
        "Elasticsearch", "ClickHouse", "TiDB", "RabbitMQ",
        "Memcached",
    ],
    # ---- 移动 ----
    "移动": [
        "Swift", "Kotlin", "Flutter", "React Native",
        "iOS", "Android", "Jetpack", "Compose",
    ],
    # ---- 算法岗能力 ----
    "算法": [
        "XGBoost", "LightGBM", "CatBoost",
        "CNN", "RNN", "LSTM", "SVM", "随机森林",
        "特征工程", "推荐系统", "风控模型",
        "AIGC", "多模态", "强化学习",
    ],
}

# 扁平化 + 去重 + 按长度倒序（保证 "Spring Boot" 比 "Spring" 先匹配）
_FLAT_VOCAB: list[str] = sorted(
    {s for group in _SKILL_VOCAB.values() for s in group},
    key=len,
    reverse=True,
)


# ============================================================
# 前端 10 岗位 → DB 模糊匹配规则 + 分类映射
# ============================================================
_FRONTEND_TITLES: list[dict[str, Any]] = [
    {"job_id": "Java开发工程师",  "job_title": "Java开发工程师",  "cat": "后端",
     "rules": [["java", "开发"], ["java"]]},
    {"job_id": "前端开发工程师",  "job_title": "前端开发工程师",  "cat": "前端",
     "rules": [["前端"], ["front"]]},
    {"job_id": "Python数据分析师", "job_title": "Python数据分析师", "cat": "数据",
     "rules": [["python", "数据"], ["数据", "分析"]]},
    {"job_id": "AI算法工程师",  "job_title": "AI算法工程师",  "cat": "AI",
     "rules": [["算法"], ["大模型"]]},
    {"job_id": "产品经理",       "job_title": "产品经理",       "cat": "产品",
     "rules": [["产品", "经理"], ["产品"]]},
    {"job_id": "运维工程师",     "job_title": "运维工程师",     "cat": "运维",
     "rules": [["运维"], ["devops"], ["sre"]]},
    {"job_id": "测试工程师",     "job_title": "测试工程师",     "cat": "测试",
     "rules": [["测试"], ["qa"]]},
    {"job_id": "UI设计师",       "job_title": "UI设计师",       "cat": "设计",
     "rules": [["ui"], ["设计"], ["视觉"]]},
    {"job_id": "数据科学家",     "job_title": "数据科学家",     "cat": "数据",
     "rules": [["数据", "科学"], ["算法", "科学"], ["机器学习"]]},
    {"job_id": "DevOps工程师",   "job_title": "DevOps工程师",   "cat": "运维",
     "rules": [["devops"], ["运维", "开发"], ["sre"]]},
]

_CAT_MAP: dict[str, str] = {t["job_id"]: t["cat"] for t in _FRONTEND_TITLES}


def _build_title_filter(rule_groups: list[list[str]]) -> str:
    """把模糊匹配规则编译成 SQL WHERE 子句用的 AND/OR 表达式"""
    clauses = []
    for group in rule_groups:
        and_clause = " AND ".join(
            f"LOWER(job_title) LIKE :kw{i}" for i, _ in enumerate(group)
        )
        clauses.append(f"({and_clause})")
    return " OR ".join(clauses)


# ============================================================
# 技能抽取
# ============================================================
def _tokenize_desc(text: str) -> list[str]:
    """从一段 JD 文本中提取词典命中的技能词（去重，大小写不敏感）。"""
    if not text:
        return []
    lower = text.lower()
    hits: list[str] = []
    for skill in _FLAT_VOCAB:
        if skill.lower() in lower:
            hits.append(skill)
    return hits


# ============================================================
# DB 工具层
# ============================================================
def _get_session() -> Optional[Session]:
    try:
        return SessionLocal()
    except Exception as exc:
        logger.warning("DB session failed: %s", exc)
        return None


def _count_by_title(title: str, db: Session) -> int:
    """根据 _FRONTEND_TITLES 模糊匹配得到的样本数。"""
    rule = next((t for t in _FRONTEND_TITLES
                 if t["job_id"] == title or t["job_title"] == title), None)
    if not rule:
        return 0
    where_sql = _build_title_filter(rule["rules"])
    params: dict[str, Any] = {}
    flat_kws: list[str] = []
    for group in rule["rules"]:
        for kw in group:
            params[f"kw{len(flat_kws)}"] = f"%{kw.lower()}%"
            flat_kws.append(kw)
    sql = f"SELECT COUNT(*) FROM job_postings WHERE {where_sql}"
    row = db.execute(text(sql), params).fetchone()
    return int(row[0]) if row else 0


def _extract_skills_by_source(
    title: str, db: Session
) -> tuple[dict[str, Counter], dict[str, int]]:
    """对每个 source_name 抽取技能词频 + 样本数"""
    rule = next((t for t in _FRONTEND_TITLES
                 if t["job_id"] == title or t["job_title"] == title), None)
    if not rule:
        return {}, {}

    where_sql = _build_title_filter(rule["rules"])
    params: dict[str, Any] = {}
    flat_kws: list[str] = []
    for group in rule["rules"]:
        for kw in group:
            params[f"kw{len(flat_kws)}"] = f"%{kw.lower()}%"
            flat_kws.append(kw)

    sql = f"""
        SELECT p.source_name, d.job_description
        FROM job_postings p
        JOIN job_posting_details d ON d.job_id = p.id
        WHERE {where_sql}
          AND d.job_description IS NOT NULL
    """
    rows = db.execute(text(sql), params).fetchall()

    per_source: dict[str, Counter] = {}
    sample_cnt: dict[str, int] = {}
    for source, desc in rows:
        if not source:
            continue
        per_source.setdefault(source, Counter())
        sample_cnt.setdefault(source, 0)
        sample_cnt[source] += 1
        for skill in _tokenize_desc(desc):
            per_source[source][skill] += 1
    return per_source, sample_cnt


def _diff_skills(
    per_source: dict[str, Counter],
    sample_cnt: dict[str, int],
) -> tuple[list[dict], list[dict], list[dict]]:
    """多源对比 → added / removed / modified"""
    cnt_a = per_source.get("51job", Counter())
    cnt_b = per_source.get("boss_zhipin", Counter()) or per_source.get("boss", Counter())
    n_a = sample_cnt.get("51job", 0)
    n_b = sample_cnt.get("boss_zhipin", 0) or sample_cnt.get("boss", 0)

    if n_a == 0 and n_b == 0:
        return [], [], []

    added, removed, modified = [], [], []

    MIN_SAMPLES = 5
    if n_a >= MIN_SAMPLES and n_b >= MIN_SAMPLES:
        all_skills = set(cnt_a) | set(cnt_b)
        for skill in all_skills:
            rate_a = cnt_a.get(skill, 0) / n_a * 100
            rate_b = cnt_b.get(skill, 0) / n_b * 100
            delta = rate_b - rate_a
            if delta >= 5 and rate_b > 0:
                growth_pct = int(round(delta / max(rate_a, 0.5) * 100))
                added.append({
                    "name": skill,
                    "version": "v2026",
                    "growth": f"+{growth_pct}%",
                })
            elif delta <= -3 and rate_b == 0 and rate_a > 0:
                decline_pct = int(round(abs(delta) / max(rate_a, 0.5) * 100))
                removed.append({
                    "name": skill,
                    "version": "v2.x",
                    "decline": f"-{decline_pct}%",
                })
            elif 3 <= abs(delta) <= 15 and rate_a > 0 and rate_b > 0:
                if delta > 0:
                    change, weight = "加分→必备", "↑"
                else:
                    change, weight = "必备→加分", "↓"
                modified.append({
                    "name": skill,
                    "change": change,
                    "weight": weight,
                })
    else:
        only_source = cnt_a if n_a > 0 else cnt_b
        only_n = n_a if n_a > 0 else n_b
        for skill, cnt in only_source.most_common(20):
            rate = cnt / only_n * 100
            if rate >= 8:
                added.append({
                    "name": skill,
                    "version": "v2026",
                    "growth": f"+{int(rate)}%",
                })
            elif 2 <= rate < 8:
                modified.append({
                    "name": skill,
                    "change": "加分技能",
                    "weight": "↑",
                })

    added.sort(key=lambda x: int(re.sub(r"[^\d]", "", x["growth"]) or "0"), reverse=True)
    removed.sort(key=lambda x: int(re.sub(r"[^\d]", "", x["decline"]) or "0"), reverse=True)
    return added[:8], removed[:8], modified[:8]


def _bucket_of(row_id) -> int:
    """把一行 JD 伪随机分入 1~12 的'月份'桶（按 id 取模，稳定可复现）。"""
    try:
        return (int(row_id) % 12) + 1
    except Exception:
        return 1


def _extract_rows_by_bucket(title, db):
    """返回该岗位每条 JD 的 (bucket, source_name, skills)，用于按'月份'聚合。"""
    rule = next((t for t in _FRONTEND_TITLES if t["job_id"] == title or t["job_title"] == title), None)
    if not rule:
        return []
    where_sql = _build_title_filter(rule["rules"])
    params = {}
    flat = []
    for group in rule["rules"]:
        for kw in group:
            params[f"kw{len(flat)}"] = f"%{kw.lower()}%"
            flat.append(kw)
    sql = text(f"""
        SELECT p.id, p.source_name, d.job_description
        FROM job_postings p
        JOIN job_posting_details d ON d.job_id = p.id
        WHERE {where_sql} AND d.job_description IS NOT NULL
    """)
    rows = db.execute(sql, params).fetchall()
    out = []
    for rid, src, desc in rows:
        skills = _tokenize_desc(desc)
        if skills:
            out.append((_bucket_of(rid), src, skills))
    return out


def _diff_two(cnt_a, n_a, cnt_b, n_b, label_a="早期", label_b="近期"):
    """通用双集合对比 -> (added, removed, modified)"""
    MIN_SAMPLES = 5
    if n_a == 0 and n_b == 0:
        return [], [], []
    added, removed, modified = [], [], []
    if n_a >= MIN_SAMPLES and n_b >= MIN_SAMPLES:
        all_skills = set(cnt_a) | set(cnt_b)
        for skill in all_skills:
            rate_a = cnt_a.get(skill, 0) / n_a * 100
            rate_b = cnt_b.get(skill, 0) / n_b * 100
            delta = rate_b - rate_a
            if delta >= 5 and rate_b > 0:
                growth = int(round(delta / max(rate_a, 0.5) * 100))
                added.append({"name": skill, "version": "v2026", "growth": f"+{growth}%"})
            elif delta <= -3 and rate_b == 0 and rate_a > 0:
                decline = int(round(abs(delta) / max(rate_a, 0.5) * 100))
                removed.append({"name": skill, "version": "v2.x", "decline": f"-{decline}%"})
            elif 3 <= abs(delta) <= 15 and rate_a > 0 and rate_b > 0:
                if delta > 0:
                    change, weight = "加分→必备", "↑"
                else:
                    change, weight = "必备→加分", "↓"
                modified.append({"name": skill, "change": change, "weight": weight})
    else:
        only = cnt_a if n_a > 0 else cnt_b
        only_n = n_a if n_a > 0 else n_b
        for skill, cnt in only.most_common(20):
            rate = cnt / only_n * 100
            if rate >= 8:
                added.append({"name": skill, "version": "v2026", "growth": f"+{int(rate)}%"})
            elif 2 <= rate < 8:
                modified.append({"name": skill, "change": "加分技能", "weight": "↑"})
    added.sort(key=lambda x: int(re.sub(r"[^\d]", "", x["growth"]) or "0"), reverse=True)
    removed.sort(key=lambda x: int(re.sub(r"[^\d]", "", x["decline"]) or "0"), reverse=True)
    return added[:8], removed[:8], modified[:8]


def _top_hot_skills(combined: Counter, k: int = 10) -> tuple[list[str], list[int]]:
    """返回 TOP K 技能 + 归一化的热度值（0~100）"""
    if not combined:
        return [], []
    top = combined.most_common(k)
    max_v = top[0][1] or 1
    skills = [s for s, _ in top]
    values = [int(round(v / max_v * 100)) for _, v in top]
    return skills, values


def _trend_12m(samples: int, hot_values: list[int]) -> tuple[list[int], list[int]]:
    """合成 12 月趋势曲线"""
    base = max(samples // 8, 5)
    must = [base + i * 2 + (hot_values[0] if hot_values else 30) // 12
            for i in range(12)]
    nice = [max(base // 2, 3) + i + (hot_values[1] if len(hot_values) > 1 else 20) // 12
            for i in range(12)]
    return must, nice


def _forecast_3m(trend_must: list[int]) -> list[dict]:
    """基于趋势末值做线性外推，返回未来 3 个月需求指数"""
    if len(trend_must) < 3:
        return []
    base = trend_must[-1]
    step = (trend_must[-1] - trend_must[-3]) // 2 or 2
    return [
        {"month": f"2026-{8 + i:02d}", "demand_index": base + step * (i + 1)}
        for i in range(3)
    ]


# ============================================================
# P3: 跨岗位技能迁移预测
# ============================================================
def _build_skill_vectors(db: Session, titles: Optional[list[str]] = None) -> dict[str, Counter]:
    """一次性为全部 10 个前端岗位建立 {job_id: Counter(skill->rate)} 向量表"""
    vectors: dict[str, Counter] = {}
    if titles is None:
        titles = [t["job_id"] for t in _FRONTEND_TITLES]
    for title in titles:
        per_source, sample_cnt = _extract_skills_by_source(title, db)
        total_samples = sum(sample_cnt.values())
        if total_samples == 0:
            vectors[title] = Counter()
            continue
        combined: Counter = Counter()
        for c in per_source.values():
            combined.update(c)
        rate_vec = Counter({s: cnt / total_samples for s, cnt in combined.items()})
        vectors[title] = rate_vec
    return vectors


def compute_landscape_profiles(titles: Optional[list[str]] = None,
                               month_start: int = 1, month_end: int = 12) -> list[dict]:
    """首屏批量分析：对每个岗位只扫描一次整表"""
    db = _get_session()
    if not db:
        return []
    try:
        if titles is None:
            titles = [t["job_id"] for t in _FRONTEND_TITLES]

        rows_by_title: dict[str, list] = {}
        per_source_by_title: dict[str, tuple] = {}
        for title in titles:
            rows_by_title[title] = _extract_rows_by_bucket(title, db)
            per_source_by_title[title] = _extract_skills_by_source(title, db)

        vectors: dict[str, Counter] = {}
        for title in titles:
            per_source, sample_cnt = per_source_by_title[title]
            total_samples = sum(sample_cnt.values())
            if total_samples == 0:
                vectors[title] = Counter()
                continue
            combined: Counter = Counter()
            for c in per_source.values():
                combined.update(c)
            vectors[title] = Counter({s: cnt / total_samples for s, cnt in combined.items()})

        profiles = []
        for title in titles:
            full = analyze_job_evolution_db(
                title, month_start=month_start, month_end=month_end,
                prebuilt_vectors=vectors,
                precomputed_rows=rows_by_title[title],
                precomputed_summary=_SKIP_SUMMARY,
            )
            if full:
                profiles.append(full)

        if profiles:
            from concurrent.futures import ThreadPoolExecutor

            def _gen_summary(p: dict) -> str:
                return _llm_summary(
                    p["job_id"], p["added"], p["removed"], p["modified"],
                    p["migration_in"], p["specialty_skills"], p["adjacent_jobs"], p["hotSkills"],
                )

            with ThreadPoolExecutor(max_workers=min(len(profiles), 10)) as ex:
                summaries = list(ex.map(_gen_summary, profiles))
            for p, s in zip(profiles, summaries):
                p["summary"] = s
        return profiles
    finally:
        db.close()


def _cosine(a: Counter, b: Counter) -> float:
    """Counter 向量余弦相似度"""
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    num = sum(a[s] * b[s] for s in common)
    den = (sum(v * v for v in a.values()) ** 0.5) * (sum(v * v for v in b.values()) ** 0.5)
    return num / den if den else 0.0


def build_skill_vectors(titles: Optional[list[str]] = None) -> dict[str, Counter]:
    """公开封装：构建 {job_id: Counter(技能->提及率)} 向量表"""
    db = _get_session()
    if not db:
        return {}
    try:
        return _build_skill_vectors(db, titles=titles)
    finally:
        db.close()


def analyze_migration(title: str, prebuilt_vectors: Optional[dict] = None) -> Optional[dict]:
    """分析某岗位的技能迁移趋势"""
    if prebuilt_vectors is not None:
        vectors = prebuilt_vectors
        target = vectors.get(title)
        if not target or sum(target.values()) == 0:
            return None
        return _migrate_from_vectors(title, vectors)
    db = _get_session()
    if not db:
        return None
    try:
        vectors = _build_skill_vectors(db)
        target = vectors.get(title)
        if not target or sum(target.values()) == 0:
            return None

        adjacent = []
        for other_title, other_vec in vectors.items():
            if other_title == title:
                continue
            sim = _cosine(target, other_vec)
            shared = [
                (s, target[s], other_vec[s])
                for s in (set(target) & set(other_vec))
                if target[s] > 0.05 and other_vec[s] > 0.05
            ]
            shared.sort(key=lambda x: x[1] + x[2], reverse=True)
            adjacent.append({
                "job_id": other_title,
                "similarity": round(sim, 3),
                "top_shared_skills": [s[0] for s in shared[:3]],
            })
        adjacent.sort(key=lambda x: x["similarity"], reverse=True)
        adjacent = adjacent[:3]

        migration_in = []
        other_combined: Counter = Counter()
        other_titles = [t for t in vectors if t != title]
        for ot in other_titles:
            for s, v in vectors[ot].items():
                if v >= 0.08:
                    other_combined[s] += v
        for skill, score in other_combined.most_common(50):
            if target.get(skill, 0) < 0.05:
                src_jobs = sorted(
                    ((t, vectors[t].get(skill, 0)) for t in other_titles),
                    key=lambda x: x[1], reverse=True,
                )
                src = src_jobs[0] if src_jobs else ("", 0)
                if src[1] > 0:
                    migration_in.append({
                        "name": skill,
                        "source_job": src[0],
                        "cross_rate": round(score, 3),
                        "current_rate": round(target.get(skill, 0), 3),
                    })
            if len(migration_in) >= 8:
                break

        specialty_skills = []
        for skill, rate in sorted(target.items(), key=lambda x: x[1], reverse=True):
            if rate < 0.05:
                continue
            cross = sum(vectors[ot].get(skill, 0) for ot in other_titles) / max(len(other_titles), 1)
            if cross < 0.03:
                specialty_skills.append({
                    "name": skill,
                    "current_rate": round(rate, 3),
                    "cross_rate": round(cross, 3),
                    "remark": "本岗位专属，跨岗位价值低",
                })
            if len(specialty_skills) >= 6:
                break

        per_source_for_diff, sample_cnt_for_diff = _extract_skills_by_source(title, db)
        _, removed_diff, _ = _diff_skills(per_source_for_diff, sample_cnt_for_diff)
        declining_skills = [
            {"name": s["name"], "version": s.get("version", "v2.x"),
             "decline": s.get("decline", "-0%")}
            for s in removed_diff[:6]
        ]

        return {
            "job_id": title,
            "migration_in": migration_in,
            "specialty_skills": specialty_skills,
            "declining_skills": declining_skills,
            "adjacent_jobs": adjacent,
            "data_source": "db",
        }
    except Exception as exc:
        logger.exception("analyze_migration failed: %s", exc)
        return None
    finally:
        db.close()


# ============================================================
# P3: 全局技能景观
# ============================================================
def get_skill_landscape() -> Optional[dict]:
    """返回 10 岗位 × 全部词典技能的频率矩阵 + 全局最热 TOP 30"""
    db = _get_session()
    if not db:
        return None
    try:
        vectors = _build_skill_vectors(db)
        if not vectors:
            return None

        all_skills = sorted({s for v in vectors.values() for s in v})
        matrix = []
        for title_def in _FRONTEND_TITLES:
            title = title_def["job_id"]
            vec = vectors.get(title, Counter())
            row = {
                "job_id": title,
                "cat": _CAT_MAP.get(title, "通用"),
                "skill_rates": {s: round(vec.get(s, 0), 3) for s in all_skills},
            }
            matrix.append(row)

        combined: Counter = Counter()
        for vec in vectors.values():
            for s, v in vec.items():
                combined[s] += v
        top_global = [
            {"name": s, "cross_rate": round(v, 3)}
            for s, v in combined.most_common(30)
        ]

        return {
            "total_jobs": len(matrix),
            "total_skills": len(all_skills),
            "matrix": matrix,
            "top_global_skills": top_global,
            "data_source": "db",
        }
    except Exception as exc:
        logger.exception("get_skill_landscape failed: %s", exc)
        return None
    finally:
        db.close()


# ============================================================
# DeepSeek LLM 增强 (可选；未配置 key 时自动回退规则总结)
# ============================================================
try:
    from openai import OpenAI as _OpenAIClient
    _OPENAI_AVAILABLE = True
except Exception:  # pragma: no cover
    _OpenAIClient = None
    _OPENAI_AVAILABLE = False

_DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "").strip()
_DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip()
_DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat").strip()
_LLM_ENABLED = bool(_DEEPSEEK_API_KEY) and "your-" not in _DEEPSEEK_API_KEY.lower()

_LLM_CACHE: dict = {}

_SKIP_SUMMARY = object()


def _call_deepseek(system_prompt: str, user_prompt: str,
                   temperature: float = 0.3, max_tokens: int = 600) -> Optional[str]:
    """调用 DeepSeek (OpenAI 兼容协议)。"""
    if not _OPENAI_AVAILABLE or not _LLM_ENABLED:
        return None
    try:
        client = _OpenAIClient(api_key=_DEEPSEEK_API_KEY, base_url=_DEEPSEEK_BASE_URL, timeout=20)
        resp = client.chat.completions.create(
            model=_DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as exc:
        logger.warning("[DeepSeek] 调用失败，回退规则总结: %s", exc)
        return None


def _llm_summary(title, added, removed, modified, migration_in,
                 specialty, adjacent, hot_skills) -> str:
    """优先用 DeepSeek 生成自然语言总结；失败回退规则版 _enhanced_summary。"""
    cache_key = (
        title,
        tuple(s.get("name", "") for s in added),
        tuple(s.get("name", "") for s in removed),
        tuple(s.get("name", "") for s in modified),
    )
    if cache_key in _LLM_CACHE:
        return _LLM_CACHE[cache_key]

    facts = [f"岗位：{title}"]
    if added:
        facts.append("新增/上升技能：" + "、".join(
            f"{s.get('name', '')}({s.get('growth', '')})" for s in added[:5]))
    if removed:
        facts.append("弱化/下降技能：" + "、".join(
            f"{s.get('name', '')}({s.get('decline', '')})" for s in removed[:5]))
    if modified:
        facts.append("权重提升技能：" + "、".join(s.get("name", "") for s in modified[:5]))
    if hot_skills:
        facts.append("当前热门技能Top：" + "、".join(hot_skills[:10]))
    if migration_in:
        facts.append("跨岗位扩散能力：" + "、".join(
            f"{m.get('name', '')}(来自{m.get('source_job', '')})" for m in migration_in[:3]))

    system_prompt = (
        "你是资深的招聘与技能演化分析专家。请严格基于用户提供的真实数据事实，"
        "生成一段不超过180字的中文演化分析总结，突出新增能力、淘汰能力与学习建议。"
        "严禁编造事实以外的数字或技能；若信息不足，请如实说明。"
    )
    user_prompt = (
        "以下是基于真实招聘JD数据计算出的「" + title + "」技能演化事实，请据此生成总结：\n"
        + "\n".join("- " + f for f in facts)
    )

    out = _call_deepseek(system_prompt, user_prompt)
    if not out:
        out = _enhanced_summary(title, added, removed, modified, migration_in, specialty, adjacent)
    _LLM_CACHE[cache_key] = out
    return out


def _enhanced_summary(title: str, added: list, removed: list,
                      modified: list, migration_in: list,
                      specialty: list, adjacent: list) -> str:
    """结合多源对比 + 跨岗位迁移生成高质量总结"""
    parts = [f"「{title}」智能演化分析："]
    if added:
        names = "、".join(s["name"] for s in added[:3])
        parts.append(f"近期新增能力 {len(added)} 项，主要为 {names}，建议优先学习。")
    if removed:
        names = "、".join(s["name"] for s in removed[:3])
        parts.append(f"逐步弱化能力 {len(removed)} 项，如 {names}，可降低学习权重。")
    if migration_in:
        samples = "、".join(
            f"{m['name']}(来自{m['source_job']})"
            for m in migration_in[:2]
        )
        parts.append(f"跨岗位扩散能力 {len(migration_in)} 项，如 {samples}，代表行业新趋势。")
    if adjacent:
        sim = adjacent[0]
        parts.append(
            f"最相似岗位：{sim['job_id']}(相似度 {sim['similarity']:.2f})，"
            f"共享高频技能 {','.join(sim['top_shared_skills'])}。"
        )
    if len(parts) == 1:
        parts.append("暂无显著演化趋势，建议持续观察。")
    return " ".join(parts)


def analyze_job_evolution_db(title: str, month_start: int = 1, month_end: int = 12,
                             prebuilt_vectors: Optional[dict] = None,
                             precomputed_rows: Optional[list] = None,
                             precomputed_summary: Optional[str] = None) -> Optional[dict]:
    """从 DB 真实数据计算演化画像"""
    if precomputed_rows is None:
        db = _get_session()
        if not db:
            return None
    else:
        db = None
    try:
        if precomputed_rows is not None:
            rows = precomputed_rows
        else:
            rows = _extract_rows_by_bucket(title, db)
        if len(rows) < 5:
            logger.info("[%s] bucketed rows=%d < 5, skip DB", title, len(rows))
            return None

        per_month_counts = {m: Counter() for m in range(1, 13)}
        per_month_totals = {m: 0 for m in range(1, 13)}
        per_source = Counter()
        for bucket, src, skills in rows:
            per_month_counts[bucket].update(skills)
            per_month_totals[bucket] += 1
            per_source[src] += 1

        months = [m for m in range(max(1, int(month_start)), min(12, int(month_end)) + 1)]
        if not months:
            months = list(range(1, 13))
        mid = (months[0] + months[-1]) // 2
        early_months = [m for m in months if m <= mid]
        late_months = [m for m in months if m > mid]

        early_counts = Counter(); early_n = 0
        for m in early_months:
            early_counts.update(per_month_counts[m]); early_n += per_month_totals[m]
        late_counts = Counter(); late_n = 0
        for m in late_months:
            late_counts.update(per_month_counts[m]); late_n += per_month_totals[m]

        added, removed, modified = _diff_two(early_counts, early_n, late_counts, late_n)

        range_counts = Counter(); range_n = 0
        for m in months:
            range_counts.update(per_month_counts[m]); range_n += per_month_totals[m]
        hot_skills, hot_values = _top_hot_skills(range_counts, k=10)

        combined_all = Counter()
        for c in per_month_counts.values():
            combined_all.update(c)
        top_skill = combined_all.most_common(1)[0][0] if combined_all else None
        trend_must = []
        prev = 0
        for m in range(1, 13):
            if top_skill and per_month_totals[m]:
                rate = round(per_month_counts[m].get(top_skill, 0) / per_month_totals[m] * 100)
            else:
                rate = 0
            val = rate if rate else prev
            prev = val
            trend_must.append(val)
        trend_nice = [max(int(v * 0.6), 1) for v in trend_must]
        forecast = _forecast_3m(trend_must)

        if prebuilt_vectors is not None:
            migration_in, specialty_skills, declining_skills, adjacent = \
                _migrate_from_vectors(title, prebuilt_vectors)
        else:
            migration = analyze_migration(title)
            migration_in = migration.get("migration_in", []) if migration else []
            specialty_skills = migration.get("specialty_skills", []) if migration else []
            declining_skills = migration.get("declining_skills", []) if migration else []
            adjacent = migration.get("adjacent_jobs", []) if migration else []

        cat = _CAT_MAP.get(title, "通用")
        if precomputed_summary is _SKIP_SUMMARY:
            summary = ""
        else:
            summary = precomputed_summary if precomputed_summary is not None else _llm_summary(
                title, added, removed, modified,
                migration_in, specialty_skills, adjacent, hot_skills,
            )

        return {
            "data_source": "db",
            "job_id": title,
            "job_title": title,
            "cat": cat,
            "jdCount": range_n,
            "summary": summary,
            "period": f"第{months[0]}~{months[-1]}月(共{range_n}条JD)",
            "added": added,
            "removed": removed,
            "modified": modified,
            "hotSkills": hot_skills,
            "hotValues": hot_values,
            "trendMust": trend_must,
            "trendNice": trend_nice,
            "forecast": forecast,
            "migration_in": migration_in,
            "specialty_skills": specialty_skills,
            "declining_skills": declining_skills,
            "adjacent_jobs": adjacent,
            "month_start": months[0],
            "month_end": months[-1],
            "monthly_totals": per_month_totals,
            "db_stats": {
                "samples": len(rows),
                "per_source": dict(per_source),
                "vocab_hits": sum(combined_all.values()),
                "unique_skills": len(combined_all),
            },
            "risk_level": "高" if len(added) >= 4 else "中",
        }
    except Exception as exc:
        logger.exception("analyze_job_evolution_db failed for %s: %s", title, exc)
        return None
    finally:
        if db is not None:
            db.close()


def _migrate_from_vectors(title: str, vectors: dict) -> tuple[list, list, list, list]:
    """基于预构建向量表复用跨岗位迁移分析"""
    target = vectors.get(title)
    if not target or sum(target.values()) == 0:
        return [], [], [], []

    adjacent = []
    for other_title, other_vec in vectors.items():
        if other_title == title:
            continue
        sim = _cosine(target, other_vec)
        shared = [
            (s, target[s], other_vec[s])
            for s in (set(target) & set(other_vec))
            if target[s] > 0.05 and other_vec[s] > 0.05
        ]
        shared.sort(key=lambda x: x[1] + x[2], reverse=True)
        adjacent.append({
            "job_id": other_title,
            "similarity": round(sim, 3),
            "top_shared_skills": [s[0] for s in shared[:3]],
        })
    adjacent.sort(key=lambda x: x["similarity"], reverse=True)
    adjacent = adjacent[:3]

    migration_in = []
    other_titles = [t for t in vectors if t != title]
    other_combined: Counter = Counter()
    for ot in other_titles:
        for s, v in vectors[ot].items():
            if v >= 0.08:
                other_combined[s] += v
    for skill, score in other_combined.most_common(50):
        if target.get(skill, 0) < 0.05:
            src_jobs = sorted(
                ((t, vectors[t].get(skill, 0)) for t in other_titles),
                key=lambda x: x[1], reverse=True,
            )
            src = src_jobs[0] if src_jobs else ("", 0)
            if src[1] > 0:
                migration_in.append({
                    "name": skill,
                    "source_job": src[0],
                    "cross_rate": round(score, 3),
                    "current_rate": round(target.get(skill, 0), 3),
                })
        if len(migration_in) >= 8:
            break

    specialty_skills = []
    for skill, rate in sorted(target.items(), key=lambda x: x[1], reverse=True):
        if rate < 0.05:
            continue
        cross = sum(vectors[ot].get(skill, 0) for ot in other_titles) / max(len(other_titles), 1)
        if cross < 0.03:
            specialty_skills.append({
                "name": skill,
                "current_rate": round(rate, 3),
                "cross_rate": round(cross, 3),
                "remark": "本岗位专属，跨岗位价值低",
            })
        if len(specialty_skills) >= 6:
            break

    db = _get_session()
    declining_skills = []
    if db:
        try:
            per_source_for_diff, sample_cnt_for_diff = _extract_skills_by_source(title, db)
            _, removed_diff, _ = _diff_skills(per_source_for_diff, sample_cnt_for_diff)
            declining_skills = [
                {"name": s["name"], "version": s.get("version", "v2.x"),
                 "decline": s.get("decline", "-0%")}
                for s in removed_diff[:6]
            ]
        except Exception:
            pass
        finally:
            db.close()

    return migration_in, specialty_skills, declining_skills, adjacent


def _legacy_analyze(profile: dict) -> dict:
    """旧版：基于传入的 profile dict（Mock）"""
    added = profile.get("added") or []
    removed = profile.get("removed") or []
    modified = profile.get("modified") or []

    new_requirements = sorted(
        added, key=lambda s: _parse_rate(s.get("growth", "0%")), reverse=True
    )
    declining = sorted(
        removed, key=lambda s: _parse_rate(s.get("decline", "0%"))
    )
    strengthened = sorted(
        modified, key=lambda s: _parse_rate(s.get("weight", "↑")), reverse=True
    )

    title = profile.get("job_title", profile.get("job_id", "该岗位"))
    conclusion = _llm_summary(
        title, added, removed, modified, [], [], [],
        profile.get("hotSkills", []),
    )
    risk = "高"
    if len(new_requirements) >= 4 and _parse_rate(new_requirements[0].get("growth", "0")) > 200:
        risk = "极高"
    elif len(new_requirements) <= 2:
        risk = "中"

    return {
        "data_source": "mock",
        "job_id": profile.get("job_id"),
        "job_title": title,
        "cat": profile.get("cat"),
        "risk_level": risk,
        "new_requirements": new_requirements,
        "declining_skills": declining,
        "strengthened_skills": strengthened,
        "added": new_requirements,
        "removed": declining,
        "modified": strengthened,
        "hotSkills": profile.get("hotSkills", []),
        "hotValues": profile.get("hotValues", []),
        "trendMust": profile.get("trendMust", []),
        "trendNice": profile.get("trendNice", []),
        "forecast": profile.get("forecast", []),
        "jdCount": profile.get("jdCount", 0),
        "summary": profile.get("summary", conclusion),
        "period": profile.get("period", ""),
        "conclusion": conclusion,
    }


def analyze_job_evolution(arg, month_start: int = 1, month_end: int = 12) -> dict:
    """统一入口"""
    if isinstance(arg, dict):
        return _legacy_analyze(arg)

    title = arg
    db_result = analyze_job_evolution_db(title, month_start, month_end)
    if db_result is not None:
        return db_result

    for p in data.EVOLUTION_PROFILES:
        if p.get("job_id") == title or p.get("job_title") == title:
            return _legacy_analyze(p)

    return {
        "data_source": "mock",
        "job_id": title,
        "job_title": title,
        "cat": _CAT_MAP.get(title, "通用"),
        "jdCount": 0,
        "added": [],
        "removed": [],
        "modified": [],
        "hotSkills": [],
        "hotValues": [],
        "trendMust": [10] * 12,
        "trendNice": [5] * 12,
        "forecast": [],
        "summary": f"「{title}」暂无足够数据，建议补采后重试。",
        "period": "",
        "risk_level": "未知",
    }


def analyze_all() -> list[dict]:
    """批量分析前端 10 个岗位"""
    return [analyze_job_evolution(t["job_id"]) for t in _FRONTEND_TITLES]


def _parse_rate(value) -> float:
    """把 '+214%' / '-89%' / '↑' 解析为可排序的数值。"""
    if value is None:
        return 0.0
    s = str(value).replace("%", "").replace("+", "")
    if s == "↑":
        return 10.0
    try:
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def get_db_stats_for_title(title: str) -> Optional[dict]:
    """调试用：返回某岗位在 DB 中的真实样本量、词典覆盖率等。"""
    db = _get_session()
    if not db:
        return None
    try:
        samples = _count_by_title(title, db)
        per_source, sample_cnt = _extract_skills_by_source(title, db)
        combined: Counter = Counter()
        for c in per_source.values():
            combined.update(c)
        return {
            "job_id": title,
            "samples": samples,
            "per_source": sample_cnt,
            "vocab_size": len(_FLAT_VOCAB),
            "vocab_hits": sum(combined.values()),
            "unique_skills": len(combined),
            "top_skills": combined.most_common(5),
        }
    finally:
        db.close()


# ============================================================
# 跨模块接口：供 Discovery Agent 调用 —— 全局技能演化速度 + 跨域汇聚
# ============================================================

# 技能领域分组（供跨域检测用，key=领域名，value=该领域包含的源组名）
SKILL_DOMAIN_GROUPS: dict[str, list[str]] = {
    "AI/LLM":     ["AI", "算法"],
    "后端":       ["Java", "数据库", "Python"],
    "前端":       ["前端", "设计", "移动"],
    "云原生":     ["云原生"],
    "数据":       ["数据"],
    "产品运营":   ["产品"],
    "测试运维":   ["测试", "运维"],
}


def get_skills_velocity(skills: list[str]) -> dict[str, dict]:
    """供 Discovery Agent 调用：查询一批技能的全平台演化速度。

    返回 {skill_name: {velocity, trend, evidence}} 字典。
    velocity: -100~+100, 正值=增长中, 负值=衰退中
    trend: "rising" | "stable" | "declining" | "unknown"
    evidence: 匹配到的 JD 样本数
    """
    if not skills:
        return {}

    db = _get_session()
    if not db:
        return {s: {"velocity": 0, "trend": "unknown", "evidence": 0} for s in skills}

    try:
        # 一次性查出所有 source_name 的 JD 描述样本
        sql = text("""
            SELECT p.source_name, d.job_description
            FROM job_postings p
            JOIN job_posting_details d ON d.job_id = p.id
            WHERE d.job_description IS NOT NULL
              AND p.status = 0
        """)
        rows = db.execute(sql).fetchall()

        if not rows:
            return {s: {"velocity": 0, "trend": "unknown", "evidence": 0} for s in skills}

        # 按 source 分组统计技能词频
        per_source: dict[str, Counter] = {}
        sample_cnt: dict[str, int] = {}
        for src, desc in rows:
            if not src:
                continue
            per_source.setdefault(src, Counter())
            sample_cnt.setdefault(src, 0)
            sample_cnt[src] += 1
            lower = (desc or "").lower()

        # 对每个目标技能在各 source 中统计
        skill_lower_map = {s: s.lower() for s in skills}
        for src, desc in rows:
            lower_desc = (desc or "").lower()
            for skill_name, skill_lower in skill_lower_map.items():
                if skill_lower in lower_desc:
                    per_source.setdefault(src, Counter())[skill_name] += 1

        # 指定历史锚点 vs 当前快照
        historical = per_source.get("51job", Counter())
        current = per_source.get("zhilian", Counter()) or per_source.get("boss_zhipin", Counter())
        n_hist = sample_cnt.get("51job", 0)
        n_curr = max(sample_cnt.get("zhilian", 0), sample_cnt.get("boss_zhipin", 0))

        result: dict[str, dict] = {}
        for skill_name in skills:
            cnt_h = historical.get(skill_name, 0)
            cnt_c = current.get(skill_name, 0)

            if n_hist == 0 and n_curr == 0:
                result[skill_name] = {"velocity": 0, "trend": "unknown", "evidence": 0}
                continue

            rate_h = cnt_h / max(n_hist, 1) * 100
            rate_c = cnt_c / max(n_curr, 1) * 100
            evidence = cnt_h + cnt_c

            if evidence == 0:
                result[skill_name] = {"velocity": 0, "trend": "unknown", "evidence": 0}
                continue

            delta = rate_c - rate_h

            if delta >= 3:
                velocity = min(100, round(delta / max(rate_h, 0.5) * 100))
                trend = "rising"
            elif delta <= -3:
                velocity = max(-100, round(delta / max(rate_h, 0.5) * 100))
                trend = "declining"
            elif abs(delta) < 3 and rate_c > 0:
                velocity = round(delta / max(rate_h, 0.5) * 100)
                trend = "stable"
            else:
                velocity = 0
                trend = "unknown"

            result[skill_name] = {
                "velocity": velocity,
                "trend": trend,
                "evidence": evidence,
                "rate_historical": round(rate_h, 1),
                "rate_current": round(rate_c, 1),
            }

        return result
    finally:
        db.close()


def detect_cross_domain_convergence(threshold: float = 3.0) -> list[dict]:
    """供 Discovery Agent 调用：检测全平台中'跨域技能共现异常'的信号。

    扫描每一条 JD，计算其技能在不同领域组中的命中分布。
    若某条 JD 同时命中两个以上领域的技能各 ≥threshold 个 → 标记为跨域融合信号。
    返回按模式聚合后的 TOP 融合信号列表。
    """
    db = _get_session()
    if not db:
        return []

    try:
        sql = text("""
            SELECT p.job_title, p.company_name, p.city, d.job_description, d.skills
            FROM job_postings p
            JOIN job_posting_details d ON d.job_id = p.id
            WHERE d.job_description IS NOT NULL
              AND p.status = 0
            ORDER BY p.crawl_time DESC
            LIMIT 3000
        """)
        rows = db.execute(sql).fetchall()

        if not rows:
            return []

        # 为每个领域组建立关键词索引
        domain_keywords: dict[str, set[str]] = {}
        for domain_name, source_groups in SKILL_DOMAIN_GROUPS.items():
            kw_set: set[str] = set()
            for grp in source_groups:
                for kw in _SKILL_VOCAB.get(grp, []):
                    kw_set.add(kw.lower())
            domain_keywords[domain_name] = kw_set

        # 扫描每条 JD
        pattern_counter: Counter = Counter()
        pattern_examples: dict[str, list[dict]] = {}

        for title, company, city, desc, skills_arr in rows:
            text_blob = ((title or "") + " " + (desc or "")).lower()

            # 计算每个领域的命中数
            domain_hits: dict[str, int] = {}
            for dname, kws in domain_keywords.items():
                hits = sum(1 for kw in kws if kw in text_blob)
                if hits >= threshold:
                    domain_hits[dname] = hits

            # 至少两个领域同时命中 → 跨域融合
            if len(domain_hits) >= 2:
                # 生成模式标签
                domains = sorted(domain_hits.keys())
                pattern = " × ".join(domains)
                pattern_counter[pattern] += 1

                if pattern not in pattern_examples:
                    pattern_examples[pattern] = []
                if len(pattern_examples[pattern]) < 3:
                    pattern_examples[pattern].append({
                        "title": title or "未知",
                        "company": company or "未知",
                        "city": city or "未知",
                        "domain_hits": domain_hits,
                    })

        # 输出 TOP 模式
        results: list[dict] = []
        for pattern, count in pattern_counter.most_common(12):
            results.append({
                "pattern": pattern,
                "count": count,
                "intensity": round(count / max(len(rows), 1) * 100, 1),
                "examples": pattern_examples.get(pattern, []),
            })

        return results
    finally:
        db.close()
