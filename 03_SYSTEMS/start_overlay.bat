@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo   Sovereign HUD Overlay - Live Monitor Mode
echo ===================================================
echo.
echo [INFO] Overlay is running in background.
echo [INFO] You can minimize this window (Keep it open during play).
echo.

"..\.venv\Scripts\python.exe" "v2_CORE\_LOL\overlay\run_overlay.py"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Process exited with error code: %ERRORLEVEL%
    pause
)
