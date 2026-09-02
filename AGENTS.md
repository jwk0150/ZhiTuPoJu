# Phase 00 — Project Audit & Architecture Decision

# 重要：本阶段只分析，不修改代码

你现在接手的是一个已经存在的项目。

这个项目目前已经完成了较多前端页面和部分后端基础，但后端业务功能、Agent 和 RAG 尚未完整实现。

当前项目已经有真实的招聘网站数据存储在数据库中。

未来计划实现：

1. 人岗匹配 Agent
2. 通用 RAG Knowledge Base
3. Evidence / Provenance 防幻觉机制

未来还可能增加：

4. 企业官网数据
5. 行业政策数据
6. 新型岗位发现 Agent
7. 未来岗位预测 Agent
8. 知识图谱

但是：

## 本阶段绝对不要实现这些功能。

本阶段的唯一任务：

> 全面检查当前项目，并根据项目现有代码、数据库、依赖和技术栈，制定最适合当前项目的 RAG + 人岗匹配架构。

---

# 一、最高优先级原则

不要直接套用通用模板。

不要假设项目使用：

* FastAPI
* Flask
* Django
* LangChain
* LangGraph
* PostgreSQL
* MySQL
* Qdrant
* Milvus
* pgvector

必须先检查实际项目。

不要因为"最佳实践"而重写现有项目。

不要因为搭建 RAG 而更换现有数据库。

不要因为搭建 Agent 而更换现有后端框架。

不要创建与现有功能重复的 Model、Service、API。

优先：

> Reuse existing code > Extend existing architecture > Add minimal new components > Rewrite

---

# 二、第一步：完整检查项目结构

首先递归检查项目目录。

重点识别：

* 前端框架
* 后端框架
* API 层
* Service 层
* ORM
* Database
* Authentication
* File Upload
* Resume
* Job
* Company
* User
* AI / LLM
* Embedding
* Vector DB
* Docker
* Environment
* Configuration
* Tests

输出：

```text
Project Architecture

Frontend:
...

Backend:
...

Database:
...

AI:
...

Existing Services:
...

Existing APIs:
...

Existing Models:
...

Docker:
...

Tests:
...
```

---

# 三、第二步：检查 package / requirements / dependencies

检查：

* package.json
* requirements.txt
* pyproject.toml
* poetry.lock
* package-lock.json
* pnpm-lock.yaml
* yarn.lock
* Dockerfile
* docker-compose.yml
* .env.example
* 配置文件

识别当前已经存在的：

### LLM

例如：

* OpenAI
* Anthropic
* Gemini
* Ollama
* 其他

### Embedding

例如：

* OpenAI Embeddings
* BGE
* sentence-transformers
* Jina
* 其他

### RAG

检查是否已经存在：

* LangChain
* LangGraph
* LlamaIndex
* 自研 Retrieval
* Vector Store

### Vector Database

检查是否已经存在：

* pgvector
* Qdrant
* Milvus
* Chroma
* Weaviate
* Elasticsearch
* OpenSearch

如果已经存在，不要重新引入另一个。

---

# 四、第三步：检查真实数据库

这是最重要的部分之一。

不要根据文件名猜数据库结构。

必须实际检查：

* Database Schema
* ORM Models
* Migration
* Job Table
* Company Table
* Skill Table
* Industry Table
* User Table
* Resume Table
* Resume Analysis Table
* 其他与招聘相关的表

重点分析招聘数据实际字段。

输出：

```text
Current Job Data Model

Job:
- id
- title
- company_id
- description
- requirements
- salary
- education
- experience
- location
- skills
- industry
- ...
```

必须区分：

### 已存在字段

和：

### RAG 未来需要但当前不存在的字段

不要为了 RAG 重复建立已有字段。

---

# 五、第四步：检查真实招聘数据

不能只看 Model。

实际读取少量真实招聘数据样本。

例如：

* 5～20 条 Job
* 不同类型岗位
* 不同公司
* 不同数据来源

检查：

1. 数据完整性
2. description 格式
3. requirements 格式
4. skills 格式
5. HTML 是否存在
6. Markdown 是否存在
7. JSON 是否存在
8. 是否有重复岗位
9. source_url 是否存在
10. 发布时间是否存在
11. 抓取时间是否存在
12. company 信息是否完整

特别检查：

> 当前招聘数据到底适不适合直接进入 RAG。

