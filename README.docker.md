# Docker Compose 部署说明

## A. 本机开发（隧道连云库）

- **frontend** nginx → 宿主机 `8080`
- **backend** uvicorn → 宿主机 `5000`
- 本机 SSH 隧道 `5433 → 8.148.77.88:5432`
- 容器：`PG_HOST=host.docker.internal`、`PG_PORT=5433`

```bat
start_db_tunnel.cmd
start_docker.cmd
```

| 入口 | URL |
|------|-----|
| 站点 | http://127.0.0.1:8080/ |
| 健康检查 | http://127.0.0.1:8080/api/health |

## B. 阿里云 ECS 公网（推荐正式演示）

在 ECS 上 Postgres 已本机监听 `127.0.0.1:5432` 时，用 `docker-compose.server.yml`：

- 站点映射 **`80:80`**（公网直接访问）
- backend **不**映射公网端口，仅 nginx `/api/` 反代
- `PG_HOST=host.docker.internal`、`PG_PORT=5432`
- `./backend/data` 挂载持久化账号（启动时自动种子管理员 / 体验用户）

```bash
mkdir -p backend/data
# .env 中 PG_PASSWORD 等与本机库一致；JWT_SECRET 请改强
DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0 \
  docker compose -f docker-compose.server.yml -p zhitu up -d --build
# 或：bash deploy/deploy_to_ecs.sh
```

开放阿里云安全组 **TCP 80**；本机防火墙放行 80。**不要**对公网开放 5432。

默认账号：

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | shangshanruoshui | ssrs123 |
| 普通用户 | user | user123 |

用户可自助注册；**无管理员注册**。

## Windows / 中文路径注意

目录名含中文时设 `name: zhitu`，并常用：

```bat
set DOCKER_BUILDKIT=0
set COMPOSE_DOCKER_CLI_BUILD=0
```

## 常见问题

| 现象 | 处理 |
|------|------|
| 本机 backend 连不上库 | 确认 `5433` LISTENING；隧道窗口未关 |
| ECS 连不上库 | 确认宿主机 `5432`；compose 用 server 文件且 `host-gateway` |
| `host.docker.internal` 无效 | compose 已含 `extra_hosts: host-gateway` |
| 注册用户重启丢失 | 确认挂载了 `./backend/data` |
| 仍想用非 Docker 本机演示 | `start_all.cmd` |

## 文件

- `docker-compose.yml`（本机）
- `docker-compose.server.yml`（ECS 公网）
- `deploy/deploy_to_ecs.sh`
- `backend/Dockerfile` / `frontend/Dockerfile` / `frontend/nginx.conf`
- `start_docker.cmd`
