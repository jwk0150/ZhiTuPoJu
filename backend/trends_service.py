# -*- coding: utf-8 -*-
"""趋势分析 — 业务逻辑层
负责：KPI 聚合、岗位兴衰分析、AI 新兴岗位推演、AI 洞察生成
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy import func, text

from backend.db import SessionLocal
from backend.db_models import JobPosting, JobPostingDetail
from backend.llm import deepseek
from backend.evolution_agent.evolution_agent import (
    _FRONTEND_TITLES,
    _extract_skills_by_source,
    _diff_two,
    _top_hot_skills,
    get_skills_velocity,
    compute_landscape_profiles,
    detect_cross_domain_convergence,
)

# ============================================================
# 工具函数
# ============================================================


def _get_session():
    try:
        return SessionLocal()
    except Exception:
        return None


def _monthly_aggregation(db, title_pattern: str, months: int = 12) -> list[int]:
    """按月份聚合岗位 JD 数量，返回时间序列"""
    cutoff = datetime.now() - timedelta(days=months * 30)
    rows = (
        db.query(
            func.date_trunc("month", JobPosting.crawl_time).label("mon"),
            func.count(JobPosting.id),
        )
        .filter(
            JobPosting.job_title.ilike(f"%{title_pattern}%"),
            JobPosting.crawl_time >= cutoff,
        )
        .group_by("mon")
        .order_by("mon")
        .all()
    )
    return [r[1] for r in rows] if rows else []


def _salary_trend(db, title_pattern: str, months: int = 12) -> list[float]:
    """按月聚合薪资中位数趋势"""
    cutoff = datetime.now() - timedelta(days=months * 30)
    rows = (
        db.query(
            func.date_trunc("month", JobPosting.crawl_time).label("mon"),
            func.avg((JobPosting.salary_min + JobPosting.salary_max) / 2.0),
        )
        .filter(
            JobPosting.job_title.ilike(f"%{title_pattern}%"),
            JobPosting.crawl_time >= cutoff,
            JobPosting.salary_min > 0,
        )
        .group_by("mon")
        .order_by("mon")
        .all()
    )
    return [round(r[1], 1) for r in rows] if rows else []


def _classify_trend(values: list[int]) -> dict:
    """基于时间序列分类趋势方向和阶段"""
    if len(values) < 4:
        return {"stage": "unknown", "trend": "flat", "growth_rate": 0, "confidence": 30}

    half = len(values) // 2
    recent = values[-half:]
    earlier = values[:half]

    avg_recent = sum(recent) / max(len(recent), 1)
    avg_earlier = sum(earlier) / max(len(earlier), 1)

    if avg_earlier == 0:
        growth = 100 if avg_recent > 0 else 0
    else:
        growth = round((avg_recent - avg_earlier) / avg_earlier * 100, 1)

    # 计算趋势稳定性（最近期的标准差/均值 越低越稳定）
    if avg_recent > 0:
        variance = sum((v - avg_recent) ** 2 for v in recent) / len(recent)
        cv = math.sqrt(variance) / avg_recent
    else:
        cv = 1.0

    if growth > 15:
        stage, trend = "rising", "up"
        confidence = min(95, round(60 + growth * 0.5))
    elif growth > 5:
        stage, trend = "rising", "up"
        confidence = min(85, round(50 + growth))
    elif growth > -5:
        stage, trend = "stable", "flat"
        confidence = max(50, round(80 - cv * 30))
    elif growth > -15:
        stage, trend = "declining", "down"
        confidence = min(85, round(50 + abs(growth) * 0.8))
    else:
        stage, trend = "declining", "down"
        confidence = min(95, round(60 + abs(growth) * 0.4))

    # 低波动加分
    if cv < 0.3:
        confidence = min(95, confidence + 5)

    return {"stage": stage, "trend": trend, "growth_rate": growth, "confidence": confidence, "volatility": round(cv, 2)}


# ============================================================
# Dashboard 数据聚合
# ============================================================


def get_dashboard_data() -> dict:
    """聚合趋势分析仪表盘所需的全量数据"""
    db = _get_session()
    if not db:
        return _mock_dashboard()

    try:
        # KPI 指标
        total_jobs = db.query(func.count(JobPosting.id)).filter(JobPosting.job_title.isnot(None)).scalar() or 0
        total_companies = (
            db.query(func.count(func.distinct(JobPosting.company_name)))
            .filter(JobPosting.company_name.isnot(None))
            .scalar()
            or 0
        )

        # 岗位趋势：取 TOP 5 热门岗位的时间序列
        # 获取最近出现最多的岗位标题
        top_titles = (
            db.query(JobPosting.job_title, func.count(JobPosting.id).label("cnt"))
            .filter(JobPosting.job_title.isnot(None))
            .group_by(JobPosting.job_title)
            .order_by(func.count(JobPosting.id).desc())
            .limit(15)
            .all()
        )

        # 取 5 个代表性岗位的时间序列
        job_trends = {}
        colors = ["#0D9488", "#7C3AED", "#0891B2", "#10B981", "#F59E0B"]
        for i, (title, _) in enumerate(top_titles[:5]):
            key = title[:12]
            demand = _monthly_aggregation(db, title, months=12)
            salary = _salary_trend(db, title, months=12)
            trend_info = _classify_trend(demand)
            job_trends[key] = {
                "title": title,
                "demand": demand,
                "salary": salary[-6:] if salary else [],
                "trend": trend_info["trend"],
                "stage": trend_info["stage"],
                "growth_rate": trend_info["growth_rate"],
                "color": colors[i % len(colors)],
            }

        # 技能热度：从 JD descriptions 采样提取
        skill_counter = Counter()
        samples = (
            db.query(JobPostingDetail.skills)
            .filter(JobPostingDetail.skills.isnot(None))
            .order_by(func.random())
            .limit(500)
            .all()
        )
        for (skills_arr,) in samples:
            if skills_arr:
                for s in skills_arr:
                    skill_counter[s.lower()] += 1

        top_skills = skill_counter.most_common(30)

        # KPI
        kpi = {
            "total_jobs": total_jobs,
            "total_companies": total_companies,
            "tracked_jobs": len(top_titles),
            "active_skills": len(top_skills),
            "data_source": "db",
        }

        return {
            "kpi": kpi,
            "job_trends": job_trends,
            "top_skills": [{"name": s, "count": c} for s, c in top_skills[:15]],
            "data_source": "db",
            "updated_at": datetime.now().isoformat(),
        }

    except Exception as e:
        return {**_mock_dashboard(), "data_source": "mock", "error": str(e)}
    finally:
        db.close()


def _mock_dashboard() -> dict:
    """Fallback mock 数据"""
    return {
        "kpi": {"total_jobs": 12850, "total_companies": 3200, "tracked_jobs": 10, "active_skills": 38, "data_source": "mock"},
        "job_trends": {},
        "top_skills": [],
        "data_source": "mock",
    }


# ============================================================
# 岗位兴衰分析
# ============================================================


LIFECYCLE_AI_PROMPT = """你是一位就业市场趋势分析专家。基于以下岗位数据，判断每个岗位所处的生命周期阶段和未来趋势。

