@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo   Sovereign HUD Overlay - Live Monitor Mode
echo ===================================================
echo.
echo [INFO] Starting Sovereign HUD...
echo [INFO] Waiting for LoL Game (Summoner's Rift)...
echo [INFO] Mini status pill will appear on bottom-right of your screen.
echo.

"..\.venv\Scripts\python.exe" "v2_CORE\_LOL\overlay\run_overlay.py"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Process exited with error code: %ERRORLEVEL%
    pause
)
