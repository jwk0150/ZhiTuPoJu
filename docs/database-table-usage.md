# 数据库表使用统计

> 统计范围：`backend/` 下的 ORM、路由、Service、Agent、RAG 和初始化脚本。
>
> 统计口径：
> - **已使用**：存在业务查询、写入或更新路径。
> - **初始化/兼容**：仅由初始化、迁移或兼容逻辑创建/检查/切换。
> - **可选/降级**：代码支持，但运行时可能因表不存在而跳过或回退。
> - **仅定义**：有 ORM/DDL 定义，但未找到当前业务调用。
>
> 当前环境未执行数据库连接和逐表 `COUNT(*)`，因此本文是“代码静态使用统计”，不是数据库实存行数统计。实际存在性、行数和 schema 仍需在目标 PostgreSQL 上验证。

## 1. 总览

| 数据域 | 表/视图数量 | 当前结论 |
|---|---:|---|
| 招聘主数据 | 5 个名称（含视图、兼容源） | 业务核心，使用最频繁 |
| RAG 知识库 | 3 张表 | 已接入摄取、检索、向量和证据链 |
| 用户中心 | 9 张表 | 资料、简历、技能、报告、收藏和能力问卷已接入 |
| Global Agent | 4 张表 | 任务、步骤、会话、消息已持久化 |
| 图谱/技术更新 | 1 张运行时表 | `new_skill_table` 由更新接口按需创建并写入 |

## 2. 招聘主数据

### 2.1 `public.the_total_table`（视图）

- **状态：已使用；当前业务统一入口。**
- ORM：`backend/db_models.py:JobPosting.__tablename__`。
- 视图来源：`backend/init_database.py` 将其指向 `public.the_total_table_copy1`；在只有智联旧表时可指向 `public.zhilian_job_postings` 的兼容视图。
- 主要使用：
  - `backend/data.py`：岗位列表、岗位详情、城市统计、薪资统计、数据统计。
  - `backend/services.py`：岗位筛选、城市/行业聚合、技术图谱、岗位池统计。
  - `backend/routers/collection.py`：采集源统计、采集摘要、清洗样本。
  - `backend/routers/talent_map.py`：地图搜索、岗位分析、技术图谱。
  - `backend/routers/ability.py`：聚合岗位 `skills` 生成技术能力目录。
  - `backend/evolution_agent/evolution_agent.py`：部分岗位演化统计。
  - `backend/matching/service.py`：SQL 岗位召回和匹配候选。
- 主要字段：岗位标题、公司、城市、薪资、经验、学历、发布时间、抓取时间、状态、完整度，以及视图底层可能提供的 `industry_tags`、`skills`、岗位文本字段。
- **说明**：页面上的岗位列表、地图统计、采集统计和人岗匹配候选，默认都应追溯到此入口或其下游 RAG 文档。

### 2.2 `public.the_total_table_copy1`（实际岗位表）

- **状态：初始化脚本明确依赖；业务通常通过 `the_total_table` 间接使用。**
- `backend/init_database.py`：启动时检查该表是否存在，并创建/刷新 `the_total_table` 视图。
- `backend/seed_city_jobs.py`：补充字段、写入城市岗位种子、删除 `ai_seed` 数据。
- 代码注释称该表约有 38,780 条，但该数量未在本次运行中重新查询，属于需要现场确认的历史记录。
- **建议验证**：确认该表是否为当前唯一的岗位事实表，以及 `the_total_table` 是否确实指向它。

### 2.3 `public.job_posting_details`

- **状态：已使用。**
- ORM：`backend/db_models.py:JobPostingDetail`。
- 主要使用：
  - 与岗位主表 join，提供岗位描述、要求、技能、关键词、公司介绍、福利、原始 HTML、来源 URL。
  - `backend/data.py`：岗位详情。
  - `backend/matching/service.py`：构造匹配岗位文本和技能。
  - `backend/knowledge/ingestion.py`、`backend/knowledge/service.py`：RAG 文档摄取与结构化过滤。
  - `backend/profile_service.py`：简历与岗位匹配。
  - `backend/routers/collection.py`：清洗样本。
  - `backend/trends_service.py`：技能和岗位趋势聚合。
  - `backend/evolution_agent/evolution_agent.py`：岗位演化统计。
- 关键非结构化字段：`job_description`、`job_requirement`、`company_intro`、`skills`、`keywords`、`source_url`、`raw_html`。
- 这些字段是进入 RAG 的主要原始内容来源。

### 2.4 `public.liepin_jobs`