对每个岗位，分析以下信号：
1. JD需求时间序列 — 近期的增长/下降趋势
2. 薪资变化 — 上涨说明供不应求（兴起信号），下降/持平说明饱和
3. 技能演化速度 — 技能栈快速变化说明岗位仍在定义中（兴起信号）
4. 行业扩散度 — 招聘公司多样性

输出 JSON 格式：
{
  "jobs": [
    {
      "title": "岗位名称",
      "stage": "rising|stable|declining|emerging",
      "trend": "up|flat|down",
      "confidence": 0-100,
      "reason": "一句话分析理由（中文，≤40字）",
      "outlook": "3-6个月展望（中文，≤30字）"
    }
  ],
  "overall_analysis": "整体市场趋势总结（中文，2-3句话）"
}

注意：
- rising = 需求持续增长，薪资上升
- stable = 需求平稳，竞争充分
- declining = 需求下降或技能过时
- emerging = 全新岗位方向，样本少但概念清晰
- 只输出JSON，不要任何其他文字"""


def get_job_lifecycle_analysis() -> dict:
    """分析各岗位的兴衰阶段"""
    db = _get_session()
    if not db:
        return _mock_lifecycle()

    try:
        # 检查是否有足够的时序数据（至少需要跨越2个月的数据）
        cutoff_2m = datetime.now() - timedelta(days=60)
        time_range_check = (
            db.query(func.min(JobPosting.crawl_time), func.max(JobPosting.crawl_time))
            .filter(JobPosting.job_title.isnot(None))
            .first()
        )
        has_sufficient_history = (
            time_range_check
            and time_range_check[0] is not None
            and time_range_check[1] is not None
            and (time_range_check[1] - time_range_check[0]).days >= 60
        )

        if not has_sufficient_history:
            return {**_mock_lifecycle(), "data_source": "mock", "note": f"DB时间跨度仅{(time_range_check[1]-time_range_check[0]).days if time_range_check else 0}天，不足60天，使用模拟数据"}

        # 选取 10 个主要岗位方向
        job_directions = [
            "软件", "前端", "java", "数据分析", "算法",
            "运维", "测试", "产品经理", "嵌入式", "全栈",
        ]

        jobs_data = []
        for direction in job_directions:
            demand = _monthly_aggregation(db, direction, months=12)
            salary = _salary_trend(db, direction, months=6)
            trend_info = _classify_trend(demand)
            company_count = (
                db.query(func.count(func.distinct(JobPosting.company_name)))
                .filter(JobPosting.job_title.ilike(f"%{direction}%"), JobPosting.company_name.isnot(None))
                .scalar()
                or 0
            )

            jobs_data.append({
                "title": direction,
                "demand_curve": demand[-6:] if demand else [],
                "salary_trend": salary if salary else [],
                "company_count": company_count,
                "growth_rate": trend_info["growth_rate"],
                "volatility": trend_info.get("volatility", 0),
                "stat_stage": trend_info["stage"],
                "stat_trend": trend_info["trend"],
                "stat_confidence": trend_info["confidence"],
            })

        # 调用 DeepSeek 进行 AI 综合判断
        ai_results = None
        try:
            compact = [
                {
                    "title": j["title"],
                    "demand_6m": j["demand_curve"],
                    "salary_6m": j["salary_trend"],
                    "growth_rate": j["growth_rate"],
                    "companies": j["company_count"],
                    "stat_stage": j["stat_stage"],
                }
                for j in jobs_data
            ]
            content, meta = deepseek.chat_completions(
                [
                    {"role": "system", "content": LIFECYCLE_AI_PROMPT},
                    {"role": "user", "content": f"岗位数据:\n{json.dumps(compact, ensure_ascii=False)}"},
                ],
                temperature=0.3,
                timeout=60.0,
            )
            if not meta.get("error"):
                ai_results = deepseek._extract_json(content)
        except Exception:
            pass

        # 合并统计结果和 AI 结果
        jobs = []
        for j in jobs_data:
            entry = {
                "title": j["title"],
                "stage": j["stat_stage"],
                "trend": j["stat_trend"],
                "growth_rate": j["growth_rate"],
                "confidence": j["stat_confidence"],
                "demand_curve": j["demand_curve"],
                "salary_trend": j["salary_trend"],
                "company_count": j["company_count"],
                "reason": "",
                "outlook": "",
            }
            # 如果有 AI 分析，覆盖
            if ai_results:
                ai_job = next(
                    (aj for aj in ai_results.get("jobs", []) if aj.get("title", "").lower() == j["title"].lower()),
                    None,
                )
                if ai_job:
                    entry["stage"] = ai_job.get("stage", entry["stage"])
                    entry["trend"] = ai_job.get("trend", entry["trend"])
                    entry["confidence"] = ai_job.get("confidence", entry["confidence"])
                    entry["reason"] = ai_job.get("reason", "")
                    entry["outlook"] = ai_job.get("outlook", "")

            jobs.append(entry)

        # 按增长率排序
        jobs.sort(key=lambda x: x["growth_rate"], reverse=True)

        return {
            "jobs": jobs,
            "overall_analysis": ai_results.get("overall_analysis", "") if ai_results else "",
            "data_source": "db",
            "ai_enriched": ai_results is not None,
            "updated_at": datetime.now().isoformat(),
        }

    except Exception as e:
        return {**_mock_lifecycle(), "data_source": "mock", "error": str(e)}
    finally:
        db.close()


def _mock_lifecycle() -> dict:
    return {
        "jobs": [
            {"title": "AI Agent 工程师", "stage": "rising", "trend": "up", "growth_rate": 38.6, "confidence": 92, "reason": "需求连续6个月增长", "demand_curve": [120, 135, 160, 185, 210, 240], "salary_trend": [15, 18, 22, 25, 28, 32]},
            {"title": "大模型应用工程师", "stage": "rising", "trend": "up", "growth_rate": 47.2, "confidence": 89, "reason": "企业LLM应用落地加速", "demand_curve": [80, 100, 130, 165, 200, 245], "salary_trend": [18, 22, 26, 30, 35, 40]},
            {"title": "云原生工程师", "stage": "stable", "trend": "up", "growth_rate": 8.5, "confidence": 78, "reason": "需求稳定增长，技能趋于标准化", "demand_curve": [200, 210, 215, 222, 228, 235], "salary_trend": [20, 21, 22, 22, 23, 24]},
            {"title": "数据分析师", "stage": "stable", "trend": "flat", "growth_rate": 3.2, "confidence": 75, "reason": "需求饱和，AI增强分析成为新要求", "demand_curve": [180, 182, 185, 183, 188, 186], "salary_trend": [12, 12, 13, 13, 13, 14]},
            {"title": "Java开发工程师", "stage": "stable", "trend": "flat", "growth_rate": 1.2, "confidence": 80, "reason": "存量市场为主，Spring AI带来新活力", "demand_curve": [500, 498, 502, 495, 505, 500], "salary_trend": [15, 15, 16, 16, 16, 17]},
            {"title": "前端开发工程师", "stage": "stable", "trend": "flat", "growth_rate": 3.5, "confidence": 76, "reason": "全栈化趋势明显，纯前端需求走平", "demand_curve": [350, 355, 348, 360, 358, 362], "salary_trend": [14, 14, 15, 15, 15, 16]},
            {"title": "传统BI分析师", "stage": "declining", "trend": "down", "growth_rate": -12.8, "confidence": 84, "reason": "被AI数据分析工具替代", "demand_curve": [120, 115, 108, 100, 92, 85], "salary_trend": [10, 10, 9, 9, 8, 8]},
            {"title": "Hadoop工程师", "stage": "declining", "trend": "down", "growth_rate": -18.2, "confidence": 90, "reason": "大数据技术栈向Spark/Flink迁移", "demand_curve": [80, 72, 65, 58, 50, 42], "salary_trend": [12, 11, 10, 10, 9, 8]},
        ],
        "overall_analysis": "AI相关岗位需求强劲增长，传统开发岗位趋于稳定，部分旧技术栈岗位加速衰退。",
        "data_source": "mock",
    }


# ============================================================
# AI 新兴岗位推演
# ============================================================


EMERGING_JOBS_PROMPT = """你是一位前沿科技就业趋势预测专家。你的任务是基于数据库中的真实招聘数据信号，推演未来6-18个月可能出现的新兴岗位。

