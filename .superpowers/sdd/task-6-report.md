# Task 6 Report — Ambient FX (particles, cluster canvas, hallucination, radar)

## Status
✅ Implemented (not committed)

## Commits
None — per instructions.

## Summary
Replaced the four no-op Task 6 stubs in `frontend/index.html` with real implementations and wired them into the discovery lifecycle:

1. **`initDiscParticles()`** — loads `tsParticles` slim on `#disc-particles` with ~40 teal particles (`#2DD4BF`/`#0D9488`), low-density links, transparent bg, no full-screen. Skips entirely under `prefers-reduced-motion` (CSS already hides `.disc-particles`). Destroys any prior container before re-init. Called from `initDiscovery()` on view enter.
2. **`playClusterAnimation(step)`** — 2s `requestAnimationFrame` tween on `#disc-cluster-canvas`: 80 random points smoothstep into 4–6 cluster centers with proximity-linked teal dots. No-op (clears canvas) under reduced-motion. Cancels any prior rAF handle.
3. **`playHallucinationAudit(step, ds)`** — unhides `#disc-hallucination`, renders up to 6 claim chips from discovery titles; each chip starts blurred (`.disc-claim` base) and gets `.verified` (evidence_sources ≥ 2) or `.warn` (< 2) with a 120ms stagger (instant under reduced-motion).
4. **`updateDiscRadar(step, ds)`** — disposes any existing ECharts instance on `#disc-radar`, parses 3 numbers (5–100 range) from the first discovery's `reasoning` for `[title, skill, cross]` scores, falling back to `[confidence, 20, 15]` then synthetic `[42, 20, 15]`. Teal radar with translucent split areas.

Added **`destroyDiscFX()`** and hooked it into `switchView` so leaving the discovery view destroys the tsParticles container, disposes the radar chart, and cancels the cluster rAF — preventing leaked instances when navigating away.

All hooks are invoked by `playReasoningSequence` at steps 2 / 3 / 6 as already wired in Task 5.

## Concerns
- `tsParticles.load` is async; if a user navigates away within ~50ms the `.then` may assign a destroyed container — guarded by try/catch on destroy and re-checked on next init.
- Radar score parsing from `reasoning` is heuristic (regex number extraction); mock data yields `[confidence, 20, 15]` which is acceptable per brief's "synthetic if missing" fallback.
- Cluster canvas resizes to its rendered box on each play; if the left panel is hidden (≤1100px single-column) the canvas may be 0×0 — tick early-returns cleanly via `clearRect`.
- Did not run a browser; verified via lints only (no linter errors). Visual verification deferred to Task 6 Step 5 / manual review.

## Files changed
- `frontend/index.html` (3 edits): replaced Task 6 stub block; added `initDiscParticles()` call in `initDiscovery`; added `destroyDiscFX()` cleanup in `switchView`.

## Report path
`C:/Users/Ibiza/Desktop/project/挑战杯/.superpowers/sdd/task-6-report.md`
