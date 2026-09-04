# Claude Code 全局前端与软件架构能力安装实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在用户级 Claude Code 环境中保留现有官方前端设计能力，安装官方 `feature-dev` 插件，并新增可按需求自动匹配的全栈软件架构 skill。

**Architecture:** 以 `~/.claude/skills/software-architecture/SKILL.md` 作为轻量自动入口，以 `feature-dev@claude-plugins-official` 提供按需启用的代码探索、架构设计和质量评审代理。安装不引入 Hook、MCP 或项目级配置，避免无关请求触发重型后台流程。

**Tech Stack:** Claude Code 2.1.258、Anthropic 官方插件市场、Markdown `SKILL.md`、Windows 11 + Git Bash

## Global Constraints

- 所有能力安装到用户级 `C:\Users\Ibiza\.claude\`，适用于全部项目。
- 保留现有 `frontend-design` 文件及其用户级插件安装，不重复安装或覆盖。
- 仅从已注册的 `anthropics/claude-plugins-official` 安装 `feature-dev`。
- 不新增或修改 Hook、MCP、权限规则和项目功能代码。
- `software-architecture` 必须根据 name/description 自动发现，同时允许手动调用。
- 普通架构请求不强制启动后台代理；复杂新功能才按需使用 `feature-dev`。
- 不读取、复制或修改全局设置中的认证令牌。
- 本次不创建 Git 提交；用户级安装不属于项目版本控制，计划/规格文档也保持未提交，除非用户另行要求。

---

## File Structure

- Create: `C:\Users\Ibiza\.claude\skills\software-architecture\SKILL.md` — 自动匹配的全栈软件架构工作流。
- Modify through Claude CLI: `C:\Users\Ibiza\.claude\plugins\installed_plugins.json` — 增加 user-scope `feature-dev@claude-plugins-official` 记录；不手工编辑。
- Created through Claude CLI: `C:\Users\Ibiza\.claude\plugins\cache\claude-plugins-official\feature-dev\<version>\**` — 官方插件缓存；版本目录由 CLI 管理。
- Verify only: `C:\Users\Ibiza\.claude\skills\frontend-design\SKILL.md` — 保持原样。
- Verify only: `C:\Users\Ibiza\.claude\settings.json` — 不新增 Hooks、MCP 或插件配置。

---

### Task 1: 安装官方 Feature Development 插件

**Files:**
- Modify through CLI: `C:\Users\Ibiza\.claude\plugins\installed_plugins.json`
- Create through CLI: `C:\Users\Ibiza\.claude\plugins\cache\claude-plugins-official\feature-dev\<version>\**`
- Verify: `C:\Users\Ibiza\.claude\plugins\marketplaces\claude-plugins-official\plugins\feature-dev\.claude-plugin\plugin.json`

**Interfaces:**
- Consumes: 已注册 marketplace `claude-plugins-official`。
- Produces: user-scope 插件 ID `feature-dev@claude-plugins-official`，以及 `code-explorer`、`code-architect`、`code-reviewer` 和 `/feature-dev`。

- [ ] **Step 1: 确认插件尚未安装**

读取 `C:\Users\Ibiza\.claude\plugins\installed_plugins.json`，确认 `plugins` 中不存在 `feature-dev@claude-plugins-official`。

Expected: 当前仅有既存插件记录，未出现目标插件；若目标已存在，则跳过安装并直接验证。

- [ ] **Step 2: 执行用户级官方插件安装**

Run:

```bash
claude plugin install feature-dev@claude-plugins-official --scope user
```

Expected: 命令退出码为 0，并报告 `feature-dev` 已安装到 user scope。

- [ ] **Step 3: 验证安装记录与插件文件**

读取 `C:\Users\Ibiza\.claude\plugins\installed_plugins.json`，确认存在：

```json
"feature-dev@claude-plugins-official": [
  {
    "scope": "user",
    "installPath": "C:\\Users\\Ibiza\\.claude\\plugins\\cache\\claude-plugins-official\\feature-dev\\<version>"
  }
]
```

然后在记录给出的 `installPath` 下确认以下文件存在：

```text
.claude-plugin/plugin.json
agents/code-explorer.md
agents/code-architect.md
agents/code-reviewer.md
commands/feature-dev.md
```

Expected: 安装记录 scope 为 `user`，五个文件均存在。

---

### Task 2: 创建自动匹配的软件架构 Skill

**Files:**
- Create: `C:\Users\Ibiza\.claude\skills\software-architecture\SKILL.md`

**Interfaces:**
- Consumes: 当前项目代码、项目说明、`CLAUDE.md`/`AGENTS.md` 等约定，以及用户给出的目标和约束。
- Produces: 可实施的架构蓝图；复杂新功能可建议按需调用已安装的 `feature-dev`，但不得自动强制启动它。

- [ ] **Step 1: 写入完整 Skill**

创建 `C:\Users\Ibiza\.claude\skills\software-architecture\SKILL.md`，内容必须精确为：

```markdown
---
name: software-architecture
description: Design or review full-stack software architecture grounded in an existing codebase. Use for module and service boundaries, frontend/backend architecture, API and data modeling, state ownership, technology choices, scalability, reliability, security, observability, deployment topology, architectural refactoring, migrations, and implementation blueprints. Do not use for one-line fixes, purely visual styling, or small changes whose implementation is already fully specified.
---

