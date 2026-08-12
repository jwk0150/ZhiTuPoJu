from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx

try:
    from dotenv import load_dotenv
    # 优先从项目根目录加载 .env（兼容不同启动目录）
    _env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
    if os.path.exists(_env_path):
        load_dotenv(_env_path, override=True)
    else:
        load_dotenv()
except (ImportError, Exception):
    pass

DEFAULT_BASE = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-chat"


def is_configured() -> bool:
    return bool(os.getenv("DEEPSEEK_API_KEY", "").strip())


def _extract_json(text: str) -> dict:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            raise
        return json.loads(m.group(0))


def chat_completions(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.4,
    timeout: float = 60.0,
) -> tuple[str, dict]:
    """Call DeepSeek chat/completions. Returns (content, meta). Never raises."""
    meta: dict[str, Any] = {"llm": "none", "error": None}
    if not is_configured() or not messages:
        meta["error"] = "DEEPSEEK_API_KEY not configured" if not is_configured() else "empty messages"
        return "", meta
    key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    base = os.getenv("DEEPSEEK_BASE_URL", DEFAULT_BASE).rstrip("/")
    model = os.getenv("DEEPSEEK_MODEL", DEFAULT_MODEL)
    try:
        # trust_env=False 跳过系统代理，避免 Windows 代理干扰 TLS 连接
        with httpx.Client(timeout=timeout, trust_env=False) as client:
            resp = client.post(
                f"{base}/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
        meta["llm"] = model
        return str(content or "").strip(), meta
    except Exception as e:
        meta["error"] = str(e)
        return "", meta


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


def suggest_procurement_chat(
    message: str,
    *,
    history: list[dict] | None = None,
    discoveries: list[dict] | None = None,
    forecasts: list[dict] | None = None,
    summary: str = "",
) -> dict:
    """兼容入口：委托统一执图顾问 ZhituAgent（channel=suggest）。"""
    from backend.llm import zhitu_agent

    return zhitu_agent.chat(
        message=message or "请给出本轮采购建议",
        channel="suggest",
        history=history,
        discoveries=discoveries,
        forecasts=forecasts,
        summary=summary or "",
    )


def enrich_discoveries(discoveries: list[dict], top_n: int = 8) -> tuple[list[dict], dict]:
    meta: dict[str, Any] = {"llm": "none", "enriched": 0, "error": None}
    if not discoveries or not is_configured():
        return discoveries, meta

    model = os.getenv("DEEPSEEK_MODEL", DEFAULT_MODEL)
    targets = discoveries[:top_n]
    compact = [
        {
            "id": d.get("id"),
            "title": d.get("title"),
            "skills": (d.get("core_skills") or d.get("requiredSkills") or [])[:8],
            "definition": (d.get("definition") or d.get("description") or "")[:400],
            "evidence_count": (d.get("quality") or {}).get("evidence_count", 0),
        }
        for d in targets
    ]
    system = (
        "你是就业市场分析师。根据给定的新兴岗位候选，润色岗位定义与一句话推理依据。"
        "严格输出 JSON：{\"items\":[{\"id\":\"\",\"definition\":\"\",\"reasoning\":\"\"}]}"
        "不要编造不存在的技能；定义≤120字；reasoning≤40字。"
    )
    user = "候选岗位:\n" + json.dumps(compact, ensure_ascii=False)

    content, call_meta = chat_completions(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.3,
        timeout=45.0,
    )
    if call_meta.get("error"):
        meta["error"] = call_meta["error"]
        return discoveries, meta
    try:
        data = _extract_json(content)
        by_id = {it["id"]: it for it in data.get("items", []) if it.get("id")}
        enriched = 0
        for d in discoveries:
            it = by_id.get(d.get("id"))
            if not it:
                continue
            if it.get("definition"):
                d["definition"] = str(it["definition"]).strip()[:250]
                d["description"] = d["definition"][:200]
            if it.get("reasoning"):
                d["reasoning"] = str(it["reasoning"]).strip()[:120]
            enriched += 1
        meta.update({"llm": call_meta.get("llm") or model, "enriched": enriched})
    except Exception as e:
        meta["error"] = str(e)
    return discoveries, meta
