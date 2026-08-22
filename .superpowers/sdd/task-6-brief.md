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


### Task 6: Ambient FX (particles, cluster canvas, hallucination, radar)

**Files:**
- Modify: `frontend/index.html` JS — add helpers called from `playReasoningSequence`

- [ ] **Step 1: `initDiscParticles()`** — if `tsParticles` global exists and not reduced-motion, load slim config on `#disc-particles` (teal links, low density ~40 particles). Destroy/reinit on view enter.

- [ ] **Step 2: `playClusterAnimation(canvas)`** — 2s: random points → 4–6 cluster centers (requestAnimationFrame). No-op if reduced-motion.

- [ ] **Step 3: `playHallucinationAudit(discoveries)`** — unhide `#disc-hallucination`, render 4–6 claim chips from titles; stagger add `.verified` or `.warn` if `evidence_sources.length < 2`.

- [ ] **Step 4: Mini ECharts radar** on `#disc-radar` during step 3 using `title_score/skill_score/cross_score` averages from first discovery's `reasoning` parse **or** synthetic [42,20,15] if missing. Dispose on leave view.

- [ ] **Step 5: Verify** — scanning looks cinematic; reduced-motion still completes.

---
=======
### Task 6: Phase 0 acceptance checklist

**Files:** none (verification only) or update spec status line to「已批准 / Phase0 完成」

- [ ] **Step 1: Run frontend + backend**

```bash
python run_backend.py
cd frontend && python -m http.server 8080
```

- [ ] **Step 2: Checklist**

| Check | Expected |
|-------|----------|
| `/pages/home.html` | Shell + 4 journey steps |
| Sidebar「更多」 | Toggles collection/analysis/quality/settings bridges |
| Demo path next | Advances highlight; link works |
| Login redirect | `pages/home.html` |
| Portal banner | Visible |
| `#view-match` | Opens match view |
| Root `_check_*.py` | Gone (in `scripts/devtools/`) |

- [ ] **Step 3: Commit spec status tweak if any**

```bash
git commit -m "docs: mark frontend IA Phase 0 acceptance"
```

---

## ADDENDUM
Also:
1. Append one line to scripts/devtools/README.md noting archived scripts may assume repo-root __file__ and are read-only artifacts.
2. Update docs/superpowers/specs/2026-08-15-frontend-ia-multipage-design.md status to note Phase 0 complete if checks pass.
3. Prefer HTTP smoke (Invoke-WebRequest / curl) for home.html, login.html, portal.html banner string, and /api/health if backend up. Headed browser optional.
4. Record checklist results in the report.

>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338
