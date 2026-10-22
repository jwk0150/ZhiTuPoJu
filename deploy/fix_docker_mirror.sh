#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
import json
path = "/etc/docker/daemon.json"
cfg = {
    "registry-mirrors": [
        "https://docker.m.daocloud.io",
        "https://mirror.ccs.tencentyun.com",
        "https://hub-mirror.c.163.com",
    ]
}
with open(path, "w", encoding="utf-8") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
print("wrote", path)
print(open(path, encoding="utf-8").read())
PY
systemctl reset-failed docker || true
systemctl start docker
sleep 2
systemctl is-active docker
docker info | grep -A8 "Registry Mirrors" || true
echo "pulling python:3.12-slim ..."
docker pull python:3.12-slim
echo "pulling nginx:1.27-alpine ..."
docker pull nginx:1.27-alpine
