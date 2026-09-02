@echo off
REM 远端 PostgreSQL SSH 隧道：本机 5433 → 8.148.77.88:5432
REM 成功后窗口会挂起；关掉窗口即断开隧道。
SETLOCAL
cd /d "%~dp0"

SET "KEY=%USERPROFILE%\.ssh\id_ed25519"
SET "HOST=8.148.77.88"
SET "LOCAL_PORT=5433"

IF NOT EXIST "%KEY%" (
  echo [error] 未找到私钥: %KEY%
  pause
  exit /b 1
)

netstat -ano 2>nul | findstr ":%LOCAL_PORT% " | findstr LISTENING >nul
IF %ERRORLEVEL%==0 (
  echo [warn] 本机 %LOCAL_PORT% 已在监听，假定隧道已打开
  exit /b 0
)

echo [info] 建立隧道 127.0.0.1:%LOCAL_PORT% ^<- %HOST%:5432 ...
echo        使用 root 公钥登录；保持本窗口打开。
ssh -i "%KEY%" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -N -L %LOCAL_PORT%:127.0.0.1:5432 root@%HOST%
echo [exit] 隧道已断开，exit=%ERRORLEVEL%
pause
