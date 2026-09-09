@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo   Sovereign HUD Overlay - Debug & Log Mode
echo ===================================================
echo.
echo [INFO] Live log monitor (Closing this window will stop the overlay)
echo.

"..\.venv\Scripts\python.exe" "v2_CORE\_LOL\overlay\run_overlay.py"

pause
