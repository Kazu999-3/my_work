@echo off
chcp 65001 > nul
echo ===================================================
echo 👑 Sovereign HUD - バックグラウンド常駐ランチャー
echo ===================================================

cd /d "%~dp0"
set PYTHON_EXE=..\..\..\..\.venv\Scripts\pythonw.exe

if not exist "%PYTHON_EXE%" (
    set PYTHON_EXE=pythonw.exe
)

echo 🚀 Sovereign HUD をバックグラウンドで起動しています...
echo 💡 タスクバー通知領域（右下）に 👑 アイコンが常駐します。
echo ⌨️ ゲーム中は [F8] キーでHUDの表示/非表示を一発トグルできます。
echo.

start "" "%PYTHON_EXE%" run_overlay.py

timeout /t 2 > nul
exit /b 0