- **状态：可选/降级。**
- ORM：`backend/db_models.py:LiepinJob`。
- `backend/data.py:get_db_stats()` 会尝试统计该表；表不存在时回滚并按 0 处理。
- 未找到主业务岗位列表、匹配或 RAG 必须依赖该表的路径。
- **结论**：目前属于可选数据源/兼容数据，不是当前主链路的必要表。

### 2.5 `public.zhilian_job_postings`

- **状态：初始化兼容源。**
- 仅在 `backend/init_database.py` 的兼容视图逻辑中被引用。
- 当 `the_total_table` 和 `the_total_table_copy1` 不可用时，可用它生成兼容视图。
- 是否在当前数据库中存在，需现场验证。

### 2.6 `job_postings` 名称冲突风险

代码中以下模块直接写了 `job_postings`：

- `backend/knowledge/ingestion.py`
- `backend/knowledge/service.py`
- `backend/knowledge/evidence.py` 的关联查询链路
- `backend/llm/zhitu_agent.py`
- `backend/evolution_agent/evolution_agent.py` 的部分 SQL
- `backend/check_config.py`

但当前 ORM 和大量业务代码使用的是 `the_total_table`，初始化脚本也明确围绕 `the_total_table_copy1` 创建视图。

**结论：`job_postings` 与 `the_total_table` 是否是同一事实数据、同义视图、历史表，当前代码无法确认。标记为 `UNKNOWN — NEED VERIFICATION`。**

建议在数据库执行：

```sql
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_name IN ('job_postings', 'the_total_table', 'the_total_table_copy1',
                     'job_posting_details', 'zhilian_job_postings');

SELECT pg_get_viewdef('public.the_total_table'::regclass, true);
```

## 3. RAG 知识库

### 3.1 `source_documents`

- **状态：已使用。**
- DDL/迁移：`backend/sql/rag_schema.sql`、`backend/init_database.py`。
- 写入：`backend/knowledge/ingestion.py`，按来源、岗位和正文哈希维护文档及新鲜度。
- 读取：`backend/knowledge/service.py`、`backend/knowledge/evidence.py`，用于检索结果和证据回溯。
- 保存内容：来源类型、岗位 ID、公司、城市、原文来源 URL、采集时间、发布时间、版本和 freshness 状态。
- 作用：统一承载招聘、企业官网、政策、行业等未来知识源的 Document 层。

### 3.2 `document_chunks`

- **状态：已使用。**
- 写入：`backend/knowledge/ingestion.py`，对 Document 分块并写入文本、哈希、岗位/来源元数据和 embedding。
- 读取：`backend/knowledge/service.py`，执行关键词/向量混合检索。
- 向量实现：`backend/knowledge/vectorstore.py` 支持数组兜底、cube 兼容路径和未来 pgvector 路径；当前配置默认 `array`。
- 作用：RAG 的实际检索单元，也是 Evidence 回链的中间层。

### 3.3 `evidence_items`

- **状态：已使用。**
- 写入：`backend/knowledge/evidence.py`；匹配结果中的证据按 job/chunk/claim 幂等保存。
- 读取：`backend/knowledge/evidence.py` 和 Agent 相关代码，用于返回来源 URL、Chunk 和证据说明。
- 作用：将回答声明连接到 `document_chunks`、`source_documents` 和原始岗位来源。

## 4. 用户中心 `user_center` Schema

### 4.1 `user_center.user_profiles`

- **状态：已使用。**
- 登录/注册时创建基础记录：`backend/routers/auth.py`。
- 读取/更新：`backend/routers/profile.py`、`backend/agent/context.py`。
- 保存：姓名、学校、专业、学历、目标岗位、简介、联系方式、头像、访谈数据和资料完成度。

### 4.2 `user_center.resumes`

- **状态：已使用。**
- 上传、解析、优化、列表、删除和同步：`backend/routers/profile.py`。
- Global Agent 简历工具读取：`backend/agent/tools.py`、`backend/agent/context.py`。
- 保存：文件名、路径/文本内容、文件类型、metadata、状态和时间。
- 人岗匹配 `/api/match/diagnose` 当前主要即时解析上传文件；是否把每次匹配文件都写入该表，取决于前端调用的上传/同步流程。

### 4.3 `user_center.user_skills`

- **状态：已使用。**
- 简历解析或访谈分析后写入：`backend/profile_service.py`。
- 读取：`backend/routers/profile.py`、`backend/agent/context.py`。
- `source` 区分 `resume`、`interview`、`manual` 等来源。

