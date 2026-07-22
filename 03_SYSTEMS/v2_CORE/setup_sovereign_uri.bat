@echo off
chcp 65001 > nul
echo ===================================================
echo   Sovereign Worker Custom URI Protocol 登録
echo ===================================================
echo.
echo 'sovereign-worker://' プロトコルをレジストリに登録中...

reg add "HKCU\Software\Classes\sovereign-worker" /ve /t REG_SZ /d "URL:Sovereign Worker Protocol" /f
reg add "HKCU\Software\Classes\sovereign-worker" /v "URL Protocol" /t REG_SZ /d "" /f
reg add "HKCU\Software\Classes\sovereign-worker\shell" /f
reg add "HKCU\Software\Classes\sovereign-worker\shell\open" /f
reg add "HKCU\Software\Classes\sovereign-worker\shell\open\command" /ve /t REG_SZ /d "cmd.exe /c start \"SovereignWorker\" python \"d:\my_work\03_SYSTEMS\v2_CORE\edge_worker_daemon.py\"" /f

echo.
echo ✅ 'sovereign-worker://' プロトコルの登録が完了しました！
echo ブラウザから sovereign-worker://start を開くことでエッジワーカーを起動できます。
echo.
pause
