@echo off
setlocal
cd /d "%~dp0"

:: 独立したバックグラウンドプロセスとして起動
start "" "..\.venv\Scripts\python.exe" "v2_CORE\_LOL\overlay\run_overlay.py"

:: cmdウィンドウは即座に自動終了
exit
