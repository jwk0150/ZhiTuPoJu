from __future__ import annotations

import html
import io
import json
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
        "skills": [item.get("name") for item in profile.get("skills", [])],
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
    allowed_job_ids = {job["id"] for job in jobs}
    candidate_skills = {canonical_skill(item.get("name", "")) for item in profile.get("skills", [])}
    reviews: dict[str, dict[str, Any]] = {}
    for item in payload.get("items", []) if isinstance(payload.get("items"), list) else []:
        if not isinstance(item, dict) or item.get("job_id") not in allowed_job_ids:
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
        reviews[item["job_id"]] = {
            "semantic_score": _score_value(item.get("semantic_score"), 55),
            "project_score": _score_value(item.get("project_score"), 50),
            "transferable_skills": transfers,
            "reason": str(item.get("reason") or "")[:100],
        }
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


def score_matches(profile: dict[str, Any], reviews: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    candidate_skills = {canonical_skill(item.get("name", "")) for item in profile.get("skills", [])}
    candidate_skills.discard("")
    results: list[dict[str, Any]] = []

    for job in data.JOBS:
        required = [canonical_skill(skill) for skill in job.get("required_skills", [])]
        preferred = [canonical_skill(skill) for skill in job.get("preferred_skills", [])]
        matched = [skill for skill in required if skill in candidate_skills]
        missing = [skill for skill in required if skill not in candidate_skills]
        review = reviews.get(job["id"], {})

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


def diagnose(filename: str, content: bytes, target_job_id: str | None = None) -> dict[str, Any]:
    document = extract_document(filename, content)
    profile, parse_meta = parse_resume(document["text"], filename)
    reviews, review_meta = _semantic_review(profile, data.JOBS)
    matches = score_matches(profile, reviews)
    if target_job_id:
        selected = next((item for item in matches if item["job"]["id"] == target_job_id), matches[0])
    else:
        selected = matches[0]
    learning_path = build_learning_path(selected)
    gap_graph = build_gap_graph(profile, selected)
    llm_used = profile.get("source") == "deepseek" or bool(reviews)
    model_name = review_meta.get("llm") or parse_meta.get("llm") or "none"
    errors = [error for error in (parse_meta.get("error"), review_meta.get("error")) if error]

    return {
        "profile": profile,
        "document": {key: value for key, value in document.items() if key != "text"},
        "matches": matches,
        "selected_job_id": selected["job"]["id"],
        "gap_graph": gap_graph,
        "learning_path": learning_path,
        "model": {
            "used": llm_used,
            "name": model_name,
            "mode": "deepseek-semantic" if llm_used else "local-fallback",
            "error": "；".join(errors)[:300] if errors else None,
        },
        "trace": [
            {"key": "upload", "label": "文件校验", "status": "done"},
            {"key": "extract", "label": "版面解析", "status": "done"},
            {"key": "profile", "label": "DeepSeek画像", "status": "done" if profile.get("source") == "deepseek" else "fallback"},
            {"key": "semantic", "label": "语义匹配", "status": "done" if reviews else "fallback"},
            {"key": "graph", "label": "图谱推理", "status": "done"},
            {"key": "plan", "label": "路径规划", "status": "done"},
        ],
    }
