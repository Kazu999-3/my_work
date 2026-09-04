@echo off
setlocal
cd /d "%~dp0"
chcp 65001 > nul

echo =================================================================
echo   Sovereign HUD - Automated Test Suite
echo =================================================================
echo.
"%~dp0..\..\..\.venv\Scripts\python.exe" "%~dp0test_overlay_suite.py"

echo.
pause
