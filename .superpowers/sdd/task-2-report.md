# Task 2 Report: Add api.js + shell.js

## Status

**DONE** — `frontend/js/api.js` and `frontend/js/shell.js` created, source-verified, and committed.

## What Was Implemented

### `frontend/js/api.js`

Verbatim from the task brief:

- `window.API_BASE` defaults to `http://127.0.0.1:5000` (does not overwrite a pre-set value)
- `window.showToast(message, tone)` — fixed `#app-toast`; amber left border vs mint (`#2DD4BF`)
- `window.apiFetch(path, options)` — prefixes relative paths with `API_BASE`, parses JSON, throws `Error` from `detail` / `message` / `HTTP <status>`

### `frontend/js/shell.js`

- `PAGE_HREF` copied verbatim (Phase 0 bridges to `../portal.html#view-*`; `home.html`; `../profile.html`)
- `NAV.primary` matches spec §3.1 (6 items); `NAV.more` matches spec §3.2 (4 items)
- `DEMO_STEPS` order: `map` → `evolution` → `discovery` → `match`
- `window.Shell.mount({ pageId, title, subtitle })` injects chrome into `#app-shell`

**Layout (Task 1 Important finding):** `Shell.mount` builds:

```html
<div id="app-shell" class="app-frame">
  <aside class="sidebar">...</aside>
  <div class="main-column">
    <header class="topbar">...</header>
    <div class="demo-path">...</div>
    <!-- existing #page-main / sibling .page-main moved here -->
  </div>
</div>
```

If `#page-main` (or a sibling `.page-main`) sits next to `#app-shell`, it is moved into `.main-column` after `.demo-path` so the flex column works.

Also:

- Avatar label from `localStorage.zhitu_user` (`name` / `username` / `displayName` / `nickname`; fallback `访客`)
- 「更多」open state in `sessionStorage.shell_more_open` (`1`/`0`); auto-open when `pageId` is a more-item
- Mobile hamburger toggles `.sidebar.is-open` + `.sidebar-backdrop.is-visible`
- Topbar user chip links to `PAGE_HREF.profile`
- Exposed `window.PAGE_HREF` and `Shell.NAV` / `Shell.DEMO_STEPS` for later pages (Task 3 home journey)

No Vue/React. Paths assume scripts run from `pages/`.

## Verification

**RED (before files existed):** Python source check failed with `missing frontend/js/api.js` / `missing frontend/js/shell.js` and all interface assertions.

**GREEN (after implementation):**

```text
PASS
api.js + shell.js: Shell.mount, apiFetch, showToast, PAGE_HREF bridges, NAV, DEMO_STEPS, user/more storage
```

Checked in source:

| Symbol / value | Present |
|----------------|---------|
| `window.apiFetch` | yes |
| `window.showToast` | yes |
| `window.API_BASE` + `http://127.0.0.1:5000` | yes |
| `window.Shell` + `mount` | yes |
| All 11 `PAGE_HREF` strings verbatim | yes |
| Spec §3.1–3.2 NAV labels | yes |
| Demo ids `map`, `evolution`, `discovery`, `match` | yes |
| `zhitu_user` / `shell_more_open` | yes |
| `#page-main` move + `.app-frame` / `.main-column` | yes |

Browser smoke deferred to Task 3 (`python -m http.server` + `pages/home.html`).

## Self-Review

| Check | Result |
|-------|--------|
| `api.js` matches brief verbatim | Yes |
| `PAGE_HREF` verbatim | Yes |
| NAV matches spec §3.1–3.2 | Yes — labels and grouping |
| Demo path order | Yes |
| `#page-main` nested in `.main-column` | Yes |
| No Vue/React | Yes |
| Only requested files committed | Yes — 2 files |

Notes (not blockers):

- `showToast` `cyan` tone is in the type comment but the brief implementation only special-cases `amber` (mint default). Plan-mandated.
- `title` / `subtitle` are interpolated as HTML; callers are first-party page scripts.
- `body[data-page]` sibling flex rules in `shell.css` remain; after the move, `#app-shell.app-frame` is the body child and still has `width: 100%` / `min-height: 100vh`. Optional CSS cleanup later.

## Concerns

1. **No browser mount test yet** — brief Step 3 defers visual check to Task 3.
2. **`showToast` cyan unused** — follows brief code, not the optional third tone.
3. **More-group CSS** — collapse uses inline `display` because `shell.css` has no `.nav-more-items` rule.

## Commits

| SHA | Subject |
|-----|---------|
| `6edc08f` | feat(frontend): add api helper and shared app shell |

## Report path

`C:/Users/Ibiza/Desktop/project/挑战杯/.superpowers/sdd/task-2-report.md`
