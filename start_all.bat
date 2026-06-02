@echo off
chcp 65001 >nul
title SOVEREIGN OS
cd /d "%~dp0"

echo ==================================================
echo   SOVEREIGN OS: Unified Master Orchestrator
echo ==================================================

:: Check venv
if not exist ".venv\Scripts\activate.bat" (
    echo [ERROR] .venv not found.
    pause
    exit /b
)

:: Activate venv (no errorlevel check - activate returns 1 even on success)
call ".venv\Scripts\activate.bat"

:: Verify Python works
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Check venv.
    pause
    exit /b
)

:: Set environment variables
set "PYTHONPATH=%~dp003_SYSTEMS"
set "PYTHONUNBUFFERED=1"

echo [OK] venv activated
echo [OK] PYTHONPATH=%PYTHONPATH%
echo --------------------------------------------------

:: Sentinel and Match Importer are now managed by the Master Orchestrator.

:: Launch Command Center (minimized)
echo [+] Starting Command Center...
start /min "CommandCenter" cmd /c "cd /d "%~dp099_ARCHIVE/04_COMMAND_CENTER_old" && npm run dev"

echo [+] All sub-processes launched.
echo --------------------------------------------------

:: Run Master Orchestrator in this window (auto-restart loop)
:ORCH_LOOP
python -u "03_SYSTEMS\v2_CORE\master_orchestrator.py"
echo [!] Master Orchestrator stopped (code: %errorlevel%). Restarting in 5s...
timeout /t 5
goto ORCH_LOOP
