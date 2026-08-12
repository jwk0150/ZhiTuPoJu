@echo off
chcp 65001 >nul
echo ========================================
echo   执图破局 - 项目启动脚本
echo ========================================
echo.

REM 检查是否在项目根目录
if not exist "backend\main.py" (
    echo [错误] 请在项目根目录运行此脚本
    pause
    exit /b 1
)

REM 检查 .env 文件
if not exist ".env" (
    echo [警告] 未找到 .env 文件
    echo [提示] 请复制 .env.example 为 .env 并填写配置
    echo.
    echo 是否现在创建 .env 文件？(Y/N)
    set /p create_env=
    if /i "%create_env%"=="Y" (
        copy .env.example .env
        echo [完成] 已创建 .env 文件，请编辑后重新运行启动脚本
        pause
        exit /b 0
    ) else (
        echo [跳过] 请手动创建 .env 文件后再启动
        pause
        exit /b 1
    )
)

echo [1/4] 检查端口占用...
echo.

REM 检查后端端口 8000
netstat -ano | findstr ":8000" >nul 2>&1
if %errorlevel%==0 (
    echo [检测] 端口 8000 已被占用
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
        set backend_pid=%%a
        goto :found_backend
    )
    :found_backend
    echo [询问] 是否停止占用进程 PID=%backend_pid%？(Y/N)
    set /p kill_backend=
    if /i "%kill_backend%"=="Y" (
        taskkill //PID %backend_pid% //F >nul 2>&1
        echo [完成] 已停止后端进程
        timeout /t 1 /nobreak >nul
    )
)

REM 检查前端端口 8080
netstat -ano | findstr ":8080" >nul 2>&1
if %errorlevel%==0 (
    echo [检测] 端口 8080 已被占用
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
        set frontend_pid=%%a
        goto :found_frontend
    )
    :found_frontend
    echo [询问] 是否停止占用进程 PID=%frontend_pid%？(Y/N)
    set /p kill_frontend=
    if /i "%kill_frontend%"=="Y" (
        taskkill //PID %frontend_pid% //F >nul 2>&1
        echo [完成] 已停止前端进程
        timeout /t 1 /nobreak >nul
    )
)

echo.
echo [2/4] 验证环境配置...
python backend\check_config.py
if %errorlevel% neq 0 (
    echo.
    echo [错误] 配置验证失败，请检查 .env 文件
    pause
    exit /b 1
)

echo.
echo [3/4] 启动后端服务...
start "执图破局-后端" cmd /k "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul

echo.
echo [4/4] 启动前端服务...
start "执图破局-前端" cmd /k "cd frontend && python -m http.server 8080"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   ✅ 服务启动完成
echo ========================================
echo.
echo 前端地址: http://localhost:8080/index.html
echo 后端地址: http://127.0.0.1:8000
echo API文档:  http://127.0.0.1:8000/docs
echo.
echo [提示] 关闭窗口即可停止服务
echo ========================================
pause
