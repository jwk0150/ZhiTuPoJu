# 执图破局（ZhiTuPoJu）

数字人才地图 · 岗位洞察 · 新岗位发现 · 人岗匹配 · 智能问答

本仓库为挑战杯 / 揭榜挂帅演示系统源码：静态前端 + FastAPI 后端；业务数据在 PostgreSQL（阿里云 ECS 宿主机库）。

---

## 目录结构

| 路径 | 说明 |
|------|------|
| `frontend/` | 静态站点（HTML/CSS/JS），Docker 下由 nginx 托管 |
| `backend/` | FastAPI 后端（地图、匹配、认证、管理端等） |
| `crawler/` | 招聘数据采集与解析（后端 knowledge 会复用部分工具） |
| `docs/` | 设计与计划文档 |
| `deploy/` | ECS 部署辅助脚本 |
| `docker-compose.yml` | **本机** Compose（经 SSH 隧道连云库 `5433`） |
| `docker-compose.server.yml` | **服务器** Compose（直连宿主机 Postgres `5432`，公网 `80`） |
| `start_all.cmd` | 本机非 Docker：隧道 + 后端 + 静态站 `:8888` |
| `start_db_tunnel.cmd` | 本机 SSH 隧道 `5433 → 云库 5432` |
| `start_docker.cmd` | 本机 Docker Compose 一键启动 |
| `.env.example` | 环境变量模板（复制为 `.env`，勿提交真实密钥） |

更细的 Docker 说明见 `README.docker.md`。

---

## 环境要求

- **本机开发**：Windows 10/11，Python 3.12（建议 venv），Docker Desktop（可选）
- **云端部署**：Ubuntu + Docker Compose V2；宿主机已安装 PostgreSQL
- 配置：复制 `.env.example` → `.env`，填写 `PG_PASSWORD`、`JWT_SECRET`、`DEEPSEEK_API_KEY` 等

---

## 快速启动（本机）

### 方式 A：非 Docker

1. 配置 `.env`（默认 `PG_HOST=127.0.0.1`、`PG_PORT=5433`）
2. 双击或运行 `start_all.cmd`（会拉起隧道、后端 `:5000`、前端 `:8888`）
3. 浏览器打开 http://127.0.0.1:8888/

### 方式 B：本机 Docker + 云库隧道

1. 启动 Docker Desktop，配置好 `.env`
2. `start_db_tunnel.cmd`（确认本机 `5433` LISTENING）
3. `start_docker.cmd`  
   （中文路径下脚本已固定项目名 `zhitu` 并关闭 BuildKit）
4. 打开 http://127.0.0.1:8080/

---

## 云端公网部署（ECS）

当前正式演示目录示例：`/opt/zhitu`，公网入口：**http://8.148.77.88/**

```bash
cd /opt/zhitu
mkdir -p backend/data
# .env 与宿主机 Postgres 一致；Compose 会覆盖 PG_HOST=host.docker.internal、PG_PORT=5432
export DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0
docker compose -f docker-compose.server.yml -p zhitu up -d --build
```

- 安全组放行 **TCP 80**；**不要**对公网开放 `5432`
- 宿主机 Postgres 需允许 Docker 网段访问（如 `listen_addresses` 含 `172.17.0.1`，`pg_hba` 放行 `172.16.0.0/12`）
- 原宿主机 `nginx` / `zhitu.service` 需停用，避免占用 80

验证：

```bash
curl -fsS http://127.0.0.1/api/health
curl -fsS http://127.0.0.1/api/map/provinces | head
```

---

## 测试账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 管理员 | `shangshanruoshui` | `ssrs123` | 内部运营端；不可自助注册管理员 |
| 普通用户 | `user` | `user123` | 业务功能页；也可在登录页自行注册 |

账号持久化文件：`backend/data/users.json`（本地/容器卷挂载；勿把含真实密码的文件提交到公开仓库）。

---

## 常用接口

| 接口 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 |
| `GET /api/map/provinces` | 人才地图省级汇总 |
| `POST /api/auth/login` | 登录 |
| `POST /api/auth/register` | 注册（仅普通用户） |

---

## 注意事项

1. **不要**把 `.env`、`backend/data/`、私钥打进对外分发包后仍明文传播密钥；本源码包默认排除 `.env`。
2. 本机目录名含中文时，Compose 请使用 `-p zhitu`，必要时 `DOCKER_BUILDKIT=0`。
3. 匹配能力在 RAG 相关表缺失时会自动降级（混合检索 / SQL / 演示数据），属预期行为。
4. 详细 Docker 排错见 `README.docker.md`。

---

## 许可证与用途

课程 / 竞赛演示项目。部署与验收请以赛题要求及现场环境为准。
