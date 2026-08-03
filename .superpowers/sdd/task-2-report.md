# Task 2 Report: Wire DeepSeek into agent scan

## Status: DONE

## Summary

Wired `backend.llm.deepseek.enrich_discoveries` into `DiscoveryAgent.scan_with_reasoning` so the agent scan enriches top discoveries via DeepSeek when configured, and exposes LLM metadata on the scan response `model` dict.

## Changes

**File modified:** `backend/routers/discovery.py`

1. **Import added**
   ```python
   from backend.llm import deepseek as ds
   ```

2. **Removed early `model_info` assignment** (previously hardcoded `backed_by: 讯飞星火 X2 (待接入,Phase 2)`).

3. **After Phase 6 (hallucination audit), before return:**
   - Call `discoveries, llm_meta = ds.enrich_discoveries(discoveries, top_n=8)`
   - Optionally append DeepSeek enrichment note to step 6 `detail` when `llm_meta["enriched"] > 0`
   - Build final `model_info`:
     - `engine`: unchanged
     - `backed_by`: `"DeepSeek"` when LLM active, else `"启发式(无LLM)"`
     - `llm`, `llm_enriched`, `llm_error` from `llm_meta`
     - `knowledge_base`: unchanged PostgreSQL table reference

4. **Empty PG path:** early return now uses a consistent `empty_model` dict with `llm=none`, `llm_enriched=0`.

5. **`agent_scan`:** no code change required — it already returns full `result` via `data.ok(result)`, so enriched discoveries and expanded `model` flow through automatically.

## Interface compliance

Scan response retains required keys: `reasoning_chain`, `discoveries`, `forecasts`, `summary`, `stats`, `model`.

`model` now includes:
| Key | Source |
|-----|--------|
| `llm` | `llm_meta["llm"]` (`deepseek-chat` or `none`) |
| `llm_enriched` | count of enriched discoveries |
| `llm_error` | error string or `null` |

Heuristic path unchanged when DeepSeek is unavailable or fails — discoveries still returned, enrich is best-effort.

## Smoke test

**Environment:** PG available at `127.0.0.1:3309`, `DEEPSEEK_API_KEY` not set.

### Direct call
```bash
python -c "from backend.routers.discovery import AGENT; r=AGENT.scan_with_reasoning(); print(r['model'])"
```
Result: `code` path OK — 30 discoveries, `llm=none`, `llm_enriched=0`, `backed_by=启发式(无LLM)`.

### HTTP endpoint
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --app-dir .
# POST http://127.0.0.1:8000/api/discovery/agent/scan
```
Result:
- `code=0`
- `data.discoveries` length = 30
- `data.model.knowledge_base` contains `zhilian_job_postings`
- `data.model.llm` = `none`
- `data.model.llm_enriched` = 0

**With-key path:** not exercised (no key in env). Expected per Task 1 module: `llm=deepseek-chat`, `llm_enriched` > 0 when API succeeds.

## Commits

None (per task instructions).

## Concerns

None. Stale uvicorn process on port 8000 initially served old code during smoke; killed and restarted — fresh server confirmed new behavior.
