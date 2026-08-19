# Task 1 Report: Design Tokens + Shell CSS

## Status

**DONE** — All three CSS files created, verified, and committed.

## What Was Implemented

### New files

| File | Purpose |
|------|---------|
| `frontend/css/tokens.css` | Design tokens: colors, typography, spacing, shadows (verbatim from brief) |
| `frontend/css/shell.css` | App chrome layout: `.app-frame`, sidebar, nav groups, topbar, demo path, page main, responsive collapse |
| `frontend/css/components.css` | Shared UI: buttons, journey steps, legacy banner, tags |

### Token values (aligned with portal teal)

| Variable | Value |
|----------|-------|
| `--signal` | `#2DD4BF` |
| `--signal-deep` | `#0D9488` |
| `--primary` | `#0D9488` |
| `--bg-page` | `#F4F7F8` |
| `--bg-sidebar` | `#0B1220` |
| `--text-dark` | `#0F172A` |

Fonts: `Noto Serif SC` (display), `DM Sans` + `Noto Sans SC` (body), `IBM Plex Mono` (mono).

### Shell layout (`shell.css`)

- **`.app-frame`** — Flex row: sidebar + `.main-column` (topbar + demo-path stack)
- **`.sidebar`** — Dark gradient sidebar matching portal aesthetic; nav groups via `.nav-group` / `.nav-label` (supports「主线」「更多」labels from `shell.js`)
- **`.nav-item`** — Hover/active states with signal accent bar (ported from `portal.html`)
- **`.topbar`** — Sticky 56px header with title block and user entry
- **`.demo-path`** — Sticky strip below topbar (`top: var(--topbar-h)`); step pills + next CTA
- **`.page-main`** — Scrollable content area with light page-enter animation
- **Responsive `@media (max-width: 900px)`** — Sidebar off-canvas with `.is-open` toggle; `.topbar-toggle` visible

### Components (`components.css`)

- **`.btn` / `.btn-primary` / `.btn-ghost`** — Base, gradient primary (teal), transparent ghost variant
- **`.journey-step`** — Home journey blocks with left accent bar, title/desc/actions; `.is-primary` modifier for CTA step
- **`.banner-legacy`** — Amber warning strip for old portal redirect (Task 4)
- **`.tag`** — Base + `.tag-signal`, `.tag-muted`, `.tag-amber` variants

### Supporting classes (not in brief interfaces but required for coherent shell)

`.main-column`, `.sidebar-brand*`, `.demo-path-step`, `.demo-path-next`, `.journey-step-*` sub-elements, `.topbar-toggle`, `.sidebar-backdrop` — these enable `shell.js` injection without inline styles.

## Verification

**Command:**

```powershell
python -c "..." # selector/variable check script
```

**Result:** All 3 files exist; 24/24 required patterns matched (9 token vars, 9 shell selectors + 900px breakpoint, 6 component selectors).

No browser smoke test — brief Step 4 defers visual verification to Task 2/3.

## Self-Review

| Check | Result |
|-------|--------|
| `tokens.css` matches brief verbatim | Yes — exact copy including Google Fonts import |
| Required CSS variables present | Yes — all 9 listed in interfaces |
| Required classes present | Yes — all 11 listed in interfaces |
| Additional brief classes (`.btn-ghost`, `.banner-legacy`, `.tag`) | Yes |
| Teal palette aligned with portal | Yes — `#2DD4BF` / `#0D9488` |
| No Vue/React/bundler | Yes — static CSS only |
| Responsive collapse at 900px | Yes |
| `prefers-reduced-motion` respected | Yes — in shell.css and components.css |
| Complete usable CSS (not stubs) | Yes — ~800 lines total with hover/focus/responsive states |

## Concerns

1. **Body layout assumption** — `body[data-page]` flex rule assumes `#app-shell` (sidebar+chrome) and `.page-main` are siblings per spec §4.1. If `shell.js` nests `.page-main` inside `.app-frame` instead, the sibling flex rule should be removed in Task 2.
2. **No visual smoke test** — CSS verification is pattern-based only; font loading and sticky stacking need browser check in Task 3.
3. **Helper classes beyond interfaces** — `.main-column`, `.demo-path-step`, etc. are intentional for shell injection but not listed in the brief interfaces table.

## Commits

| SHA | Subject |
|-----|---------|
| `02a2f68` | feat(frontend): add design tokens and shell component CSS |

## Report path

`C:/Users/Ibiza/Desktop/project/挑战杯/.superpowers/sdd/task-1-report.md`
