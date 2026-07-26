# Discovery Mission Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the 新岗位发现 page into a dual-pane mission-control demo (agent reasoning + discoveries), fed by real PostgreSQL crawl data and optional DeepSeek definition enrichment.

**Architecture:** Keep heuristic `DiscoveryAgent` for PG scan/cluster/score/forecast. Add a thin DeepSeek client that polishes Top-N discovery definitions when `DEEPSEEK_API_KEY` is set. Frontend `view-discovery` becomes a 42/58 command deck with GSAP-orchestrated 6-step playback, tsParticles ambient layer, canvas cluster flash, hallucination-audit climax, and a right-side detail drawer — all driven by a unified scan response schema.

**Tech Stack:** FastAPI, psycopg, httpx (DeepSeek), Vanilla HTML/CSS/JS in `frontend/index.html`, GSAP, tsParticles, ECharts (existing), PostgreSQL `zhilian_crawl_db`

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-26-discovery-mission-control-design.md`
- Scope: only `view-discovery` UI + discovery backend DeepSeek layer; do not redesign other views
- Palette: ink `#0B1220`, signal `#2DD4BF` / `#0D9488`, amber `#F5A524` — no purple-default look
- Secrets: `DEEPSEEK_API_KEY` via env / `.env` only — never hardcode keys in source or commit `.env`
- PG: `127.0.0.1:3309` / `zhilian_crawl_db` / tables `zhilian_job_postings` + `zhilian_job_posting_details`
- Scan response must keep keys: `reasoning_chain`, `discoveries`, `forecasts`, `summary`, `stats`, `model`
- `prefers-reduced-motion`: disable particles, typewriter, heavy GSAP; steps snap in
- Commits: only when the user explicitly asks (do not auto-commit)

## File Map

| File | Responsibility |
|------|----------------|
| `backend/llm/deepseek.py` | DeepSeek HTTP client + Top-N enrich helpers |
| `backend/llm/__init__.py` | Package marker |
| `backend/routers/discovery.py` | Wire enrich into `agent_scan`; expose `model.llm` |
| `backend/requirements.txt` | Add `httpx`, `python-dotenv` |
| `.env.example` | Document `DEEPSEEK_API_KEY` placeholder (no real key) |
| `backend/tests/test_deepseek_enrich.py` | Unit tests with mocked HTTP |
| `frontend/index.html` | Discovery HTML/CSS/JS overhaul + CDN scripts |

---

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

---

### Task 2: Wire DeepSeek into agent scan

**Files:**
- Modify: `backend/routers/discovery.py` (`scan_with_reasoning` return + `agent_scan`)

**Interfaces:**
- Consumes: `backend.llm.deepseek.enrich_discoveries`, `is_configured`
- Produces: scan `model` dict includes `llm`, `llm_enriched`, `llm_error`

- [ ] **Step 1: After discoveries are built in `scan_with_reasoning`, call enrich**

Near end of `scan_with_reasoning`, before building return dict:

```python
from backend.llm import deepseek as ds

discoveries, llm_meta = ds.enrich_discoveries(discoveries, top_n=8)
# Optional: append a short note to the hallucination step detail if llm_meta["enriched"]
model_info = {
    "engine": "DiscoveryAgent v2.0 启发式推理机",
    "backed_by": "DeepSeek" if llm_meta.get("llm") != "none" else "启发式(无LLM)",
    "llm": llm_meta.get("llm", "none"),
    "llm_enriched": llm_meta.get("enriched", 0),
    "llm_error": llm_meta.get("error"),
    "knowledge_base": f"PostgreSQL {POSTINGS_TBL} + {DETAILS_TBL}",
}
```

Replace the existing `model_info` assignment accordingly. Keep heuristic path unchanged when enrich fails.

- [ ] **Step 2: Manual smoke (PG required)**

```bash
# PowerShell — set key only in shell, never commit
$env:DEEPSEEK_API_KEY="<your-key>"
python -m uvicorn backend.main:app --reload --app-dir .
# another shell:
curl -X POST http://127.0.0.1:8000/api/discovery/agent/scan
```

Expected JSON: `code=0`, `data.discoveries` length > 0, `data.model.knowledge_base` mentions `zhilian`, `data.model.llm` is `deepseek-chat` or `none`.

Without key: still `code=0`, `llm=none`.

---

### Task 3: Discovery page shell (HTML structure)

