@echo off
chcp 65001 > nul
title KTM Sovereign - Match Watcher 停止
cd /d "%~dp0"

echo ====================================================
echo    🛑 KTM Sovereign - Match Watcher 停止処理
echo ====================================================

if not exist ".ktm_watcher.pid" (
    echo [情報] 実行中の KTM Match Watcher プロセスは見つかりませんでした。
    goto END
)

set /p PID=<.ktm_watcher.pid

if "%PID%"=="" (
    echo [警告] PIDファイルが空でした。
    del /f /q ".ktm_watcher.pid" 2>nul
    goto END
)

echo [停止中] プロセス ID: %PID% を停止しています...
taskkill /PID %PID% /F >nul 2>&1

if %ERRORLEVEL% equ 0 (
    echo ✅ KTM Match Watcher を正常に停止しました。
) else (
    echo [情報] プロセスは既に終了していたか、停止済みです。
)

del /f /q ".ktm_watcher.pid" 2>nul

:END
echo ====================================================
echo 完了しました。
timeout /t 3 >nul
