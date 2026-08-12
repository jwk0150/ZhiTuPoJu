@echo off
chcp 65001 >nul
echo ========================================
echo   ZhiTuPoJu - Stop Services Script
echo ========================================
echo.

REM Stop backend service (port 8000)
echo [1/2] Stopping backend service...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo [ACTION] Stopping process PID=%%a
    taskkill //PID %%a //F >nul 2>&1
)

REM Stop frontend service (port 8080)
echo [2/2] Stopping frontend service...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
    echo [ACTION] Stopping process PID=%%a
    taskkill //PID %%a //F >nul 2>&1
)

echo.
echo ========================================
echo   All Services Stopped
echo ========================================
pause