**Files:**
- Modify: `frontend/index.html` — replace `#view-discovery` block (~lines 716–791)
- Modify: `<head>` — add CDN scripts after existing ECharts/G6:

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/tsparticles-slim@2.12.0/tsparticles.slim.bundle.min.js"></script>
```

**Interfaces:**
- Produces DOM ids later JS will bind:
  - `#disc-mission`, `#disc-left`, `#disc-right`
  - `#disc-particles`, `#disc-cluster-canvas`, `#disc-hallucination`
  - `#disc-steps`, `#disc-step-detail`, `#disc-engine-badge`, `#disc-llm-badge`, `#disc-pg-count`
  - `#btn-agent-scan`, `#kpi-discovered`, `#kpi-pending`, `#kpi-adopted`, `#kpi-forecast`
  - `#discovery-tabs`, `#discovery-search`, `#discovery-sort`, `#discovery-cat`, `#discovery-grid`
  - `#disc-drawer`, `#disc-drawer-body`, `#disc-drawer-title`, `#disc-drawer-actions`

- [ ] **Step 1: Replace `#view-discovery` inner HTML** with mission-control layout:

```html
<section class="view" id="view-discovery">
  <div class="disc-topbar">
    <div>
      <h1 class="disc-brand">新岗位发现智能体</h1>
      <div class="disc-sub">多源真实库推演 · 启发式发现 · DeepSeek 定义增强</div>
    </div>
    <div class="disc-topbar-meta">
      <span class="disc-chip" id="disc-pg-count">PG · —</span>
      <span class="disc-chip" id="disc-engine-badge">引擎待命</span>
      <span class="disc-chip" id="disc-llm-badge">LLM · —</span>
      <button class="btn btn-primary" id="btn-agent-scan" onclick="agentScan()">启动扫描</button>
      <button class="btn" onclick="agentBatchAdopt()">批量采纳</button>
    </div>
  </div>
  <div class="disc-mission" id="disc-mission" data-phase="idle">
    <aside class="disc-left" id="disc-left">
      <div id="disc-particles" class="disc-particles"></div>
      <canvas id="disc-cluster-canvas" class="disc-cluster-canvas" width="640" height="220"></canvas>
      <div class="disc-left-inner">
        <div class="disc-panel-label">推理指挥舱</div>
        <ol class="disc-steps" id="disc-steps"></ol>
        <div class="disc-step-detail" id="disc-step-detail">点击「启动扫描」，智能体将接入本地招聘库并展开六幕推演。</div>
        <div class="disc-radar" id="disc-radar" style="height:140px"></div>
        <div class="disc-hallucination" id="disc-hallucination" hidden></div>
      </div>
    </aside>
    <main class="disc-right" id="disc-right">
      <div class="disc-kpi-strip">
        <button class="disc-kpi" data-status="all"><span id="kpi-discovered">0</span><label>本轮发现</label></button>
        <button class="disc-kpi" data-status="pending"><span id="kpi-pending">0</span><label>待审核</label></button>
        <button class="disc-kpi" data-status="adopted"><span id="kpi-adopted">0</span><label>已采纳</label></button>
        <button class="disc-kpi" data-status="forecast"><span id="kpi-forecast">0</span><label>未来预测</label></button>
      </div>
      <div class="tab-bar" id="discovery-tabs">...</div>
      <!-- keep search/sort/cat controls with same ids -->
      <div class="job-grid" id="discovery-grid"></div>
    </main>
  </div>
  <aside class="disc-drawer" id="disc-drawer" aria-hidden="true">
    <div class="disc-drawer-head">
      <h2 id="disc-drawer-title">岗位详情</h2>
      <button type="button" onclick="closeDiscoveryDrawer()">×</button>
    </div>
    <div class="disc-drawer-body" id="disc-drawer-body"></div>
    <div class="disc-drawer-actions" id="disc-drawer-actions"></div>
  </aside>
  <div class="disc-drawer-mask" id="disc-drawer-mask" onclick="closeDiscoveryDrawer()"></div>
</section>
```

Keep existing tab ids (`discovery-count-*`) and filter control ids.

- [ ] **Step 2: Browser check** — open SPA, switch to 新岗位发现; layout dual-pane visible; no JS errors from missing nodes.

---

### Task 4: Mission-control CSS

**Files:**
- Modify: `frontend/index.html` `<style>` — add `.disc-*` block near other view styles

- [ ] **Step 1: Add CSS** covering:

