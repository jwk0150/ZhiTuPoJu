#!/usr/bin/env bash
# 在 ECS 上执行：把仓库目录作为工作区，构建并启动公网 Compose
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "[error] 缺少 .env（需含 PG_PASSWORD 等）"
  exit 1
fi

mkdir -p backend/data

# 确保本机 Postgres 只监听本机时，Docker 经 host-gateway 可访问
export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-0}"
export COMPOSE_DOCKER_CLI_BUILD="${COMPOSE_DOCKER_CLI_BUILD:-0}"

docker compose -f docker-compose.server.yml -p zhitu up -d --build

echo "[info] 等待健康检查..."
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1/api/health" >/dev/null 2>&1; then
    echo "[ok] http://127.0.0.1/api/health"
    curl -fsS "http://127.0.0.1/api/health" || true
    echo
    exit 0
  fi
  sleep 2
done

echo "[warn] 健康检查超时，查看日志："
docker compose -f docker-compose.server.yml -p zhitu logs --tail=80 backend
exit 1
