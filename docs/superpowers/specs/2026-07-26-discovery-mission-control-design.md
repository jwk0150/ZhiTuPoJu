# 新岗位发现 · 推演指挥舱前端设计规格

> **日期**：2026-07-26  
> **状态**：已通过（2026-07-26）  
> **范围**：`frontend/index.html` 的 `view-discovery` + 后端 `discovery` 接真实 PG + DeepSeek 增强  
> **关联**：方案 B · 双栏任务控制台；竞赛 Demo 冲击力优先

---

## 1. 目标与成功标准

### 1.1 一句话目标

把「新岗位发现」做成**左推演 / 右发现**的任务控制台：评委能同时看到智能体在思考、以及从本地真实招聘库里挖出的新兴岗位；视觉对标顶级产品 Demo。

### 1.2 成功标准

| # | 标准 | 验收 |
|---|------|------|
| 1 | 双栏并重，非 KPI 堆叠看板 | Idle / Scanning / Settled 三态清晰 |
| 2 | 推演过程可见、可感 | 6 步逐步点亮 + 插件特效 +「幻觉审计」高潮 |
| 3 | 数据真实 | 扫描结果来自本地 PostgreSQL `zhilian_*` 表（约 9k+ 条） |
| 4 | LLM 增强可选 | DeepSeek 润色定义/推理文案；失败则启发式兜底 |
| 5 | 密钥不进仓库 | `DEEPSEEK_API_KEY` 仅环境变量 / `.env`（gitignore） |
| 6 | 降级可用 | CDN 失败、无 Key、无后端时仍可演示（mock 或纯启发式） |

---

## 2. 信息架构与布局

### 2.1 范围

- **改**：`#view-discovery` 及其 CSS / JS；后端 `discovery.py` 增强（PG 已接，补 DeepSeek）
- **不改**：其它视图（看板 / 图谱 / 演化等）的结构与视觉语言（可复用全局 token）

### 2.2 线框

```
┌─ 顶栏：执图破局 · 新岗位发现智能体 | PG 条数 | dataSource 徽标 | [启动扫描] ─┐
│ 左 42% 推理指挥舱                    │ 右 58% 发现工作台                      │
│ · 粒子/神经网氛围层                  │ · KPI：发现 / 待审 / 采纳 / 预测         │
│ · 6 步时间线 + 当前步打字机细节      │ · Tab + 搜索 / 排序 / 分类               │
│ · 引擎 / 知识库 / DeepSeek 状态微标  │ · 岗位卡片网格（stagger 入场）           │
└──────────────────────────────────────┴────────────────────────────────────────┘
  点卡片 → 右侧抽屉 ~420px（定义 / 职责 / 场景 / 技能 / 证据 / 质量 / 采纳）
```

### 2.3 三态

| 状态 | 左栏 | 右栏 |
|------|------|------|
| **Idle** | 引导文案 + 弱粒子 | 空态：「等待智能体扫描」 |
| **Scanning** | 6 幕逐步点亮 + 特效 | 第 4 幕后卡片入场；第 5 幕预测卡浮现 |
| **Settled** | 可折成紧凑轨道；粒子降速 | 全量审核工作台 |

---

## 3. 视觉与插件

### 3.1 视觉方向

- 深墨指挥舱底 `#0B1220` + 信号青绿 `#2DD4BF` / `#0D9488` + 琥珀警示 `#F5A524`
- 字体：Noto Serif SC（标题）/ DM Sans + Noto Sans SC（正文）/ IBM Plex Mono（遥测数据）
- **禁止**：默认紫渐变、大面积卡片堆、emoji 刷屏（推理步骤可用克制图标，不用 🤖 堆砌）
- 预测卡：青绿 + 琥珀描边，不用紫色默认风

### 3.2 CDN 插件

| 插件 | 用途 |
|------|------|
| GSAP | 推演时间轴、卡片 stagger、抽屉滑入 |
| tsParticles | 指挥舱粒子连线（知识流动感） |
| Typed.js 或自写打字机 | 当前步思维流逐字输出 |
| ECharts（已有） | 步骤内微型雷达 / 指标柱 |
| Canvas 自绘 | Phase 2「语义簇」聚合短动画 |

### 3.3 推演六幕（对齐后端 `reasoning_chain`）

1. **多源数据接入** — 粒子汇入；扫描条数计数器跳动  
2. **语义消歧与聚类** — Canvas 散点→簇  
3. **多维度新兴度评分** — 三轴雷达依次点亮（新颖度 / 技能熵 / 跨行业）  
4. **岗位定义生成** — 打字机吐定义；DeepSeek 可用时标注「LLM 增强」  
5. **时序趋势外推** — 预测卡从雾中浮现  
6. **幻觉审计（签名高潮）** — 「智能体幻想」戏：待证声明被扫描束扫过；通过→青绿校验印；弱证据→琥珀警示  

`prefers-reduced-motion`：关粒子 / 神经网 / 打字机；步骤瞬间到位。

---

## 4. 结果工作台

### 4.1 KPI / Tab / 卡片

- KPI：本轮发现 · 待审核 · 已采纳 · 未来预测（可点击切 Tab）
- Tab：全部 / 待审 / 已采纳 / 未来预测 / 已拒绝
- 卡片：标题、分类/级别/城市、置信度条（≥80 青绿 / 60–80 琥珀 / <60 珊瑚）、技能芯片≤5、一行 `reasoning` 摘要、待审时采纳/拒绝
- 预测卡：额外 ETA + 驱动力两行

### 4.2 详情抽屉

分区顺序：身份条 → 定义 → 职责 → 场景 → 技能 → 证据链（公司·城市·来源）→ 质量四格 →（预测）驱动力+ETA。  
底栏：采纳 / 拒绝 / 关闭；Esc 关闭；打开时背景微暗。

