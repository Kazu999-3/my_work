@echo off
echo ===================================================
echo Sovereign OS Launcher
echo ===================================================
echo.

cd /d "%~dp0"
if not exist ".venv" (
    cd /d "d:\my_work"
)
set PYTHONPATH=03_SYSTEMS

echo [1/2] Starting SRE Daemon (Separate Window)...
start "SRE Daemon (Sovereign OS)" cmd /k ".venv\Scripts\python.exe 03_SYSTEMS\v2_CORE\sre_daemon.py"

echo [2/2] Starting Web Portal (Separate Window)...
start "Web Portal (Next.js)" /D 04_PORTAL cmd /k "npm run dev"

echo.
echo ===================================================
echo Command sent. Please check separate windows.
echo Log file: 00_LOGS/sovereign_os.log
echo ===================================================
echo.
pause
