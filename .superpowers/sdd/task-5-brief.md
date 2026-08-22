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
=======
### Task 5: Archive root devtools scripts

**Files:**
- Create: `scripts/devtools/` (directory)
- Move: root `_*.py`, `_*.txt` matching diagnostic/acceptance patterns
- Create: `scripts/devtools/README.md` (one paragraph: archive of one-off checks)

**Interfaces:**
- Do **not** move: `run_backend.py`, `.env`, `zhoukou.yaml` (unless confirmed unused — keep yaml at root), `backend/`, `crawler/`, `docs/`, `论文/`
- Do not move files under `crawler/` or `backend/` that merely start with `_`

- [ ] **Step 1: List candidates**

```bash
# PowerShell from repo root
Get-ChildItem -File -Filter "_*" | Select-Object Name
```

- [ ] **Step 2: `mkdir scripts/devtools` and `git mv` each file**

```bash
mkdir -p scripts/devtools
git mv _check_http.py scripts/devtools/
# ... repeat for all root _* files
```

- [ ] **Step 3: Add `scripts/devtools/README.md`**

```markdown
# Devtools archive

One-off diagnostic / acceptance scripts and their log outputs formerly living at the repo root. Not part of the runtime app. Prefer `backend/` tests or documented check scripts for new work.
```

- [ ] **Step 4: `git status` — confirm root is clean of `_check_*` clutter**

- [ ] **Step 5: Commit**

```bash
git add scripts/devtools
git commit -m "chore: archive root diagnostic scripts under scripts/devtools"
```
>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338

---
