@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

:MENU
cls
echo ==================================================
echo   🏆 Antigravity Master Control System 🚀
echo ==================================================
echo   1. 全て実行 (Full Sync: Task, Docs, Memo, YT)
echo   2. タスク同期のみ (task.md -^> Notion)
echo   3. 文書一覧同期のみ (Markdown List -^> Notion)
echo   4. メモ同期のみ (Notion -^> Local)
echo   5. YouTube整理のみ (Notion Rules)
echo   6. Discord Bot 起動 (RUN_BOT)
echo   7. 終了
echo ==================================================
set /p CHOICE="選択してください (1-7): "

if "%CHOICE%"=="1" goto ALL
if "%CHOICE%"=="2" goto TASKS
if "%CHOICE%"=="3" goto DOCS
if "%CHOICE%"=="4" goto MEMO
if "%CHOICE%"=="5" goto YT
if "%CHOICE%"=="6" goto BOT
if "%CHOICE%"=="7" exit
goto MENU

:ALL
echo.
echo [1/4] タスクを同期中...
call :TASKS_CORE
echo [2/4] ドキュメント一覧を同期中...
call :DOCS_CORE
echo [3/4] メモを同期中...
call :MEMO_CORE
echo [4/4] YouTube 整理中...
call :YT_CORE
goto END

:TASKS
echo.
call :TASKS_CORE
goto END

:DOCS
echo.
call :DOCS_CORE
goto END

:MEMO
echo.
call :MEMO_CORE
goto END

:YT
echo.
call :YT_CORE
goto END

:BOT
echo.
echo Discord Bot を起動します...
echo (注: このウィンドウは閉じずに、最小化してお使いください)
start "Antigravity Discord Bot" cmd /c "python ..\apps\hybrid_bot\src\discord_bot.py & pause"
echo Botの起動指示を送信しました。
goto MENU

:: --- Core Functions ---

:TASKS_CORE
echo task.md を Notion に同期しています...
python ..\apps\hybrid_bot\src\sync_tasks_to_notion.py
echo 完了しました。
exit /b

:DOCS_CORE
echo ローカルドキュメントを Notion に同期しています...
python ..\apps\hybrid_bot\src\sync_docs_to_notion.py
echo 完了しました。
exit /b

:MEMO_CORE
echo Notionのメモをローカルに同期しています...
python ..\apps\hybrid_bot\src\notion_to_local.py
echo 完了しました。
exit /b

:YT_CORE
echo YouTube の自動整理を開始します...
python ..\apps\youtube_manager\src\notion_yt_orchestrator.py
echo 完了しました。
exit /b

:END
echo.
echo ==================================================
echo   ✨ 処理が完了しました！ ✨
echo ==================================================
pause
goto MENU
