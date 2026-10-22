@echo off
REM 执图破局 · Docker Compose 启动（需本机 SSH 隧道连阿里云库）
SETLOCAL EnableExtensions
cd /d "%~dp0"

where docker >nul 2>nul
IF ERRORLEVEL 1 (
  echo [error] 未找到 docker，请先安装并启动 Docker Desktop
  pause
  exit /b 1
)

netstat -ano 2>nul | findstr ":5433 " | findstr LISTENING >nul
IF ERRORLEVEL 1 (
  echo [info] 本机 5433 未监听，正在启动云库隧道...
  start "ZhiTuPoJu-DBTunnel" cmd /k "cd /d "%~dp0" && call start_db_tunnel.cmd"
  timeout /t 4 >nul
)

netstat -ano 2>nul | findstr ":5433 " | findstr LISTENING >nul
IF ERRORLEVEL 1 (
  echo [error] 隧道未就绪。请先运行 start_db_tunnel.cmd 并保持窗口打开。
  pause
  exit /b 1
)

REM 中文路径下 BuildKit 可能失败；classic builder + 固定项目名 zhitu
set DOCKER_BUILDKIT=0
set COMPOSE_DOCKER_CLI_BUILD=0
echo [info] docker compose -p zhitu up -d --build ...
docker compose -p zhitu up -d --build
IF ERRORLEVEL 1 (
  echo [error] compose 失败（可试：关闭 BuildKit 后重跑；见 README.docker.md）
  pause
  exit /b 1
)

echo [done] 前端 http://127.0.0.1:8080/
echo        API   http://127.0.0.1:5000/api/health
echo        文档  http://127.0.0.1:5000/docs
start "" "http://127.0.0.1:8080/"
pause
