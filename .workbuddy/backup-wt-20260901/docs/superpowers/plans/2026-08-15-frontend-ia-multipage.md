# Frontend IA Multipage Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cluttered single-file portal navigation with a multi-page Vanilla shell, judge-first home journey, and archive root `_*.py`/`_*.txt` scripts — without losing any existing view capabilities.

**Architecture:** Shared `shell.js` injects sidebar/topbar/demo-path into each `pages/*.html`. Business logic stays Vanilla; Phase 0 builds the shell + home and bridges undigested pages back to `portal.html#view-*`. Later phases cut views out of `portal.html` into dedicated page JS files.

**Tech Stack:** Static HTML/CSS/JS, `python -m http.server` on `:8080`, FastAPI on `:5000`, no bundler.

**Spec:** `docs/superpowers/specs/2026-08-15-frontend-ia-multipage-design.md`

## Global Constraints

- No Vue/React/Vite this cycle
- Do not change FastAPI route contracts
- Default `API_BASE = 'http://127.0.0.1:5000'`
- Keep `portal.html` until Phase 3 archive
- Feature zero-loss: every old `view-*` must remain reachable (new page or portal bridge)
- Prefer `git mv` for script archival
- Commits per completed task

## File map (target)

| Path | Responsibility |
|------|----------------|
| `frontend/css/tokens.css` | Color/type/spacing CSS variables |
| `frontend/css/shell.css` | App chrome layout (sidebar, topbar, demo strip) |
| `frontend/css/components.css` | Buttons, cards, tags shared by home |
| `frontend/js/api.js` | `API_BASE`, `apiFetch`, toast helper |
| `frontend/js/shell.js` | Nav model, inject chrome, demo path, active page |
| `frontend/js/pages/home.js` | Home journey interactions |
| `frontend/pages/home.html` | Judge story home |
| `frontend/pages/_bridge.html` | Optional thin redirect helper (or use query on portal) |
| `frontend/login.html` | Redirect to `pages/home.html` |
| `frontend/index.html` | Redirect to login or home |
| `frontend/portal.html` | Legacy banner + keep views |
| `scripts/devtools/` | Archived root `_*.py` / `_*.txt` |

---

### Task 1: Create design tokens + shell CSS

**Files:**
- Create: `frontend/css/tokens.css`
- Create: `frontend/css/shell.css`
- Create: `frontend/css/components.css`

**Interfaces:**
- Produces: CSS variables `--signal`, `--signal-deep`, `--primary`, `--bg-page`, `--bg-sidebar`, `--text-dark`, `--font-display`, `--font-body`, `--font-mono`; classes `.app-frame`, `.sidebar`, `.nav-item`, `.topbar`, `.demo-path`, `.page-main`, `.btn`, `.btn-primary`, `.journey-step`

- [ ] **Step 1: Create `frontend/css/tokens.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

:root {
  --signal: #2DD4BF;
  --signal-deep: #0D9488;
  --signal-dim: rgba(45, 212, 191, 0.14);
  --primary: #0D9488;
  --primary-light: #2DD4BF;
  --bg-page: #F4F7F8;
  --bg-sidebar: #0B1220;
  --bg-card: #FFFFFF;
  --text-dark: #0F172A;
  --text-secondary: #64748B;
  --text-muted: #94A3B8;
  --text-on-dark: #E2E8F0;
  --border: #E2E8F0;
  --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.08);
  --radius: 12px;
  --font-display: 'Noto Serif SC', 'Songti SC', serif;
  --font-body: 'DM Sans', 'Noto Sans SC', "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --sidebar-w: 248px;
  --topbar-h: 56px;
  --demo-h: 44px;
}
```

- [ ] **Step 2: Create `frontend/css/shell.css`** with layout for `.app-frame` (sidebar + main column), dark sidebar nav groups「主线」「更多」, `.demo-path` sticky strip under topbar, responsive collapse at 900px.

- [ ] **Step 3: Create `frontend/css/components.css`** with `.btn`, `.btn-primary`, `.btn-ghost`, `.journey-step`, `.banner-legacy`, `.tag`.

- [ ] **Step 4: Smoke-open tokens** — create a temporary blank HTML only if needed; otherwise proceed to Task 2 and verify together.

- [ ] **Step 5: Commit**

```bash
git add frontend/css/tokens.css frontend/css/shell.css frontend/css/components.css
git commit -m "feat(frontend): add design tokens and shell component CSS"
```

