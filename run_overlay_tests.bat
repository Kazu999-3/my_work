@echo off
setlocal
cd /d "%~dp0"
chcp 65001 > nul

echo =================================================================
echo   Sovereign HUD - Automated Test Suite
echo =================================================================
echo.
echo [1/2] Executing Python test suite...
"%~dp0.venv\Scripts\python.exe" "%~dp003_SYSTEMS\v2_CORE\_LOL\overlay\test_overlay_suite.py"

echo.
echo [2/2] Screenshots saved to:
echo       03_SYSTEMS\v2_CORE\_LOL\overlay\test_screenshots\
echo.
pause
