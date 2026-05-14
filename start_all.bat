@echo off
title SOVEREIGN OS: UNIFIED MASTER ORCHESTRATOR
cd /d "%~dp0"

echo ==================================================
echo   [START] SOVEREIGN OS: Unified Master Orchestrator
echo   (YouTube + Research + Forge + Sync + Pulse)
echo ==================================================

:: 1. Virtual Environment Check
if exist .venv\Scripts\activate goto VENV_EXISTS
echo [!] Virtual environment (.venv) not found.
pause
exit /b

:VENV_EXISTS
echo [+] Activating virtual environment...
call .venv\Scripts\activate

:: 2. Set PYTHONPATH and Audit by Sentinel
echo [+] Starting system audit by Sentinel...
set PYTHONPATH=%PYTHONPATH%;%~dp002_ENGINE
python -m v2_CORE.sentinel

:: 3. Launch Match Importer (Background, every 15min)
echo [+] Starting Match Importer (background, every 15min)...
start /min "MatchImporter" python 02_ENGINE\v2_CORE\match_importer.py

:: 4. Launch Command Center (Frontend)
echo [+] Starting Sovereign Portal (React Frontend)...
start "Command Center" cmd /c "cd /d %~dp004_COMMAND_CENTER && npm run dev"

:: 5. Launch Unified Master Orchestrator
echo [+] Launching Unified Sovereign OS...
echo [*] All sub-engines (YouTube Watcher, Kingdom, Pulse, MatchImporter) will run in parallel.
echo --------------------------------------------------
python 02_ENGINE\v2_CORE\master_orchestrator.py

pause
