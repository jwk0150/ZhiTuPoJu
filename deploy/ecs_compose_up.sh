#!/usr/bin/env bash
set -euo pipefail
cd /opt/zhitu
mkdir -p backend/data
grep -q '^JWT_SECRET=' .env || echo "JWT_SECRET=zhitu-prod-$(date +%s)" >> .env
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0
docker compose -f docker-compose.server.yml -p zhitu up -d --build
sleep 8
docker compose -f docker-compose.server.yml -p zhitu ps
curl -fsS http://127.0.0.1/api/health
echo
curl -fsS -X POST http://127.0.0.1/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"shangshanruoshui","password":"ssrs123"}' | head -c 400
echo
curl -fsS -X POST http://127.0.0.1/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"user","password":"user123"}' | head -c 400
echo
ss -lntp | grep -E ':80|:5000' || true
