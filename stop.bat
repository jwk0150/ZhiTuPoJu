@echo off
chcp 65001 >nul
echo ========================================
echo   执图破局 - 停止服务脚本
echo ========================================
echo.

REM 停止后端服务（端口 8000）
echo [1/2] 停止后端服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo [执行] 停止进程 PID=%%a
    taskkill //PID %%a //F >nul 2>&1
)

REM 停止前端服务（端口 8080）
echo [2/2] 停止前端服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
    echo [执行] 停止进程 PID=%%a
    taskkill //PID %%a //F >nul 2>&1
)

echo.
echo ========================================
echo   ✅ 所有服务已停止
echo ========================================
pause
