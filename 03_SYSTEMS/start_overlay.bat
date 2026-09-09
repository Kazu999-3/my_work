@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ===================================================
echo   👑 Sovereign HUD Overlay - 起動中...
echo ===================================================
echo.
echo [INFO] LoLの試合開始（サモナーズリフト）を待機しています...
echo [INFO] 画面右下にステータスバッジが表示されます。
echo.

..\.venv\Scripts\python.exe v2_CORE\_LOL\overlay\run_overlay.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] エラーが発生して終了しました。(終了コード: %ERRORLEVEL%)
    pause
)
