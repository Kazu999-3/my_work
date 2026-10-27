@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
title 👑 Sovereign OS / KTM 統合ランチャー

:MENU
cls
echo ============================================================
echo   👑 Sovereign OS / KTM 統合コントロールランチャー
echo ============================================================
echo.
echo   【🚀 一括操作】
echo     [1] 全システム一括起動 (動画解析 + リプレイ待機 + 試合監視)
echo     [2] 全システム一括停止
echo.
echo   【🗺️ リプレイ道筋】
echo     [3] リプレイ道筋を取り込む (試合IDを手動入力して実行)
echo     [4] リプレイ待機ワーカーを起動 (常駐待機)
echo     [5] リプレイ待機ワーカーを停止
echo.
echo   【🎮 試合中HUDオーバーレイ】
echo     [6] HUDオーバーレイを起動
echo     [7] HUDオーバーレイを停止
echo.
echo   【📹 動画解析 (Edge Worker)】
echo     [8] Edge Worker を起動
echo     [9] Edge Worker を停止
echo     [L] Edge Worker ログを開く
echo.
echo   【📊 状況確認】
echo     [S] デーモン稼働状況・PID・ログ確認
echo.
echo     [0] 終了
echo ============================================================
set /p CHOICE="番号を入力してください: "

if "%CHOICE%"=="1" goto START_ALL
if "%CHOICE%"=="2" goto STOP_ALL
if "%CHOICE%"=="3" goto REPLAY_IMPORT
if "%CHOICE%"=="4" goto START_REPLAY_WORKER
if "%CHOICE%"=="5" goto STOP_REPLAY_WORKER
if "%CHOICE%"=="6" goto START_OVERLAY
if "%CHOICE%"=="7" goto STOP_OVERLAY
if "%CHOICE%"=="8" goto START_EDGE
if "%CHOICE%"=="9" goto STOP_EDGE
if /i "%CHOICE%"=="L" goto OPEN_LOG
if /i "%CHOICE%"=="S" goto STATUS
if "%CHOICE%"=="0" exit /b 0

echo.
echo ⚠️ 無効な番号です。もう一度入力してください。
timeout /t 2 > nul
goto MENU

:START_ALL
echo.
echo 🚀 全システムを一括起動しています...
wscript.exe "D:\my_work\03_SYSTEMS\start_edge_worker.vbs"
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process 'd:\my_work\.venv\Scripts\pythonw.exe' -ArgumentList 'd:\my_work\scripts\replay_worker.py' -WindowStyle Hidden"
wscript.exe "d:\my_work\scripts\run_match_watcher_silent.vbs"
echo ✅ 動画解析、リプレイ待機、試合監視をすべてバックグラウンド起動しました。
timeout /t 3 > nul
goto MENU

:STOP_ALL
echo.
echo 🛑 全システムを一括停止しています...
call "D:\my_work\stop_edge_worker.bat" > nul 2>&1
call "D:\my_work\03_SYSTEMS\stop_overlay.bat" > nul 2>&1
powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*replay_worker.py*' -or $_.CommandLine -like '*match_watcher_daemon*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" > nul 2>&1
echo ✅ 全デーモンを停止しました。
timeout /t 3 > nul
goto MENU

:REPLAY_IMPORT
cls
echo ===================================================
echo   🗺️ KTM リプレイ道筋 自動取り込みツール
echo ===================================================
echo.
echo ※LoLクライアントを起動し、リプレイをDLしておいてください。
echo.
set /p MATCH_ID="取り込みたい試合IDを入力（例: JP1_608209265）: "
if "%MATCH_ID%"=="" (
    echo 試合IDが未入力のためメニューへ戻ります。
    timeout /t 2 > nul
    goto MENU
)

echo.
echo 撮影範囲を選択してください:
echo 1: 試合終了まで（全編）
echo 2: 序盤10分だけ（高速）
set /p RANGE_CHOICE="番号を選択 (1 または 2) [既定: 1]: "

set EXTRA_ARGS=
if "%RANGE_CHOICE%"=="2" set EXTRA_ARGS=--minutes 10

echo.
echo ---------------------------------------------------
echo 試合 %MATCH_ID% の取り込みを開始します...
echo ※撮影中はゲーム画面を手前（アクティブ）にしてください
echo ---------------------------------------------------
echo.

d:\my_work\.venv\Scripts\python.exe d:\my_work\scripts\replay_paths.py %MATCH_ID% %EXTRA_ARGS% --upload

echo.
echo ===================================================
echo 取り込み処理が終了しました。
echo ===================================================
pause
goto MENU

:START_REPLAY_WORKER
echo.
echo 🚀 リプレイ待機ワーカーを起動中...
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process 'd:\my_work\.venv\Scripts\pythonw.exe' -ArgumentList 'd:\my_work\scripts\replay_worker.py' -WindowStyle Hidden"
echo ✅ リプレイ待機ワーカーをバックグラウンド起動しました（ポータルから自動取り込み可能）。
timeout /t 2 > nul
goto MENU

:STOP_REPLAY_WORKER
echo.
echo 🛑 リプレイ待機ワーカーを停止中...
powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*replay_worker.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo ✅ リプレイ待機ワーカーを停止しました。
timeout /t 2 > nul
goto MENU

:START_OVERLAY
echo.
echo 🎮 HUDオーバーレイを起動中...
call "D:\my_work\03_SYSTEMS\start_overlay.bat"
timeout /t 2 > nul
goto MENU

:STOP_OVERLAY
echo.
echo 🛑 HUDオーバーレイを停止中...
call "D:\my_work\03_SYSTEMS\stop_overlay.bat"
timeout /t 2 > nul
goto MENU

:START_EDGE
echo.
echo 📹 Edge Worker（動画解析）を起動中...
wscript.exe "D:\my_work\03_SYSTEMS\start_edge_worker.vbs"
echo ✅ Edge Worker をバックグラウンド起動しました。
timeout /t 2 > nul
goto MENU

:STOP_EDGE
echo.
echo 🛑 Edge Worker を停止中...
call "D:\my_work\stop_edge_worker.bat"
timeout /t 2 > nul
goto MENU

:OPEN_LOG
start notepad.exe "D:\my_work\03_SYSTEMS\logs\edge_worker.log"
goto MENU

:STATUS
cls
d:\my_work\.venv\Scripts\python.exe "d:\my_work\scripts\check_daemons.py"
echo.
pause
goto MENU
