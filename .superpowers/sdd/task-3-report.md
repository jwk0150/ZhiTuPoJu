# Task 3 Report — Discovery page shell (HTML structure)

## Status
Complete — `#view-discovery` replaced with mission-control shell; CDN scripts added.

## Commits
None (per instructions).

## Summary
- Added `gsap@3.12.5` and `tsparticles-slim@2.12.0` CDN scripts in `<head>` immediately after the existing ECharts/G6 scripts.
- Replaced the legacy `#view-discovery` block (old KPI grid + `#agent-panel` card + candidate card) with the dual-pane mission-control shell: `disc-topbar` + `disc-mission` (`disc-left` aside with particles/cluster canvas/steps/radar/hallucination, `disc-right` main with KPI strip + tabs + filters + grid) plus the `disc-drawer` side drawer and mask.
- Preserved all required DOM ids (verified 26/26): `disc-mission`, `disc-left`, `disc-right`, `disc-particles`, `disc-cluster-canvas`, `disc-hallucination`, `disc-steps`, `disc-step-detail`, `disc-engine-badge`, `disc-llm-badge`, `disc-pg-count`, `btn-agent-scan`, `kpi-discovered`, `kpi-pending`, `kpi-adopted`, `kpi-forecast`, `discovery-tabs`, `discovery-search`, `discovery-sort`, `discovery-cat`, `discovery-grid`, `disc-drawer`, `disc-drawer-body`, `disc-drawer-title`, `disc-drawer-actions`, `disc-drawer-mask`, plus `disc-radar`.
- Retained the existing tab structure with `discovery-count-all|pending|adopted|forecast|rejected` ids and the search/sort/cat filter controls with their original ids.
- Other views (`view-evolution`, `view-match`, `view-qa`, etc.) untouched.

## Concerns
- Styling for the new `disc-*` classes is not yet present in the stylesheet — layout will look unstyled until Task 4+ adds CSS. This is expected per the task brief (HTML structure only).
- Old discovery JS (e.g. `agentScan`, `renderDiscoveryList`) still references removed nodes like `#agent-panel`, `#agent-steps`, `#kpi-avg-conf`; these will throw at runtime until later tasks rewire them. Brief explicitly permits temporarily-broken JS.
- `disc-radar` is an empty div intended for an ECharts radar; left as a placeholder for a later task.
- `<canvas id="disc-cluster-canvas">` uses fixed `width="640" height="220"` attributes; CSS in a later task should make it responsive.

## Report path
`C:/Users/Ibiza/Desktop/project/挑战杯/.superpowers/sdd/task-3-report.md`
