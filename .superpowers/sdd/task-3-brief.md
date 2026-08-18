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

## ADDENDUM (user-approved 2026-08-15)

Home page MUST include a teal/cyan-green particle starfield background:
- Canvas layer behind content, pointer-events:none, z-index below journey content
- Palette: teal/cyan greens aligned with --signal #2DD4BF and --signal-deep #0D9488 (蓝绿色)
- ~120-250 particles; soft links optional; keep FPS friendly
- Disable animation when prefers-reduced-motion: reduce (show static dark-teal gradient instead)
- Only on home.html (not business pages)
- Put logic in frontend/js/pages/home.js or frontend/js/pages/particles-teal.js imported by home
- Add minimal CSS for .home-particles / .home-stage positioning in components.css or a small home.css linked from home.html

