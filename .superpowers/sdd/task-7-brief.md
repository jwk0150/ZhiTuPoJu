## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-26-discovery-mission-control-design.md`
- Scope: only `view-discovery` UI + discovery backend DeepSeek layer; do not redesign other views
- Palette: ink `#0B1220`, signal `#2DD4BF` / `#0D9488`, amber `#F5A524` — no purple-default look
- Secrets: `DEEPSEEK_API_KEY` via env / `.env` only — never hardcode keys in source or commit `.env`
- PG: `127.0.0.1:3309` / `zhilian_crawl_db` / tables `zhilian_job_postings` + `zhilian_job_posting_details`
- Scan response must keep keys: `reasoning_chain`, `discoveries`, `forecasts`, `summary`, `stats`, `model`
- `prefers-reduced-motion`: disable particles, typewriter, heavy GSAP; steps snap in
- Commits: only when the user explicitly asks (do not auto-commit)


### Task 7: Workbench cards + drawer + actions

**Files:**
- Modify: `frontend/index.html` — `renderDiscoveryList`, replace modal-based `showDiscoveryDetail` with drawer

- [ ] **Step 1: Card template** — confidence color bands; forecast uses `.is-forecast` (teal+amber), no purple; show `reasoning` one-liner; adopt/reject stopPropagation.

- [ ] **Step 2: `openDiscoveryDrawer(id)` / `closeDiscoveryDrawer()`** — fill sections per spec; Esc closes; footer adopt/reject/close.

- [ ] **Step 3: Wire KPI strip buttons** to set `status` filter + active tab.

- [ ] **Step 4: Keep `adoptDiscoveryJob` / `rejectDiscoveryJob` / `agentBatchAdopt`** — POST when possible; always update local state.

- [ ] **Step 5: Verify** — click card opens drawer; Esc closes; batch adopt updates KPIs.

---
