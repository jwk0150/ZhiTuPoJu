#!/usr/bin/env bash
set -euo pipefail
cd /opt/zhitu
# 保留 .env 与账号数据；解压覆盖业务代码
tar -xzf /tmp/zhitu-redeploy.tgz -C /opt/zhitu
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
echo '=== map ==='
curl -fsS -o /tmp/map.json -w "http=%{http_code} size=%{size_download}\n" http://127.0.0.1/api/map/provinces
head -c 120 /tmp/map.json; echo
echo '=== login user ==='
curl -fsS -X POST http://127.0.0.1/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"user","password":"user123"}' | head -c 220
echo
