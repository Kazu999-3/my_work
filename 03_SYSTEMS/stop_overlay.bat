@echo off
setlocal

set PID=
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":59124 "') do (
    set PID=%%a
)

if not "%PID%"=="" goto kill_proc

powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*run_overlay.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" > nul 2>&1
echo [INFO] Sovereign HUD is not running.
goto finish

:kill_proc
echo [INFO] Stopping Sovereign HUD process: %PID%
taskkill /F /PID %PID% > nul 2>&1
echo [SUCCESS] Sovereign HUD stopped successfully.

:finish
ping 127.0.0.1 -n 2 > nul
exit /b 0