```css
.disc-mission{display:grid;grid-template-columns:42% 58%;gap:16px;min-height:calc(100vh - 180px);align-items:stretch}
.disc-left{position:relative;background:linear-gradient(165deg,#0B1220 0%,#0f1a24 55%,#0a1f1c 100%);border-radius:16px;overflow:hidden;color:#E2E8F0;border:1px solid rgba(45,212,191,.2)}
.disc-particles,.disc-cluster-canvas{position:absolute;inset:0;pointer-events:none}
.disc-cluster-canvas{z-index:1;opacity:.55}
.disc-left-inner{position:relative;z-index:2;padding:18px 16px 20px;display:flex;flex-direction:column;gap:12px;height:100%}
.disc-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;overflow:auto;max-height:42%}
.disc-step{padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);font-size:12px;opacity:.45;transition:opacity .3s,border-color .3s}
.disc-step.active,.disc-step.done{opacity:1}
.disc-step.active{border-color:rgba(45,212,191,.55);box-shadow:0 0 0 1px rgba(45,212,191,.2)}
.disc-step.done{border-color:rgba(16,185,129,.35)}
.disc-right{display:flex;flex-direction:column;gap:12px;min-width:0}
.disc-kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.disc-kpi{background:#fff;border:1px solid var(--border-dark);border-radius:12px;padding:12px;text-align:left;cursor:pointer}
.disc-kpi span{font-family:var(--font-mono);font-size:22px;font-weight:600;color:var(--ink);display:block}
.job-card.is-forecast{border:1px solid rgba(245,165,36,.45);box-shadow:inset 3px 0 0 var(--signal)}
.disc-drawer{position:fixed;top:0;right:0;width:min(420px,100vw);height:100vh;background:#fff;z-index:120;transform:translateX(100%);transition:transform .35s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;box-shadow:-16px 0 48px rgba(11,18,32,.18)}
.disc-drawer.open{transform:translateX(0)}
.disc-drawer-mask{position:fixed;inset:0;background:rgba(11,18,32,.45);z-index:110;opacity:0;pointer-events:none;transition:opacity .25s}
.disc-drawer-mask.open{opacity:1;pointer-events:auto}
.disc-hallucination{min-height:72px;border:1px dashed rgba(245,165,36,.4);border-radius:10px;padding:10px;font-size:11px;font-family:var(--font-mono)}
.disc-claim{opacity:.35;filter:blur(1px);transition:all .4s}
.disc-claim.verified{opacity:1;filter:none;color:var(--signal)}
.disc-claim.warn{opacity:1;filter:none;color:var(--amber)}
@media (max-width:1100px){.disc-mission{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){
  .disc-drawer{transition:none}
  .disc-particles{display:none!important}
}
```

Remove reliance on old `#agent-panel` card (deleted with HTML replace).

- [ ] **Step 2: Visual check** — left pane reads as ink command deck; right is light workbench; no purple forecast styling.

---

### Task 5: Scan orchestration + step playback JS

**Files:**
- Modify: `frontend/index.html` discovery JS section (`window.discoveryState` through `agentScan` / `renderDiscoveryList` / `showDiscoveryDetail`)

**Interfaces:**
- Consumes: `POST /api/discovery/agent/scan` → unified payload
- Produces: `window.discoveryState.phase`, `activeStep`, `dataSource`, `llmEnabled`; `playReasoningSequence(chain)`

- [ ] **Step 1: Expand state**

```js
window.discoveryState = {
  phase: 'idle', activeStep: 0, scanning: false,
  dataSource: 'api', llmEnabled: false,
  discoveries: [], forecasts: [], reasoningChain: [],
  scanSummary: '', modelInfo: {}, drawerJobId: null,
  search: '', sort: 'confidence', category: 'all', status: 'all'
};
```

- [ ] **Step 2: Implement `buildMockScanPayload()`** — same shape as backend (6 steps, ~8 discoveries, ~6 forecasts). Mark `dataSource:'mock'` when used.

- [ ] **Step 3: Rewrite `agentScan`**

