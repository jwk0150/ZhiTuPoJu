# 执图破局前端 IA 重建与多页拆分 — 设计规格

**日期：** 2026-08-15  
**状态：** 已批准  
**范围：** `frontend/` 多页重建 + 根目录临时脚本整理  

---

## Brief

- **Goal：** 评委/用户 30 秒内知道怎么走；功能零丢失；目录可维护，达到可演示、可上线的竞赛级前端壳。
- **User / surface：** 默认评委路演；求职者/研究者能力保留但降级到次要入口。主表面为多页 Vanilla 门户（登录后进新首页）。
- **In scope：** 信息架构重排、共享壳、首页演示路径、渐进拆页、视觉 token 统一、根目录 `_*.py`/`_*.txt` 归档、登录跳转新首页、旧 portal 过渡横幅。
- **Out of scope：** 本轮不上 Vue/React；不改后端 API 契约；不重做爬虫；不做整仓 backend/crawler 重构。
- **Constraints：** 保留现有业务能力与 API（`API_BASE` 默认 `http://127.0.0.1:5000`）；单文件 `portal.html` 过渡期保留；无构建工具优先（纯静态可 `python -m http.server` 启动）。
- **Done when：** 新导航下主线 6 页可点通；首页三步演示路径可走完到匹配；旧 view 均有对照落点；根目录临时脚本已迁入 `scripts/devtools/`；登录进新首页。
- **Recommended approach：** 方案一 — 渐进拆页（先壳+首页，再按主线拆业务页）。
- **Open risks：** `portal.html` 内联 JS 耦合紧，拆页时需按模块剪切而非重写逻辑；ECharts/地图资源路径变更。

---

## 1. 背景与问题

当前 `frontend/portal.html`（约 1.2 万行）将全部业务塞进单页多 `view-*`，侧栏把求职、研究、运维入口平铺，导致：

1. 不知道先点哪里（任务路径缺失）
2. 子页（学习路径、新增技能）与主功能同级，分类混乱
3. 单文件难维护、难协作、难上线演进
4. 仓库根目录大量 `_check_*` / `_diag_*` 临时文件，观感不专业

---

## 2. 已确认决策

| 项 | 决策 |
|----|------|
| 主受众 | 评委路演默认；其他角色能力进「更多」或顶栏 |
| 叙事主线 | **数据底座 → 图谱/地图 → 人岗匹配**（匹配是高潮） |
| 技术路线 | 多页 + 共享壳（Vanilla HTML/CSS/JS），不上框架 |
| 推进方式 | **方案一渐进拆页** |
| 目录清理 | **B：frontend 重建 + 根目录临时脚本归档** |

---

## 3. 信息架构

### 3.1 主线导航（默认展开）

| 顺序 | 导航名 | 路由文件 | 对应旧 view |
|------|--------|----------|-------------|
| 1 | 首页 / 演示路径 | `pages/home.html` | `view-dashboard`（重做为故事线，非 KPI 堆） |
| 2 | 数字人才地图 | `pages/map.html` | `view-map` |
| 3 | 岗位能力演化 | `pages/evolution.html` | `view-evolution` + 页内 Tab：`learningPath`、`newSkill` |
| 4 | 新岗位发现 | `pages/discovery.html` | `view-discovery` |
| 5 | 人岗匹配诊断 | `pages/match.html` | `view-match`（含 CareerFit 双模式） |
| 6 | 智能问答 | `pages/qa.html` | `view-qa` |

### 3.2 「更多」（折叠）

| 导航名 | 路由 | 旧 view |
|--------|------|---------|
| 数据采集 | `pages/more/collection.html` | `view-collection` |
| 趋势分析 | `pages/more/analysis.html` | `view-analysis`（及 `trend.html` 能力并入或链过去） |
| 质量监控 | `pages/more/quality.html` | `view-quality` |
| 系统设置 | `pages/more/settings.html` | `view-settings` |

### 3.3 账户

- **我的资料**：顶栏头像 → `pages/profile.html`（现有 `profile.html` 迁入或包装）
- 不占用主线侧栏位

### 3.4 功能不丢原则

拆页前维护对照表（见附录 A）。每个旧 `data-view` / 独立 HTML 必须映射到新页或页内区域；下线 `portal.html` 前做一次点击验收。

---

## 4. 壳层与首页

### 4.1 共享壳

每页结构：

```html
<body data-page="map">
  <div id="app-shell"><!-- shell.js 注入侧栏+顶栏+演示条 --></div>
  <main class="page-main"><!-- 本页内容 --></main>
</body>
```

- `js/shell.js`：根据 `data-page` 高亮导航；渲染「演示下一步」条
- `js/api.js`：统一 `API_BASE`、`fetch` 封装、toast 钩子
- 顶栏：品牌 + 当前页一句话 + 用户入口
- 演示路径条：地图 → 演化 → 发现 → 匹配（当前步高亮，可一键下一步）

### 4.2 首页（评委第一眼）

竖向四段，每段一个主按钮：