---

### Task 2: Add `api.js` + `shell.js`

**Files:**
- Create: `frontend/js/api.js`
- Create: `frontend/js/shell.js`

**Interfaces:**
- Produces:
  - `window.API_BASE: string` (default `http://127.0.0.1:5000`)
  - `window.apiFetch(path: string, options?: RequestInit): Promise<any>` — JSON helper, throws Error with message
  - `window.showToast(message: string, tone?: 'mint'|'amber'|'cyan'): void`
  - `window.Shell.mount({ pageId: string, title: string, subtitle: string }): void`
  - Nav items fixed in `shell.js` `NAV` constant matching spec §3.1–3.2
  - Undigested pages use `href` to `../portal.html#view-<id>` until Phase 1/2 migrates them
  - Demo path order: `map` → `evolution` → `discovery` → `match`

- [ ] **Step 1: Write `frontend/js/api.js`**

```javascript
(function () {
  window.API_BASE = window.API_BASE || 'http://127.0.0.1:5000';

  window.showToast = function (message, tone) {
    let el = document.getElementById('app-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-toast';
      el.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9999;padding:12px 16px;border-radius:10px;background:#0B1220;color:#fff;font:500 13px var(--font-body);box-shadow:0 8px 24px rgba(0,0,0,.25);opacity:0;transition:opacity .2s';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.borderLeft = tone === 'amber' ? '3px solid #F59E0B' : '3px solid #2DD4BF';
    el.style.opacity = '1';
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2800);
  };

  window.apiFetch = async function (path, options) {
    const url = path.startsWith('http') ? path : window.API_BASE + path;
    const res = await fetch(url, options);
    let payload = null;
    try { payload = await res.json(); } catch (_) { payload = null; }
    if (!res.ok) {
      const msg = (payload && (payload.detail || payload.message)) || ('HTTP ' + res.status);
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return payload;
  };
})();
```

- [ ] **Step 2: Write `frontend/js/shell.js`** implementing `NAV` (primary + more), `DEMO_STEPS`, `Shell.mount`:
  - Inject into `#app-shell`
  - Paths relative from `pages/` → use prefix `../` for css already in HTML; nav hrefs like `home.html`, `map.html`, or `../portal.html#view-map` for bridges
  - For Phase 0 bridge map: pages that do not exist yet point to portal hash
  - Read `localStorage.zhitu_user` if present for avatar label
  - Toggle「更多」open state in `sessionStorage.shell_more_open`

Bridge href map for Phase 0:

```javascript
const PAGE_HREF = {
  home: 'home.html',
  map: '../portal.html#view-map',
  evolution: '../portal.html#view-evolution',
  discovery: '../portal.html#view-discovery',
  match: '../portal.html#view-match',
  qa: '../portal.html#view-qa',
  collection: '../portal.html#view-collection',
  analysis: '../portal.html#view-analysis',
  quality: '../portal.html#view-quality',
  settings: '../portal.html#view-settings',
  profile: '../profile.html'
};
```

After a page is migrated in later tasks, change only that entry to `map.html` etc.

- [ ] **Step 3: Manual check** — open via http.server after Task 3; for now commit.

- [ ] **Step 4: Commit**

```bash
git add frontend/js/api.js frontend/js/shell.js
git commit -m "feat(frontend): add api helper and shared app shell"
```

---

### Task 3: Build `pages/home.html` + home journey JS

**Files:**
- Create: `frontend/pages/home.html`
- Create: `frontend/js/pages/home.js`

**Interfaces:**
- Consumes: `Shell.mount`, CSS from `../css/*`
- Produces: Working home at `/pages/home.html` with four journey blocks

- [ ] **Step 1: Create `frontend/pages/home.html`**

Skeleton:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>执图破局 · 演示路径</title>
  <link rel="stylesheet" href="../css/tokens.css" />
  <link rel="stylesheet" href="../css/shell.css" />
  <link rel="stylesheet" href="../css/components.css" />
</head>
<body data-page="home">
  <div id="app-shell"></div>
  <main class="page-main" id="page-main">
    <!-- four journey-step sections per spec §4.2 -->
  </main>
  <script src="../js/api.js"></script>
  <script src="../js/shell.js"></script>
  <script src="../js/pages/home.js"></script>
