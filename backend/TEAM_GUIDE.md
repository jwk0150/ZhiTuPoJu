# 后端协作操作指南（4人版）

这份后端骨架是为了让 4 个人可以同时用 Codex 开发。核心原则：每个人只改自己负责的业务文件，不互相覆盖。

## 目录结构

```text
backend/
  main.py
  data.py
  requirements.txt
  routers/
    collection.py
    graph.py
    discovery.py
    evolution.py
```

## 四人分工

| 人员 | 只改这些文件 | 负责方面 |
|---|---|---|
| 1号 | `backend/routers/collection.py` | 数据采集与数据治理 |
| 2号 | `backend/routers/graph.py` | 图谱可视化接口 |
| 3号 | `backend/routers/discovery.py` | 新岗位发现 |
| 4号 | `backend/routers/evolution.py` | 能力动态演化 |

## 公共文件规则

`backend/data.py` 是公共 mock 数据文件，已经放了岗位、技能、来源、图谱、新岗位、能力演化数据。

平时不要多人同时改 `backend/data.py`。如果某个人需要加数据，先在群里说清楚要加哪些字段，再由一个人统一加，避免覆盖。

`backend/main.py` 已经挂载了 4 个模块，一般不要改。除非以后新增模块，才需要改它。

## 启动方式

在项目根目录执行：

```bash
cd backend
python -m pip install -r requirements.txt
cd ..
python -m uvicorn backend.main:app --reload
```

启动后访问：

```text
http://127.0.0.1:8000/api/health
```

返回 `status: ok` 就说明后端正常。

## 当前已有接口

### 1. 数据采集与治理

```text
GET /api/collection/sources
GET /api/collection/summary
GET /api/collection/cleaning-samples
```

### 2. 图谱可视化

```text
GET /api/graph
GET /api/graph/job/{job_id}
GET /api/graph/search?keyword=RAG
```

### 3. 新岗位发现

```text
GET /api/discovery/jobs
GET /api/discovery/jobs/{job_id}
POST /api/discovery/jobs/{job_id}/status
```

### 4. 能力动态演化

```text
GET /api/evolution/profiles
GET /api/evolution/jobs/{job_id}
GET /api/evolution/skills?keyword=RAG
```

## 统一返回格式

成功：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

失败：

```json
{
  "code": 1,
  "message": "错误原因",
  "data": null
}
```

## 每个人给 Codex 的提示词模板

### 1号：数据采集与治理

```text
只修改 backend/routers/collection.py，不要修改其他文件。
完善数据采集与治理接口，数据从 backend/data.py 导入。
接口需要体现多源数据、采集统计、清洗样例、去重、时效性和质量评分。
所有接口返回 {"code":0,"message":"success","data":...}。
```

### 2号：图谱可视化

```text
只修改 backend/routers/graph.py，不要修改其他文件。
完善知识图谱接口，返回 nodes、edges、stats。
支持按岗位取子图和 keyword 搜索。
数据从 backend/data.py 导入。
所有接口返回 {"code":0,"message":"success","data":...}。
```

### 3号：新岗位发现

```text
只修改 backend/routers/discovery.py，不要修改其他文件。
完善新岗位发现接口，支持 keyword、status、sort 查询参数，以及岗位状态更新。
接口需要返回岗位名称、置信度、增长率、核心技能、岗位定义和证据来源。
数据从 backend/data.py 导入。
```

### 4号：能力动态演化

```text
只修改 backend/routers/evolution.py，不要修改其他文件。
完善能力动态演化接口，支持岗位能力变化、技能新增/弱化/修改、趋势预测。
接口需要返回 trend、added_skills、weakened_skills、changed_skills、forecast。
数据从 backend/data.py 导入。
```

## 前端对接示例

```js
const res = await fetch("http://127.0.0.1:8000/api/evolution/profiles");
const json = await res.json();
const profiles = json.data;
```

如果前端和后端端口不同，`main.py` 已经允许跨域。

## 协作规则

1. 每个人只改自己的 `backend/routers/*.py` 文件。
2. 不要随便改字段名，例如 `id`、`title`、`nodes`、`edges`、`status`、`trend`。
3. 需要新增公共数据时，先统一字段，再由一个人集中改 `backend/data.py`。
4. 每次改完先自己启动后端，访问自己的接口确认能返回 JSON。
5. 第一阶段不做真实爬虫和真实 RAG，先让前端四个页面都能从后端接口拿到数据。

## 第一阶段目标

先完成四个页面的后端数据支撑：

```text
数据采集 -> 图谱可视化 -> 新岗位发现 -> 能力动态演化
```

这四块跑通后，再继续做人岗匹配、质量监控、RAG 和大模型增强。
