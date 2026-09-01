# 执图顾问 ZhituAgent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地统一领域智能体 ZhituAgent，采购顾问与智能问答共用，检索业务手册/领域卡/扫描缓存/PG JD 摘要，且不改 DiscoveryAgent 扫描职责。

**Architecture:** 新模块 `backend/llm/zhitu_agent.py` + 知识包 `backend/llm/knowledge/`；新路由 `POST /api/agent/chat`；旧 `suggest/chat` 薄转发；前端双入口接线；底层复用 `deepseek.chat_completions`。

**Tech Stack:** FastAPI, DeepSeek API (httpx), PostgreSQL/psycopg, 前端 SPA (`frontend/index.html`)

## Global Constraints

- 不微调模型；首版无向量库
- 不改 `/api/discovery/agent/scan` 与 `enrich_discoveries` 职责
- 禁止编造未出现的岗位名/id
- 人设：资深猎头/人才采购顾问；回答多样、非死板
- 旧 `POST /api/discovery/suggest/chat` 必须保持可用（转发）

---

## File Map

| File | Responsibility |
|---|---|
| `backend/llm/knowledge/playbook.md` | 业务手册 |
| `backend/llm/knowledge/domain_cards.json` | 赛题领域卡片 |
| `backend/llm/knowledge/style_examples.json` | 多样回答样例 |
| `backend/llm/zhitu_agent.py` | 意图、检索、组 prompt、调用、兜底 |
| `backend/routers/agent.py` | `/api/agent/chat` |
| `backend/main.py` | 挂载 router |
| `backend/routers/discovery.py` | suggest/chat → ZhituAgent |
| `backend/llm/deepseek.py` | `suggest_procurement_chat` 委托 ZhituAgent |
| `backend/tests/test_zhitu_agent.py` | 单元测试 |
| `frontend/index.html` | suggest + qa 接线 |

---

### Task 1: Knowledge pack

**Files:**
- Create: `backend/llm/knowledge/playbook.md`
- Create: `backend/llm/knowledge/domain_cards.json`
- Create: `backend/llm/knowledge/style_examples.json`

**Interfaces:**
- Produces: static files loaded by `zhitu_agent.load_knowledge()`

- [ ] **Step 1: Write playbook.md** covering 发现→审核→采购/拒绝、预测仅跟踪、图谱/匹配话术、无数据催扫描
- [ ] **Step 2: Write domain_cards.json** as list of `{id,tags,title,body}`
- [ ] **Step 3: Write style_examples.json** as 3–5 `{channel,user,assistant}` few-shots

---

### Task 2: ZhituAgent core + tests

**Files:**
- Create: `backend/llm/zhitu_agent.py`
- Create: `backend/tests/test_zhitu_agent.py`
- Modify: `backend/llm/deepseek.py` (delegate `suggest_procurement_chat`)

**Interfaces:**
- Produces:
  - `chat(*, message: str, channel: str = "suggest", history: list[dict] | None = None, discoveries: list[dict] | None = None, forecasts: list[dict] | None = None, summary: str = "") -> dict`
  - Return keys: `reply`, `recommendations`, `llm`, `error`, `mode`, `channel`
- Consumes: `deepseek.chat_completions`, `deepseek.is_configured`, optional PG via env DSN same as discovery

- [ ] **Step 1: Write failing tests** for intent tagging, heuristic fallback without key, no fabricated job titles when empty context
- [ ] **Step 2: Implement `zhitu_agent.py`** (load knowledge, retrieve snippets, build system+context, call LLM, heuristic fallback with varied templates)
- [ ] **Step 3: Make `suggest_procurement_chat` call `zhitu_agent.chat(..., channel="suggest")`**
- [ ] **Step 4: Run** `python -m pytest backend/tests/test_zhitu_agent.py -v`

---

### Task 3: API router + discovery forward

**Files:**
- Create: `backend/routers/agent.py`
- Modify: `backend/main.py`
- Modify: `backend/routers/discovery.py` (`suggest_chat` → ZhituAgent)

**Interfaces:**
- Produces: `POST /api/agent/chat` body fields matching spec
- Consumes: `zhitu_agent.chat`; discovery `_CACHED` for empty client context

- [ ] **Step 1: Add `agent.py` router** with Pydantic models
- [ ] **Step 2: `include_router` in main** prefix `/api/agent`
- [ ] **Step 3: Thin-forward discovery suggest/chat**
- [ ] **Step 4: Manual smoke** `POST /api/agent/chat` and `POST /api/discovery/suggest/chat`

---

### Task 4: Frontend dual entry

**Files:**
- Modify: `frontend/index.html` (`sendAiSuggestChat`, `sendQAQuestion`)

**Interfaces:**
- Consumes: `POST /api/agent/chat` with `channel`

- [ ] **Step 1: Point suggest chat to `/api/agent/chat`** `channel=suggest`
- [ ] **Step 2: Point QA to same API** `channel=qa`; on failure keep `QAEngine` fallback; render text reply in chat bubble
- [ ] **Step 3: Hard refresh smoke** both entries

---

### Task 5: Spec acceptance self-check

- [ ] Scan still only DiscoveryAgent
- [ ] Empty scan → advisor refuses to invent jobs
- [ ] No key → heuristic human reply on both channels
- [ ] Old suggest path still 200

---

## Spec coverage

| Spec item | Task |
|---|---|
| Unified brain dual entry | 3, 4 |
| Hunter persona + diversity | 1, 2 |
| Knowledge A+B+C+D | 1, 2 (PG retrieve in 2) |
| Isolation from DiscoveryAgent | 2, 3, 5 |
| Compat suggest/chat | 3 |
| Heuristic fallback | 2, 4 |
