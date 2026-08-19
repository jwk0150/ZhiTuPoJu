# Task 4 Report: Wire login + index + portal banner + hash routing

## Status

**DONE** — Login lands on `pages/home.html`; `index.html` is a short redirect to `login.html`; portal shows a legacy banner and boots `#view-*` hashes via `window.switchView` after it is defined.

## What Was Implemented

### `frontend/login.html`

Both post-login redirects (`devLogin` and successful `handleLogin`) now go to `pages/home.html`. No remaining `portal.html` targets.

### `frontend/index.html`

Replaced the large portal duplicate (git history still has the old app) with a 10-line redirect: meta refresh + `location.replace('login.html')` + fallback link.

### `frontend/portal.html` (surgical)

- Banner after `<body>`: 「你正在使用旧版单页门户」+ link to `pages/home.html`. `.app` height is `calc(100vh - 36px)` so the bar does not clip the flex row.
- `bootHashView` IIFE placed immediately after `window.switchView` is assigned. Strips `#view-` then `#`, calls `switchView(id, { skipHash: true })`, and listens for `hashchange`.
- Existing hashchange + `load` start-view parser also strip `#view-` so `portal.html#view-map` does not fall back to dashboard.

## Verification

**GREEN** — `python .superpowers/sdd/check_task_4.py`

```text
PASS login no portal.html
PASS login home redirects (count=2)
PASS index short redirect (lines=10)
PASS index not full app
PASS portal banner
PASS portal bootHashView
PASS boot after switchView
PASS hash strips #view-
OVERALL PASS
```

**Select-String:** `pages/home.html` in login (×2) and portal banner; `location.replace('login.html')` in index; `bootHashView` in portal.

No headed browser click-through (login mock, home CTA → map view). Source/static checks only.

## Self-Review

| Check | Result |
|-------|--------|
| Login → `pages/home.html` | Yes (both redirects) |
| Index is short login redirect | Yes; old app remains in git history |
| Portal banner + home link | Yes |
| Hash boot after `switchView` exists | Yes |
| `#view-map` parsed on load | Yes |

## Concerns

1. **No headed UI pass** — cannot confirm map view paints after `portal.html#view-map` until Task 6 / a real browser.
2. **Double hashchange listeners** — original listener kept (now also strips `#view-`) plus `bootHashView`; `#map` (without `view-`) may call `switchView` twice.
3. **Early `bootHashView` vs `load`** — IIFE may call `switchView` before `generateAllData`; the `load` handler still switches after 60ms with the same hash id.
4. **Check script untracked** — `.superpowers/sdd/check_task_4.py` not in this commit.

## Commits

| SHA | Subject |
|-----|---------|
| `a1f4681` | feat(frontend): route login to new home and bridge portal hashes |

3 files: `frontend/login.html`, `frontend/index.html` (−9812 lines), `frontend/portal.html` (+banner/hash boot).

## Report path

`C:/Users/Ibiza/Desktop/project/挑战杯/.superpowers/sdd/task-4-report.md`
