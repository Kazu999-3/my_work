@echo off
chcp 65001 > nul
echo ===================================================
echo   👑 Sovereign HUD Overlay (Mock Test Mode)
echo ===================================================
..\.venv\Scripts\python.exe v2_CORE\_LOL\overlay\run_overlay.py --mock
pause