1. **数据与图谱底座** — 说明多源数据与图谱；次要链到「更多 / 采集·质量」
2. **看地图** → `map.html`
3. **看演化与发现** → `evolution.html` / `discovery.html`
4. **做人岗匹配** → `match.html`（主 CTA）

禁止：首页堆运维 KPI、多入口平铺、无说明的图标墙。

### 4.3 视觉

- 延续现有青绿信号色，抽成 `css/tokens.css`
- `shell.css` + `components.css` 统一侧栏、按钮、页眉、空态
- 动效克制：路径高亮、轻量页入场；尊重 `prefers-reduced-motion`
- 「更多」页可用更朴素密度，主线页留白与层级优先

---

## 5. 目标目录结构

```
frontend/
  css/
    tokens.css
    shell.css
    components.css
  js/
    api.js
    shell.js
    pages/          # 各页业务脚本（从 portal 剪切）
      home.js
      map.js
      evolution.js
      discovery.js
      match.js
      qa.js
      ...
  pages/
    home.html
    map.html
    evolution.html
    discovery.html
    match.html
    qa.html
    profile.html
    more/
      collection.html
      analysis.html
      quality.html
      settings.html
  assets/           # china-geo.json、图标等
  samples/          # 示例简历（保留）
  login.html        # 登录成功 → pages/home.html
  portal.html       # 过渡期保留 + 横幅指向新版；验收后归档
  index.html        # 重定向到 pages/home.html 或 login

scripts/
  devtools/         # 原根目录 _*.py / 诊断输出 _*.txt
```

---

## 6. 分阶段交付（方案一）

### Phase 0 — 地基（可立即演示壳）

- 建立 `css/`、`js/`、`pages/`、`scripts/devtools/`
- 实现 shell + tokens + 新首页
- `login.html` 跳转新首页；`portal.html` 加「进入新版」横幅
- 根目录临时脚本迁入 `scripts/devtools/`（git mv，不改逻辑）

**验收：** 登录 → 新首页 → 侧栏可点（未拆页的链到 portal 锚点或占位说明）

### Phase 1 — 主线拆页（优先）

顺序：`map` → `match` → `evolution`（含 Tab）→ `discovery` → `qa`

**验收：** 演示路径条可走完；匹配含 CareerFit；演化内可进学习路径/新增技能

### Phase 2 — 「更多」与资料

- collection / analysis / quality / settings / profile
- 清理 `index_backup_old.html` 等备份到 `scripts/devtools/archive-frontend/` 或删除（需确认）

**验收：** 附录 A 全绿

### Phase 3 — 抛光与下线旧门户

- 空态、错误态、演示脚本文案、移动端侧栏
- 确认无引用后归档/删除 `portal.html` 巨页（或移至 archive）

---

## 7. 过渡与兼容

| 项 | 策略 |
|----|------|
| 旧书签 `/portal.html` | 顶部横幅 + 可选 3s 提示，不强制跳转 |
| 未拆完的页 | 侧栏链到 `portal.html#view-xxx` 或暂留 portal 内，壳上标记「旧版页」 |
| 静态资源 | `china-geo.json` 等迁 `assets/`，更新相对路径 |
| API | 不改路径；仅集中到 `api.js` |

---

## 8. 非目标（再次强调）

- 不引入 Vite/React/Vue（本规格周期内）
- 不修改 FastAPI 路由契约（除非发现硬编码端口不一致，仅前端对齐 5000）
- 不重写匹配/地图算法逻辑，以剪切迁移为主

---

## 附录 A — 旧 → 新对照（验收清单）

| 旧 | 新 | Phase |
|----|-----|-------|
| view-dashboard | pages/home.html | 0 |
| view-map | pages/map.html | 1 |
| view-evolution | pages/evolution.html | 1 |
| view-learningPath | evolution 内 Tab | 1 |
| view-newSkill | evolution 内 Tab | 1 |
| view-discovery | pages/discovery.html | 1 |
| view-match | pages/match.html | 1 |
| view-qa | pages/qa.html | 1 |
| view-collection | pages/more/collection.html | 2 |
| view-analysis | pages/more/analysis.html | 2 |
| view-quality | pages/more/quality.html | 2 |
| view-settings | pages/more/settings.html | 2 |
| view-user-profile / profile.html | pages/profile.html | 2 |
| login.html | 保留，改跳转 | 0 |
| index.html | 入口重定向 | 0 |
| trend.html / trends-mock.js | 并入 analysis 或 more 链 | 2 |

---

## 附录 B — 根目录清理规则

迁入 `scripts/devtools/`：

- `_check_*.py`、`_diag_*.py`、`_chk_*.py`、`_e2e_*.py`、`_smoke_*.py` 等诊断/验收脚本
- 对应 `*_out.txt`、`*_log.txt`、`_cmdtest.txt` 等输出

保留在根或原位：

- `run_backend.py`、`.env`、`.env.example`
- `backend/`、`crawler/`、`docs/`、`论文/` 等正式目录
- 业务数据/配置如 `zhoukou.yaml`（若仍被正式流程引用则保留；仅一次性诊断产物再迁）

删除前需确认无引用：`frontend/index_backup_old.html`、`frontend/test.json`（可进 archive）