如果不适合，要提出清洗方案。

---

# 六、第五步：检查当前 Resume 系统

因为第一阶段最终要做人岗匹配。

检查：

* Resume Upload
* Resume Storage
* Resume Parser
* Resume Model
* Resume Analysis
* Resume API
* Resume File Format

识别：

用户上传简历以后，目前系统到底能够做到哪一步。

输出：

```text
Current Resume Flow

Upload
↓
Storage
↓
Parser
↓
Analysis
↓
Database
```

如果某一环不存在：

明确指出。

不要自行实现。

本阶段只记录问题。

---

# 七、第六步：检查现有 AI 架构

检查项目目前是否已经有：

* LLM Service
* AI Service
* Prompt Service
* Agent
* Tool
* Chat
* Streaming
* Structured Output
* Function Calling

重点判断：

> 人岗匹配 Agent 应该基于现有 AI 架构扩展，还是需要新建 Agent Layer。

如果已经有 AI Service：

优先复用。

如果已经有 Agent Framework：

优先复用。

不要为了"标准架构"而重复创建。

---

# 八、第七步：判断 RAG 最适合使用什么方案

根据实际项目检查结果，比较：

### 方案 A

PostgreSQL + pgvector

### 方案 B

PostgreSQL + Qdrant

### 方案 C

PostgreSQL + Elasticsearch / OpenSearch

### 方案 D

其他现有方案

不要默认选择 Qdrant。

不要默认选择 pgvector。

必须根据当前项目实际情况判断。

比较：

* 当前数据库
* 数据规模
* 查询方式
* 部署复杂度
* Docker
* 运维成本
* Hybrid Search
* Metadata Filter
* 后续扩展
* 当前项目依赖

最后给出：

> 推荐方案

并解释为什么。

---

# 九、第八步：判断是否真的需要 LangChain

不要因为项目叫 RAG 就强制使用 LangChain。

检查当前项目。

比较：

### 原生实现

vs

### LangChain

vs

### LangGraph

判断：

* 当前项目是否已经使用
* 是否真的需要
* 是否增加复杂度
* 是否方便未来 Agent
* 是否方便 Tool Calling
* 是否方便维护

最后明确：

> 当前项目推荐使用什么，以及为什么。

如果已有 LangChain：

优先复用。

如果没有：

不要为了"看起来像 RAG 项目"强行引入。

---

# 十、第九步：设计数据流

基于真实代码设计：

```text
Current Job Database
        ↓
   RAG Ingestion
        ↓
     Document
        ↓
       Chunk
        ↓
    Embedding
        ↓
    Vector Store
        ↓
 KnowledgeService
        ↓
 Job Matching Agent
```

但这只是初始假设。

你必须根据实际项目修改它。

---

# 十一、第十步：判断结构化数据和 RAG 的边界

这是本项目非常重要的架构问题。

不要把数据库所有字段全部 Embedding。

必须判断：

哪些数据应该从 PostgreSQL / 当前数据库直接查询？

例如：

* job_id
* salary
* location
* education
* experience
* company_id
* published_at

哪些数据适合 RAG：

* job_description
* responsibilities
* requirements
* company introduction
* policy text

最终给出：

```text
Structured Data
↓
Database Query

Unstructured Knowledge
↓
RAG
```

以及：

```text
Hybrid Retrieval
=
Database Filter
+
Keyword Search
+
Vector Search
```

---

# 十二、第十一步：设计未来扩展方式

当前只有：

RECRUITMENT

未来需要：

COMPANY_WEBSITE
POLICY
INDUSTRY

判断当前架构如何支持。

必须做到：

新增数据源

不需要：

* 重写 RAG
* 重写 Agent
* 重建数据库
* 重写 Retrieval

理想结构：

```text
Source
 ├── Recruitment
 ├── Company Website
 ├── Policy
 └── Industry

        ↓

Unified Document

        ↓

Unified Chunk

        ↓

Unified Retrieval

        ↓

KnowledgeService
```

---

# 十三、第十二步：设计 Evidence / Provenance

判断当前数据库是否已经有：

* source_url
* source_name
* crawl_time
* publish_time
* original_content
* hash
* data_version

如果缺少：

列出需要增加什么。

目标：

```text
Answer
 ↓
Claim
 ↓
Evidence
 ↓
Chunk
 ↓
Document
 ↓
Original Data
 ↓
Source URL
```

注意：

