@echo off
REM ============================================================
REM  执图破局 · 一键启动（挑战杯演示）
REM  SSH 隧道 :5433  +  后端 :5000  +  前端静态 :8888
REM ============================================================
SETLOCAL EnableExtensions
cd /d "%~dp0"

SET "ROOT=%~dp0"
SET "ROOT=%ROOT:~0,-1%"
SET "BACKEND_PORT=5000"
SET "FRONTEND_PORT=8888"
SET "DB_TUNNEL_PORT=5433"

where python >nul 2>nul
IF ERRORLEVEL 1 (
  echo [error] 未找到 python，请先安装并加入 PATH
  pause
  exit /b 1
)

REM ---- SSH tunnel to remote Postgres (map_data_table) ----
netstat -ano 2>nul | findstr ":%DB_TUNNEL_PORT% " | findstr LISTENING >nul
IF %ERRORLEVEL%==0 (
  echo [warn] 端口 %DB_TUNNEL_PORT% 已在监听，假定云库隧道已打开
) ELSE (
  echo [info] 启动云库 SSH 隧道 127.0.0.1:%DB_TUNNEL_PORT% ...
  start "ZhiTuPoJu-DBTunnel" cmd /k "cd /d "%ROOT%" && call start_db_tunnel.cmd"
  timeout /t 3 >nul
)

REM ---- backend (FastAPI) ----
netstat -ano 2>nul | findstr ":%BACKEND_PORT% " >nul
IF %ERRORLEVEL%==0 (
  echo [warn] 端口 %BACKEND_PORT% 已被占用，假定后端已在运行
) ELSE (
  echo [info] 启动后端 http://127.0.0.1:%BACKEND_PORT% ...
  start "ZhiTuPoJu-Backend" cmd /k "cd /d "%ROOT%" && python -m uvicorn backend.main:app --host 127.0.0.1 --port %BACKEND_PORT% --reload"
)

REM ---- frontend (python http.server) ----
netstat -ano 2>nul | findstr ":%FRONTEND_PORT% " >nul
IF %ERRORLEVEL%==0 (
  echo [warn] 端口 %FRONTEND_PORT% 已被占用，假定前端已在运行
) ELSE (
  echo [info] 启动前端 http://127.0.0.1:%FRONTEND_PORT% ...
  start "ZhiTuPoJu-Frontend" cmd /k "cd /d "%ROOT%\frontend" && python -m http.server %FRONTEND_PORT%"
)

echo [info] 等待服务就绪...
timeout /t 4 >nul
start "" "http://127.0.0.1:%FRONTEND_PORT%/"
echo [done] 入口:     http://127.0.0.1:%FRONTEND_PORT%/
echo        后端 API: http://127.0.0.1:%BACKEND_PORT%/api/health
echo        云库隧道: 127.0.0.1:%DB_TUNNEL_PORT%  ^(map_data_table^)
echo        文档:     http://127.0.0.1:%BACKEND_PORT%/docs
echo.
echo 演示路径: 开发者入口 → 岗位大新闻 → 地图 → 洞察 → 发现 → 匹配 → 仓库
echo 关闭本窗口不会停服务；请关掉 ZhiTuPoJu-* 窗口以停止。
pause
