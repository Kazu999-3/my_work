@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==================================================
echo   🚀 [AUTO] Antigravity Master Control System 
echo ==================================================
echo.
set ROOT_DIR=D:\my_work

echo [1/4] タスクを同期中...
python "%ROOT_DIR%\apps\hybrid_bot\src\sync_tasks_to_notion.py"

echo [2/4] メモを同期中...
python "%ROOT_DIR%\apps\hybrid_bot\src\notion_to_local.py"

echo [3/4] YouTube 整理中...
python "%ROOT_DIR%\apps\youtube_manager\src\notion_yt_orchestrator.py"

echo.
echo [4/5] 自動メンテナンス (Git登録・フォルダマップ整理等) 実行中...
python "%ROOT_DIR%\scripts\auto_maintenance.py"

echo.
echo [5/5] トレンド分析・スカウティング 実行中...
python "%ROOT_DIR%\apps\intelligence\trend_watcher.py" >> "%ROOT_DIR%\02_research\reports\auto_sync.log" 2>&1
python "%ROOT_DIR%\apps\hybrid_bot\src\trends_analyzer.py" >> "%ROOT_DIR%\02_research\reports\auto_sync.log" 2>&1

echo.
echo ==================================================
echo   ✨ 自動同期処理が完了しました！ ✨
echo ==================================================
exit /b