不要实现 Chain-of-Thought。

只需要实现：

> 可验证的 Evidence Chain。

---

# 十四、第十三步：设计人岗匹配架构

结合当前真实代码，判断最适合的：

```text
Resume
↓
Candidate Profile
↓
Job Retrieval
↓
Matching Engine
↓
Evidence Retrieval
↓
LLM Explanation
↓
Recommendation
```

重点判断：

哪些已经存在？

哪些需要新建？

哪些可以复用？

哪些需要修改？

---

# 十五、第十四步：不要让 LLM 负责评分

检查当前项目是否已有评分逻辑。

如果没有，提出：

Matching Engine

至少考虑：

* Skill Match
* Experience Match
* Education Match
* Industry Match
* Location Match

但不要现在实现。

本阶段只设计。

---

# 十六、第十五步：检查 API

列出现有 API。

特别检查：

* /jobs
* /resume
* /users
* /ai
* /chat

然后判断未来需要：

/knowledge/search

/jobs/match

/resume/analyze

还是可以复用已有 API。

不要重复创建 API。

---

# 十七、第十六步：检查前端对接方式

当前前端已经存在。

检查：

* API Client
* Axios / Fetch
* TypeScript Types
* State Management
* Upload Flow
* Loading State
* Error Handling

判断未来人岗匹配需要增加哪些 API。

不要修改前端。

本阶段只分析。

---

# 十八、最终输出必须包含以下内容

不要修改任何代码。

输出一份：

# Project Architecture Audit

包括：

## 1. 当前项目技术栈

## 2. 当前项目目录结构

## 3. 当前数据库结构

## 4. 当前招聘数据结构

## 5. 当前 Resume 流程

## 6. 当前 AI / LLM 架构

## 7. 当前依赖

## 8. 当前已有可复用模块

## 9. 当前缺失模块

## 10. 当前存在的问题

## 11. RAG 推荐架构

## 12. Vector DB 推荐

## 13. Embedding 推荐

## 14. 是否使用 LangChain

## 15. 是否需要 LangGraph

## 16. Document / Chunk 设计

## 17. Metadata 设计

## 18. Evidence / Provenance 设计

## 19. 人岗匹配 Agent 架构

## 20. API 设计

## 21. 数据流

## 22. 未来增加企业官网数据的方法

## 23. 未来增加政策数据的方法

## 24. 如何保证新增数据不需要重建整个 RAG

## 25. 推荐实施顺序

---

# 十九、非常重要：给出"方案选择依据"

不要只输出：

"推荐使用 Qdrant。"

必须解释：

为什么当前项目适合 Qdrant？

为什么不是 pgvector？

为什么不是 Elasticsearch？

同样：

为什么使用 LangChain？

为什么不用？

为什么需要 LangGraph？

为什么不需要？

---

# 二十、最终给出明确结论

最后必须输出：

## Recommended Architecture

用一张简洁架构图表示：

```text
                    Existing Database
                           │
                           ↓
                    RAG Ingestion
                           │
                ┌──────────┴──────────┐
                ↓                     ↓
          Structured Data       Knowledge Data
                │                     │
                ↓                     ↓
           PostgreSQL          Vector / Search
                │                     │
                └──────────┬──────────┘
                           ↓
                   KnowledgeService
                           ↓
                   Job Matching Agent
                           ↓
                  Matching + Evidence
                           ↓
                    Recommendation
```

但必须根据实际项目修改这张架构图。

---

# 二十一、执行限制

本阶段：

### 允许

* 阅读代码
* 阅读配置
* 阅读数据库 Model
* 阅读 Migration
* 阅读少量真实数据
* 分析依赖
* 分析架构
* 提出方案

### 禁止

* 修改代码
* 删除代码
* 创建数据库表
* 创建 Vector DB
* 安装依赖
* 修改 package.json
* 修改 requirements
* 修改 Docker
* 修改前端
* 实现 RAG
* 实现 Agent

---

# 二十二、最终原则

不要告诉我：

"按照最佳实践应该……"

我要的是：

> "根据当前这个项目实际代码，目前最适合的方法是……"

所有架构建议必须能够指出：

* 对应的现有文件
* 对应的现有 Model
* 对应的现有 Service
* 对应的现有 API
* 对应的现有依赖

如果某个判断无法从代码确认：

明确标记：

`UNKNOWN — NEED VERIFICATION`

不要猜测。