### 4.3 批量采纳

仅 `pending && confidence >= 70`；toast + KPI 刷新。

---

## 5. 数据与后端

### 5.1 真实库（已存在）

| 项 | 值 |
|----|-----|
| Host / Port | `127.0.0.1:3309` |
| DB | `zhilian_crawl_db` |
| 表 | `zhilian_job_postings` + `zhilian_job_posting_details` |
| 规模 | ~9335 条（以实库为准） |
| 密码 | 本地开发用；**不写进前端、不提交明文到公开文档以外的配置** |

后端 `DiscoveryAgent._query_pg` 已 JOIN 两表拉取标题/公司/城市/薪资/技能/JD。扫描必须以该库为事实源，禁止用假 JD 冒充扫描结果（mock 仅作后端不可达时的前端演示降级）。

### 5.2 DeepSeek 增强（够用，角色清晰）

**结论：DeepSeek 足够支撑本模块 Demo。**

| 能力 | 是否用 DeepSeek | 说明 |
|------|-----------------|------|
| 标题聚类 / 新兴度评分 / 证据抽取 | ❌ 启发式本地算 | 快、稳、可复现；不烧 Token |
| 岗位定义润色、职责归纳、推演旁白 | ✅ `deepseek-chat` | 把干巴模板变成可读的「分析师口吻」 |
| 可选深度思考旁白 | △ `deepseek-reasoner` | 更炫但更慢更贵；默认关闭，开关控制 |

推荐默认：`deepseek-chat` + 只对 **Top-N（如 8）新兴发现** 调 LLM；其余保持启发式。配额紧张时仍完整出结果。

**鉴权（强制）**

```text
环境变量：DEEPSEEK_API_KEY
可选：DEEPSEEK_BASE_URL（默认 https://api.deepseek.com）
可选：DEEPSEEK_MODEL（默认 deepseek-chat）
```

- 密钥**禁止**写入 `index.html`、git 跟踪的配置、本规格正文中的真实值  
- 使用 `.env`（已在 `.gitignore`）或 shell 导出；文档只写占位符 `<DEEPSEEK_API_KEY>`  
- 若密钥曾出现在聊天记录中，建议在 DeepSeek 控制台**轮换**后再用于长期开发

**API 形态（后端）**

```
POST /api/discovery/agent/scan
  → 读 PG → 启发式发现 →（若有 Key）批量润色 Top-N 定义/旁白
  → 返回 { reasoning_chain, discoveries, forecasts, summary, stats, model }

model 字段示例：
  engine: DiscoveryAgent v2
  llm: deepseek-chat | none
  knowledge_base: PostgreSQL zhilian_*
```

前端展示 `model.llm`：有 Key 显示「DeepSeek 增强」；无则「启发式推理」。

### 5.3 前端数据流

```
启动扫描
  → POST /api/discovery/agent/scan（超时 ~60s，因可能含 LLM）
  → 成功：dataSource=api，驱动六幕动画（可用返回的 chain 逐步回放，或本地编排对齐）
  → 失败：toast 提示；可选 fallback 到本地 MockOrchestrator（仅 Demo 保底，卡片角标标明 mock）
```

采纳/拒绝：`POST /api/discovery/jobs/{id}/status`；失败则本地改状态并提示「未同步后端」。

### 5.4 降级矩阵

| 场景 | 行为 |
|------|------|
| 无 DeepSeek Key / 调用失败 | 纯启发式定义；推演 UI 照常；徽标「启发式」 |
| PG 空/连不上 | 返回错误；前端展示失败态 + 可选手动 mock |
| CDN 插件失败 | CSS 过渡兜底，功能完整 |
| `prefers-reduced-motion` | 关重特效 |
| 扫描中重复点击 | 忽略 + toast |

---

## 6. 状态模型（前端）

```js
discoveryState = {
  phase: 'idle' | 'scanning' | 'settled',
  activeStep: 0..6,
  scanning: boolean,
  dataSource: 'api' | 'mock',
  llmEnabled: boolean,       // 来自响应 model.llm !== 'none'
  discoveries: [],
  forecasts: [],
  reasoningChain: [],
  scanSummary: '',
  modelInfo: {},
  drawerJobId: null | string,
  search, sort, category, status
}
```

---

## 7. 实现边界与非目标

**本规格包含**

- 发现页 UI/动效重构（指挥舱）  
- 后端 scan 继续吃真实 PG；接入 DeepSeek 润色层  
- 密钥经环境变量注入  

**本规格不包含**

- 换成讯飞星火（可后续加路由，本阶段 DeepSeek）  
- 其它三个业务页重做  
- 生产级配额监控 / 计费看板  

---

## 8. 风险

| 风险 | 缓解 |
|------|------|
| LLM 拖慢扫描 | Top-N 限制 + 超时 + 启发式兜底 |
| 密钥泄露 | 环境变量；轮换；不进前端 |
| 特效喧宾夺主 | 签名高潮只留「幻觉审计」一幕；其余克制 |
| 真实数据新兴岗位少 | 评分阈值保持与现 Agent 一致；预测层补未来方向 |

---

## 9. 开放决策（已拍板）

| 决策 | 结论 |
|------|------|
| 布局 | 双栏 42/58 推演剧场优先（方案 B） |
| 视觉冲击 | GSAP + tsParticles + 幻觉审计幻想戏 |
| 数据 | 本地 PG 真实岗位 |
| LLM | DeepSeek `deepseek-chat` 增强定义/旁白，启发式保底 |

---

## 10. 下一步

用户审阅本规格 → 无修改后启用 **writing-plans** 拆实现任务 → 再动代码。

审阅请回复：通过 / 要改（指出章节）。
