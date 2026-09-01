## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-26-discovery-mission-control-design.md`
- Scope: only `view-discovery` UI + discovery backend DeepSeek layer; do not redesign other views
- Palette: ink `#0B1220`, signal `#2DD4BF` / `#0D9488`, amber `#F5A524` — no purple-default look
- Secrets: `DEEPSEEK_API_KEY` via env / `.env` only — never hardcode keys in source or commit `.env`
- PG: `127.0.0.1:3309` / `zhilian_crawl_db` / tables `zhilian_job_postings` + `zhilian_job_posting_details`
- Scan response must keep keys: `reasoning_chain`, `discoveries`, `forecasts`, `summary`, `stats`, `model`
- `prefers-reduced-motion`: disable particles, typewriter, heavy GSAP; steps snap in
- Commits: only when the user explicitly asks (do not auto-commit)


### Task 6: Ambient FX (particles, cluster canvas, hallucination, radar)

**Files:**
- Modify: `frontend/index.html` JS — add helpers called from `playReasoningSequence`

- [ ] **Step 1: `initDiscParticles()`** — if `tsParticles` global exists and not reduced-motion, load slim config on `#disc-particles` (teal links, low density ~40 particles). Destroy/reinit on view enter.

- [ ] **Step 2: `playClusterAnimation(canvas)`** — 2s: random points → 4–6 cluster centers (requestAnimationFrame). No-op if reduced-motion.

- [ ] **Step 3: `playHallucinationAudit(discoveries)`** — unhide `#disc-hallucination`, render 4–6 claim chips from titles; stagger add `.verified` or `.warn` if `evidence_sources.length < 2`.

- [ ] **Step 4: Mini ECharts radar** on `#disc-radar` during step 3 using `title_score/skill_score/cross_score` averages from first discovery's `reasoning` parse **or** synthetic [42,20,15] if missing. Dispose on leave view.

- [ ] **Step 5: Verify** — scanning looks cinematic; reduced-motion still completes.

---
