# Task 1 Report: DeepSeek client + enrich

## Status

**DONE** — All 4 tests pass; implementation matches the task brief verbatim.

## What Was Implemented

### New files

| File | Purpose |
|------|---------|
| `backend/llm/__init__.py` | Empty package init |
| `backend/llm/deepseek.py` | DeepSeek HTTP client: `is_configured()`, `enrich_discoveries()` |
| `backend/tests/test_deepseek_enrich.py` | Unit tests (4 cases) |
| `.env.example` | Placeholder env vars for DeepSeek config |

### Modified files

| File | Change |
|------|--------|
| `backend/requirements.txt` | Appended `httpx` and `python-dotenv` |

### Public API

- **`is_configured() -> bool`** — True when `DEEPSEEK_API_KEY` is set and non-empty.
- **`enrich_discoveries(discoveries, top_n=8) -> tuple[list[dict], dict]`**
  - Skips LLM call when no key or empty list; returns original discoveries with `meta = {"llm": "none", "enriched": 0, "error": None}`.
  - Sends top-N compact job payloads to DeepSeek chat completions; merges returned `definition`, `description`, and `reasoning` back into matching discovery dicts by `id`.
  - On success: `meta["llm"]` is the model name (default `deepseek-chat`), `meta["enriched"]` is count of updated items.
  - On failure: `meta["error"]` holds the exception string; discoveries are returned unchanged.

## TDD Evidence

### Step 1 — RED (tests before implementation)

**Command:**

```powershell
Set-Location "C:/Users/Ibiza/Desktop/project/挑战杯"
python -m pip install -r backend/requirements.txt pytest -q
python -m pytest backend/tests/test_deepseek_enrich.py -v
```

**Output (expected FAIL):**

```
ERROR collecting backend/tests/test_deepseek_enrich.py
ImportError while importing test module ...
backend\tests\test_deepseek_enrich.py:4: in <module>
    from backend.llm import deepseek
E   ModuleNotFoundError: No module named 'backend.llm'
!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
```

### Step 2 — GREEN (after implementation)

**Command:**

```powershell
Set-Location "C:/Users/Ibiza/Desktop/project/挑战杯"
python -m pytest backend/tests/test_deepseek_enrich.py -v
```

**Output (all PASS):**

```
backend/tests/test_deepseek_enrich.py::test_is_configured_false_without_key PASSED [ 25%]
backend/tests/test_deepseek_enrich.py::test_is_configured_true_with_key PASSED [ 50%]
backend/tests/test_deepseek_enrich.py::test_enrich_skips_when_no_key PASSED [ 75%]
backend/tests/test_deepseek_enrich.py::test_enrich_rewrites_top_n PASSED [100%]

============================== 4 passed in 0.15s ==============================
```

## Self-Review

| Check | Result |
|-------|--------|
| Code matches brief verbatim | Yes — `deepseek.py`, tests, `.env.example` copied as specified |
| No real API keys in source | Yes — only empty placeholder in `.env.example` |
| Dependencies added | Yes — `httpx`, `python-dotenv` in `requirements.txt` |
| TDD order | Yes — tests written first, RED confirmed, then implementation, GREEN confirmed |
| Imports from project root | Yes — `from backend.llm import deepseek` works when pytest run from project root |
| Mock path correct | Yes — `patch("backend.llm.deepseek.httpx.Client")` intercepts HTTP in tests |
| `top_n` behavior | Only first `top_n` items sent to LLM; merge loop applies to full list by id (matches brief) |
| Error handling | Broad `except Exception` stores message in `meta["error"]` without raising (matches brief) |

## Concerns

1. **No integration test against live API** — By design; all HTTP is mocked. Task 2+ should verify wiring in `discovery.py`.
2. **`enriched` count semantics** — Counts any discovery whose `id` appears in LLM response, not strictly `top_n` slice; consistent with brief implementation but worth noting for Task 2 metrics.
3. **`.env` loading at import** — `load_dotenv()` runs on module import; harmless in tests (monkeypatch overrides env) but may load a local `.env` in dev — expected per brief.

## Commits

None (per user rule — commits only when explicitly requested).
