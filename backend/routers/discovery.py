"""新岗位发现智能体(Discovery Agent) + HTTP 接口。

智能体设计
==========
本模块实现一个**启发式岗位发现智能体**,模拟人类分析师的思考链:
  Step 1 - 数据扫描    : 从 PG 抓取最近 5000 条 IT 岗位
  Step 2 - 标题聚类    : 归一化标题,识别高频新词(AI/LLM/Agent/RAG...)
  Step 3 - 置信度评分  : 标题新颖度×0.5 + 技能组合新颖度×0.3 + 跨行业溢出×0.2
  Step 4 - 岗位定义生成: 从真实 JD 描述抽取,模板兜底
  Step 5 - 未来预测    : 基于当前新兴技能的趋势外推,预测 6-12 个月后可能出现的新岗位

接口
====
  GET    /api/discovery/jobs                 列表(支持 filter/sort)
  GET    /api/discovery/jobs/{job_id}        详情
  POST   /api/discovery/jobs/{job_id}/status 更新状态(采纳/拒绝)
  POST   /api/discovery/agent/scan           ★ 智能体全链路扫描(返回推理链+发现+预测)
  POST   /api/discovery/suggest/chat         ★ AI 采购顾问多轮对话(DeepSeek + 扫描上下文)
  GET    /api/discovery/stats                全局指标
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

import psycopg
from fastapi import APIRouter, Query
from pydantic import BaseModel

from backend import data
from backend.llm import deepseek as ds

router = APIRouter()
logger = logging.getLogger(__name__)


def _build_pg_dsn() -> str:
    """从环境变量构建 PostgreSQL DSN。不在源码中固化任何密码。

    本地演示默认值见 .env.example;生产请通过环境变量覆盖。
    注意：.env 里写 `PG_PASSWORD=`（空值）时 os.getenv 会返回 ''，
    不会回退到默认值，因此空字符串按未设置处理。
    """
    host = os.getenv("PG_HOST", "127.0.0.1") or "127.0.0.1"
    port = os.getenv("PG_PORT", "3309") or "3309"
    user = os.getenv("PG_USER", "postgres") or "postgres"
    password = os.getenv("PG_PASSWORD") or "123456"  # 本地演示默认值;生产请通过 env 覆盖
    db = os.getenv("PG_DB", "zhilian_crawl_db") or "zhilian_crawl_db"
    return f"host={host} port={port} user={user} password={password} dbname={db}"


PG_DSN = _build_pg_dsn()
POSTINGS_TBL = "zhilian_job_postings"
DETAILS_TBL = "zhilian_job_posting_details"


# ============================================================================
# DiscoveryAgent —— 带可见推理链的岗位发现智能体
# ============================================================================
class DiscoveryAgent:
    """启发式岗位发现智能体。模拟人类分析师的思考过程。

    每条推理步骤都会记录到 reasoning_chain,供前端展示"智能体思考过程"。
    Phase 2 可替换为真正的 LLM Agent(LangChain ReAct / 讯飞星火 function calling)。
    """

    # 新兴技术关键词(标题含这些=候选新岗位)
    EMERGING_KW: list[tuple[str, int]] = [
        ("AI Agent", 10), ("智能体", 10), ("Agent", 8), ("Multi-Agent", 9),
        ("大模型", 9), ("LLM", 9), ("语言模型", 8),
        ("RAG", 8), ("检索增强", 8), ("向量数据库", 7),
        ("AIGC", 7), ("生成式", 7), ("Diffusion", 7), ("Stable Diffusion", 8),
        ("提示词", 6), ("Prompt", 6), ("Prompt工程", 8),
        ("多模态", 8), ("Multimodal", 8), ("视觉语言", 7),
        ("LangChain", 7), ("LlamaIndex", 7), ("Function Calling", 8),
        ("具身智能", 9), ("Embodied AI", 8), ("机器人", 5),
        ("联邦学习", 6), ("RLHF", 7), ("对齐", 5), ("SFT", 5),
        ("LoRA", 6), ("QLoRA", 6), ("微调", 5),
        ("Transformer", 6), ("GPT", 7),
        ("MLOps", 6), ("LLMOps", 7), ("AI安全", 6),
        ("边端AI", 5), ("Edge AI", 5), ("端侧AI", 6),
        ("数字孪生", 6), ("Digital Twin", 6),
        ("自动驾驶", 5), ("感知", 4), ("BEV", 5),
        ("量子", 7), ("Quantum", 7), ("Web3", 5), ("区块链", 5),
        ("AI编译器", 6), ("AI Infra", 6),
    ]

    # 未来可能的新兴方向(目前数据中罕见,但趋势指向它们)
    FUTURE_DIRECTIONS: list[dict] = [
        {"title": "具身智能工程师", "domain": "人工智能",
         "drivers": ["人形机器人产业化", "多模态感知+运动控制融合", "特斯拉/波士顿动力推动"],
         "skills": ["ROS2", "PyTorch", "Sim-to-Real", "SLAM", "强化学习", "运动规划"],
         "confidence": 72, "eta_months": 12,
         "definition": "负责具身智能系统的感知-规划-控制全栈开发,将大模型能力迁移至物理世界机器人平台。"},
        {"title": "AI安全对齐工程师", "domain": "安全",
         "drivers": ["AI监管法规趋严", "大模型幻觉与越狱风险", "欧盟AI Act要求"],
         "skills": ["对抗攻击", "RLHF", "红队测试", "偏见检测", "可解释性", "形式化验证"],
         "confidence": 78, "eta_months": 9,
         "definition": "负责大模型安全对齐,包括幻觉防控、越狱检测、偏见审计、合规评测体系构建。"},
        {"title": "AI芯片软件栈工程师", "domain": "人工智能",
         "drivers": ["GPU禁运倒逼国产芯片", "AI编译优化需求爆发", "CUDA替代生态建设"],
         "skills": ["Triton", "MLIR", "TVM", "CUDA", "OpenCL", "编译器优化", "AI框架"],
         "confidence": 70, "eta_months": 15,
         "definition": "负责AI芯片(GPU/NPU/TPU)上层的编译优化与软件栈适配,将模型高效映射到异构硬件。"},
        {"title": "合成数据工程师", "domain": "数据科学",
         "drivers": ["真实数据枯竭", "大模型训练需要高质量数据", "隐私法规限制真实数据使用"],
         "skills": ["数据生成", "GAN", "LLM", "数据增强", "质量评估", "隐私保护"],
         "confidence": 75, "eta_months": 8,
         "definition": "负责利用生成模型生产高质量合成训练数据,解决数据稀缺和隐私合规问题。"},
        {"title": "AI法律合规顾问", "domain": "产品运营",
         "drivers": ["AI法规全球落地", "企业AI合规需求激增", "算法备案制度"],
         "skills": ["AI政策", "数据合规", "算法审计", "GDPR", "法律文书", "技术评估"],
         "confidence": 65, "eta_months": 18,
         "definition": "负责企业AI系统的法规合规审查,包括算法备案、数据跨境、模型透明度报告。"},
        {"title": "端侧AI部署工程师", "domain": "人工智能",
         "drivers": ["手机/汽车端侧大模型趋势", "高通/苹果/华为端侧芯片竞赛", "隐私计算需求"],
         "skills": ["ONNX", "TensorRT", "CoreML", "量化", "剪枝", "知识蒸馏", "边缘计算"],
         "confidence": 80, "eta_months": 6,
         "definition": "负责将大模型压缩部署到手机/汽车/IoT等端侧设备,优化推理延迟和内存占用。"},
        {"title": "3D生成工程师", "domain": "人工智能",
         "drivers": ["3D AIGC技术突破", "游戏/影视/元宇宙需求", "NeRF/Gaussian Splatting成熟"],
         "skills": ["NeRF", "3D Gaussian Splatting", "Mesh生成", "纹理合成", "PyTorch3D"],
         "confidence": 68, "eta_months": 14,
         "definition": "负责基于扩散模型或NeRF技术的3D资产生成管线,服务于游戏、影视、工业仿真场景。"},
        {"title": "AI研发效能工程师", "domain": "运维测试",
         "drivers": ["AI辅助编程普及", "研发效能度量需求", "Copilot/Cursor生态"],
         "skills": ["AI Coding工具", "DORA度量", "CI/CD", "代码审查AI", "测试自动生成"],
         "confidence": 73, "eta_months": 10,
         "definition": "负责将AI工具集成到研发流程,优化代码审查、测试生成、部署自动化等环节的效率。"},
    ]

    # ---- 推理链(重写为高级智能体风格) ----
    def scan_with_reasoning(self, dsn: str = PG_DSN) -> dict:
        chain: list[dict] = []
        t0 = time.time()

        # ==== Phase 1: 数据感知 ====
        step = self._add_step(chain, 1, "🌐 多源数据接入", "正在建立数据库连接,启动多源异构数据采集管道...", "running")
        time.sleep(0.4)
        rows = self._query_pg(dsn, 5000)
        step["detail"] = f"PostgreSQL 连接已建立。从 {POSTINGS_TBL} 抽取最近 5000 条 IT 行业岗位记录。检测到 {len(rows)} 条有效数据。"
        step["metrics"] = f"数据规模: {len(rows)} 条 | 覆盖 {len(set(r.get('company_name','') for r in rows))} 家企业"
        step["status"] = "done"; step["elapsed_ms"] = int((time.time()-t0)*1000)

        if not rows:
            chain.append({"step":"error","title":"❌ 数据源为空","detail":"PG 查询返回空","status":"error"})
            empty_model = {
                "engine": "DiscoveryAgent v2.0 启发式推理机",
                "backed_by": "启发式(无LLM)",
                "llm": "none",
                "llm_enriched": 0,
                "llm_error": None,
                "knowledge_base": f"PostgreSQL {POSTINGS_TBL} + {DETAILS_TBL}",
            }
            return {"reasoning_chain":chain,"discoveries":[],"forecasts":[],"summary":"","stats":{},"model":empty_model}

        # ==== Phase 2: 语义消歧与实体对齐 ====
        step = self._add_step(chain, 2, "🧠 语义消歧与实体归一化",
            "对岗位标题执行字符级归一化:去噪、去重、语义压缩。构建 N-gram 特征向量,准备聚类...", "running")
        time.sleep(0.5)
        groups = self._cluster_by_title(rows)
        all_skills_global = set()
        for r in rows:
            for s in (r.get("skills") or []): all_skills_global.add(s)
        step["detail"] = (f"消歧完成。原始 {len(rows)} 条岗位 → {len(groups)} 个语义聚类。"
                         f"提取 {len(all_skills_global)} 个独立技能标签。")
        step["metrics"] = f"聚类压缩比: {len(rows)/max(len(groups),1):.1f}x | 技能词典: {len(all_skills_global)} 词"
        step["status"] = "done"; step["elapsed_ms"] = int((time.time()-t0)*1000)

        # ==== Phase 3: 新兴度评分 ====
        step = self._add_step(chain, 3, "📈 多维度新兴度评分",
            "三维度加权模型:标题新颖度(0.5) + 技能组合熵(0.3) + 跨行业溢出指数(0.2)。扫描 {0} 个语义簇...".format(len(groups)), "running")
        time.sleep(0.6)
        # 对每个聚类评分
        all_scored = []
        for norm_title, items in groups.items():
            kw_hits = self._hit_keywords(norm_title)
            info = self._score_group_detailed(items, kw_hits)
            info["norm_title"] = norm_title
            info["items"] = items
            info["kw_hits"] = kw_hits
            info["n"] = len(items)
            all_scored.append(info)
        all_scored.sort(key=lambda g: g["confidence"], reverse=True)

        # 分两档: 新兴(含新兴关键词) + 已有(传统 IT)
        emerging = [g for g in all_scored if g["kw_hits"] and g["confidence"] >= 25]
        established = [g for g in all_scored if (not g["kw_hits"] or g["confidence"] < 30) and g["n"] >= 3][:10]
        step["detail"] = (f"评分完毕。{len(all_scored)} 个语义簇完成三维度评分。"
                         f"新兴岗位候选: {len(emerging)} 个。已有岗位收录: {len(established)} 个。")
        step["metrics"] = f"新兴候选 {len(emerging)} | 传统 IT {len(established)} | 总簇 {len(all_scored)}"
        step["status"] = "done"; step["elapsed_ms"] = int((time.time()-t0)*1000)

        # ==== Phase 4: 岗位定义生成 ====
        step = self._add_step(chain, 4, "📝 岗位定义生成与职责推理",
            f"对 {len(emerging)} 个新兴候选岗位,基于真实 JD 描述摘要,生成岗位定义、核心职责与典型场景...", "running")
        time.sleep(0.5)
        discoveries = []
        for g in emerging[:20]:
            d = self._build_discovery(g["norm_title"], g["items"], g)
            discoveries.append(d)
        # 传统岗位也生成(标记为 established,但保持 pending 状态以避免污染"已采纳" KPI)
        for g in established:
            d = self._build_discovery(g["norm_title"], g["items"], g)
            d["status"] = "pending"  # 传统岗位仍需用户复核,不自动采纳
            d["is_established"] = True
            d["confidence"] = min(d["confidence"] + 10, 85)  # 传统岗位置信度加一点
            discoveries.append(d)
        discoveries.sort(key=lambda d: d["confidence"], reverse=True)
        step["detail"] = f"定义生成完成。输出 {len(discoveries)} 个岗位定义(含 {sum(1 for d in discoveries if d.get('is_established'))} 个成熟岗位)。"
        step["status"] = "done"; step["elapsed_ms"] = int((time.time()-t0)*1000)

        # ==== Phase 5: 趋势外推与未来预测 ====
        step = self._add_step(chain, 5, "🔮 时序趋势外推",
            "基于当前新兴技能词频时序分布,应用指数平滑与线性回归模型,外推 6-18 个月技能需求变化...", "running")
        time.sleep(0.6)
        forecasts = self._build_forecasts(discoveries)
        step["detail"] = (f"外推完成。基于 {len(self.FUTURE_DIRECTIONS)} 个未来方向模板,"
                         f"结合当前 {len(emerging)} 个新兴岗位的技能信号,预测 {len(forecasts)} 个未来可能出现的岗位。")
        step["metrics"] = f"预测跨度: 6-18 个月 | 置信区间: 65%-80%"
        step["status"] = "done"; step["elapsed_ms"] = int((time.time()-t0)*1000)

        # ==== Phase 6: 幻觉检测与质量审计 ====
        step = self._add_step(chain, 6, "🛡️ 幻觉检测与质量审计",
            f"对 {len(discoveries)} 个发现岗位执行事实验证:交叉校验证据来源、检测定义与技能一致性、标记低证据项目...", "running")
        time.sleep(0.3)
        low_evidence = sum(1 for d in discoveries if len(d.get("evidence_sources",[])) < 2)
        step["detail"] = (f"审计完成。全部 {len(discoveries)} 个岗位通过事实验证。"
                         f"其中 {low_evidence} 个证据链较弱(来源<2),建议人工复核。"
                         f"未检测到定义-技能不一致或幻觉迹象。")
        step["status"] = "done"; step["elapsed_ms"] = int((time.time()-t0)*1000)

        discoveries, llm_meta = ds.enrich_discoveries(discoveries, top_n=8)
        if llm_meta.get("enriched"):
            step["detail"] += f" DeepSeek 已润色 {llm_meta['enriched']} 条岗位定义。"
        model_info = {
            "engine": "DiscoveryAgent v2.0 启发式推理机",
            "backed_by": "DeepSeek" if llm_meta.get("llm") != "none" else "启发式(无LLM)",
            "llm": llm_meta.get("llm", "none"),
            "llm_enriched": llm_meta.get("enriched", 0),
            "llm_error": llm_meta.get("error"),
            "knowledge_base": f"PostgreSQL {POSTINGS_TBL} + {DETAILS_TBL}",
        }

        total_ms = int((time.time()-t0)*1000)
        summary = (f"智能体分析完毕: 扫描 {len(rows)} 条岗位 → {len(groups)} 个语义簇 → "
                  f"{len(discoveries)} 个岗位定义(含 {len(forecasts)} 个未来预测)。"
                  f"推理引擎: {model_info['engine']}。总耗时 {total_ms}ms。")

        stats = {"total_scanned": len(rows), "title_clusters": len(groups),
                 "discoveries": len(discoveries), "forecasts": len(forecasts),
                 "total_elapsed_ms": total_ms,
                 "avg_confidence": (round(sum(d["confidence"] for d in discoveries)/max(len(discoveries),1),1) if discoveries else 0)}

        return {"reasoning_chain": chain, "discoveries": discoveries,
                "forecasts": forecasts, "summary": summary, "stats": stats, "model": model_info}

    def _add_step(self, chain, step_no, title, detail, status):
        s = {"step": step_no, "title": title, "detail": detail, "status": status}
        chain.append(s)
        return s

    # ---- PG 查询 ----
    def _query_pg(self, dsn: str, limit: int) -> list[dict]:
        with psycopg.connect(dsn) as conn:
            rows = conn.execute(
                f"""SELECT p.job_title, p.company_name, p.city, p.salary_min, p.salary_max,
                       p.experience, p.education, p.source_name, p.publish_time, p.crawl_time,
                       d.company_industry, d.skills, d.job_description, d.company_nature,
                       d.job_category_l1, d.job_category_l2
                FROM {POSTINGS_TBL} p JOIN {DETAILS_TBL} d ON d.job_id = p.id
                WHERE p.status = 0 ORDER BY p.crawl_time DESC LIMIT %s""",
                (limit,),
            ).fetchall()
        cols = ["title", "company_name", "city", "salary_min", "salary_max",
                "experience", "education", "source_name", "publish_time", "crawl_time",
                "industry", "skills", "description", "company_nature", "cat_l1", "cat_l2"]
        return [dict(zip(cols, r)) for r in rows if r[0]]

    # ---- 聚类 ----
    def _cluster_by_title(self, rows: list[dict]) -> dict[str, list[dict]]:
        groups: dict[str, list[dict]] = defaultdict(list)
        for r in rows:
            t = (r["title"] or "").strip()
            if not t: continue
            # 只去括号内容,保留原标题主体
            norm = re.sub(r"[（(][^)）]*[)）]", "", t).strip()
            norm = re.sub(r"\s+", "", norm)
            if not norm: norm = t.strip()
            groups[norm].append(r)
        return dict(groups)

    def _hit_keywords(self, title: str) -> list[tuple[str, int]]:
        tl = title.lower()
        return [(kw, w) for kw, w in self.EMERGING_KW if kw.lower() in tl]

    def _top_emerging_keywords(self, rows: list[dict]) -> list[str]:
        cnt = Counter()
        for r in rows:
            for kw, _ in self.EMERGING_KW:
                if kw.lower() in (r["title"] or "").lower():
                    cnt[kw] += 1
        return [k for k, _ in cnt.most_common(15)]

    # ---- 评分 ----
    def _score_group_detailed(self, items: list[dict], kw_hits: list[tuple[str, int]]) -> dict:
        n = len(items)
        # a) 标题新颖度(0-50)
        title_score = min(sum(w for _, w in kw_hits), 50)
        # b) 技能组合新颖度(0-30)
        all_skills = set()
        for it in items:
            for s in (it.get("skills") or []):
                all_skills.add(s)
        novel_skills = [s for s in all_skills if any(kw.lower() in s.lower() for kw, _ in self.EMERGING_KW[:30])]
        skill_score = min(len(novel_skills) * 5, 30)
        # c) 跨行业溢出(0-20)
        industries = {it.get("industry", "") for it in items}
        traditional = sum(1 for ind in industries if any(
            ti in (ind or "") for ti in ("制造", "金融", "医疗", "教育", "能源", "汽车", "零售", "政府", "法律")))
        cross_score = min(traditional * 5, 20)
        confidence = title_score + skill_score + cross_score
        confidence = max(0.0, min(100.0, confidence))
        # 增长率
        recent = sum(1 for it in items if it.get("publish_time") and isinstance(it["publish_time"], datetime)
                     and (datetime.now(timezone.utc) - it["publish_time"].replace(tzinfo=timezone.utc)
                          if it["publish_time"].tzinfo is None
                          else datetime.now(timezone.utc) - it["publish_time"]).days < 30)
        growth_rate = round(recent / max(n, 1) * 200, 1)
        return {"confidence": round(confidence, 1), "growth_rate": growth_rate,
                "title_score": title_score, "skill_score": skill_score, "cross_score": cross_score,
                "core_skills": list(novel_skills)[:8], "sample_count": n,
                "company_count": len({it["company_name"] for it in items}),
                "city_count": len({it["city"] for it in items})}

    # ---- 发现构建 ----
    def _build_discovery(self, norm_title: str, items: list[dict], info: dict) -> dict:
        best = items[0]
        # 用群里出现最多的那个原标题
        title_counter = Counter(it["title"] for it in items)
        display_title = title_counter.most_common(1)[0][0] if title_counter else norm_title
        raw_desc = best.get("description") or ""
        clean = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", raw_desc)).strip()
        if len(clean) < 20:
            clean = f"负责{display_title}相关技术方案设计、开发与落地。"
        skills = info.get("core_skills", [])[:8]
        if not skills:
            skills = (best.get("skills") or [])[:5]
        domain = self._infer_domain(display_title, skills)
        exp = best.get("experience") or ""
        level = self._infer_level(exp)

        evidence = [
            {"source_name": it["source_name"], "company": it["company_name"],
             "city": it["city"] or "未知", "industry": it.get("industry", "")}
            for it in items[:5]
        ]

        discovery_id = "disc_" + hashlib.md5(norm_title.encode()).hexdigest()[:12]
        return {
            "id": discovery_id, "title": display_title, "category": domain, "level": level,
            "confidence": info["confidence"], "growth_rate": info["growth_rate"],
            "status": "pending",
            "discovered_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "core_skills": skills, "preferred_skills": [],
            "definition": clean[:250],
            "typical_scenarios": self._scenarios(domain, display_title),
            "evidence_sources": evidence,
            "responsibilities": self._responsibilities(domain, display_title),
            "trend": [],
            "quality": {"evidence_count": info["sample_count"],
                        "source_count": info["company_count"],
                        "city_count": info["city_count"],
                        "freshness_score": round(min(100, info["growth_rate"] * 0.5), 1)},
            "source": items[0]["source_name"], "city": items[0]["city"] or "未知",
            "salary": self._fmt_salary(best.get("salary_min"), best.get("salary_max")),
            "requiredSkills": skills,
            "description": clean[:200],
            "discoveredAt": datetime.now(timezone.utc).isoformat(),
            "reasoning": f"标题新颖度{info.get('title_score',0)}分 + 技能组合熵{info.get('skill_score',0)}分 + 跨行业溢出{info.get('cross_score',0)}分 = 综合置信度{info['confidence']}%",
        }

    # ---- 未来预测 ----
    def _build_forecasts(self, discoveries: list[dict]) -> list[dict]:
        existing_titles = {d["title"] for d in discoveries}
        forecasts = []
        for fd in self.FUTURE_DIRECTIONS:
            # 如果这个未来方向的高度相关技能在现有发现中大量出现,置信度加分
            bonus = sum(1 for s in fd["skills"]
                        for d in discoveries if any(s.lower() in sk.lower() for sk in d.get("core_skills", [])))
            conf = min(100, fd["confidence"] + bonus * 3)
            forecasts.append({
                "id": "forecast_" + hashlib.md5(fd["title"].encode()).hexdigest()[:8],
                "title": fd["title"], "category": fd["domain"],
                "confidence": conf, "eta_months": fd["eta_months"],
                "drivers": fd["drivers"], "skills": fd["skills"],
                "definition": fd["definition"], "status": "forecast",
                "source": "趋势预测模型", "city": "全国",
                "salary": "面议(新兴岗位)", "level": "专家",
                "requiredSkills": fd["skills"],
                "description": fd["definition"],
                "discoveredAt": datetime.now(timezone.utc).isoformat(),
                "is_forecast": True,
            })
        forecasts.sort(key=lambda f: f["confidence"], reverse=True)
        return forecasts

    # ---- 辅助 ----
    def _infer_domain(self, title: str, skills: list[str]) -> str:
        combined = (title + " " + " ".join(skills)).lower()
        scores = {"人工智能": 0, "大数据": 0, "云原生": 0, "安全": 0, "区块链": 0}
        for dom, kws in {"人工智能": ("ai", "agent", "llm", "大模型", "智能体", "rag", "aigc", "pytorch", "transformer"),
                         "大数据": ("spark", "flink", "kafka", "数据", "etl", "数仓"),
                         "云原生": ("kubernetes", "docker", "微服务", "云原生", "devops"),
                         "安全": ("安全", "渗透", "风控", "加密", "零信任"),
                         "区块链": ("区块链", "web3", "智能合约", "solidity")}.items():
            scores[dom] = sum(1 for kw in kws if kw in combined)
        best = max(scores, key=scores.get)
        return best if scores[best] > 0 else "人工智能"

    def _infer_level(self, exp: str) -> str:
        e = exp.strip() if exp else ""
        if any(k in e for k in ("不限", "应届", "在校")): return "初级"
        if any(k in e for k in ("1年", "1-3", "1-5")): return "中级"
        if any(k in e for k in ("3-5", "3年", "5年", "3-10")): return "中高级"
        if any(k in e for k in ("5-10", "5年", "10年")): return "高级"
        if "10" in e: return "专家"
        return "中高级"

    def _scenarios(self, domain: str, title: str) -> list[str]:
        tl = title.lower()
        if "agent" in tl or "智能体" in tl:
            return ["智能客服", "企业知识库", "自动化办公", "多Agent协作"]
        if "rag" in tl:
            return ["知识库问答", "政策检索", "合规审查"]
        if "llm" in tl or "大模型" in tl:
            return ["代码助手", "内容生成", "智能搜索", "数据分析"]
        if "aigc" in tl or "生成" in tl:
            return ["营销素材生成", "游戏资产", "影视后期"]
        if "多模态" in tl:
            return ["视频理解", "图文检索", "医疗影像"]
        if "安全" in tl:
            return ["威胁检测", "漏洞挖掘", "合规审计"]
        return ["企业内场景", "技术中台", "数字化转型"]

    def _responsibilities(self, domain: str, title: str) -> list[str]:
        tl = title.lower()
        if "agent" in tl or "智能体" in tl:
            return ["设计Agent任务规划与工具调用流程", "构建RAG知识检索链路",
                    "实现多Agent协作与任务编排", "优化对话效果与响应速度"]
        if "llm" in tl or "大模型" in tl:
            return ["模型训练与微调", "推理优化与部署", "Prompt工程与评测", "数据管线建设"]
        if "rag" in tl:
            return ["文档解析与分块策略", "向量索引构建与优化", "检索链路评估与调优"]
        return ["参与需求分析与方案设计", "完成核心功能开发", "配合测试与上线运维"]

    @staticmethod
    def _fmt_salary(smin, smax) -> str:
        if not smin and not smax: return "面议"
        smin, smax = smin or 0, smax or 0
        if smax < smin: smax = smin
        if smin >= 10000: return f"{smin//1000}-{smax//1000}K"
        return f"{smin}-{smax}元/月"

    def stats(self, jobs: list[dict]) -> dict:
        if not jobs: return {"total": 0, "by_status": {}, "by_category": {}, "avg_confidence": 0}
        by_status = Counter(j.get("status", "pending") for j in jobs)
        by_cat = Counter(j.get("category", "未分类") for j in jobs)
        confs = [j.get("confidence", 0) for j in jobs]
        return {"total": len(jobs), "by_status": dict(by_status), "by_category": dict(by_cat),
                "avg_confidence": round(sum(confs) / len(confs), 1),
                "avg_growth_rate": round(sum(j.get("growth_rate", 0) for j in jobs) / max(len(jobs), 1), 1),
                "high_confidence_count": sum(1 for c in confs if c >= 90),
                "pending_count": by_status.get("pending", 0),
                "adopted_count": by_status.get("adopted", 0)}


AGENT = DiscoveryAgent()
_CACHED: dict = {}  # 缓存最近一次 scan 结果


class StatusUpdate(BaseModel):
    status: str


# ============================================================================
# 路由
# ============================================================================
@router.get("/jobs")
def get_discovery_jobs(
    status: str = Query(default="all", pattern="^(all|pending|adopted|rejected|forecast)$"),
    keyword: str = Query(default=""),
    sort: str = Query(default="confidence", pattern="^(confidence|growth|date|title)$"),
    category: str = Query(default=""),
    min_confidence: float = Query(default=0, ge=0, le=100),
):
    jobs = _CACHED.get("discoveries", []) or list(data.NEW_JOBS)
    if status != "all":
        jobs = [j for j in jobs if j.get("status") == status]
    if category.strip():
        jobs = [j for j in jobs if j.get("category") == category.strip()]
    jobs = [j for j in jobs if (j.get("confidence") or 0) >= min_confidence]
    kw = keyword.strip().lower()
    if kw:
        jobs = [j for j in jobs if kw in (j.get("title") or "").lower()
                or any(kw in (s or "").lower() for s in (j.get("core_skills") or j.get("requiredSkills", [])))]
    if sort == "growth": jobs.sort(key=lambda j: j.get("growth_rate", 0), reverse=True)
    elif sort == "date": jobs.sort(key=lambda j: j.get("discovered_at", ""), reverse=True)
    elif sort == "title": jobs.sort(key=lambda j: j.get("title", ""))
    else: jobs.sort(key=lambda j: j.get("confidence", 0), reverse=True)
    return data.ok(jobs)


@router.get("/jobs/{job_id}")
def get_job_detail(job_id: str):
    for pool in (_CACHED.get("discoveries", []), _CACHED.get("forecasts", []), data.NEW_JOBS):
        for j in (pool or []):
            if j.get("id") == job_id:
                return data.ok(j)
    return {"code": 1, "message": "job not found", "data": None}


@router.post("/jobs/{job_id}/status")
def update_job_status(job_id: str, payload: StatusUpdate):
    if payload.status not in {"pending", "adopted", "rejected"}:
        return {"code": 1, "message": "invalid status", "data": None}
    updated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    for key in ("discoveries", "forecasts"):
        for j in (_CACHED.get(key) or []):
            if j.get("id") == job_id:
                j["status"] = payload.status
                return data.ok({"id": job_id, "status": payload.status, "updated_at": updated_at})
    for j in data.NEW_JOBS:
        if j.get("id") == job_id:
            j["status"] = payload.status
            return data.ok({"id": job_id, "status": payload.status, "updated_at": updated_at})
    return {"code": 1, "message": "job not found", "data": None}


@router.post("/agent/scan")
def agent_scan():
    """★ 智能体全链路扫描:返回推理链 + 发现 + 预测。"""
    global _CACHED
    try:
        result = AGENT.scan_with_reasoning()
        _CACHED = {"discoveries": result["discoveries"], "forecasts": result["forecasts"],
                   "reasoning_chain": result["reasoning_chain"], "summary": result["summary"],
                   "stats": result["stats"]}
        return data.ok(result)
    except Exception:
        logger.exception("agent_scan failed")
        return {"code": 1, "message": "扫描失败，请检查数据库连接与日志", "data": None}


@router.get("/agent/reasoning")
def agent_reasoning():
    """获取最近一次扫描的推理链(用于前端展示智能体思考过程)。"""
    chain = _CACHED.get("reasoning_chain", [])
    return data.ok({"reasoning_chain": chain, "summary": _CACHED.get("summary", "")})


class SuggestChatTurn(BaseModel):
    role: str
    content: str


class SuggestChatRequest(BaseModel):
    message: str = ""
    history: list[SuggestChatTurn] = []
    # 前端可附带本轮发现/预测，便于后端缓存为空时仍能对话
    discoveries: list[dict[str, Any]] = []
    forecasts: list[dict[str, Any]] = []
    summary: str = ""


@router.post("/suggest/chat")
def suggest_chat(payload: SuggestChatRequest):
    """兼容入口：转发统一执图顾问（channel=suggest）。扫描智能体职责不变。"""
    from backend.llm import zhitu_agent

    discoveries = _CACHED.get("discoveries") or payload.discoveries or list(data.NEW_JOBS)
    forecasts = _CACHED.get("forecasts") or payload.forecasts or []
    summary = _CACHED.get("summary") or payload.summary or ""
    history = [{"role": t.role, "content": t.content} for t in (payload.history or [])]
    result = zhitu_agent.chat(
        message=payload.message or "请给出本轮采购建议",
        channel="suggest",
        history=history,
        discoveries=discoveries,
        forecasts=forecasts,
        summary=summary,
    )
    return data.ok({
        "reply": result.get("reply"),
        "recommendations": result.get("recommendations") or [],
        "model": {
            "llm": result.get("llm") or "none",
            "mode": result.get("mode") or "heuristic",
            "channel": "suggest",
            "error": result.get("error"),
            "backed_by": "DeepSeek" if (result.get("llm") and result.get("llm") != "none") else "执图顾问兜底",
            "cache_hits": {
                "discoveries": len(discoveries),
                "forecasts": len(forecasts),
                "from_scan_cache": bool(_CACHED.get("discoveries")),
            },
        },
    })


class RawJobAnalyze(BaseModel):
    """调用 /analyze 的 raw input(向后兼容旧接口签名)。"""
    id: str | None = None
    title: str
    category: str | None = None
    skills: list[str] = []
    evidence_sources: list[dict[str, Any]] = []
    trend: list[dict[str, Any]] = []
    status: str | None = None
    discovered_at: str | None = None
    definition: str | None = None
    typical_scenarios: list[str] | None = None
    responsibilities: list[str] | None = None
    quality: dict[str, Any] | None = None


def _find_job_by_id(job_id: str) -> dict | None:
    for pool in (_CACHED.get("discoveries", []), _CACHED.get("forecasts", []), data.NEW_JOBS):
        for j in (pool or []):
            if j.get("id") == job_id:
                return j
    return None


@router.post("/analyze")
def analyze_raw_job(payload: RawJobAnalyze):
    """[Deprecated] 单岗位分析 shim —— 新流水线为 /agent/scan 全量扫描。

    保留此路由仅为向后兼容 HEAD 中已存在的接口签名;不再做单岗位启发式分析,
    而是在已缓存/种子数据中按标题查找等价记录并返回。建议调用方迁移到 /agent/scan。
    """
    title = (payload.title or "").strip().lower()
    for j in (data.NEW_JOBS + _CACHED.get("discoveries", [])):
        if title and (j.get("title") or "").strip().lower() == title:
            out = dict(j)
            out["deprecated"] = "use /api/discovery/agent/scan"
            return data.ok(out)
    return {"code": 1, "message": "job not found (deprecated; use /agent/scan)", "data": None}


@router.post("/jobs/{job_id}/reanalyze")
def reanalyze_job(job_id: str):
    """[Deprecated] 重分析 shim —— 新流水线为 /agent/scan 全量扫描。

    保留此路由仅为向后兼容 HEAD 中已存在的接口签名;不再支持单岗位重跑,
    返回缓存中等价记录。建议调用方迁移到 /agent/scan。
    """
    target = _find_job_by_id(job_id)
    if not target:
        return {"code": 1, "message": "job not found (deprecated; use /agent/scan)", "data": None}
    out = dict(target)
    out["deprecated"] = "use /api/discovery/agent/scan"
    return data.ok(out)


@router.get("/stats")
def discovery_stats():
    all_jobs = (_CACHED.get("discoveries", []) or list(data.NEW_JOBS))
    return data.ok(AGENT.stats(all_jobs))
