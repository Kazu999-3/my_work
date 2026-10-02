@echo off
chcp 65001 > nul
setlocal
cd /d "%~dp0"

REM Edge Worker Daemon のデスクトップショートカット(起動/停止/ログ)と、
REM Windows起動時の自動起動(スタートアップ)を登録する。HUD(install_overlay_autostart.bat)と同じ方式。
REM 解除は uninstall_edge_worker_autostart.bat。
REM
REM 動画解析は2026-07-31以降PCのデーモンだけが担当しており、PCを再起動した後に
REM 起動し忘れると解析が止まる(2026-09-30〜10-02に約44時間止まっていた)ため自動起動にする。

set "SCRIPT_DIR=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; $desk = [Environment]::GetFolderPath('Desktop'); $dir = '%SCRIPT_DIR%'.TrimEnd('\');" ^
  "function mk($path, $target, $arguments, $desc, $style) { $s = $ws.CreateShortcut($path); $s.TargetPath = $target; $s.Arguments = $arguments; $s.WorkingDirectory = $dir; $s.WindowStyle = $style; $s.Description = $desc; $s.Save() }" ^
  "mk (Join-Path $desk 'Sovereign Edge Worker (Start).lnk') 'wscript.exe' ('\"' + $dir + '\start_edge_worker.vbs\"') 'Edge Worker Daemon を起動' 1;" ^
  "mk (Join-Path $desk 'Sovereign Edge Worker (Stop).lnk') ($dir + '\stop_edge_worker.bat') '' 'Edge Worker Daemon を停止' 7;" ^
  "mk (Join-Path $desk 'Sovereign Edge Worker (Log).lnk') 'notepad.exe' ('\"' + $dir + '\logs\edge_worker.log\"') 'Edge Worker Daemon のログを開く' 1;" ^
  "mk (Join-Path '%STARTUP_DIR%' 'Sovereign_Edge_Worker.lnk') 'wscript.exe' ('\"' + $dir + '\start_edge_worker.vbs\"') 'Edge Worker Daemon 自動起動' 1"

if not exist "%SCRIPT_DIR%logs" mkdir "%SCRIPT_DIR%logs"
if not exist "%SCRIPT_DIR%logs\edge_worker.log" type nul > "%SCRIPT_DIR%logs\edge_worker.log"

echo.
echo [完了] デスクトップに以下を作成しました:
echo   - Sovereign Edge Worker (Start) / (Stop) / (Log)
echo [完了] Windows起動時に自動起動するよう登録しました（解除: uninstall_edge_worker_autostart.bat）
ping 127.0.0.1 -n 3 > nul
exit /b 0
