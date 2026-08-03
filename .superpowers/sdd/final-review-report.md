# Discovery Mission Control — Final Code Review

Branch: feature/discovery-mission-control (working tree, uncommitted)
Base: 92c82bc7b340dcb540788165a42bf9490a6b92e4
Reviewer: Senior Code Reviewer
Date: 2026-07-27

Scope: backend/llm/ (new), backend/routers/discovery.py (rewrite), backend/requirements.txt, backend/tests/test_deepseek_enrich.py (new), .env.example (new), frontend/index.html (discovery view + head + JS).

---

## Strengths

1. Plan adherence is strong — all 8 tasks landed; dual-pane 42/58 layout, 6-step reasoning playback, hallucination-audit climax, drawer, KPI strip, and mock fallback all match the spec.
2. DeepSeek layer is correctly scoped. enrich_discoveries only touches Top-N, mutates defensively, never raises (broad except writes to meta["error"]), and is_configured() gates the whole path. Heuristic scan stays authoritative — matches spec §5.2 "role清晰".
3. Graceful degradation matrix is real: no DEEPSEEK_API_KEY → llm:"none"; DeepSeek HTTP failure → heuristic preserved; backend down → frontend buildMockScanPayload() toast + mock cards; CDN missing → typeof guards; prefers-reduced-motion → particles hidden, typewriter skipped, delay=0, cluster canvas cleared.
4. Secrets hygiene is correct for DeepSeek: .env.example carries only placeholders, .env is in .gitignore (line 20), no real keys in tracked source, no key read in frontend.
5. Response schema preserved as required: reasoning_chain, discoveries, forecasts, summary, stats, model — all present and consumed uniformly from API and mock paths.
6. Tests cover the contract. test_deepseek_enrich.py (4 passing) covers is_configured both ways, no-key skip, Top-N rewrite with mocked httpx.Client.
7. Frontend ergonomics improved. Drawer replaces the previously-broken modal path; Esc handler, mask click, aria-hidden wired. destroyDiscFX invoked on view leave to prevent radar/particle leaks.
8. PG badge fix landed. updateDiscBadges prefers ds.scanStats.total_scanned and falls back to discoveries.length only when stats absent — addresses Task-5 minor.

---

## Issues

### Critical

#### C1 — Hardcoded PostgreSQL password in source
- File: backend/routers/discovery.py:39
- Code: `PG_DSN = "host=127.0.0.1 port=3309 user=postgres password=123456 dbname=zhilian_crawl_db"`
- What's wrong: DB credential committed to git. Contradicts spec §1.2 #5 and §5.1 ("密钥不进仓库"). A DB password is more sensitive than the LLM key the spec explicitly protects — it grants direct data access. The same clause's spirit clearly applies.
- How to fix: Move DSN (or components) to env. Example:
  ```python
  PG_DSN = os.getenv("PG_DSN", "host=127.0.0.1 port=3309 user=postgres password= dbname=zhilian_crawl_db")
  ```
  Add `PG_DSN=` placeholder to .env.example. Load via dotenv (already imported in deepseek.py; consider a shared settings module). At minimum, redact the password. Blocks merge.

### Important

#### I1 — agent_scan leaks internal exception text to client
- File: backend/routers/discovery.py:535-536
- Code:
  ```python
  except Exception as e:
      return {"code": 1, "message": f"扫描失败: {e}", "data": None}
  ```
- What's wrong: str(e) for psycopg.OperationalError frequently includes the DSN (and thus the password) in the message. Also leaks schema/table names and stack details to the client.
- How to fix: Log full exception server-side (logger.exception), return generic message:
  ```python
  except Exception as e:
      logger.exception("agent_scan failed")
      return {"code": 1, "message": "扫描失败，请检查后端日志", "data": None}
  ```

#### I2 — SQL built with f-string interpolation
- File: backend/routers/discovery.py:258 (and surrounding _query_pg)
- Code: `f"""SELECT ... FROM {POSTINGS_TBL} p JOIN {DETAILS_TBL} d ON d.job_id = p.id WHERE p.status = 0 ORDER BY p.crawl_time DESC LIMIT {limit}"""`
- What's wrong: Table names come from module constants and limit from an internal call site, so not exploitable today — but it is a fragile pattern one refactor away from a real injection. psycopg supports parameter binding for limits.
- How to fix: Bind limit as a parameter:
  ```python
  ... LIMIT %s""", (limit,)
  ```
  Keep POSTINGS_TBL/DETAILS_TBL as validated module constants (or interpolate with an allowlist check).

