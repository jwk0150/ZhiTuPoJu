from __future__ import annotations

import html
import io
import json
import logging
import math
import re
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

from backend import data
from backend.llm import deepseek


MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_TEXT_CHARS = 50_000
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt"}

SKILL_ALIASES = {
    "fast api": "FastAPI",
    "fastapi": "FastAPI",
    "springboot": "Spring Boot",
    "spring boot": "Spring Boot",
    "k8s": "Kubernetes",
    "function call": "Function Calling",
    "function calling": "Function Calling",
    "函数调用": "Function Calling",
    "multi-agent": "多智能体协作",
    "multi agent": "多智能体协作",
    "agent": "Agent",
    "pytorch": "PyTorch",
    "mysql": "MySQL",
    "redis": "Redis",
    "langchain": "LangChain",
    "rag": "RAG",
    "nlp": "NLP",
    "llm": "LLM",
}

SKILL_RELATIONS: dict[str, list[tuple[str, str, float]]] = {
    "Python": [
        ("FastAPI", "语言到工程框架", 0.78),
        ("RAG", "语言到应用能力", 0.64),
        ("LangChain", "语言到编排框架", 0.62),
    ],
    "NLP": [("RAG", "语义检索基础", 0.72), ("Transformer", "模型原理基础", 0.72)],
    "PyTorch": [("Transformer", "深度学习框架基础", 0.76), ("RAG", "模型应用基础", 0.48)],
    "深度学习": [("Transformer", "理论基础", 0.74)],
    "Java": [("Spring Boot", "语言到工程框架", 0.86)],
    "Spring Boot": [("微服务", "服务治理基础", 0.72), ("RAG", "业务集成基础", 0.38)],
    "Linux": [("Docker", "系统运维基础", 0.62), ("Kubernetes", "系统基础", 0.42)],
    "Docker": [("Kubernetes", "容器编排前置", 0.82)],
    "Prompt工程": [("RAG", "生成质量基础", 0.66), ("Agent", "智能体交互基础", 0.61)],
    "向量检索": [("向量数据库", "检索工程基础", 0.84), ("RAG", "检索链路基础", 0.88)],
    "BERT": [("Transformer", "架构同源", 0.86), ("NLP", "领域实践", 0.82)],
}

RESOURCE_MAP = {
    "RAG": ("RAG检索增强实战", "构建文档切分、向量召回、重排与答案评测闭环", 3, "项目实战"),
    "LangChain": ("LangChain编排与评测", "完成检索链、工具调用和回归评测", 2, "官方文档 + 实验"),
    "Function Calling": ("工具调用工程化", "掌握Schema设计、异常重试和工具结果校验", 2, "专题实训"),
    "多智能体协作": ("多智能体工作流", "实现角色分工、状态管理与终止条件", 3, "综合项目"),
    "FastAPI": ("FastAPI服务化", "将模型能力封装为可测试、可观测的API", 2, "工程项目"),
    "向量数据库": ("向量检索系统", "掌握索引、召回、过滤与性能评估", 2, "实验课程"),
    "Transformer": ("Transformer核心原理", "补齐注意力机制、编码器与微调实践", 3, "理论 + 代码复现"),
    "Kubernetes": ("Kubernetes部署基础", "完成容器编排、服务发布与观测", 3, "云原生实验"),
    "Spring Boot": ("Spring Boot工程实践", "完成接口、数据层与服务治理项目", 2, "项目实战"),
    "MySQL": ("MySQL性能优化", "掌握索引、执行计划和事务诊断", 2, "数据库实验"),
    "Redis": ("Redis高可用实践", "掌握缓存策略、持久化与一致性", 2, "项目实战"),
}


