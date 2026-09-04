# Claude Code 全局前端与软件架构能力安装设计

**日期：** 2026-09-02  
**状态：** 已批准，待实施  
**范围：** 用户级 Claude Code 配置 `C:\Users\Ibiza\.claude\`；不修改当前项目功能代码

---

## 1. 目标

为所有 Claude Code 项目提供两类可自动发现的能力：

1. **前端设计与实现**：继续使用已安装的 Anthropic 官方 `frontend-design`。
2. **全栈软件架构**：安装官方 `feature-dev` 插件，并新增一个轻量、用户级 `software-architecture` skill，使架构设计、模块拆分、重构规划、API/数据边界、可靠性与部署演进等请求能够按描述自动触发。

用户无需显式输入 `/frontend-design` 或 `/software-architecture`；Claude Code 根据 skill 的名称和 `description` 判断相关性并调用。手动调用仍可作为可选入口。

---

## 2. 当前状态

- 用户级 `frontend-design` skill 已存在：`~/.claude/skills/frontend-design/SKILL.md`。
- `frontend-design@claude-plugins-official` 已按用户级 scope 安装。
- Anthropic 官方 marketplace 已注册：`anthropics/claude-plugins-official`。
- 当前未安装通用架构 skill。
- 官方 `feature-dev` 插件提供：
  - `code-explorer`：追踪既有实现与代码模式；
  - `code-architect`：形成具体架构蓝图；
  - `code-reviewer`：检查正确性、约定与质量；
  - `/feature-dev`：面向复杂功能的完整七阶段工作流。

---

## 3. 选定方案

采用“官方能力 + 本地轻量自动入口”的组合：

1. **保留现有 `frontend-design`，不重复安装。**
2. **安装官方 `feature-dev` 插件到 user scope。**
3. **新增 `~/.claude/skills/software-architecture/SKILL.md`。**
4. **不增加 Hook、MCP 或强制 agent。**

该组合把自动匹配与重型工作流分离：

- 普通架构咨询、设计和重构规划由 `software-architecture` 自动匹配；
- 复杂、多文件新功能可按需使用官方 `feature-dev` 代理或命令；
- 避免每次请求都启动后台代理，减少长时间 `Swirling…`。

---

## 4. `software-architecture` Skill 设计

### 4.1 自动触发范围

`description` 应清楚覆盖以下意图：

- 设计或评审软件架构；
- 规划新功能的模块边界与集成方式；
- 拆分单体、模块或大型文件；
- 设计前后端接口、领域模型、数据流和状态所有权；
- 技术选型与架构权衡；
- 可靠性、性能、安全、可观测性和部署拓扑；
- 渐进式重构、迁移及演进路线。

同时注明不用于简单的一行修复、纯视觉设计或已经完全明确的小改动，减少误触发。

### 4.2 工作原则

1. **先读现状**：检查项目说明、技术栈、目录、相似实现和约定；不得脱离代码库套模板。
2. **先约束后方案**：明确目标、非目标、负载、兼容性、团队能力和交付约束。
3. **匹配复杂度**：优先最简单且满足约束的设计，避免无依据的微服务、事件总线或抽象层。
4. **明确边界**：每个组件说明职责、接口、依赖、状态所有权和失败方式。
5. **贯通数据流**：覆盖入口、验证、业务处理、持久化、异步边界和输出。
6. **纳入横切关注点**：错误处理、安全、性能、可靠性、可观测性、测试、部署与回滚。
7. **形成可实施蓝图**：给出具体文件/模块影响、分阶段构建顺序、迁移与验收标准。
8. **记录关键决策**：对重要取舍使用简洁 ADR 结构（背景、决策、替代方案、后果）。

### 4.3 输出结构

根据任务规模裁剪，不机械输出空章节：

- 现有模式与约束（含 `file:line` 证据）；
- 推荐架构与理由；
- 组件及接口；
- 数据流与状态所有权；
- 失败处理及横切关注点；
- 文件/模块影响图；
- 分阶段实施、迁移和回滚；
- 风险、验证方法和未决问题。

---

## 5. 安装与配置边界

### 写入

- `~/.claude/skills/software-architecture/SKILL.md`
- Claude Code 自身管理的用户级插件安装记录与缓存（通过官方插件安装命令）

### 保留不动

- 当前项目源代码与项目级 `.claude/` 配置；
- 现有 `frontend-design` 内容；
- 全局 Hooks、MCP 和权限规则；
- 其他已安装 skills。

### 凭据说明

检查中发现用户设置包含明文认证令牌。本任务不读取其用途、不复制、不修改。令牌应另行轮换并迁移到更安全的凭据来源；这不阻塞本次技能安装。

---

## 6. 验证

安装完成后执行不产生项目改动的验证：

1. 检查 `installed_plugins.json` 中存在 user-scope 的 `feature-dev@claude-plugins-official`。
2. 检查 `software-architecture/SKILL.md` 的 frontmatter、名称和描述。
3. 检查全局技能发现结果包含 `frontend-design` 与 `software-architecture`。
4. 用两个语义测试验证匹配边界：
   - “为人才匹配页面设计有辨识度且可访问的界面”应匹配前端能力；
   - “规划人才匹配服务的模块边界、API、数据流和渐进迁移”应匹配架构能力。
5. 确认未新增 Hook 或 MCP，且项目 Git 工作树未因安装发生变化。

由于 Claude Code 通常在会话启动时加载技能列表，如当前会话无法立即显示新 skill，应重启会话后完成最终发现验证。

---

## 7. 回滚

- 卸载 `feature-dev@claude-plugins-official` 的 user-scope 安装；
- 删除由本次创建的 `~/.claude/skills/software-architecture/`；
- 不影响现有 `frontend-design` 或项目代码。
