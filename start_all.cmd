@echo off
REM ============================================================
REM  One-click launcher for "ZhiTuPoJu / 岗位大新闻" (real discovery crawler)
REM  Starts the FastAPI backend (:5000) + the static frontend (:8090),
REM  then opens the news page in your default browser.
REM  Double-click this file, or run it from a command prompt.
REM ============================================================
SETLOCAL
SET "ROOT=C:\Users\Dsy\ZhiTuPoJu"
SET "BACKEND_PORT=5000"
SET "FRONTEND_PORT=8090"

REM ---- backend (FastAPI) ----
netstat -ano 2>nul | findstr ":%BACKEND_PORT%" >nul
IF %ERRORLEVEL%==0 (
  echo [warn] port %BACKEND_PORT% already in use - backend assumed running, skip.
) ELSE (
  echo [info] starting backend on :%BACKEND_PORT% ...
  start "ZhiTuPoJu-Backend" cmd /k "cd /d %ROOT% && .venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port %BACKEND_PORT%"
)

REM ---- frontend (node static server) ----
netstat -ano 2>nul | findstr ":%FRONTEND_PORT%" >nul
IF %ERRORLEVEL%==0 (
  echo [warn] port %FRONTEND_PORT% already in use - frontend assumed running, skip.
) ELSE (
  echo [info] starting frontend on :%FRONTEND_PORT% ...
  SET "NODE_EXE=node"
  WHERE node >nul 2>nul
  IF NOT %ERRORLEVEL%==0 (
    SET "NODE_EXE=C:\Users\Dsy\.workbuddy\binaries\node\versions\22.22.2-2\node.exe"
  )
  start "ZhiTuPoJu-Frontend" cmd /k "%NODE_EXE% C:\Users\Dsy\serve_news.js"
)

echo [info] waiting for backend to be ready ...
timeout /t 4 >nul
start "" http://127.0.0.1:%FRONTEND_PORT%/pages/news/index.html
echo [done] News page opened: http://127.0.0.1:%FRONTEND_PORT%/pages/news/index.html
echo        Click the "智能发现 / 开始发现" button to pull real multi-source data.
echo        Backend API: http://127.0.0.1:%BACKEND_PORT%/api/discovery/run
echo        API docs:    http://127.0.0.1:%BACKEND_PORT%/docs
echo.
echo        To stop: close the two "ZhiTuPoJu-*" command windows.
pause
