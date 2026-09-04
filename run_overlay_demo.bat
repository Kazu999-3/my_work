@echo off
setlocal
cd /d "%~dp0"
chcp 65001 > nul

echo =================================================================
echo   Sovereign HUD - Live Desktop Demo Simulation
echo =================================================================
echo.
echo [Controls]
echo   - TAB key        : Show/Hide Matchup Intel and Lane Dominance
echo   - Numpad 1 to 5  : Manual trigger of enemy spells/ultimates
echo.
"%~dp0.venv\Scripts\python.exe" "%~dp003_SYSTEMS\v2_CORE\_LOL\overlay\run_overlay.py" --demo

pause
