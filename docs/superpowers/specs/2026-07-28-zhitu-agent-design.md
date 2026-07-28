# 执图顾问 · 统一领域智能体设计规格

> **日期**：2026-07-28  
> **状态**：已确认并落地（2026-07-28）  
> **范围**：统一大脑服务「AI 采购顾问」+「智能问答」；不改动 DiscoveryAgent 扫描职责  
> **方案**：B · 统一领域智能体 + 检索增强（非模型微调）

---

## 1. 目标与边界

### 1.1 一句话目标

把 DeepSeek 做成「执图破局」专属**资深猎头 / 人才采购顾问**大脑：深刻理解业务、回答自然多样，采购抽屉与智能问答共用同一智能体，且**不与发现扫描智能体冲突**。

### 1.2 已确认决策

| 项 | 选择 |
|---|---|
| 入口 | 统一大脑，双入口（suggest + qa） |
| 人设 | 资深猎头 / 人才采购顾问 |
| 底料 | A 本轮扫描 + B PG JD 摘要 + C 业务手册 + D 赛题领域卡片 |
| 实现路径 | 检索增强 + 强人设 Prompt（不做本地微调） |
| 隔离 | 不改 DiscoveryAgent / enrich_discoveries 职责 |

### 1.3 非目标

- 不训练 / 不微调本地权重模型
- 不替换 `/api/discovery/agent/scan` 扫描流水线
- 不把整库 JD 一次性塞进 prompt
- 不改变审核 / 采购 / 跟踪等业务按钮语义

### 1.4 成功标准

1. 两个入口回答风格一致（猎头口吻），场景语气可按 `channel` 微调  
2. 能引用本轮发现/预测与手册规则；能按需引用 PG JD 信号  
3. 禁止编造未出现的岗位名 / id；无数据时催扫描或声明依据不足  
4. 同问多轮表述有变化，避免死板模板感  
5. 扫描智能体与顾问智能体职责清晰、接口不互相覆盖状态  
6. 无 DeepSeek Key / 超时仍有人话兜底，演示不断档  

---

## 2. 架构

### 2.1 组件

```
前端 suggest 抽屉 ──┐
                    ├──► POST /api/agent/chat ──► ZhituAgent
前端 智能问答页 ────┘         │
                              ├─ intent 粗分
                              ├─ retrieve(知识包 + PG 摘要 + 扫描缓存)
                              ├─ DeepSeek chat_completions（独立 system）
                              └─ heuristic fallback
DiscoveryAgent.scan ──────────► /api/discovery/agent/scan（独立，不经顾问）
enrich_discoveries ───────────► 扫描润色（独立 prompt，不经顾问）
```

### 2.2 隔离规则

| 能力 | 职责 | 顾问是否介入 |
|---|---|---|
| `DiscoveryAgent` | PG 扫描、聚类、评分、预测、推理链 | 否 |
| `enrich_discoveries` | 岗位定义 JSON 润色 | 否 |
| `ZhituAgent` | 仅多轮对话（suggest / qa） | 是 |
| 底层 `chat_completions` | HTTP 调用可复用 | 仅复用传输层，prompt/温度/上下文分离 |

### 2.3 人设硬规则

- 先结论、后依据；敢给优先级与「先别采 / 先跟踪」
- 中文；可口语化，但专业；禁止公文腔堆砌
- 回答形态轮换：短拍板 / 编号清单 / 一条证据故事化，避免固定句式
- 预测岗不可直接采购；采购只对发现岗且尊重 pending/adopted/rejected

---

## 3. 知识与检索

### 3.1 知识包（仓库内 Markdown / JSON）

建议目录：`backend/llm/knowledge/`

| 文件 | 内容 |
|---|---|
| `playbook.md` | 产品业务：发现→审核→采购/拒绝、预测跟踪、图谱/匹配话术 |
| `domain_cards.json` | 赛题领域短卡片：新兴岗位、能力演化、幻觉防控等 |
| `style_examples.json` | 少量多样回答样例（few-shot），防止死板 |