# Software Architecture

Create the simplest architecture that satisfies the real constraints. Ground every recommendation in the codebase and the requested outcome rather than applying fashionable patterns by default.

## 1. Establish the context

Before proposing architecture:

- Read applicable `CLAUDE.md`, `AGENTS.md`, project documentation, manifests, configuration, and entry points.
- Identify the runtime stack, deployment model, module boundaries, persistence, external integrations, and existing conventions.
- Find the closest analogous feature and cite relevant evidence as `file:line`.
- State the goal, non-goals, compatibility requirements, delivery constraints, expected load, and important unknowns.
- Ask only questions whose answers materially change the design. When a conventional default fits the codebase, choose it and state the assumption.

For a complex multi-file feature, the installed `feature-dev` plugin can provide deeper exploration, competing architecture proposals, and review. Recommend it when useful, but do not force it for ordinary architecture work.

## 2. Define boundaries

For every proposed component or module, specify:

- its single responsibility;
- its public interface or contract;
- what it owns, especially mutable state and data;
- what it depends on;
- what may depend on it;
- its failure modes and recovery behavior.

Prefer cohesive modules with narrow interfaces. Keep business rules independent from transport, storage, framework, and UI details when that separation pays for itself. Do not introduce microservices, queues, repositories, factories, event buses, or generic abstraction layers without a concrete requirement.

## 3. Trace the data and control flow

Describe the complete path through:

1. entry point and authentication or authorization;
2. input validation and normalization;
3. domain or application logic;
4. persistence and external calls;
5. asynchronous work and consistency boundaries;
6. response, UI state update, or emitted event;
7. errors, retries, timeouts, cancellation, and idempotency where applicable.

Make state ownership explicit. For frontend work, cover server state, client state, URL state, form state, cache invalidation, loading, empty, and error states. For backend work, cover transaction boundaries, schema evolution, concurrency, and backward compatibility.

## 4. Evaluate cross-cutting concerns

Address only the concerns relevant to the task, but never omit a material risk:

- security and privacy;
- reliability and graceful degradation;
- performance and capacity;
- observability and operability;
- accessibility and responsive behavior for user interfaces;
- testability and test boundaries;
- deployment, configuration, migration, rollback, and feature flags;
- ownership and maintainability.

Use concrete budgets or acceptance criteria when the repository or user provides them. Do not invent numerical requirements.

## 5. Make a decision

When exploration is requested, compare two or three viable approaches and recommend one. Otherwise, make one confident recommendation and explain:

- why it fits the current system;
- which alternatives were rejected and why;
- near-term complexity and long-term consequences;
- what would cause the decision to be revisited.

For consequential choices, include a concise ADR:

```text
Context:
Decision:
Alternatives:
Consequences:
Revisit when:
```

## 6. Produce an implementation blueprint

Scale the response to the task. Include only sections that carry useful information:

- Existing patterns and constraints, with `file:line` evidence
- Recommended architecture and rationale
- Components, responsibilities, interfaces, and dependencies
- Data/control flow and state ownership
- Failure handling and relevant cross-cutting concerns
- Exact files or modules to create and modify
- Ordered implementation and migration phases
- Verification, rollout, rollback, risks, and unresolved questions

