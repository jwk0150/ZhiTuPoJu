#!/usr/bin/env bash
# 为公网数字人（WebRTC/XRTC）启用 HTTPS（自签证书；浏览器需点一次信任）
set -euo pipefail
CERT_DIR=/opt/zhitu/certs
mkdir -p "$CERT_DIR"
if [[ ! -f "$CERT_DIR/fullchain.pem" || ! -f "$CERT_DIR/privkey.pem" ]]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -subj "/CN=8.148.77.88" \
    -addext "subjectAltName=IP:8.148.77.88"
fi
chmod 600 "$CERT_DIR/privkey.pem"
ls -la "$CERT_DIR"

# 写入支持 80+443 的 nginx 配置到宿主机，再重建 frontend（或 docker cp）
cat > /opt/zhitu/frontend/nginx.conf <<'NGINX'
server {
    listen 80;
    server_name _;
    # HTTP 跳转到 HTTPS（WebRTC 需要安全上下文）
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name _;
    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    root /usr/share/nginx/html;
    index index.html portal.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
        client_max_body_size 20m;
    }

    location /docs {
        proxy_pass http://backend:5000/docs;
        proxy_set_header Host $host;
    }
    location /openapi.json {
        proxy_pass http://backend:5000/openapi.json;
        proxy_set_header Host $host;
    }
}
NGINX

# 更新 compose：挂载证书、暴露 443
python3 - <<'PY'
from pathlib import Path
p = Path("/opt/zhitu/docker-compose.server.yml")
text = p.read_text(encoding="utf-8")
if "443:443" not in text:
    text = text.replace(
        '    ports:\n      - "80:80"\n',
        '    ports:\n      - "80:80"\n      - "443:443"\n'
        '    volumes:\n'
        '      - ./certs:/etc/nginx/certs:ro\n'
    )
    p.write_text(text, encoding="utf-8")
    print("compose updated")
else:
    print("compose already has 443")
print(p.read_text(encoding="utf-8"))
PY

export DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0
cd /opt/zhitu
docker compose -f docker-compose.server.yml -p zhitu up -d --build frontend
sleep 3
docker compose -f docker-compose.server.yml -p zhitu ps
curl -kfsS https://127.0.0.1/api/health
echo
ss -lntp | grep -E ':80|:443' || true
# 放行本机防火墙
ufw allow 443/tcp || true
iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
echo DONE