### 3.2 运行时底料

| 源 | 用法 |
|---|---|
| `_CACHED` 扫描结果 | suggest 优先；qa 也可带 |
| 前端附带 discoveries/forecasts | 缓存为空时兜底 |
| PostgreSQL JD 摘要 | 按问题关键词 `LIMIT` 拉取标题/技能/城市/薪资信号 |

### 3.3 检索策略（轻量，首版）

1. 关键词 / 意图标签切分（采购、对比、技能、趋势、薪资、流程）  
2. playbook / domain_cards 按标签取 Top 片段  
3. 若需市场证据：对 PG 做受限 SQL / 已有表查询，最多 N 条摘要  
4. 组装 JSON 上下文（严格截断），再调用 LLM  

首版不做向量库；结构预留后续接 embedding。

---

## 4. API 与前端

### 4.1 新接口

`POST /api/agent/chat`

请求（示意）：

```json
{
  "message": "本轮优先采哪些？",
  "channel": "suggest",
  "history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],
  "discoveries": [],
  "forecasts": [],
  "summary": ""
}
```

响应：

```json
{
  "code": 0,
  "data": {
    "reply": "...",
    "recommendations": [],
    "mode": "llm|heuristic",
    "model": {"llm": "deepseek-chat", "channel": "suggest"}
  }
}
```

### 4.2 兼容

- `POST /api/discovery/suggest/chat` **保留**：内部转发 `ZhituAgent`（`channel=suggest`）
- 扫描相关路由不变

### 4.3 前端

| 入口 | 改动 |
|---|---|
| 采购顾问 | `sendAiSuggestChat` → `/api/agent/chat`，`channel=suggest` |
| 智能问答 | `sendQAQuestion` 改为调同一接口，`channel=qa`；失败回落现有 `QAEngine` |
| 扫描 / 审核 / 采购 | 不动 |

---

## 5. 模块落点（实现指引）

| 路径 | 职责 |
|---|---|
| `backend/llm/zhitu_agent.py` | ZhituAgent：意图、检索、组 prompt、调用、兜底 |
| `backend/llm/knowledge/*` | 手册与领域卡片 |
| `backend/routers/agent.py` | `/api/agent/chat` |
| `backend/main.py` | `include_router(..., prefix="/api/agent")` |
| `backend/routers/discovery.py` | suggest/chat 转发顾问（薄包装） |
| `frontend/index.html` | 双入口接线 |

`deepseek.py` 继续提供 `chat_completions`；现有 `suggest_procurement_chat` 可迁入或委托给 `ZhituAgent`，避免两套人设并存。

---

## 6. 多样性与防死板

- `temperature`：suggest 约 0.55，qa 约 0.65（可配置）  
- system 中要求「禁止连续两轮同一开场白 / 同一清单模板」  
- 注入 2–3 条风格样例，轮换引用  
- 兜底启发式也准备多套句式随机选  

---

## 7. 验收清单

- [ ] 重新扫描仅走 DiscoveryAgent；顾问无扫描副作用  
- [ ] suggest / qa 均能基于扫描 + 手册回答  
- [ ] 问不存在岗位时拒绝编造  
- [ ] 无 Key 时双入口人话兜底  
- [ ] 同问两次表述不完全相同（抽样人工看）  
- [ ] 旧 `/api/discovery/suggest/chat` 仍可用  

---

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| PG 慢拖垮对话 | 检索超时短、失败跳过 JD 层 |
| Prompt 过长 | 分段截断 + TopN |
| 与扫描润色抢同一 Key 限流 | 共用 Key 可接受；不共享会话状态 |
| QA 前端结构化卡片依赖旧 schema | 首版 qa 以文本 `reply` 为主，逐步映射富展示 |

---

## 9. 明确不做（本迭代）

- Neo4j / 向量 RAG 全量上线  
- 讯飞星火切换（可后续配置化 base_url）  
- 离线微调  
- 改发现页 UI 版式（仅接线）  
