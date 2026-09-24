@echo off
chcp 65001 > nul
setlocal
cd /d "%~dp0"

echo =======================================================
echo   👑 Sovereign HUD - Windows自動起動（スタートアップ）設定
echo =======================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "START_BAT=%SCRIPT_DIR%start_overlay.bat"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\Sovereign_HUD_Overlay.lnk"

if not exist "%START_BAT%" (
    echo [エラー] ランチャーファイルが見つかりません: %START_BAT%
    pause
    exit /b 1
)

echo [1/3] スタートアップフォルダにショートカットを作成中...
powershell -NoProfile -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$s = $ws.CreateShortcut('%SHORTCUT_PATH%'); " ^
    "$s.TargetPath = '%START_BAT%'; " ^
    "$s.WorkingDirectory = '%SCRIPT_DIR%'; " ^
    "$s.WindowStyle = 7; " ^
    "$s.Description = 'Sovereign HUD LoL Overlay Auto-Launcher'; " ^
    "$s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [成功] スタートアップ登録が完了しました！
    echo 💡 これでWindows起動時に Sovereign HUD が自動常駐し、
    echo    LoLで試合が始まると自動的にオーバーレイが表示されます。
) else (
    echo [エラー] スタートアップの登録に失敗しました。
)

echo.
echo [2/3] デスクトップにもショートカットを作成します...
call "%SCRIPT_DIR%create_desktop_shortcuts.bat"

echo.
echo [3/3] 今すぐバックグラウンド常駐を開始しますか？
set /p START_NOW="今すぐ起動しますか？ (Y/N, デフォルト: Y): "
if /i "%START_NOW%"=="" set START_NOW=Y
if /i "%START_NOW%"=="Y" (
    call "%START_BAT%"
    echo 🚀 Sovereign HUD をバックグラウンド常駐起動しました！（タスクバー右下の通知領域に常駐）
)

echo.
echo =======================================================
pause
