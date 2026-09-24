@echo off
setlocal
cd /d "%~dp0"

for %%I in ("%~dp0..\..\..\..\.venv\Scripts\python.exe") do set "PYTHON_EXE=%%~fI"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python.exe"

echo =================================================================
echo   Sovereign HUD - Live Desktop Demo Simulation
echo =================================================================
echo.
"%PYTHON_EXE%" "%~dp0run_overlay.py" --demo
pause
