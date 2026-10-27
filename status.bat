@echo off
chcp 65001 > nul
set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

"%PYTHON_EXE%" "%~dp0scripts\check_daemons.py"
echo.
pause
