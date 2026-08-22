<<<<<<< HEAD
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
=======
# Task 3 Report: Home journey page + teal particles

## Status

**DONE** — `frontend/pages/home.html`, `frontend/js/pages/home.js`, `frontend/js/pages/particles-teal.js` created; home-stage CSS added to `components.css`; source-checked, HTTP-smoked, and committed.

## What Was Implemented

### `frontend/pages/home.html`

Skeleton matches the brief: tokens/shell/components CSS, `data-page="home"`, `#app-shell`, `#page-main`, scripts `api.js` → `shell.js` → `particles-teal.js` → `home.js`.

Four journey blocks (spec §4.2 / brief copy):

| # | Title | Actions |
|---|--------|---------|
| 1 | 数据与图谱底座 | Ghost links「采集与质量」→ collection,「质量监控」→ quality (main CTA weakened to text) |
| 2 | 看地图 | Primary「进入地图」→ `PAGE_HREF.map` |
| 3 | 看演化与发现 | Buttons → evolution + discovery |
| 4 | 做人岗匹配 | Primary CTA「开始人岗匹配」→ match (`.is-primary`) |

Copy includes「多源异构数据驱动岗位能力图谱」. Fallback `href`s point at `../portal.html#view-*`; JS overwrites from `window.PAGE_HREF`.

Home-only stage: `.home-stage` + `#home-particles` canvas behind `.home-journey`.

### `frontend/js/pages/home.js`

```js
Shell.mount({ pageId: 'home', title: '演示路径', subtitle: '数据 → 图谱 → 匹配' })
```

Then binds `[data-page-href]` to `window.PAGE_HREF` and mounts `TealParticles` on the canvas.

### `frontend/js/pages/particles-teal.js`

- 180 particles (clamped 120–250), palette `#2DD4BF` / `#0D9488` / cyan-teal tints
- Soft neighbor links (max 4, distance 92px), DPR capped at 2
- `prefers-reduced-motion: reduce` → hide canvas, add `.home-stage.is-static` (dark-teal gradient, no rAF)
- Canvas is `pointer-events: none` via CSS; z-index 0 under journey (z-index 1)

### CSS (`components.css`)

`.home-stage` / `.home-particles` / `.home-journey` / lead typography. Stage bleeds to `page-main` edges with a dark teal field so the starfield reads; cards stay light.

No Vue/React. `portal.html` untouched.

## Verification

**RED (before files existed):** `python .superpowers/sdd/check_task_3.py` → `missing frontend/pages/home.html` / `home.js` and all content assertions.

**GREEN:**

```text
PASS
home.html + home.js: four journey steps, Shell.mount, PAGE_HREF, teal particles, reduced-motion
```

**HTTP smoke:** `python -m http.server 8080` in `frontend/`

```text
GET http://127.0.0.1:8080/pages/home.html  →  200  (3063 bytes)
journey-step present; home-particles present; shell.js linked
```

No headed browser click-through (sidebar / demo strip / hash navigation). Chrome is injected by `Shell.mount` from Task 2.

## Self-Review

| Check | Result |
|-------|--------|
| Four exact journey titles | Yes |
| Step 1 secondary collection/quality; main weakened | Yes |
| Map / evolution+discovery / match CTA | Yes |
| `Shell.mount` args exact | Yes |
| `PAGE_HREF` used for buttons | Yes |
| Teal particle addendum | Yes — canvas, palette, 180 count, reduced-motion, pointer-events none, home only |
| No Vue/React / no portal.html edit | Yes |
| `#page-main` sibling of `#app-shell` (moved by Shell.mount) | Yes |

## Concerns

1. **No headed UI pass** — HTTP 200 + source check only; sidebar/demo-strip/layout need a real browser look.
2. **Dark stage vs light shell** — home content column is a dark teal field so the starfield works; other pages stay `--bg-page`.
3. **Hash links from `pages/`** — Phase 0 bridges are `../portal.html#view-*`; map/evolution/discovery/match pages do not exist yet.
4. **Check script untracked** — `.superpowers/sdd/check_task_3.py` was used for TDD and not committed.

## Commits

| SHA | Subject |
|-----|---------|
| `32a6f08` | feat(frontend): add judge-first home journey page |

4 files: `home.html`, `home.js`, `particles-teal.js`, `components.css` (+300).

## Report path

>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338
`C:/Users/Ibiza/Desktop/project/挑战杯/.superpowers/sdd/task-3-report.md`
