@echo off
cd /d "%~dp0"

if /i "%~1"=="edge" (
    echo [Sovereign OS] Starting Edge Worker Daemon only...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_all.ps1" -Mode edge
) else (
    echo [Sovereign OS] Starting all services...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_all.ps1" -Mode all
)
pause
