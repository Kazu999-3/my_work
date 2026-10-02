@echo off
chcp 65001 > nul
setlocal

REM install_edge_worker_shortcuts.bat で登録した自動起動を解除する（デスクトップのショートカットは残す）
set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Sovereign_Edge_Worker.lnk"
if exist "%LNK%" (
  del "%LNK%"
  echo [完了] Edge Worker Daemon の自動起動を解除しました。
) else (
  echo [INFO] 自動起動は登録されていません。
)
ping 127.0.0.1 -n 3 > nul
exit /b 0