### 4.4 `user_center.career_reports`

- **状态：已使用。**
- 写入：`backend/profile_service.py` 的职业分析报告保存逻辑。
- 读取：`backend/routers/profile.py`、`backend/agent/context.py`。
- 保存：六维分数、总分、优缺点、建议、岗位匹配 JSON 和原始 AI 分析。

### 4.5 `user_center.user_favorites`

- **状态：已使用。**
- 查询和切换收藏：`backend/routers/profile.py`。
- 统一承载新闻、发现、预测和匹配岗位收藏，使用 `source + item_id` 区分业务来源。
- 前端同时使用 localStorage 作为离线/未登录缓存；数据库记录是登录后的持久化路径。

### 4.6 `user_center.tech_abilities`

- **状态：已使用。**
- `backend/routers/ability.py` 从 `map_data_table.skills` 聚合并 upsert 技术目录。
- `backend/agent/context.py` 用于构建用户能力上下文。
- 是系统级技术主表，不等同于某个用户的技能记录。

### 4.7 `user_center.user_abilities`

- **状态：已使用。**
- `backend/routers/ability.py` 读取和保存用户问卷/能力选择。
- 通过 `ability_id` 关联 `tech_abilities`，形成用户到技术目录的关联。

## 5. Global Agent 持久化表

### 5.1 `user_center.agent_tasks`

- **状态：已使用。**
- `backend/agent/task_store.py` 创建、查询、更新任务状态、取消任务和保存结果。
- `backend/routers/global_agent.py` 的 `/tasks`、`/chat` 等接口使用。

### 5.2 `user_center.agent_task_steps`

- **状态：已使用。**
- `TaskStore` 保存每个工具步骤的输入、状态、结果、错误、证据 ID 和确认信息。
- Global Agent SSE 会读取该表回放任务进度。

### 5.3 `user_center.agent_conversations`

- **状态：已使用。**
- `TaskStore` 创建/查询用户会话，Global Agent 对话接口使用。

### 5.4 `user_center.agent_messages`

- **状态：已使用。**
- 保存 user、assistant、tool、system 消息及其任务关联。
- 会话详情和上下文构建会读取该表。

## 6. 图谱/技术更新运行时表

### `public.new_skill_table`

- **状态：按需使用。**
- `backend/services.py` 和 `backend/routers/talent_map.py` 的“更新技术图谱”路径会：
  1. `CREATE TABLE IF NOT EXISTS`；
  2. 从 `the_total_table` 的真实岗位技能池计算；
  3. 删除同一岗位旧版本；
  4. 写入新一轮技能结果。
- 普通岗位浏览不依赖此表。
- 该表更像运行结果/版本快照，不是原始岗位事实表。

## 7. 代码中提到但当前业务未确认使用的对象

| 对象 | 状态 | 说明 |
|---|---|---|
| `academic_paper` | UNKNOWN — NEED VERIFICATION | `rag_schema.sql` 注释提到历史学术数据，但当前业务代码未找到稳定的读写入口。 |
| `the_total_table_copy1` | 初始化/种子脚本使用 | 真实表由视图间接服务业务；需确认当前部署是否存在及行数。 |
| `zhilian_job_postings` | 兼容回退 | 仅初始化兼容逻辑使用。 |
| `job_postings` | UNKNOWN — NEED VERIFICATION | RAG/部分演化 SQL 使用该名称，与当前 ORM 的 `the_total_table` 存在命名不一致。 |
| `liepin_jobs` | 可选/降级 | 只用于统计尝试，不是核心查询链路。 |

## 8. 按功能模块反查

| 功能 | 主要表/视图 |
|---|---|
| 岗位列表、详情、城市和薪资统计 | `the_total_table`、`job_posting_details` |
| 人岗匹配 | `the_total_table`/`job_postings`、`job_posting_details`、`source_documents`、`document_chunks`、`evidence_items` |
| 学习路径 | 主要读取匹配结果和用户技能；当前没有专门的学习进度数据库表，前端进度使用 localStorage |
| 面试训练 | 面试评估接口即时计算；职业访谈历史/分析写入 `user_profiles.interview_data`、`user_skills`、`career_reports` |
| 简历上传、解析、优化 | `resumes`、`user_profiles`、`user_skills`、`career_reports` |
| 收藏 | `user_favorites`，未登录时前端 localStorage 兜底 |
| 能力问卷/技术目录 | `tech_abilities`、`user_abilities`、`the_total_table.skills` |
| RAG 检索 | `source_documents`、`document_chunks`，结构化过滤关联岗位表 |
| Evidence 证据链 | `evidence_items` → `document_chunks` → `source_documents` → `job_posting_details.source_url` |
| 趋势分析 | `the_total_table`、`job_posting_details`；数据库失败时 `trends_service.py` 有 mock fallback |
| 人才地图 | `map_data_table`（由配置 `PG_JOB_TABLE` 指定），部分接口也读取 `the_total_table` |
| Global Agent | `agent_tasks`、`agent_task_steps`、`agent_conversations`、`agent_messages` |