分析框架：
1. 从当前招聘数据中识别"技能组合异常"——不同领域技能的交叉出现（如Agent+芯片、RAG+合规）
2. 关注新出现的低频但高增长职位标题
3. 结合技术发展趋势（AI Agent进化、端侧大模型、具身智能等）
4. 参考但不局限于已知的未来方向

输出 JSON：
{
  "emerging_jobs": [
    {
      "title": "新兴岗位名称",
      "growth_potential": 0-100,
      "eta_months": 预计出现高峰的月数,
      "drivers": ["驱动因素1", "驱动因素2"],
      "required_skills": ["核心技能1", "核心技能2", "核心技能3"],
      "definition": "岗位定义（≤80字）",
      "evidence_signals": ["从DB中发现的支撑信号"]
    }
  ],
  "analysis_summary": "整体推演逻辑说明（中文，2-3句话）"
}

要求：
- 输出 5-8 个新兴岗位
- growth_potential 要合理（不是全部都90+）
- 推演要有DB数据支撑
- 只输出JSON"""


def get_emerging_jobs_analysis() -> dict:
    """AI 驱动的实时新兴岗位推演"""
    db = _get_session()
    if not db:
        return _mock_emerging_jobs()

    try:
        # 1. 获取跨域融合信号
        cross_signals = []
        try:
            cross_signals = detect_cross_domain_convergence(threshold=1.5)
        except Exception:
            pass

        # 2. 采样最近的数据用于 AI 分析
        recent_jobs = (
            db.query(
                JobPosting.job_title,
                JobPosting.company_name,
                func.array_agg(func.distinct(JobPostingDetail.skills)).label("skills"),
            )
            .join(JobPostingDetail, JobPostingDetail.job_id == JobPosting.id)
            .filter(
                JobPosting.crawl_time >= datetime.now() - timedelta(days=90),
                JobPosting.job_title.isnot(None),
            )
            .group_by(JobPosting.job_title, JobPosting.company_name)
            .order_by(func.random())
            .limit(200)
            .all()
        )

        # 3. 提取技能组合信号
        title_counter = Counter()
        skill_combo_counter = Counter()
        for title, company, skills in recent_jobs:
            title_counter[title] += 1
            if skills:
                # 识别跨域技能组合
                for i, s1 in enumerate(skills):
                    for s2 in skills[i + 1 :]:
                        combo = tuple(sorted([s1.lower()[:20], s2.lower()[:20]]))
                        skill_combo_counter[combo] += 1

        # 低频高新颖性的标题
        novel_titles = [
            {"title": t, "count": c}
            for t, c in title_counter.most_common(50)
            if c < 20 and any(kw in t.lower() for kw in ["agent", "ai", "llm", "大模型", "智能", "rag", "aigc", "生成", "安全", "数据", "云原生", "边缘"])
        ][:15]

        # 最高频的跨域技能组合
        top_combos = [{"skills": list(k), "count": v} for k, v in skill_combo_counter.most_common(20)]

        # 4. 调用 DeepSeek 推演
        context = {
            "novel_titles": novel_titles[:20],
            "cross_domain_signals": cross_signals[:10] if cross_signals else [],
            "top_skill_combos": top_combos[:15],
            "known_directions": [
                {"title": "具身智能工程师", "skills": ["ROS2", "PyTorch", "SLAM", "强化学习"]},
                {"title": "AI安全对齐工程师", "skills": ["对抗攻击", "RLHF", "红队测试", "偏见检测"]},
                {"title": "端侧AI部署工程师", "skills": ["ONNX", "TensorRT", "量化", "边缘计算"]},
                {"title": "合成数据工程师", "skills": ["数据生成", "GAN", "LLM", "数据增强"]},
                {"title": "AI芯片软件栈工程师", "skills": ["Triton", "MLIR", "TVM", "CUDA"]},
                {"title": "3D生成工程师", "skills": ["NeRF", "3D Gaussian Splatting", "纹理合成"]},
                {"title": "AI研发效能工程师", "skills": ["AI Coding", "DORA度量", "CI/CD", "代码审查AI"]},
                {"title": "AI法律合规顾问", "skills": ["AI政策", "数据合规", "算法审计", "GDPR"]},
            ],
        }

        content, meta = deepseek.chat_completions(
            [
                {"role": "system", "content": EMERGING_JOBS_PROMPT},
                {"role": "user", "content": f"DB数据信号:\n{json.dumps(context, ensure_ascii=False)[:6000]}"},
            ],
            temperature=0.4,
            timeout=90.0,
        )

        if meta.get("error"):
            return {**_mock_emerging_jobs(), "data_source": "mock", "ai_error": meta["error"]}

        result = deepseek._extract_json(content)
        result["data_source"] = "db"
        result["ai_enriched"] = True
        result["updated_at"] = datetime.now().isoformat()
        result["db_signals_count"] = len(recent_jobs)
        return result

    except Exception as e:
        return {**_mock_emerging_jobs(), "data_source": "mock", "error": str(e)}
    finally:
        db.close()


def _mock_emerging_jobs() -> dict:
    # 演示口径：预测岗位全部为趋势外推产生、当前招聘市场上尚不存在的全新岗位
    return {
        "emerging_jobs": [
            {"title": "世界模型对齐工程师", "growth_potential": 92, "eta_months": 6, "drivers": ["视频生成世界模型爆发", "物理一致性训练需求"], "required_skills": ["World Model", "时序预测", "对齐训练", "强化学习"], "definition": "负责让世界模型与物理规律对齐，约束生成结果的因果一致性。", "evidence_signals": ["世界模型相关论文增长4x", "头部实验室组建对齐团队"]},
            {"title": "神经符号推理架构师", "growth_potential": 88, "eta_months": 9, "drivers": ["大模型逻辑幻觉倒逼", "可验证推理需求"], "required_skills": ["Neuro-Symbolic", "知识图谱", "定理证明", "推理引擎"], "definition": "设计神经网络与符号推理融合的混合架构，保证结论可验证。", "evidence_signals": ["NeSy 相关职位增长170%", "金融/医疗高可靠场景落地"]},
            {"title": "具身智能伦理审计师", "growth_potential": 85, "eta_months": 8, "drivers": ["人形机器人进入公共场所", "具身行为合规要求"], "required_skills": ["VLA", "伦理框架", "行为审计", "红队测试"], "definition": "审计具身智能体在物理世界中的决策与行为边界，出具合规报告。", "evidence_signals": ["机器人伦理岗位从0到1出现", "多地出台机器人行为草案"]},
            {"title": "自主智能体仿真工程师", "growth_potential": 82, "eta_months": 7, "drivers": ["Agent 社会模拟兴起", "政策沙盒推演需求"], "required_skills": ["Agent Society", "仿真推演", "博弈论", "沙盒环境"], "definition": "构建大规模自主智能体社会仿真，推演经济与组织行为。", "evidence_signals": ["Agent 仿真论文增长3x", "智库开始采购推演平台"]},
            {"title": "量子机器学习编译工程师", "growth_potential": 78, "eta_months": 15, "drivers": ["量子硬件比特数突破", "QML 编译层空白"], "required_skills": ["QML", "量子门", "编译器", "混合编程"], "definition": "为量子机器学习模型构建编译层，优化量子-经典混合执行。", "evidence_signals": ["量子云平台开放编译接口", "超导芯片规模翻番"]},
        ],
        "analysis_summary": "AI技术正从模型层向世界模型、神经符号、具身伦理、智能体社会与量子计算方向扩散，未来6-18个月将涌现一批当前招聘市场上尚不存在的全新岗位。",
        "data_source": "mock",
    }


# ============================================================
# AI 洞察
# ============================================================


INSIGHT_PROMPT = """你是一位就业市场分析报告撰写专家。基于以下趋势数据，生成一份简洁有力的趋势分析洞察。

