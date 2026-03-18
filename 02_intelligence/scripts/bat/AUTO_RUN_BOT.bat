@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==================================================
echo   🤖 Antigravity Discord Bot Auto-Starter
echo ==================================================
echo.
echo Discord Bot をバックグラウンドで起動します...
echo (このウィンドウは最小化してお使いください)
echo.

:: pythonスクリプトを直接実行して待機（exitしないことでBotプロセスを維持）
python ..\apps\hybrid_bot\src\discord_bot.py

:: 万が一クラッシュした時のためにpauseを入れておく
echo Botが停止しました。
pause