class _HTMLTextExtractor(HTMLParser):
    BLOCKS = {"p", "div", "h1", "h2", "h3", "li", "tr", "td", "th", "br", "table", "section"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in self.BLOCKS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in self.BLOCKS:
            self.parts.append("\n")

    def handle_data(self, data_: str) -> None:
        if data_.strip():
            self.parts.append(data_)

    def text(self) -> str:
        value = html.unescape("".join(self.parts))
        value = re.sub(r"[\t\xa0]+", " ", value)
        value = re.sub(r" *\n *", "\n", value)
        value = re.sub(r"\n{3,}", "\n\n", value)
        return value.strip()


def _decode_bytes(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "gb18030", "utf-16"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="ignore")


def _extract_html_text(content: bytes) -> str:
    parser = _HTMLTextExtractor()
    parser.feed(_decode_bytes(content))
    return parser.text()


def _extract_docx(content: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            xml = archive.read("word/document.xml")
    except (zipfile.BadZipFile, KeyError) as exc:
        raise ValueError("DOCX文件结构无效或已损坏") from exc
    root = ElementTree.fromstring(xml)
    paragraphs: list[str] = []
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    for paragraph in root.iter(namespace + "p"):
        runs = [node.text or "" for node in paragraph.iter(namespace + "t")]
        text = "".join(runs).strip()
        if text:
            paragraphs.append(text)
    return "\n".join(paragraphs)


def _extract_pdf(content: bytes) -> tuple[str, int]:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise ValueError("服务器尚未安装PDF解析组件 pypdf") from exc
    try:
        reader = PdfReader(io.BytesIO(content))
        pages = [(page.extract_text() or "").strip() for page in reader.pages]
    except Exception as exc:
        raise ValueError("PDF解析失败，请确认文件未加密且包含可提取文本") from exc
    text = "\n\n".join(page for page in pages if page)
    if len(text.strip()) < 30:
        raise ValueError("该PDF可能是扫描件，当前演示服务未检测到文本层，请先进行OCR")
    return text, len(reader.pages)


def extract_document(filename: str, content: bytes) -> dict[str, Any]:
    extension = Path(filename or "resume").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("仅支持 PDF、DOC、DOCX、TXT 简历")
    if not content:
        raise ValueError("上传文件为空")
    if len(content) > MAX_FILE_BYTES:
        raise ValueError("简历文件不能超过8MB")

    pages = 1
    if extension == ".pdf":
        text, pages = _extract_pdf(content)
    elif extension == ".docx":
        text = _extract_docx(content)
    elif extension == ".doc":
        head = content[:256].lstrip().lower()
        if head.startswith(b"<html") or b"<html" in head:
            text = _extract_html_text(content)
        else:
            raise ValueError("暂不支持二进制旧版DOC，请另存为DOCX后上传")
    else:
        text = _decode_bytes(content)

    text = re.sub(r"\n{3,}", "\n\n", text).strip()[:MAX_TEXT_CHARS]
    if len(text) < 30:
        raise ValueError("未能从简历中提取到足够文本")
    return {
        "text": text,
        "characters": len(text),
        "pages": pages,
        "extension": extension.lstrip(".").upper(),
    }


def _json_from_text(value: str) -> dict[str, Any]:
    text = (value or "").strip()
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return {}
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}


def canonical_skill(value: str) -> str:
    clean = re.sub(r"\s+", " ", str(value or "").strip())
    if not clean:
        return ""
    return SKILL_ALIASES.get(clean.lower(), clean)


def _skill_name(value: Any) -> str:
    """Return a skill name from either the normal object form or a string."""
    if isinstance(value, dict):
        return str(value.get("name") or "")
    return str(value or "")


def _known_skills() -> list[str]:
    values: set[str] = set()
    for job in data.JOBS:
        values.update(job.get("required_skills") or [])
        values.update(job.get("preferred_skills") or [])
    values.update(SKILL_RELATIONS)
    for relations in SKILL_RELATIONS.values():
        values.update(target for target, _, _ in relations)
    values.update({"Python", "Java", "PyTorch", "TensorFlow", "NLP", "SQL", "Git", "Linux", "CUDA", "BERT", "Docker", "机器学习", "深度学习", "向量检索", "微服务", "LLM", "Agent"})
    return sorted(values, key=len, reverse=True)


def _heuristic_profile(text: str, filename: str) -> dict[str, Any]:
    lines = [line.strip(" ·|：:") for line in text.splitlines() if line.strip()]
    name = "候选人"
    for line in lines[:8]:
        if 2 <= len(line) <= 12 and not any(key in line for key in ("简历", "个人", "电话", "邮箱")):
            name = line
            break

    experience_match = re.search(r"(?:工作年限|工作经验|从业)[：:\s]*(\d+(?:\.\d+)?)\s*年", text)
    experience = float(experience_match.group(1)) if experience_match else 0.0
    city_match = re.search(r"(?:城市|所在地|现居地)[：:\s]*([\u4e00-\u9fff]{2,8})", text)
    education_match = re.search(r"(博士|硕士|本科|大专|专科)", text)
    target_match = re.search(r"求职意向\s*\n?([^\n]{2,80})", text)

    skills: list[dict[str, Any]] = []
    lowered = text.lower()
    for skill in _known_skills():
        if skill.lower() in lowered:
            skills.append({
                "name": canonical_skill(skill),
                "level": "熟悉",
                "evidence": f"简历原文出现“{skill}”",
                "confidence": 0.86,
            })
    deduped: dict[str, dict[str, Any]] = {item["name"]: item for item in skills}

    project_lines = [
        line.lstrip("•·- ")[:160]
        for line in lines
        if any(word in line for word in ("项目", "负责", "主导", "实现", "开发", "构建")) and len(line) >= 10
    ][:5]

    return {
        "name": name,
        "target_role": target_match.group(1).strip() if target_match else "",
        "city": city_match.group(1) if city_match else "",
        "education": education_match.group(1) if education_match else "未识别",
        "experience_years": experience,
        "summary": "；".join(project_lines[:2])[:220] or "已完成基础字段与技能识别",
        "skills": list(deduped.values()),
        "projects": project_lines,
        "confidence": 0.86,
        "source": "local-fallback",
        "filename": filename,
    }


def parse_resume(text: str, filename: str) -> tuple[dict[str, Any], dict[str, Any]]:
    system = """你是严谨的中文简历结构化解析器。只依据原文抽取，不得补写经历。
严格输出一个JSON对象，字段如下：
{"name":"","target_role":"","city":"","education":"","experience_years":0,
"summary":"不超过100字","skills":[{"name":"","level":"了解|熟悉|熟练|精通|未说明","evidence":"原文短证据","confidence":0.0}],
"projects":["项目或关键成果"],"confidence":0.0}
技能名称使用行业标准写法；无法确定填空字符串或0；confidence范围0到1。"""
    content, meta = deepseek.chat_completions(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": f"文件名：{filename}\n\n简历原文：\n{text[:24000]}"},
        ],
        temperature=0.1,
        timeout=60.0,
    )
    parsed = _json_from_text(content) if content else {}
    if not parsed or not isinstance(parsed.get("skills"), list):
        profile = _heuristic_profile(text, filename)
        return profile, meta

    normalized_skills: dict[str, dict[str, Any]] = {}
    for raw in parsed.get("skills") or []:
        if not isinstance(raw, dict):
            continue
        name = canonical_skill(raw.get("name", ""))
        if not name:
            continue
        confidence = raw.get("confidence", 0.8)
        try:
            confidence = max(0.0, min(1.0, float(confidence)))
        except (TypeError, ValueError):
            confidence = 0.8
        normalized_skills[name] = {
            "name": name,
            "level": str(raw.get("level") or "未说明")[:12],
            "evidence": str(raw.get("evidence") or "")[:120],
            "confidence": round(confidence, 2),
        }
    try:
        exp = max(0.0, min(50.0, float(parsed.get("experience_years") or 0)))
    except (TypeError, ValueError):
        exp = 0.0
    try:
        confidence = max(0.0, min(1.0, float(parsed.get("confidence") or 0.9)))
    except (TypeError, ValueError):
        confidence = 0.9

    profile = {
        "name": str(parsed.get("name") or Path(filename).stem or "候选人")[:30],
        "target_role": str(parsed.get("target_role") or "")[:100],
        "city": str(parsed.get("city") or "")[:30],
        "education": str(parsed.get("education") or "未识别")[:60],
        "experience_years": exp,
        "summary": str(parsed.get("summary") or "")[:240],
        "skills": list(normalized_skills.values())[:40],
        "projects": [str(item)[:180] for item in (parsed.get("projects") or []) if str(item).strip()][:8],
        "confidence": round(confidence, 2),
        "source": "deepseek",
        "filename": filename,
    }
    return profile, meta


def _score_value(value: Any, default: float) -> float:
    try:
        return round(max(0.0, min(100.0, float(value))), 1)
    except (TypeError, ValueError):
        return float(default)