## 9. 当前需要优先核对的数据库问题

1. **岗位主表命名**：`the_total_table`、`the_total_table_copy1`、`job_postings` 是否同源，是否都存在。
2. **RAG 关联可用性**：`source_documents.job_id` 能否关联当前岗位主表的 `id`。
3. **详情表覆盖率**：`job_posting_details.job_id` 与主岗位表的匹配比例，以及 `job_description`、`job_requirement`、`skills`、`source_url` 非空比例。
4. **地图主表一致性**：`map_data_table` 是否与 `the_total_table` 来自同一数据库和同一批次数据。
5. **用户中心是否已执行 DDL**：确认 `user_center` 下 13 张表（资料、简历、技能、报告、收藏、能力、Agent）是否都已创建。
6. **RAG Schema 是否已执行**：确认 `source_documents`、`document_chunks`、`evidence_items` 的新增字段和索引是否已应用。
7. **真实行数**：在目标库执行下方 SQL，补齐本文的运行时统计。

## 10. 建议的现场统计 SQL

```sql
-- 关系是否存在、类型是什么
SELECT n.nspname AS schema_name, c.relname AS object_name,
       CASE c.relkind WHEN 'r' THEN 'table' WHEN 'v' THEN 'view'
            WHEN 'm' THEN 'materialized view' ELSE c.relkind::text END AS object_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname IN (
  'the_total_table', 'the_total_table_copy1', 'job_postings',
  'job_posting_details', 'zhilian_job_postings', 'liepin_jobs',
  'source_documents', 'document_chunks', 'evidence_items',
  'map_data_table', 'new_skill_table', 'user_profiles', 'resumes',
  'user_skills', 'career_reports', 'user_favorites', 'tech_abilities',
  'user_abilities', 'agent_tasks', 'agent_task_steps',
  'agent_conversations', 'agent_messages'
)
ORDER BY n.nspname, c.relname;

-- 核心表行数（不存在的表会报错，建议按已确认存在的表分别执行）
SELECT COUNT(*) FROM public.the_total_table;
SELECT COUNT(*) FROM public.the_total_table_copy1;
SELECT COUNT(*) FROM public.job_posting_details;
SELECT COUNT(*) FROM public.source_documents;
SELECT COUNT(*) FROM public.document_chunks;
SELECT COUNT(*) FROM public.evidence_items;

-- RAG 完整性
SELECT COUNT(*) AS chunks,
       COUNT(embedding) AS embedded_chunks
FROM public.document_chunks;

SELECT COUNT(*) AS detail_rows,
       COUNT(*) FILTER (WHERE job_description IS NOT NULL AND trim(job_description) <> '') AS has_description,
       COUNT(*) FILTER (WHERE job_requirement IS NOT NULL AND trim(job_requirement) <> '') AS has_requirement,
       COUNT(*) FILTER (WHERE skills IS NOT NULL) AS has_skills,
       COUNT(*) FILTER (WHERE source_url IS NOT NULL AND trim(source_url) <> '') AS has_source_url
FROM public.job_posting_details;
```

## 11. 最终结论

当前项目的数据库主链路是：

```text
the_total_table（岗位统一视图）
        + job_posting_details（岗位详情）
        ↓
source_documents → document_chunks → evidence_items
        ↓
KnowledgeService / MatchingService / Agent
```

用户业务链路是：

```text
user_profiles + resumes + user_skills + career_reports
        + user_favorites
        + tech_abilities / user_abilities
        ↓
Profile / Resume / Interview / Ability / Matching 页面
```

Agent 持久化链路是：

```text
agent_conversations + agent_messages
        + agent_tasks + agent_task_steps
        ↓
Global Agent 对话、任务、确认和 SSE 进度
```

最值得优先修正或确认的是 `job_postings` 与 `the_total_table` 的命名不一致。只要这两个名称没有明确的视图/表映射，RAG 摄取、趋势演化和人岗匹配可能读取不同数据源，不能仅凭页面结果判断数据库链路一致。