#### I3 — Removed public endpoints with no deprecation notice
- File: backend/routers/discovery.py — POST /api/discovery/analyze and POST /api/discovery/jobs/{job_id}/reanalyze removed; RawJobAnalyze schema removed.
- What's wrong: The plan §"Interfaces" never authorized removal; the original module docstring explicitly advertised these routes. Verified no remaining references in backend/ or frontend/, so internally safe — but anything external (notebooks, demo scripts, report) will now 404.
- How to fix: Either restore as thin shims around the new pipeline, or call out the removal explicitly in the commit message and progress notes. Preferred: keep `/analyze` as a 1-job wrapper over `scan_with_reasoning` for backward compat.

#### I4 — Frontend hardcodes http://127.0.0.1:8000 in three places
- File: frontend/index.html:2439 (agentScan), 2599 (adoptDiscoveryJob), 2604 (rejectDiscoveryJob)
- What's wrong: If the demo is ever served from a different host (or the static file is opened on a judge's laptop), every action will silently fetch-fail and the UI will only update local state. Toasts won't surface because the catch blocks swallow errors.
- How to fix: Centralise:
  ```js
  const API_BASE = window.API_BASE || 'http://127.0.0.1:8000';
  ```
  Or derive from location.origin when served from the same origin. Replace all three call sites.

#### I5 — _score_group_detailed "recent" computation is broken/unreadable
- File: backend/routers/discovery.py:311-315
- Code:
  ```python
  recent = sum(1 for it in items if it.get("publish_time") and isinstance(it["publish_time"], datetime)
              and (datetime.now(timezone.utc) - it["publish_time"].replace(tzinfo=timezone.utc)
                   if it["publish_time"].tzinfo is None
                   else datetime.now(timezone.utc) - it["publish_time"]).days < 30)
  growth_rate = round(recent / max(n, 1) * 200, 1)
  ```
- What's wrong: The ternary returns a timedelta either way so technically works, but is unreadable. The `* 200` scaling on a 30-day ratio is dubious. This path is untested and feeds `quality.freshness_score` which influences displayed metrics.
- How to fix: Extract a helper:
  ```python
  def _is_recent(it, now=None, days=30):
      now = now or datetime.now(timezone.utc)
      pt = it.get("publish_time")
      if not isinstance(pt, datetime): return False
      if pt.tzinfo is None: pt = pt.replace(tzinfo=timezone.utc)
      return (now - pt).days < days
  ```
  Add a unit test for both tz-aware and tz-naive publish_time.

#### I6 — update_job_status regressed on response payload
- File: backend/routers/discovery.py:517, 521
- Code: `return data.ok({"id": job_id, "status": payload.status})`
- What's wrong: Previous implementation returned `{"id", "status", "updated_at"}`. The new one drops `updated_at`. Not required by spec but a regression for any caller that displayed it.
- How to fix: Restore the field:
  ```python
  return data.ok({"id": job_id, "status": payload.status, "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")})
  ```

#### I7 — Established jobs inflate KPIs and avg_confidence
- File: backend/routers/discovery.py:190-194
- Code:
  ```python
  for g in established:
      d = self._build_discovery(g["norm_title"], g["items"], g)
      d["status"] = "adopted"  # 传统岗位默认已采纳
      d["is_established"] = True
      d["confidence"] = min(d["confidence"] + 10, 85)
  ```
- What's wrong: Auto-adopted "traditional IT" clusters count toward the "已采纳" KPI and bump stats.avg_confidence with non-discoveries. Spec §4.1 treats KPIs as a measure of this scan's pending/adopted/forecast work — the dashboard now lies about agent output.
- How to fix: Either (a) exclude is_established from KPI counts in frontend updateDiscoveryCounts, or (b) don't force status="adopted" — use a separate "established" status and add a tab if needed. Option (a) is the smaller change.

### Minor

#### M1 — enrich_discoveries both mutates and returns the input list
- File: backend/llm/deepseek.py:35-93
- What's wrong: API is misleading; invites bugs at call sites that alias the list. Current call site reassigns, so safe today.
- How to fix: Pick one convention. Either return a new list, or return None and document in-place mutation. Recommend returning a new list to match functional style.

