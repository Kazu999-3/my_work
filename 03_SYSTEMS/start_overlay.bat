@echo off
cd /d "%~dp0"
echo ===================================================
echo   Sovereign HUD Overlay (Live Monitor Mode)
echo ===================================================
..\.venv\Scripts\python.exe v2_CORE\_LOL\overlay\run_overlay.py
pause
