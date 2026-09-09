@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo   Sovereign HUD Overlay - Mock Test Mode
echo ===================================================
echo.
echo [INFO] Starting Overlay in Mock Mode (All Widgets Visible)...
echo.

"..\.venv\Scripts\python.exe" "v2_CORE\_LOL\overlay\run_overlay.py" --mock

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Process exited with error code: %ERRORLEVEL%
    pause
)
