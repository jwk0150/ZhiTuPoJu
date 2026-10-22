#!/usr/bin/env bash
set -euo pipefail

# 打断卡住的构建
pkill -f 'docker compose.*zhitu' 2>/dev/null || true
pkill -f 'docker-compose.*zhitu' 2>/dev/null || true
docker ps -aq --filter ancestor=9d3efd0744ff | xargs -r docker rm -f 2>/dev/null || true
docker builder prune -f >/dev/null 2>&1 || true

cd /opt/zhitu
mkdir -p backend/data
grep -q '^JWT_SECRET=' .env || echo "JWT_SECRET=zhitu-prod-$(date +%s)" >> .env

export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

docker compose -f docker-compose.server.yml -p zhitu up -d --build --force-recreate

sleep 6
docker compose -f docker-compose.server.yml -p zhitu ps
echo '=== health ==='
curl -fsS http://127.0.0.1/api/health
echo
echo '=== admin login ==='
curl -fsS -X POST http://127.0.0.1/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"shangshanruoshui","password":"ssrs123"}'
echo
echo '=== user login ==='
curl -fsS -X POST http://127.0.0.1/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"user","password":"user123"}'
echo
ss -lntp | grep -E ':80 ' || true
