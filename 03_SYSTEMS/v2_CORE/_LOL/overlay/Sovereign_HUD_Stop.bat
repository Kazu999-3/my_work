@echo off
chcp 65001 > nul
echo ===================================================
echo 🛑 Sovereign HUD - 停止スクリプト
echo ===================================================

set FOUND=0

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":59124 "') do (
    set PID=%%a
    set FOUND=1
)

if "%FOUND%"=="1" (
    echo 🎯 実行中の Sovereign HUD プロセス (PID: %PID%) を終了しています...
    taskkill /F /PID %PID% > nul 2>&1
    echo ✅ Sovereign HUD を正常に終了しました。
) else (
    echo ℹ️ Sovereign HUD は起動していません（待機中プロセスなし）。
)

timeout /t 2 > nul
exit /b 0
