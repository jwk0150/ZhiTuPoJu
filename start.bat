@echo off
chcp 65001 >nul
echo ========================================
echo   ZhiTuPoJu - Project Startup Script
echo ========================================
echo.

REM Check if running in project root
if not exist "backend\main.py" (
    echo [ERROR] Please run this script in project root directory
    pause
    exit /b 1
)

REM Check .env file
if not exist ".env" (
    echo [WARNING] .env file not found
    echo [INFO] Please copy .env.example to .env and fill in your config
    echo.
    echo Create .env file now? (Y/N)
    set /p create_env=
    if /i "%create_env%"=="Y" (
        copy .env.example .env
        echo [DONE] .env file created, please edit it and run this script again
        pause
        exit /b 0
    ) else (
        echo [SKIP] Please create .env file manually
        pause
        exit /b 1
    )
)

echo [1/4] Checking port usage...
echo.

REM Check backend port 8000
netstat -ano | findstr ":8000" >nul 2>&1
if %errorlevel%==0 (
    echo [DETECT] Port 8000 is in use
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
        set backend_pid=%%a
        goto :found_backend
    )
    :found_backend
    echo [ASK] Stop process PID=%backend_pid%? (Y/N)
    set /p kill_backend=
    if /i "%kill_backend%"=="Y" (
        taskkill //PID %backend_pid% //F >nul 2>&1
        echo [DONE] Backend process stopped
        timeout /t 1 /nobreak >nul
    )
)

REM Check frontend port 8080
netstat -ano | findstr ":8080" >nul 2>&1
if %errorlevel%==0 (
    echo [DETECT] Port 8080 is in use
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
        set frontend_pid=%%a
        goto :found_frontend
    )
    :found_frontend
    echo [ASK] Stop process PID=%frontend_pid%? (Y/N)
    set /p kill_frontend=
    if /i "%kill_frontend%"=="Y" (
        taskkill //PID %frontend_pid% //F >nul 2>&1
        echo [DONE] Frontend process stopped
        timeout /t 1 /nobreak >nul
    )
)

echo.
echo [2/4] Validating configuration...
python backend\check_config.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Configuration validation failed, please check .env file
    pause
    exit /b 1
)

echo.
echo [3/4] Starting backend service...
start "ZhiTuPoJu-Backend" cmd /k "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul

echo.
echo [4/4] Starting frontend service...
start "ZhiTuPoJu-Frontend" cmd /k "cd frontend && python -m http.server 8080"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   Services Started Successfully
echo ========================================
echo.
echo Frontend: http://localhost:8080/index.html
echo Backend:  http://127.0.0.1:8000
echo API Docs: http://127.0.0.1:8000/docs
echo.
echo [INFO] Close the windows to stop services
echo ========================================
pause