Each phase should leave the system working and independently verifiable. Separate required work from optional future improvements. Do not write production code until the user approves the architecture when approval is needed by the active workflow.

## Quality check

Before finishing, verify that:

- the design follows existing repository patterns unless a deviation is justified;
- every component has one clear purpose and a narrow interface;
- data ownership and failure paths are explicit;
- the proposal does not add infrastructure or abstractions without demonstrated need;
- migration and rollback are feasible;
- tests and operational verification cover the highest-risk boundaries;
- the blueprint is specific enough to implement without guessing.
```

Expected: 文件写入成功，未覆盖任何现有 skill。

- [ ] **Step 2: 验证 frontmatter 和关键触发词**

读取新文件并确认：

```text
name: software-architecture
```

且 `description` 同时包含以下语义范围：

```text
full-stack software architecture
module and service boundaries
frontend/backend architecture
API and data modeling
reliability
security
migrations
```

Expected: frontmatter 位于文件开头、由 `---` 包围，name 与目录名一致，没有 `TBD`、`TODO` 或空章节。

---

### Task 3: 验证自动发现边界与安装隔离

**Files:**
- Verify: `C:\Users\Ibiza\.claude\skills\frontend-design\SKILL.md`
- Verify: `C:\Users\Ibiza\.claude\skills\software-architecture\SKILL.md`
- Verify: `C:\Users\Ibiza\.claude\settings.json`
- Verify: `C:\Users\Ibiza\.claude\plugins\installed_plugins.json`
- Verify: project Git working tree

**Interfaces:**
- Consumes: Task 1 的插件记录和 Task 2 的 `SKILL.md`。
- Produces: 两类全局能力的可发现性证据，以及“无 Hook/MCP/项目代码改动”的隔离证据。

- [ ] **Step 1: 验证两个核心 Skill 都存在且职责不重叠**

确认以下文件均存在：

```text
C:\Users\Ibiza\.claude\skills\frontend-design\SKILL.md
C:\Users\Ibiza\.claude\skills\software-architecture\SKILL.md
```

检查描述边界：

- `frontend-design` 负责视觉方向、排版、布局、动效、界面文案和 UI 实现质量；
- `software-architecture` 负责系统边界、接口、数据、状态、可靠性、部署和演进；
- 架构 skill 明确排除纯视觉样式和一行修复。

Expected: 两文件都存在，触发范围清晰，无同名冲突。

- [ ] **Step 2: 验证没有引入 Hook 或 MCP**

重新读取 `C:\Users\Ibiza\.claude\settings.json`。

Expected: 本任务没有新增 `hooks`、`enabledMcpjsonServers`、`enableAllProjectMcpServers`、`pluginConfigs` 或与本任务有关的权限规则；既有字段保持不变。

- [ ] **Step 3: 验证项目隔离**

Run:

```bash
git status --short
```

Expected: 除本次已经创建的两份未提交文档外，不出现由用户级安装造成的项目文件变化：

```text
?? docs/superpowers/specs/2026-09-02-global-frontend-architecture-skills-design.md
?? docs/superpowers/plans/2026-09-02-global-frontend-architecture-skills.md
```

- [ ] **Step 4: 说明会话加载行为并给出语义验收用例**

记录以下验收用例，供新会话检查：

```text
前端：为人才匹配页面设计有辨识度且可访问的界面。
架构：规划人才匹配服务的模块边界、API、数据流和渐进迁移。
简单修复：修正 README 中的一个错别字。
```

Expected:

- 第一条应使 `frontend-design` 成为相关 skill；
- 第二条应使 `software-architecture` 成为相关 skill；
- 第三条不应触发两者；
- 当前会话若未刷新技能清单，则重启 Claude Code 后验证，不添加 Hook 来强制触发。

- [ ] **Step 5: 汇报结果与回滚命令**

成功时报告已安装内容、验证结果和“新会话生效”的要求。提供但不要执行以下回滚步骤：

```bash
claude plugin uninstall feature-dev@claude-plugins-official --scope user
```

以及删除本次创建的目录：

```text
C:\Users\Ibiza\.claude\skills\software-architecture\
```

Expected: 不删除或修改现有 `frontend-design`。
