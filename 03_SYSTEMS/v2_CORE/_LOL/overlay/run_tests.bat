@echo off
setlocal
cd /d "%~dp0"

for %%I in ("%~dp0..\..\..\..\.venv\Scripts\python.exe") do set "PYTHON_EXE=%%~fI"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python.exe"

echo =================================================================
echo   Sovereign HUD - Automated Test Suite
echo =================================================================
echo.
"%PYTHON_EXE%" "%~dp0test_overlay_suite.py"
echo.
pause