#### M2 — _extract_json regex is greedy
- File: backend/llm/deepseek.py:29
- Code: `m = re.search(r"\{[\s\S]*\}", text)`
- What's wrong: Grabs from first `{` to last `}`. A stray trailing brace in model reasoning will break parsing. DeepSeek is usually well-behaved at temperature 0.3 but not guaranteed.
- How to fix: Try a non-greedy match, or strip ```json fences first, or use a JSON-aware parser. Add a unit test for fenced ```json ... ``` payloads.

#### M3 — agent_reasoning endpoint is dead code
- File: backend/routers/discovery.py:540-543
- What's wrong: Frontend consumes reasoning_chain directly from the scan response; nothing calls /agent/reasoning.
- How to fix: Either remove it, or wire a "replay last reasoning" button in the UI. Recommend removal until a use case appears.

#### M4 — Sort option mismatch
- File: frontend/index.html:833 (sort select) vs backend/routers/discovery.py:495 (Query pattern)
- What's wrong: Frontend offers confidence|date|name; backend validates ^(confidence|growth|date|title)$. Frontend `name` is client-side only; backend `growth`/`title` are unreachable.
- How to fix: Align both sides — either drop unused options or wire them through to the backend.

#### M5 — discoveryState.scanStats not declared in initial state object
- File: frontend/index.html:2281 (state decl) vs 2457 (assignment)
- What's wrong: Set in agentScan but absent from the explicit field list above it. Works at runtime but inconsistent.
- How to fix: Add `scanStats: {}` to the initial window.discoveryState object.

#### M6 — playReasoningSequence renders the list twice around step 4/5
- File: frontend/index.html:2519 and 2525
- What's wrong: Calls renderDiscoveryList({onlyDiscoveries:true}) at step 4 then full render at step 5. Minor reflow flicker.
- How to fix: Merge into one render after step 5, or render discoveries at step 4 and only append forecasts at step 5.

#### M7 — Emoji usage on prediction tab and rescan button
- File: frontend/index.html — prediction tab adds 🔮, rescan button gets 🤖
- What's wrong: Spec §3.1 says "不用 🤖 堆砌". Step-title emojis match spec §3.3 wording (acceptable), but the extra tab/button emoji is the "prediction tab emoji" backlog item.
- How to fix: Confirm with design before merge. Either drop the extra emoji or accept the spec carve-out.

#### M8 — Global Escape listener registered at module load
- File: frontend/index.html:2713
- What's wrong: Never removed across view switches. Fine for an SPA but technically leaks.
- How to fix: Scope to view-enter/view-leave (add in initDiscovery, remove in destroyDiscFX).

#### M9 — _CACHED global is not thread-safe
- File: backend/routers/discovery.py — `_CACHED: dict = {}` module-level
- What's wrong: Concurrent scans overwrite each other. uvicorn --reload is single-process so demo-safe.
- How to fix: Add a one-line comment noting the assumption, or use a per-request cache if async support is ever added.

#### M10 — Test coverage gaps
- File: backend/tests/test_deepseek_enrich.py
- What's wrong: No test for _extract_json, no test for the /agent/scan FastAPI route (even with mocked AGENT), no test for the empty-rows branch in scan_with_reasoning. The "no keyed DeepSeek live smoke this session" backlog means the httpx path is only exercised through mocks.
- How to fix: Add at least one recorded/VCR-style integration test for the live LLM path before claiming production-ready. Add a route-level test using FastAPI TestClient with AGENT mocked.

---

## Plan Alignment

| Spec criterion | Status | Notes |
|---|---|---|
| Dual-pane 42/58 mission control | ✅ | CSS + HTML match. |
| Idle / Scanning / Settled | ✅ | phase state drives badges. |
| 6-step reasoning + FX + hallucination climax | ✅ | All six steps, cluster canvas, radar, hallucination chips. |
| Real PG data | ⚠️ | Works, but DSN password hardcoded (C1). |
| DeepSeek enrich Top-N | ✅ | top_n=8, gated by is_configured. |
| Key via env only | ✅ | For DeepSeek. ❌ for PG (C1). |
| Workbench + drawer + batch adopt | ✅ | Drawer, KPI strip, batch adopt threshold confidence>=70. |
| Mock / CDN / reduced-motion degrade | ✅ | All four fallbacks implemented. |
| No purple / teal-amber forecast | ✅ | .is-forecast uses --signal-deep + --amber. |
| Commits only when user asks | ✅ | Working tree only, no commits. |

---

## Verdict

**Needs fixes before merge.**

The implementation is feature-complete, well-aligned with the spec, and the LLM integration is cleanly designed. However, C1 (hardcoded DB password in PG_DSN) is a real security regression that must be fixed before this lands on main — it is the same class of issue the spec explicitly prohibits for DEEPSEEK_API_KEY, and a DB password is more sensitive than an LLM key.

Merge-blocker set:
- C1 — move PG_DSN to env.
- I1 — stop returning str(e) from agent_scan.
- I3 — decide on the removed /analyze + /reanalyze endpoints (restore shims or document removal).
- I7 — fix the KPI inflation from auto-adopted established jobs (or exclude them from KPIs).

Also strongly recommend before any demo on a non-dev machine:
- I4 — replace hardcoded 127.0.0.1:8000 with a centralised API_BASE.

Everything else (I2, I5, I6, M1–M10) can land as fast-follow cleanup.

Minor backlog items from prior task reviews (PG badge, browser E2E, keyed DeepSeek smoke, prediction-tab emoji) are all still open and correctly characterised in task-8-report.md as DONE_WITH_CONCERNS. The PG badge one is already fixed in code; the other three remain legitimately deferred and do not block merge.
