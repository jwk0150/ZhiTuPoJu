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