Flow:
1. If `scanning` return toast
2. `phase='scanning'`, clear grid to skeleton/empty, show left steps placeholders
3. `fetch` scan with `AbortSignal.timeout(90000)`; on failure use mock + toast
4. Store discoveries/forecasts/chain/model; set `llmEnabled = model.llm && model.llm !== 'none'`
5. Call `await playReasoningSequence(chain)` which:
   - For each step i: set `.active`, typewriter `detail` into `#disc-step-detail`, update metrics text, optional radar on step 3, cluster canvas on step 2, hallucination on step 6
   - After step 4: `renderDiscoveryList({onlyDiscoveries:true})` + GSAP stagger if available
   - After step 5: include forecasts in render
6. `phase='settled'`, update badges (`PG · N`, engine, LLM)

Use delays ~700ms/step; if `matchMedia('(prefers-reduced-motion: reduce)').matches` set delay 0 and skip typewriter.

- [ ] **Step 4: Manual test** — with backend up: scan shows 6 steps then cards. With backend down: mock path still animates and fills cards with mock badge.

---

### Task 6: Ambient FX (particles, cluster canvas, hallucination, radar)

**Files:**
- Modify: `frontend/index.html` JS — add helpers called from `playReasoningSequence`

- [ ] **Step 1: `initDiscParticles()`** — if `tsParticles` global exists and not reduced-motion, load slim config on `#disc-particles` (teal links, low density ~40 particles). Destroy/reinit on view enter.

- [ ] **Step 2: `playClusterAnimation(canvas)`** — 2s: random points → 4–6 cluster centers (requestAnimationFrame). No-op if reduced-motion.

- [ ] **Step 3: `playHallucinationAudit(discoveries)`** — unhide `#disc-hallucination`, render 4–6 claim chips from titles; stagger add `.verified` or `.warn` if `evidence_sources.length < 2`.

- [ ] **Step 4: Mini ECharts radar** on `#disc-radar` during step 3 using `title_score/skill_score/cross_score` averages from first discovery's `reasoning` parse **or** synthetic [42,20,15] if missing. Dispose on leave view.

- [ ] **Step 5: Verify** — scanning looks cinematic; reduced-motion still completes.

---

### Task 7: Workbench cards + drawer + actions

**Files:**
- Modify: `frontend/index.html` — `renderDiscoveryList`, replace modal-based `showDiscoveryDetail` with drawer

- [ ] **Step 1: Card template** — confidence color bands; forecast uses `.is-forecast` (teal+amber), no purple; show `reasoning` one-liner; adopt/reject stopPropagation.

- [ ] **Step 2: `openDiscoveryDrawer(id)` / `closeDiscoveryDrawer()`** — fill sections per spec; Esc closes; footer adopt/reject/close.

- [ ] **Step 3: Wire KPI strip buttons** to set `status` filter + active tab.

- [ ] **Step 4: Keep `adoptDiscoveryJob` / `rejectDiscoveryJob` / `agentBatchAdopt`** — POST when possible; always update local state.

- [ ] **Step 5: Verify** — click card opens drawer; Esc closes; batch adopt updates KPIs.

---

### Task 8: End-to-end verification

**Files:** none (manual + optional curl)

- [ ] **Step 1: Backend health**

```bash
curl http://127.0.0.1:8000/api/health
curl -X POST http://127.0.0.1:8000/api/discovery/agent/scan
```

Confirm discoveries reference real-looking titles from PG (e.g. contain AI/Agent/运维等真实库方向).

- [ ] **Step 2: Frontend demo path**

1. Open `frontend/index.html` (or served static)
2. Navigate 新岗位发现
3. Idle → dual pane
4. Start scan → 6-step playback + FX
5. Cards appear; open drawer; adopt one; switch 未来预测 tab
6. Kill backend, rescan → mock fallback toast + still usable

- [ ] **Step 3: Security check**

```bash
rg "sk-[a-zA-Z0-9]" backend frontend --glob '!.env'
```

Expected: no real API key matches in tracked files.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| Dual-pane 42/58 mission control | 3, 4 |
| Idle / Scanning / Settled | 5 |
| 6-step reasoning + FX + hallucination climax | 5, 6 |
| Real PG data | 2 (existing agent) |
| DeepSeek enrich Top-N | 1, 2 |
| Key via env only | 1, 8 |
| Workbench + drawer + batch adopt | 7 |
| Mock / CDN / reduced-motion degrade | 5, 6 |
| No purple default / teal-amber forecast | 4, 7 |

## Self-Review Notes

- No TBD placeholders in tasks
- Response schema names match existing `discovery.py`
- Drawer replaces broken `modal.classList.add('open')` path for discovery details
- DeepSeek failure never fails the whole scan
