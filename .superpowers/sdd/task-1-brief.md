<<<<<<< HEAD
## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-26-discovery-mission-control-design.md`
- Scope: only `view-discovery` UI + discovery backend DeepSeek layer; do not redesign other views
- Palette: ink `#0B1220`, signal `#2DD4BF` / `#0D9488`, amber `#F5A524` — no purple-default look
- Secrets: `DEEPSEEK_API_KEY` via env / `.env` only — never hardcode keys in source or commit `.env`
- PG: `127.0.0.1:3309` / `zhilian_crawl_db` / tables `zhilian_job_postings` + `zhilian_job_posting_details`
- Scan response must keep keys: `reasoning_chain`, `discoveries`, `forecasts`, `summary`, `stats`, `model`
- `prefers-reduced-motion`: disable particles, typewriter, heavy GSAP; steps snap in
- Commits: only when the user explicitly asks (do not auto-commit)


### Task 1: DeepSeek client + enrich (backend)

**Files:**
- Create: `backend/llm/__init__.py`
- Create: `backend/llm/deepseek.py`
- Create: `backend/tests/test_deepseek_enrich.py`
- Modify: `backend/requirements.txt`
- Create: `.env.example` (if missing) with `DEEPSEEK_API_KEY=`

**Interfaces:**
- Consumes: `os.environ["DEEPSEEK_API_KEY"]`, optional `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`
- Produces:
  - `def is_configured() -> bool`
  - `def enrich_discoveries(discoveries: list[dict], top_n: int = 8) -> tuple[list[dict], dict]`
    - returns `(updated_discoveries, meta)` where `meta = {"llm": "deepseek-chat"|"none", "enriched": int, "error": str|None}`

- [ ] **Step 1: Add dependencies**

Append to `backend/requirements.txt`:

```
httpx
python-dotenv
```

- [ ] **Step 2: Write failing tests**

Create `backend/tests/test_deepseek_enrich.py`:

```python
import json
from unittest.mock import MagicMock, patch

from backend.llm import deepseek


def test_is_configured_false_without_key(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    assert deepseek.is_configured() is False


def test_is_configured_true_with_key(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    assert deepseek.is_configured() is True


def test_enrich_skips_when_no_key(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    jobs = [{"id": "d1", "title": "Agent工程师", "definition": "old", "core_skills": ["Python"]}]
    out, meta = deepseek.enrich_discoveries(jobs, top_n=8)
    assert out[0]["definition"] == "old"
    assert meta["llm"] == "none"
    assert meta["enriched"] == 0


def test_enrich_rewrites_top_n(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    payload = {
        "choices": [{
            "message": {
                "content": json.dumps({
                    "items": [{
                        "id": "d1",
                        "definition": "负责多智能体任务规划与工具编排。",
                        "reasoning": "标题含Agent且技能组合新颖。"
                    }]
                }, ensure_ascii=False)
            }
        }]
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = payload
    mock_resp.raise_for_status = MagicMock()

    jobs = [
        {"id": "d1", "title": "Agent工程师", "definition": "raw", "core_skills": ["Agent"], "responsibilities": []},
        {"id": "d2", "title": "Java", "definition": "raw2", "core_skills": ["Java"], "responsibilities": []},
    ]
    with patch("backend.llm.deepseek.httpx.Client") as client_cls:
        client_cls.return_value.__enter__.return_value.post.return_value = mock_resp
        out, meta = deepseek.enrich_discoveries(jobs, top_n=1)
    assert out[0]["definition"].startswith("负责多")
    assert "Agent" in out[0]["reasoning"]
    assert out[1]["definition"] == "raw2"
    assert meta["llm"] == "deepseek-chat"
    assert meta["enriched"] == 1
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
cd backend
python -m pip install -r requirements.txt pytest -q
python -m pytest tests/test_deepseek_enrich.py -v
```

Expected: FAIL `ModuleNotFoundError` or import error for `backend.llm.deepseek`

- [ ] **Step 4: Implement client**

`backend/llm/__init__.py` — empty.

`backend/llm/deepseek.py`:

```python
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
```

`.env.example`:

```
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
python -m pytest tests/test_deepseek_enrich.py -v
```

Expected: all PASS

=======
### Task 1: Create design tokens + shell CSS

**Files:**
- Create: `frontend/css/tokens.css`
- Create: `frontend/css/shell.css`
- Create: `frontend/css/components.css`

**Interfaces:**
- Produces: CSS variables `--signal`, `--signal-deep`, `--primary`, `--bg-page`, `--bg-sidebar`, `--text-dark`, `--font-display`, `--font-body`, `--font-mono`; classes `.app-frame`, `.sidebar`, `.nav-item`, `.topbar`, `.demo-path`, `.page-main`, `.btn`, `.btn-primary`, `.journey-step`

- [ ] **Step 1: Create `frontend/css/tokens.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

:root {
  --signal: #2DD4BF;
  --signal-deep: #0D9488;
  --signal-dim: rgba(45, 212, 191, 0.14);
  --primary: #0D9488;
  --primary-light: #2DD4BF;
  --bg-page: #F4F7F8;
  --bg-sidebar: #0B1220;
  --bg-card: #FFFFFF;
  --text-dark: #0F172A;
  --text-secondary: #64748B;
  --text-muted: #94A3B8;
  --text-on-dark: #E2E8F0;
  --border: #E2E8F0;
  --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.08);
  --radius: 12px;
  --font-display: 'Noto Serif SC', 'Songti SC', serif;
  --font-body: 'DM Sans', 'Noto Sans SC', "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --sidebar-w: 248px;
  --topbar-h: 56px;
  --demo-h: 44px;
}
```

- [ ] **Step 2: Create `frontend/css/shell.css`** with layout for `.app-frame` (sidebar + main column), dark sidebar nav groups「主线」「更多」, `.demo-path` sticky strip under topbar, responsive collapse at 900px.

- [ ] **Step 3: Create `frontend/css/components.css`** with `.btn`, `.btn-primary`, `.btn-ghost`, `.journey-step`, `.banner-legacy`, `.tag`.

- [ ] **Step 4: Smoke-open tokens** — create a temporary blank HTML only if needed; otherwise proceed to Task 2 and verify together.

- [ ] **Step 5: Commit**

```bash
git add frontend/css/tokens.css frontend/css/shell.css frontend/css/components.css
git commit -m "feat(frontend): add design tokens and shell component CSS"
```

>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338
---
