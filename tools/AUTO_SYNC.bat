@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==================================================
echo   🚀 [AUTO] Antigravity Master Control System 
echo ==================================================
echo.
echo [1/4] タスクを同期中...
python ..\apps\hybrid_bot\src\sync_tasks_to_notion.py

echo [2/4] ドキュメント一覧を同期中...
python ..\apps\hybrid_bot\src\sync_docs_to_notion.py

echo [3/4] メモを同期中...
python ..\apps\hybrid_bot\src\notion_to_local.py

echo [4/4] YouTube 整理中...
python ..\apps\youtube_manager\src\notion_yt_orchestrator.py

echo.
echo ==================================================
echo   ✨ 自動同期処理が完了しました！ ✨
echo ==================================================
exit /b
