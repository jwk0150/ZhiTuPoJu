from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
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


def enrich_discoveries(discoveries: list[dict], top_n: int = 8) -> tuple[list[dict], dict]:
    meta: dict[str, Any] = {"llm": "none", "enriched": 0, "error": None}
    if not discoveries or not is_configured():
        return discoveries, meta

    key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    base = os.getenv("DEEPSEEK_BASE_URL", DEFAULT_BASE).rstrip("/")
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

    try:
        with httpx.Client(timeout=45.0) as client:
            resp = client.post(
                f"{base}/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
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
        meta.update({"llm": model, "enriched": enriched})
    except Exception as e:
        meta["error"] = str(e)
    return discoveries, meta