数据包括：
- 岗位需求的月度变化
- 技能热度排名
- 岗位兴衰分类
- 薪资趋势

请输出 JSON：
{
  "headline": "核心结论（中文，≤20字）",
  "insights": [
    {"text": "洞察内容（中文，≤60字）", "confidence": 0-100, "category": "rising|declining|opportunity|risk"}
  ],
  "summary": "综合分析（中文，2-3句话，≤150字）"
}

只输出JSON。"""


def get_ai_insight(dashboard_data: dict | None = None, lifecycle_data: dict | None = None) -> dict:
    """生成 AI 趋势洞察"""

    # 构建 context
    context = {
        "dashboard_summary": {
            "total_jobs": dashboard_data.get("kpi", {}).get("total_jobs", "N/A") if dashboard_data else "N/A",
            "active_skills": dashboard_data.get("kpi", {}).get("active_skills", "N/A") if dashboard_data else "N/A",
        },
        "lifecycle": []
        if not lifecycle_data
        else [
            {"title": j["title"], "stage": j["stage"], "trend": j["trend"], "growth_rate": j["growth_rate"]}
            for j in lifecycle_data.get("jobs", [])[:8]
        ],
    }

    content, meta = deepseek.chat_completions(
        [
            {"role": "system", "content": INSIGHT_PROMPT},
            {"role": "user", "content": f"趋势数据:\n{json.dumps(context, ensure_ascii=False)}"},
        ],
        temperature=0.4,
        timeout=45.0,
    )

    if meta.get("error"):
        return {
            "headline": "AI分析暂不可用",
            "insights": [
                {"text": "AI Agent相关岗位需求持续增长，同比增长38.6%", "confidence": 92, "category": "rising"},
                {"text": "传统大数据技能(Hadoop等)加速被Spark/Flink替代", "confidence": 88, "category": "declining"},
                {"text": "跨域融合岗位(AI+安全、AI+芯片)将大量涌现", "confidence": 82, "category": "opportunity"},
            ],
            "summary": "DB数据驱动的趋势分析。AI服务不可用时的默认洞察。",
            "data_source": "default",
        }

    try:
        result = deepseek._extract_json(content)
        result["data_source"] = "ai"
        return result
    except Exception:
        return {
            "headline": "AI分析解析失败",
            "insights": [],
            "summary": content[:200] if content else "",
            "data_source": "ai_raw",
        }
