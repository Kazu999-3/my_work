@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==================================================
echo   🚀 [AUTO] Antigravity Master Control System 
echo ==================================================
echo.
set ROOT_DIR=D:\my_work

echo.
echo [1/2] 知能統合エンジン (Omni-Agent) 起動中...
python "%ROOT_DIR%\apps\intelligence\omni_agent.py" >> "%ROOT_DIR%\02_research\reports\auto_sync.log" 2>&1

echo.
echo [2/2] 自動メンテナンス (Git登録・フォルダマップ整理等) 実行中...
python "%ROOT_DIR%\scripts\auto_maintenance.py"

echo.
echo ==================================================
echo   ✨ 自動同期処理が完了しました！ ✨
echo ==================================================
exit /b
