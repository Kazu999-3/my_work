@echo off
setlocal
cd /d "%~dp0"
chcp 65001 > nul

echo =================================================================
echo   Sovereign HUD - Live Desktop Demo Simulation
echo =================================================================
echo.
"%~dp0..\..\..\.venv\Scripts\python.exe" "%~dp0run_overlay.py" --demo

pause
