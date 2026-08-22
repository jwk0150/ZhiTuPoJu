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


### Task 3: Discovery page shell (HTML structure)

**Files:**
- Modify: `frontend/index.html` — replace `#view-discovery` block (~lines 716–791)
- Modify: `<head>` — add CDN scripts after existing ECharts/G6:

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/tsparticles-slim@2.12.0/tsparticles.slim.bundle.min.js"></script>
```

**Interfaces:**
- Produces DOM ids later JS will bind:
  - `#disc-mission`, `#disc-left`, `#disc-right`
  - `#disc-particles`, `#disc-cluster-canvas`, `#disc-hallucination`
  - `#disc-steps`, `#disc-step-detail`, `#disc-engine-badge`, `#disc-llm-badge`, `#disc-pg-count`
  - `#btn-agent-scan`, `#kpi-discovered`, `#kpi-pending`, `#kpi-adopted`, `#kpi-forecast`
  - `#discovery-tabs`, `#discovery-search`, `#discovery-sort`, `#discovery-cat`, `#discovery-grid`
  - `#disc-drawer`, `#disc-drawer-body`, `#disc-drawer-title`, `#disc-drawer-actions`

- [ ] **Step 1: Replace `#view-discovery` inner HTML** with mission-control layout:

```html
<section class="view" id="view-discovery">
  <div class="disc-topbar">
    <div>
      <h1 class="disc-brand">新岗位发现智能体</h1>
      <div class="disc-sub">多源真实库推演 · 启发式发现 · DeepSeek 定义增强</div>
    </div>
    <div class="disc-topbar-meta">
      <span class="disc-chip" id="disc-pg-count">PG · —</span>
      <span class="disc-chip" id="disc-engine-badge">引擎待命</span>
      <span class="disc-chip" id="disc-llm-badge">LLM · —</span>
      <button class="btn btn-primary" id="btn-agent-scan" onclick="agentScan()">启动扫描</button>
      <button class="btn" onclick="agentBatchAdopt()">批量采纳</button>
    </div>
  </div>
  <div class="disc-mission" id="disc-mission" data-phase="idle">
    <aside class="disc-left" id="disc-left">
      <div id="disc-particles" class="disc-particles"></div>
      <canvas id="disc-cluster-canvas" class="disc-cluster-canvas" width="640" height="220"></canvas>
      <div class="disc-left-inner">
        <div class="disc-panel-label">推理指挥舱</div>
        <ol class="disc-steps" id="disc-steps"></ol>
        <div class="disc-step-detail" id="disc-step-detail">点击「启动扫描」，智能体将接入本地招聘库并展开六幕推演。</div>
        <div class="disc-radar" id="disc-radar" style="height:140px"></div>
        <div class="disc-hallucination" id="disc-hallucination" hidden></div>
      </div>
    </aside>
    <main class="disc-right" id="disc-right">
      <div class="disc-kpi-strip">
        <button class="disc-kpi" data-status="all"><span id="kpi-discovered">0</span><label>本轮发现</label></button>
        <button class="disc-kpi" data-status="pending"><span id="kpi-pending">0</span><label>待审核</label></button>
        <button class="disc-kpi" data-status="adopted"><span id="kpi-adopted">0</span><label>已采纳</label></button>
        <button class="disc-kpi" data-status="forecast"><span id="kpi-forecast">0</span><label>未来预测</label></button>
      </div>
      <div class="tab-bar" id="discovery-tabs">...</div>
      <!-- keep search/sort/cat controls with same ids -->
      <div class="job-grid" id="discovery-grid"></div>
    </main>
  </div>
  <aside class="disc-drawer" id="disc-drawer" aria-hidden="true">
    <div class="disc-drawer-head">
      <h2 id="disc-drawer-title">岗位详情</h2>
      <button type="button" onclick="closeDiscoveryDrawer()">×</button>
    </div>
    <div class="disc-drawer-body" id="disc-drawer-body"></div>
    <div class="disc-drawer-actions" id="disc-drawer-actions"></div>
  </aside>
  <div class="disc-drawer-mask" id="disc-drawer-mask" onclick="closeDiscoveryDrawer()"></div>
</section>
```

Keep existing tab ids (`discovery-count-*`) and filter control ids.

- [ ] **Step 2: Browser check** — open SPA, switch to 新岗位发现; layout dual-pane visible; no JS errors from missing nodes.

---
=======
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

>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338
