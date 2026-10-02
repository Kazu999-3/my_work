@echo off
chcp 65001 > nul
setlocal

REM Edge Worker Daemon を停止する。
REM python本体を止めると、親の start_all.ps1 が後始末(ロックファイル削除)をして終了する。
powershell -NoProfile -Command ^
  "$p = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*v2_CORE.edge_worker_daemon*' -and $_.Name -like 'python*' };" ^
  "if ($p) { $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Write-Host '[SUCCESS] Edge Worker Daemon を停止しました。' }" ^
  "else { Write-Host '[INFO] Edge Worker Daemon は起動していません。' }"

ping 127.0.0.1 -n 3 > nul
exit /b 0
