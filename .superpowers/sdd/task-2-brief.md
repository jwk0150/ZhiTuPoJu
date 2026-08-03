## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-26-discovery-mission-control-design.md`
- Scope: only `view-discovery` UI + discovery backend DeepSeek layer; do not redesign other views
- Palette: ink `#0B1220`, signal `#2DD4BF` / `#0D9488`, amber `#F5A524` — no purple-default look
- Secrets: `DEEPSEEK_API_KEY` via env / `.env` only — never hardcode keys in source or commit `.env`
- PG: `127.0.0.1:3309` / `zhilian_crawl_db` / tables `zhilian_job_postings` + `zhilian_job_posting_details`
- Scan response must keep keys: `reasoning_chain`, `discoveries`, `forecasts`, `summary`, `stats`, `model`
- `prefers-reduced-motion`: disable particles, typewriter, heavy GSAP; steps snap in
- Commits: only when the user explicitly asks (do not auto-commit)


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