def _semantic_review(profile: dict[str, Any], jobs: list[dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    compact_jobs = [
        {
            "id": job["id"],
            "title": job["title"],
            "description": job.get("description", ""),
            "required_skills": job.get("required_skills", []),
        }
        for job in jobs
    ]
    compact_profile = {
        "target_role": profile.get("target_role"),
        "experience_years": profile.get("experience_years"),
        "summary": profile.get("summary"),
        "skills": [_skill_name(item) for item in profile.get("skills", [])],
        "projects": profile.get("projects", []),
    }
    system = """你是人岗语义审查器。不得仅按关键词判断，也不得编造候选人经历。
对每个岗位判断项目职责语义契合度和可迁移能力。严格输出JSON：
{"items":[{"job_id":"","semantic_score":0,"project_score":0,
"transferable_skills":[{"from":"候选人已有技能","to":"岗位技能","reason":"","confidence":0.0}],
"reason":"不超过60字"}]}
两个score范围0到100；迁移关系必须能从候选人已有技能或项目证据推出。"""
    content, meta = deepseek.chat_completions(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps({"candidate": compact_profile, "jobs": compact_jobs}, ensure_ascii=False)},
        ],
        temperature=0.1,
        timeout=60.0,
    )
    payload = _json_from_text(content) if content else {}
    allowed_job_ids = {str(job["id"]) for job in jobs}
    candidate_skills = {canonical_skill(_skill_name(item)) for item in profile.get("skills", [])}
    reviews: dict[str, dict[str, Any]] = {}
    for item in payload.get("items", []) if isinstance(payload.get("items"), list) else []:
        if not isinstance(item, dict):
            continue
        raw_id = item.get("job_id")
        if raw_id is None or str(raw_id) not in allowed_job_ids:
            continue
        transfers = []
        for transfer in item.get("transferable_skills", []) if isinstance(item.get("transferable_skills"), list) else []:
            if not isinstance(transfer, dict):
                continue
            from_skill = canonical_skill(transfer.get("from", ""))
            to_skill = canonical_skill(transfer.get("to", ""))
            if from_skill not in candidate_skills or not to_skill:
                continue
            try:
                confidence = max(0.0, min(1.0, float(transfer.get("confidence") or 0.5)))
            except (TypeError, ValueError):
                confidence = 0.5
            transfers.append({
                "from": from_skill,
                "to": to_skill,
                "reason": str(transfer.get("reason") or "语义能力迁移")[:80],
                "confidence": round(confidence, 2),
            })
        review_body = {
            "semantic_score": _score_value(item.get("semantic_score"), 55),
            "project_score": _score_value(item.get("project_score"), 50),
            "transferable_skills": transfers,
            "reason": str(item.get("reason") or "")[:100],
        }
        reviews[str(raw_id)] = review_body
        reviews[raw_id] = review_body
        try:
            reviews[int(raw_id)] = review_body
        except (TypeError, ValueError):
            pass
    return reviews, meta


def _relation_transfer(candidate_skills: set[str], requirement: str) -> dict[str, Any] | None:
    best: dict[str, Any] | None = None
    for source in candidate_skills:
        for target, relation, confidence in SKILL_RELATIONS.get(source, []):
            if canonical_skill(target) != canonical_skill(requirement):
                continue
            candidate = {"from": source, "to": requirement, "reason": relation, "confidence": confidence}
            if best is None or candidate["confidence"] > best["confidence"]:
                best = candidate
    return best


def _fallback_semantic(profile: dict[str, Any], job: dict[str, Any]) -> tuple[float, float]:
    corpus = " ".join([
        str(profile.get("target_role") or ""),
        str(profile.get("summary") or ""),
        " ".join(profile.get("projects") or []),
    ]).lower()
    title_parts = [part for part in re.split(r"[\s/·（）()]+", job.get("title", "")) if len(part) >= 2]
    description_parts = [part for part in re.split(r"[，。；、\s]+", job.get("description", "")) if len(part) >= 2]
    hits = sum(1 for part in title_parts + description_parts if part.lower() in corpus)
    semantic = min(88, 48 + hits * 8)
    project = min(86, 45 + sum(1 for p in profile.get("projects", []) if any(k in p for k in ("负责", "开发", "构建", "优化"))) * 6)
    return float(semantic), float(project)