</body>
</html>
```

Journey copy (exact):
1. 标题「数据与图谱底座」/ 正文说明多源异构数据驱动岗位能力图谱 / 次要链接「采集与质量」→ portal collection/quality / 主按钮可弱化为文字链
2. 「看地图」→ `PAGE_HREF.map`
3. 「看演化与发现」→ evolution + discovery
4. 「做人岗匹配」主 CTA → match

- [ ] **Step 2: Create `frontend/js/pages/home.js`** calling `Shell.mount({ pageId:'home', title:'演示路径', subtitle:'数据 → 图谱 → 匹配' })`.

- [ ] **Step 3: Verify in browser**

```bash
cd frontend && python -m http.server 8080
```

Open `http://127.0.0.1:8080/pages/home.html`  
Expected: sidebar primary nav, demo strip, four steps, links open portal hashes or pages.

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/home.html frontend/js/pages/home.js
git commit -m "feat(frontend): add judge-first home journey page"
```

---

### Task 4: Wire login + index + portal banner + hash routing

**Files:**
- Modify: `frontend/login.html` (redirect targets `pages/home.html`)
- Modify: `frontend/index.html` (redirect to `login.html` or `pages/home.html`)
- Modify: `frontend/portal.html` (legacy banner + hash → `switchView`)

**Interfaces:**
- Login success → `pages/home.html`
- `portal.html` on load: if `location.hash` is `#view-map` etc., call existing `window.switchView(id)`
- Banner HTML at top of `.app` or `body`: 「你正在使用旧版单页门户」+ link to `pages/home.html`

- [ ] **Step 1: In `login.html`, replace both `portal.html` redirects** with `pages/home.html`.

- [ ] **Step 2: Make `index.html` a short redirect:**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0; url=login.html" />
  <script>location.replace('login.html');</script>
  <title>执图破局</title>
</head>
<body><a href="login.html">进入登录</a></body>
</html>
```

(If current `index.html` is a full app duplicate of portal, replace carefully: move old content is NOT required — portal remains. Back up by `git` history.)

- [ ] **Step 3: Add portal banner** after `<body>` / `.app` open, and hash boot:

```javascript
(function bootHashView() {
  const h = (location.hash || '').replace(/^#view-/, '').replace(/^#/, '');
  if (h && typeof window.switchView === 'function') {
    window.switchView(h, { skipHash: true });
  }
  window.addEventListener('hashchange', () => {
    const id = (location.hash || '').replace(/^#view-/, '').replace(/^#/, '');
    if (id && window.switchView) window.switchView(id, { skipHash: true });
  });
})();
```

Place near existing `switchView` listeners after it is defined.

- [ ] **Step 4: Manual test**

1. `login.html` → after mock/real login lands on `pages/home.html`
2. From home click「数字人才地图」→ `portal.html#view-map` shows map view
3. Banner visible on portal

- [ ] **Step 5: Commit**

```bash
git add frontend/login.html frontend/index.html frontend/portal.html
git commit -m "feat(frontend): route login to new home and bridge portal hashes"
```

---

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

---

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

## Phase 1+ (separate execution rounds — outline)

Implement only after Phase 0 acceptance. Each migrated page: extract HTML/CSS/JS from `portal.html`, set `PAGE_HREF.<id>` to local file, keep behavior.

### Task 7: Migrate map → `pages/map.html` + `js/pages/map.js`
- Cut `#view-map` + map scripts; fix `china-geo.json` → `../assets/china-geo.json` (git mv file)
- Update `PAGE_HREF.map = 'map.html'`

### Task 8: Migrate match → `pages/match.html` (CareerFit included)
- Cut match hall + diagnose + competitiveness modal/JS
- Samples path `../samples/...`

### Task 9: Migrate evolution (+ tabs learningPath, newSkill)

### Task 10: Migrate discovery

### Task 11: Migrate qa

### Task 12: Migrate more/* + profile; retire duplicate `index` app body if any

### Task 13: Phase 3 polish — archive `portal.html` to `scripts/devtools/archive-frontend/`, empty states, mobile nav

---

## Spec coverage self-check

| Spec item | Task |
|-----------|------|
| Tokens + shell | 1–2 |
| Home journey | 3 |
| Login / index / portal bridge | 4 |
| Devtools archive | 5 |
| Phase 0 done-when | 6 |
| Progressive page splits | 7–12 |
| Portal archive | 13 |
| No framework / no API break | Global Constraints |

## Placeholder scan

None intentional. Phase 1+ tasks are outlined for later rounds with explicit file targets; execute Phase 0 Tasks 1–6 first.
