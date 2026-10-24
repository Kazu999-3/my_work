@echo off
chcp 65001 > nul
title KTM Sovereign - Match Watcher
cd /d "%~dp0"

echo ====================================================
echo    🎮 KTM Sovereign - Match Watcher 起動中
echo ====================================================
echo.

node "%~dp0scripts\ktm_match_watcher.mjs"

pause