def score_matches(
    profile: dict[str, Any],
    reviews: dict[str, dict[str, Any]],
    jobs: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """五维匹配评分。

    jobs：候选岗位列表（Phase 03 起支持真实岗位；缺省回退 data.JOBS Mock）。
    评分算法保持原样，不重写。
    """
    candidate_skills = {canonical_skill(_skill_name(item)) for item in profile.get("skills", [])}
    candidate_skills.discard("")
    results: list[dict[str, Any]] = []

    for job in (jobs if jobs is not None else data.JOBS):
        required = [canonical_skill(skill) for skill in job.get("required_skills", [])]
        preferred = [canonical_skill(skill) for skill in job.get("preferred_skills", [])]
        matched = [skill for skill in required if skill in candidate_skills]
        missing = [skill for skill in required if skill not in candidate_skills]
        review = reviews.get(job["id"]) or reviews.get(str(job["id"]), {}) or {}

        transfers_by_target: dict[str, dict[str, Any]] = {}
        for target in missing:
            local_transfer = _relation_transfer(candidate_skills, target)
            if local_transfer:
                transfers_by_target[target] = local_transfer
        for transfer in review.get("transferable_skills", []):
            target = canonical_skill(transfer.get("to", ""))
            if target not in missing:
                continue
            current = transfers_by_target.get(target)
            if current is None or transfer.get("confidence", 0) > current.get("confidence", 0):
                transfers_by_target[target] = transfer

        direct_value = len(matched)
        transfer_value = sum(min(0.65, item.get("confidence", 0) * 0.65) for item in transfers_by_target.values())
        skill_score = 100 * (direct_value + transfer_value) / max(1, len(required))
        preferred_hits = sum(1 for skill in preferred if skill in candidate_skills)
        skill_score = min(100, skill_score + preferred_hits * 2.5)

        if review:
            semantic_score = _score_value(review.get("semantic_score"), 55)
            project_score = _score_value(review.get("project_score"), 50)
        else:
            semantic_score, project_score = _fallback_semantic(profile, job)

        graph_score = 35.0
        if transfers_by_target:
            graph_score = min(100, 45 + 55 * sum(item["confidence"] for item in transfers_by_target.values()) / max(1, len(missing)))
        elif matched:
            graph_score = min(82, 48 + len(matched) * 7)

        experience_years = float(profile.get("experience_years") or 0)
        experience_score = min(100, 58 + experience_years * 7) if experience_years else 55
        total = (
            skill_score * 0.42
            + semantic_score * 0.24
            + project_score * 0.14
            + experience_score * 0.10
            + graph_score * 0.10
        )
        if not matched and not transfers_by_target:
            total -= 8
        total = round(max(0, min(98, total)), 1)

        gaps = []
        gap_paths = []
        for index, skill in enumerate(missing):
            transfer = transfers_by_target.get(skill)
            readiness = round((transfer.get("confidence", 0) if transfer else 0.12) * 100)
            gaps.append({
                "id": f"{job['id']}_gap_{index + 1}",
                "skill": skill,
                "readiness": readiness,
                "severity": "high" if readiness < 40 else "medium",
                "reason": transfer.get("reason") if transfer else "岗位必备技能，简历中暂无直接证据",
            })
            if transfer:
                gap_paths.append({
                    "from": transfer["from"],
                    "to": skill,
                    "relation": transfer["reason"],
                    "confidence": round(transfer["confidence"] * 100),
                })

        results.append({
            "job": {**job, "requiredSkills": required, "preferredSkills": preferred},
            "score": total,
            "dimensions": {
                "skills": round(skill_score, 1),
                "semantics": round(semantic_score, 1),
                "projects": round(project_score, 1),
                "experience": round(experience_score, 1),
                "graph": round(graph_score, 1),
            },
            "matched": matched,
            "missing": missing,
            "transferable": list(transfers_by_target.values()),
            "gaps": gaps,
            "gap_paths": gap_paths,
            "reason": review.get("reason") or ("核心技能覆盖较好" if len(matched) >= len(required) / 2 else "具备部分可迁移能力，仍需补齐岗位核心要求"),
        })
    return sorted(results, key=lambda item: item["score"], reverse=True)


def build_learning_path(best_match: dict[str, Any]) -> list[dict[str, Any]]:
    gaps = sorted(best_match.get("gaps", []), key=lambda item: (item["severity"] != "high", item["readiness"]))
    steps: list[dict[str, Any]] = []
    week_cursor = 1
    for index, gap in enumerate(gaps[:4], 1):
        skill = gap["skill"]
        title, description, weeks, resource = RESOURCE_MAP.get(
            skill,
            (f"{skill}能力补齐", f"通过知识学习与小型项目建立{skill}的可验证能力证据", 2, "知识图谱精选资源"),
        )
        end_week = week_cursor + weeks - 1
        steps.append({
            "step": index,
            "skill": skill,
            "title": title,
            "description": description,
            "weeks": weeks,
            "schedule": f"第{week_cursor}-{end_week}周" if weeks > 1 else f"第{week_cursor}周",
            "resource": resource,
            "deliverable": f"完成1个可展示的{skill}实践成果",
            "impact": min(12, 4 + math.ceil((100 - gap["readiness"]) / 12)),
        })
        week_cursor = end_week + 1
    if not steps:
        steps.append({
            "step": 1,
            "skill": "综合实战",
            "title": "目标岗位综合项目",
            "description": "将现有能力组合成一个可演示、可量化、可复盘的完整项目",
            "weeks": 2,
            "schedule": "第1-2周",
            "resource": "综合项目",
            "deliverable": "项目仓库、技术说明与评测报告",
            "impact": 5,
        })
    return steps


def build_gap_graph(profile: dict[str, Any], best_match: dict[str, Any]) -> dict[str, Any]:
    nodes: list[dict[str, Any]] = [{"id": "candidate", "label": profile.get("name") or "候选人", "type": "candidate", "status": "candidate"}]
    edges: list[dict[str, Any]] = []
    existing: set[str] = {"candidate"}
    for skill in best_match.get("matched", [])[:7]:
        node_id = "skill_" + re.sub(r"\W+", "_", skill.lower())
        if node_id not in existing:
            nodes.append({"id": node_id, "label": skill, "type": "skill", "status": "matched"})
            existing.add(node_id)
        edges.append({"source": "candidate", "target": node_id, "label": "已掌握"})
    for path in best_match.get("gap_paths", []):
        source_id = "skill_" + re.sub(r"\W+", "_", path["from"].lower())
        target_id = "skill_" + re.sub(r"\W+", "_", path["to"].lower())
        if source_id not in existing:
            nodes.append({"id": source_id, "label": path["from"], "type": "skill", "status": "matched"})
            edges.append({"source": "candidate", "target": source_id, "label": "已有基础"})
            existing.add(source_id)
        if target_id not in existing:
            nodes.append({"id": target_id, "label": path["to"], "type": "skill", "status": "bridge"})
            existing.add(target_id)
        edges.append({"source": source_id, "target": target_id, "label": path["relation"]})
    for gap in best_match.get("gaps", [])[:6]:
        target_id = "skill_" + re.sub(r"\W+", "_", gap["skill"].lower())
        if target_id not in existing:
            nodes.append({"id": target_id, "label": gap["skill"], "type": "skill", "status": "missing"})
            existing.add(target_id)
    nodes.append({"id": "target_job", "label": best_match["job"]["title"], "type": "job", "status": "target"})
    for gap in best_match.get("gaps", [])[:6]:
        target_id = "skill_" + re.sub(r"\W+", "_", gap["skill"].lower())
        edges.append({"source": target_id, "target": "target_job", "label": "岗位要求"})
    for skill in best_match.get("matched", [])[:5]:
        source_id = "skill_" + re.sub(r"\W+", "_", skill.lower())
        edges.append({"source": source_id, "target": "target_job", "label": "直接匹配"})
    return {"nodes": nodes, "edges": edges}
def generate_perfect_resume(target_job: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    """AI-generated ideal resume profile for the target position as benchmark."""
    system = """你是资深HR与岗位建模专家。基于目标岗位要求，推演该岗位"完美候选人"的画像，不得虚构具体人名。
严格输出JSON对象：
{"ideal_skills":[{"name":"","level":"精通|熟练|熟悉","why":"该技能为何关键"}],
"ideal_summary":"不超过120字的完美个人简介",
"ideal_experience_years":0,
"ideal_education":"建议学历",
"ideal_projects":["该岗位理想的3个相关项目或成果"],
"key_differentiators":["完美候选人相比普通候选人的3个核心优势"],
"market_benchmark":"该岗位市场顶薪/头部候选人画像概述（不超过60字）"}"""
    job_text = json.dumps({
        "title": target_job.get("title", ""),
        "description": target_job.get("description", ""),
        "required_skills": target_job.get("required_skills", []),
        "preferred_skills": target_job.get("preferred_skills", []),
        "company": target_job.get("company", ""),
    }, ensure_ascii=False)
    content, _meta = deepseek.chat_completions(
        [{"role": "system", "content": system},
         {"role": "user", "content": f"目标岗位：\n{job_text}\n\n候选人当前画像（仅供参考）：\n{json.dumps({'target_role': profile.get('target_role'), 'experience_years': profile.get('experience_years'), 'skills': [_skill_name(s) for s in profile.get('skills', [])]}, ensure_ascii=False)}"}],
        temperature=0.2, timeout=45.0
    )
    parsed = _json_from_text(content) if content else {}
    if not parsed or not parsed.get("ideal_skills"):
        # Fallback heuristic
        required = target_job.get("required_skills", [])
        preferred = target_job.get("preferred_skills", [])
        all_skills = required + preferred
        return {
            "ideal_skills": [{"name": s, "level": "熟练", "why": "岗位核心要求"} for s in all_skills[:10]],
            "ideal_summary": f"具备{target_job.get('title', '该岗位')}所需的完整技能栈与项目经验，深耕领域多年",
            "ideal_experience_years": max(1, int(float(profile.get("experience_years") or 0)) + 2),
            "ideal_education": profile.get("education") or "本科及以上",
            "ideal_projects": [f"{all_skills[0] if all_skills else '核心能力'}深度实践项目", "团队协作与交付经验", "技术方案设计与落地"],
            "key_differentiators": ["技能覆盖全面", "项目经验深度匹配", "行业理解力强"],
            "market_benchmark": f"{target_job.get('title', '')}领域头部候选人通常具备全栈技术能力与业务洞察力",
            "source": "local-fallback",
        }
    parsed["source"] = "deepseek"
    return parsed


def compare_with_perfect(profile: dict[str, Any], perfect: dict[str, Any], target_job: dict[str, Any]) -> dict[str, Any]:
    """Compare user resume against the AI-generated perfect resume benchmark."""
    user_skills_raw = {canonical_skill(_skill_name(s)) for s in profile.get("skills", [])}
    user_skills_raw.discard("")
    ideal_skills_raw = {canonical_skill(_skill_name(s)) for s in perfect.get("ideal_skills", [])}
    ideal_skills_raw.discard("")

    matched_skills = user_skills_raw & ideal_skills_raw
    missing_skills = ideal_skills_raw - user_skills_raw

    # Dimension scores
    skill_coverage = round(len(matched_skills) / max(1, len(ideal_skills_raw)) * 100, 1)
    experience_gap = max(0, int(perfect.get("ideal_experience_years", 0)) - int(float(profile.get("experience_years") or 0)))
    experience_score = max(10, 100 - experience_gap * 15)

    # Compare summaries semantically via keyword overlap
    user_text = (profile.get("summary") or "") + " " + " ".join(profile.get("projects") or [])
    ideal_text = (perfect.get("ideal_summary") or "") + " "
    if not user_text.strip():
        summary_score = 30.0
    else:
        user_words = set(user_text.lower().split())
        ideal_words = set(ideal_text.lower().split())
        common = user_words & ideal_words
        summary_score = round(min(95, 30 + len(common) / max(1, len(ideal_words)) * 65), 1)

    education_match = 85.0 if profile.get("education") and profile.get("education") not in ("未识别", "") else 60.0

    competitiveness = round(
        skill_coverage * 0.45 + experience_score * 0.15 + summary_score * 0.20 + education_match * 0.10
        + (10 if len(matched_skills) >= len(ideal_skills_raw) / 2 else 0), 1)

    strengths = list(matched_skills) if matched_skills else ["具备基础学习能力"]
    weakness_list = list(missing_skills) if missing_skills else ["建议强化岗位核心技能"]

    skill_comparison = []
    for ideal in perfect.get("ideal_skills", [])[:12]:
        name = canonical_skill(_skill_name(ideal))
        if not name:
            continue
        user_level = "未掌握"
        for us in profile.get("skills", []):
            if canonical_skill(_skill_name(us)) == name:
                user_level = us.get("level", "了解") if isinstance(us, dict) else "了解"
                break
        skill_comparison.append({
            "skill": name,
            "ideal_level": ideal.get("level", "熟练") if isinstance(ideal, dict) else "熟练",
            "user_level": user_level,
            "gap": "matched" if name in matched_skills else "missing",
            "why_important": ideal.get("why", "岗位核心要求") if isinstance(ideal, dict) else "岗位核心要求",
        })

    # Improvement suggestions
    suggestions = []
    missing_list = list(missing_skills)
    matched_list = list(matched_skills)
    for skill in missing_list[:5]:
        suggestions.append({
            "skill": skill,
            "priority": "high" if len(missing_list) <= 3 else "medium",
            "action": f"通过系统学习和项目实践掌握{skill}",
            "effort_weeks": 3 if len(missing_list) > 3 else 2,
        })
    for i, skill in enumerate(matched_list):
        if i >= 3: break
        suggestions.append({
            "skill": skill,
            "priority": "low",
            "action": f"深化{skill}的实战应用，积累可量化的项目成果",
            "effort_weeks": 1,
        })

    return {
        "competitiveness": round(min(98, competitiveness), 1),
        "dimension_scores": {
            "skill_coverage": skill_coverage,
            "experience_match": experience_score,
            "summary_quality": summary_score,
            "education_match": education_match,
        },
        "strengths": [s for i, s in enumerate(strengths) if i < 8],
        "weaknesses": [w for i, w in enumerate(weakness_list) if i < 8],
        "skill_comparison": skill_comparison[:15],
        "improvement_suggestions": suggestions[:8],
    }


def analyze_job_requirement(target_job: dict[str, Any]) -> dict[str, Any]:
    """Deep analysis of a job position's requirements."""
    required = target_job.get("required_skills", [])
    preferred = target_job.get("preferred_skills", [])
    title = target_job.get("title", "")
    description = target_job.get("description", "")

    system = """你是资深职业规划顾问。基于岗位信息，输出结构化JSON：
{"job_summary":"不超过80字的岗位概述",
"core_requirements":[{"skill":"","importance":"必备|重要|加分","explanation":"不超过40字"}],
"market_insight":"该岗位在当前就业市场的位置、竞争程度、薪资水平概述（不超过80字）",
"preparation_advice":["入职准备的3-5条核心建议"],
"interview_focus":["面试中可能被重点考察的3-5个方面"],
"career_path":"该岗位未来3-5年的典型职业发展路径（不超过60字）"}"""
    content, _meta = deepseek.chat_completions(
        [{"role": "system", "content": system},
         {"role": "user", "content": f"岗位名称：{title}\n岗位描述：{description[:2000]}\n必备技能：{json.dumps(required, ensure_ascii=False)}\n加分技能：{json.dumps(preferred, ensure_ascii=False)}"}],
        temperature=0.15, timeout=35.0
    )
    parsed = _json_from_text(content) if content else {}
    if not parsed:
        return {
            "job_summary": f"{title}岗位，核心要求{', '.join(required[:4])}等技能",
            "core_requirements": [{"skill": s, "importance": "必备", "explanation": "岗位要求"} for s in required[:6]],
            "market_insight": f"{title}岗位在就业市场中需求稳定，建议关注核心技能积累",
            "preparation_advice": [f"掌握{required[0]}" if required else "夯实专业基础", "积累相关项目经验", "关注行业最新趋势"],
            "interview_focus": ["技术能力深度", "项目经验验证", "问题解决能力", "团队协作", "学习潜力"],
            "career_path": f"从{title}可向高级/资深方向发展，逐步拓展技术广度与管理能力",
            "source": "local-fallback",
        }
    parsed["source"] = "deepseek"
    # Ensure lists
    for key in ("core_requirements", "preparation_advice", "interview_focus"):
        if not isinstance(parsed.get(key), list):
            parsed[key] = []
    return parsed


# ============================================================
# Phase 03 — 真实岗位接入（Mock → Real）
# ============================================================
def _split_skill_values(values: Any) -> list[str]:
    """Normalize DB skill arrays, including legacy pipe-delimited entries."""
    if isinstance(values, str):
        values = [values]
    if not isinstance(values, (list, tuple, set)):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        for part in re.split(r"[|｜,，;；]", str(value or "")):
            skill = part.strip()
            if skill and skill not in seen:
                seen.add(skill)
                out.append(skill)
    return out


def to_match_job_dict(row: dict[str, Any]) -> dict[str, Any]:
    """把真实岗位行（job_postings+details join）转成 MatchingService 需要的结构。

    字段契约与 data.JOBS 对齐：id/title/category/company/industry/city/salary/
    required_skills/preferred_skills/post_date/source/description + 溯源字段。
    技能为空时用知识库清洗器的规则抽取（skills+keywords+labels+词典，不调 LLM）。
    """
    from backend.knowledge.cleaner import extract_skills

    raw_skills = row.get("skills") or []
    skills = _split_skill_values(raw_skills)
    if not skills:
        skills = extract_skills(row)
    keywords = _split_skill_values(row.get("keywords") or [])
    labels = _split_skill_values(row.get("job_labels") or [])
    preferred = list(dict.fromkeys(keywords + labels))

    salary: str | None = None
    lo, hi = row.get("salary_min"), row.get("salary_max")
    if lo or hi:
        lo_k = int(lo or 0) // 1000
        hi_k = int(hi or 0) // 1000
        salary = f"{lo_k}-{hi_k}K" if lo_k and hi_k else (f"{hi_k}K" if hi_k else f"{lo_k}K")

    description = "\n".join(
        x for x in (row.get("job_description") or "", row.get("job_requirement") or "") if x
    )
    return {
        "id": row.get("id") if row.get("id") is not None else row.get("job_id"),
        "title": row.get("job_title"),
        "category": row.get("job_category_l1") or "",
        "company": row.get("company_name"),
        "industry": row.get("company_industry"),
        "city": row.get("city"),
        "salary": salary,
        "required_skills": skills[:20],
        "preferred_skills": preferred[:20],
        "post_date": str(row.get("publish_time")) if row.get("publish_time") else None,
        "source": row.get("source_name"),
        "description": description,
        "source_url": row.get("source_url"),
        "education": row.get("education"),
        "experience": row.get("experience"),
    }


# 学历标签（与 job_postings.education 的短标签对齐，如 本科/大专/硕士）
_EDU_TAGS = ("博士", "硕士", "本科", "大专", "中技", "中专", "高中", "初中")


def _extract_education_tag(text: str) -> str:
    """从教育经历文本（如「某大学 计算机科学与技术 本科 2019.09 - 2023.06」）
    提取学历标签；无则返回空串（不设 filter，避免误过滤）。"""
    for tag in _EDU_TAGS:
        if tag in (text or ""):
            return tag
    return ""


def build_retrieval_query(profile: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """由 Candidate Profile 生成 KnowledgeService 检索 query 与结构化 filters。"""
    parts: list[str] = []
    target = (profile.get("target_role") or "").strip()
    skills = [_skill_name(s) for s in (profile.get("skills") or []) if _skill_name(s)][:8]
    summary = (profile.get("summary") or "").strip()
    if target:
        parts.append(target)
    if skills:
        parts.append(" ".join(skills))
    if summary:
        parts.append(summary[:150])
    query = " ".join(parts).strip() or (target or "招聘岗位")

    filters: dict[str, Any] = {}
    city = (profile.get("city") or "").strip()
    if city and city not in ("未识别", "未知"):
        filters["city"] = city
    education = (profile.get("education") or "").strip()
    # education 可能是整段教育经历文本 → 先提取学历标签再作为 filter，避免精确匹配落空
    edu_tag = _extract_education_tag(education)
    if edu_tag:
        filters["education"] = edu_tag
    years = profile.get("experience_years")
    if isinstance(years, (int, float)) and years > 0:
        if years < 1:
            filters["experience"] = "应届"
        elif years <= 3:
            filters["experience"] = "1-3年"
        elif years <= 5:
            filters["experience"] = "3-5年"
        elif years <= 10:
            filters["experience"] = "5-10年"
        else:
            filters["experience"] = "10年以上"
    return query, filters


def retrieve_candidate_jobs(
    profile: dict[str, Any],
    top_k: int = 50,
    target_job_id: str | None = None,
) -> list[dict[str, Any]]:
    """召回真实候选岗位并转换为 MatchingService 输入。

    优先级：
    1) target_job_id → 精确拉取
    2) KnowledgeService.hybrid_search（需 document_chunks）
    3) job_postings SQL 技能/标题粗排（无知识库表时也能通）
    4) data.JOBS 演示岗位（库不可用时保证流程可演示）
    """
    from backend.knowledge.ingestion import fetch_jobs
    from backend.knowledge.service import KnowledgeService

    if target_job_id:
        try:
            rows = fetch_jobs(job_ids=[int(target_job_id)], limit=1)
        except (TypeError, ValueError):
            rows = []
        except Exception:
            rows = []
        jobs = [to_match_job_dict(r) for r in rows]
        if jobs:
            for j in jobs:
                j["_retrieval"] = "target"
            return jobs

    # 2) 知识库 Hybrid（表缺失 / 未入库时安全降级）
    try:
        query, filters = build_retrieval_query(profile)
        svc = KnowledgeService()
        res = svc.hybrid_search(query, filters=filters, top_k=top_k)
        # Resume metadata is often incomplete or uses labels that do not exactly
        # match the job table. Retry without metadata filters before falling back
        # to the coarse SQL retriever so a valid keyword/vector hit is not lost.
        if (not res.get("results")) and filters:
            res = svc.hybrid_search(query, filters={}, top_k=top_k)
        if res.get("status") == "OK" and res.get("results"):
            hits_by_job: dict[int, list[dict[str, Any]]] = {}
            for hit in res["results"]:
                job_id = hit.get("job_id")
                if job_id is None:
                    continue
                base = {
                    "job_id": job_id,
                    "doc_id": hit.get("doc_id"),
                    "source_name": hit.get("source_name"),
                    "source_url": hit.get("source_url"),
                    "score": hit.get("final_score"),
                }
                chunks = hit.get("chunks") or [{"chunk_id": hit.get("chunk_id"), "snippet": hit.get("snippet")}]
                for c in chunks:
                    hits_by_job.setdefault(job_id, []).append({
                        **base,
                        "chunk_id": c.get("chunk_id"),
                        "snippet": c.get("snippet"),
                    })

            ids = [h["job_id"] for h in res["results"] if h.get("job_id")]
            rows = fetch_jobs(job_ids=ids, limit=len(ids) or 1) if ids else []
            jobs = []
            for row in rows:
                job = to_match_job_dict(row)
                job["_evidence"] = hits_by_job.get(row["id"], [])
                job["_retrieval"] = "hybrid"
                jobs.append(job)
            if jobs:
                return jobs
    except Exception as exc:
        logging.warning("candidate hybrid retrieval failed; using SQL fallback: %s", exc)

    # 3) 直接从招聘表按画像粗排
    try:
        sql_jobs = _retrieve_jobs_from_postings(profile, top_k=top_k)
        if sql_jobs:
            return sql_jobs
    except Exception as exc:
        logging.warning("candidate SQL retrieval failed; using demo fallback: %s", exc)

    # 4) 演示岗位，保证全流程可通
    demo = []
    for raw in data.JOBS:
        job = dict(raw)
        job["_evidence"] = [{
            "snippet": (job.get("description") or "")[:180],
            "source_name": job.get("source") or "演示数据",
            "source_url": None,
        }]
        job["_retrieval"] = "demo"
        demo.append(job)
    return demo[: max(1, min(top_k, len(demo)))]


def _profile_skill_names(profile: dict[str, Any]) -> list[str]:
    names: list[str] = []
    for item in profile.get("skills") or []:
        if isinstance(item, dict):
            n = (item.get("name") or "").strip()
        else:
            n = str(item or "").strip()
        if n:
            names.append(n)
    return names


def _retrieve_jobs_from_postings(profile: dict[str, Any], top_k: int = 50) -> list[dict[str, Any]]:
    """无 RAG 表时：从 job_postings 拉一批真实岗位，按技能/意向标题粗排。"""
    from backend.knowledge.ingestion import fetch_jobs

    skills = [s for s in _profile_skill_names(profile) if s]
    target = (profile.get("target_role") or "").strip()
    pool = fetch_jobs(limit=max(top_k * 6, 120))

    # 额外按技能/意向关键词捞一批（近期表可能全是无关行业）
    try:
        keyed = _fetch_jobs_by_keywords(
            [target] + skills[:6],
            limit=max(top_k * 2, 40),
        )
        seen = {r.get("id") for r in pool}
        for r in keyed:
            if r.get("id") not in seen:
                pool.append(r)
                seen.add(r.get("id"))
    except Exception:
        pass

    if not pool:
        return []

    skills_l = [s.lower() for s in skills]
    target_l = target.lower()
    city = (profile.get("city") or "").strip()
    if city in ("未识别", "未知", ""):
        city = ""

    scored: list[tuple[float, dict[str, Any]]] = []
    for row in pool:
        job = to_match_job_dict(row)
        title = (job.get("title") or "").lower()
        desc = (job.get("description") or "").lower()
        req = [str(s).lower() for s in (job.get("required_skills") or [])]
        blob = " ".join([title, desc, " ".join(req)])
        score = 0.0
        if target_l and target_l in title:
            score += 12.0
        elif target_l:
            for token in target_l.replace("/", " ").replace("工程师", " ").split():
                if len(token) >= 2 and token in title:
                    score += 4.0
        skill_hits = 0
        for sk in skills_l:
            if not sk:
                continue
            if sk in req or sk in title:
                score += 4.0
                skill_hits += 1
            elif sk in blob:
                score += 1.5
                skill_hits += 1
        job_city = job.get("city") or ""
        if city and city in job_city:
            score += 2.5
        if skills_l and skill_hits == 0:
            score *= 0.15
        snippet = (job.get("description") or job.get("title") or "")[:180]
        job["_evidence"] = [{
            "snippet": snippet,
            "source_name": job.get("source") or "招聘库",
            "source_url": job.get("source_url"),
            "job_id": job.get("id"),
        }]
        job["_retrieval"] = "sql"
        scored.append((score, job))

    scored.sort(key=lambda x: x[0], reverse=True)
    # A low lexical score still represents a real, usable job candidate. The
    # previous cutoff turned an otherwise healthy database into a false
    # "no-jobs" response whenever the resume had sparse/translated skills.
    return [j for _, j in scored[:top_k]]


def _fetch_jobs_by_keywords(keywords: list[str], limit: int = 40) -> list[dict[str, Any]]:
    """按标题/描述关键词从 job_postings 检索（不依赖 document_chunks）。"""
    import psycopg2
    from backend.config import config

    keys = [k.strip() for k in keywords if k and len(str(k).strip()) >= 2][:8]
    if not keys:
        return []
    wheres = []
    params: list[Any] = []
    for k in keys:
        wheres.append("(jp.job_title ILIKE %s OR COALESCE(jpd.job_description,'') ILIKE %s OR COALESCE(jpd.job_requirement,'') ILIKE %s)")
        like = f"%{k}%"
        params.extend([like, like, like])
    sql = f"""
        SELECT jp.id, jp.source_name, jp.source_id, jp.job_title, jp.company_name,
               jp.city, jp.district, jp.salary_min, jp.salary_max, jp.salary_unit,
               jp.experience, jp.education, jp.job_type, jp.publish_time, jp.crawl_time,
               jp.status, jpd.company_industry, jpd.company_size, jpd.company_nature,
               jpd.job_description, jpd.job_requirement, jpd.job_highlights,
               jpd.job_labels, jpd.skills, jpd.keywords, jpd.salary_description,
               jpd.job_category_l1, jpd.job_category_l2, jpd.source_url
        FROM job_postings jp
        LEFT JOIN job_posting_details jpd ON jpd.job_id = jp.id
        WHERE jp.status = 0 AND ({' OR '.join(wheres)})
        ORDER BY jp.crawl_time DESC
        LIMIT %s
    """
    params.append(limit)
    with psycopg2.connect(
        host=config.PG_HOST, port=config.PG_PORT, user=config.PG_USER,
        password=config.PG_PASSWORD, dbname=config.PG_DB,
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]


def _empty_diagnose_result(
    profile: dict[str, Any],
    document: dict[str, Any],
    parse_meta: dict[str, Any],
    reason: str = "未找到候选岗位",
) -> dict[str, Any]:
    """无候选岗位时的兜底：不报错、不编造。"""
    return {
        "profile": profile,
        "document": {key: value for key, value in document.items() if key != "text"},
        "matches": [],
        "selected_job_id": None,
        "gap_graph": {},
        "learning_path": [],
        "perfect_resume": {},
        "competitiveness": {},
        "job_analysis": {},
        "model": {
            "used": profile.get("source") == "deepseek",
            "name": parse_meta.get("llm") or "none",
            "mode": "no-jobs",
            "error": reason,
            "compare_error": None,
        },
        "trace": [
            {"key": "upload", "label": "文件校验", "status": "done"},
            {"key": "extract", "label": "版面解析", "status": "done"},
            {"key": "profile", "label": "DeepSeek画像", "status": "done" if profile.get("source") == "deepseek" else "fallback"},
            {"key": "retrieve", "label": "候选岗位召回", "status": "empty"},
        ],
    }


def _evidence_confidence(count: int) -> tuple[str, float, float]:
    """按 Evidence 条数给置信度（Phase 04 §八）：>=2 high / >=1 medium / 0 low。"""
    from backend.knowledge.evidence import evidence_confidence

    return evidence_confidence(count)


def _generate_explanations(
    profile: dict[str, Any],
    matches: list[dict[str, Any]],
    top_n: int = 10,
) -> dict[str, dict[str, Any]] | None:
    """批量生成 DeepSeek 解释：输入 = Candidate + Job + Match Result + Evidence。

    只生成推荐理由 / 匹配原因 / 技能优势 / 技能缺口；
    禁止编造岗位、技能、公司、URL、来源；无 Evidence 时标注 INSUFFICIENT_EVIDENCE。
    失败返回 None（调用方走 fallback）。
    """
    targets = matches[:top_n]
    compact = []
    for m in targets:
        job = m["job"]
        ev_texts = [e.get("snippet") for e in (m.get("evidence") or []) if e.get("snippet")][:3]
        compact.append({
            "job_id": job.get("id"),
            "title": job.get("title"),
            "company": job.get("company"),
            "match_score": m.get("score"),
            "matched_skills": (m.get("matched") or [])[:8],
            "missing_skills": (m.get("missing") or [])[:8],
            "evidence": ev_texts,
        })
    system = (
        "你是就业推荐解释助手。只能基于提供的 Candidate Profile、Job、Match Result、Evidence 生成解释。\n"
        "禁止编造岗位要求、技能、公司、URL、来源，或任何输入中不存在的事实。\n"
        "若某岗位 Evidence 为空，reason 必须以 INSUFFICIENT_EVIDENCE 开头，且不补充任何细节。\n"
        "严格输出 JSON：{\"items\":[{\"job_id\":\"\",\"reason\":\"不超过60字\","
        "\"strengths\":[\"来自候选人简历的技能优势，最多3条\"],"
        "\"gaps\":[\"需要补齐的技能及建议，最多3条\"]}]}"
    )
    user = json.dumps({
        "candidate": {
            "target_role": profile.get("target_role"),
            "skills": [_skill_name(s) for s in (profile.get("skills") or [])][:10],
            "experience_years": profile.get("experience_years"),
            "education": profile.get("education"),
            "summary": (profile.get("summary") or "")[:150],
        },
        "matches": compact,
    }, ensure_ascii=False)

    content, meta = deepseek.chat_completions(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.3,
        timeout=45.0,
    )
    if meta.get("error") or not content:
        return None
    try:
        payload = deepseek._extract_json(content)
        items = payload.get("items") if isinstance(payload.get("items"), list) else []
        return {str(it.get("job_id")): it for it in items if it.get("job_id")}
    except Exception:
        return None


def diagnose_from_profile(
    profile: dict[str, Any],
    jobs: list[dict[str, Any]],
    target_job_id: str | None = None,
    mode: str = "b",
    parse_meta: dict[str, Any] | None = None,
    document: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """画像 + 候选岗位 → 五维评分 → Evidence 持久化 → DeepSeek 解释 → 推荐。"""
    parse_meta = parse_meta or {"llm": "none", "error": None}
    document = document or {}
    errors = [error for error in (parse_meta.get("error"),) if error]

    if not jobs:
        return _empty_diagnose_result(profile, document, parse_meta)

    # 语义审查只送前 12 个，避免超时；评分仍覆盖全部候选
    reviews, review_meta = _semantic_review(profile, jobs[:12])
    matches = score_matches(profile, reviews, jobs=jobs)
    # Evidence 挂到每个匹配结果（供前端溯源）
    for m in matches:
        m["evidence"] = (m.get("job") or {}).get("_evidence", [])

    if not matches:
        return _empty_diagnose_result(profile, document, parse_meta, reason="候选岗位评分异常")

    # ---- Phase 04：Evidence 持久化 + 置信度 + 解释 ----
    explanations = _generate_explanations(profile, matches)
    for m in matches:
        ev_count = len(m.get("evidence") or [])
        conf_level, conf_num, unc = _evidence_confidence(ev_count)
        m["confidence"] = conf_level
        m["sources"] = list(dict.fromkeys(
            e.get("source_url") for e in m.get("evidence") or [] if e.get("source_url")
        ))
        # 持久化 Evidence → evidence_items（幂等），并把 evidence_id 写回
        try:
            from backend.knowledge.evidence import persist_match_evidence

            persist_match_evidence(m, conf_num, unc)
        except Exception as exc:
            errors.append(f"evidence persist: {exc}")
        # DeepSeek 解释（失败 → fallback；无 Evidence → INSUFFICIENT_EVIDENCE）
        ex = (explanations or {}).get(str(m["job"]["id"]))
        if ex and ex.get("reason"):
            m["match_reasons"] = [str(ex["reason"])[:200]]
            m["explanation"] = ex
        else:
            fallback = m.get("reason") if ev_count else "INSUFFICIENT_EVIDENCE"
            m["match_reasons"] = [fallback]
            m["explanation"] = None

    if target_job_id:
        selected = next((item for item in matches if str(item["job"]["id"]) == str(target_job_id)), matches[0])
    else:
        selected = matches[0]
    learning_path = build_learning_path(selected)
    gap_graph = build_gap_graph(profile, selected)
    llm_used = profile.get("source") == "deepseek" or bool(reviews)
    model_name = review_meta.get("llm") or parse_meta.get("llm") or "none"
    if review_meta.get("error"):
        errors.append(review_meta["error"])

    retrieval_modes = {(j.get("_retrieval") or "unknown") for j in jobs}
    if "hybrid" in retrieval_modes:
        retrieve_mode = "hybrid"
    elif "sql" in retrieval_modes:
        retrieve_mode = "sql-fallback"
    elif "demo" in retrieval_modes:
        retrieve_mode = "demo-jobs"
    elif "target" in retrieval_modes:
        retrieve_mode = "target"
    else:
        retrieve_mode = "deepseek-semantic" if llm_used else "local-fallback"

    # Perfect Resume + Comparison + Job Analysis
    perfect_resume: dict[str, Any] = {}
    competitiveness: dict[str, Any] = {}
    job_analysis: dict[str, Any] = {}
    compare_error: str | None = None

    try:
        perfect_resume = generate_perfect_resume(selected["job"], profile)
    except Exception as exc:
        compare_error = f"完美简历生成失败: {exc}"

    try:
        if perfect_resume:
            competitiveness = compare_with_perfect(profile, perfect_resume, selected["job"])
    except Exception as exc:
        compare_error = (compare_error or "") + f"; 对比分析失败: {exc}"

    if mode == "a" and selected.get("job"):
        try:
            job_analysis = analyze_job_requirement(selected["job"])
        except Exception as exc:
            errors.append(f"岗位分析失败: {exc}")

    return {
        "profile": profile,
        "document": {key: value for key, value in document.items() if key != "text"},
        "matches": matches,
        "selected_job_id": selected["job"]["id"],
        "gap_graph": gap_graph,
        "learning_path": learning_path,
        "perfect_resume": perfect_resume,
        "competitiveness": competitiveness,
        "job_analysis": job_analysis,
        "model": {
            "used": llm_used,
            "name": model_name,
            "mode": retrieve_mode if retrieve_mode in ("hybrid", "sql-fallback", "demo-jobs", "target") else ("deepseek-semantic" if llm_used else "local-fallback"),
            "error": "；".join(errors)[:300] if errors else None,
            "compare_error": compare_error,
        },
        "trace": [
            {"key": "upload", "label": "文件校验", "status": "done"},
            {"key": "extract", "label": "版面解析", "status": "done"},
            {"key": "profile", "label": "DeepSeek画像", "status": "done" if profile.get("source") == "deepseek" else "fallback"},
            {"key": "retrieve", "label": "候选岗位召回", "status": "done" if jobs else "empty"},
            {"key": "semantic", "label": "语义匹配", "status": "done" if reviews else "fallback"},
            {"key": "graph", "label": "图谱推理", "status": "done"},
            {"key": "plan", "label": "路径规划", "status": "done"},
            {"key": "perfect", "label": "完美简历", "status": "done" if perfect_resume else ("fallback" if compare_error else "pending")},
            {"key": "compare", "label": "竞争力对比", "status": "done" if competitiveness else ("fallback" if compare_error else "pending")},
        ],
    }


def diagnose(filename: str, content: bytes, target_job_id: str | None = None, mode: str = "b") -> dict[str, Any]:
    """兼容入口：Mock 数据诊断（保持既有行为/测试可用）。"""
    document = extract_document(filename, content)
    profile, parse_meta = parse_resume(document["text"], filename)
    return diagnose_from_profile(profile, list(data.JOBS), target_job_id, mode, parse_meta, document)
