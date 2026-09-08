@echo off
chcp 65001 > nul
setlocal

echo =======================================================
echo   👑 Sovereign HUD - Windows自動起動（スタートアップ）設定
echo =======================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "VBS_PATH=%SCRIPT_DIR%start_overlay_silent.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\Sovereign_HUD_Overlay.lnk"

if not exist "%VBS_PATH%" (
    echo [エラー] ランチャーファイルが見つかりません: %VBS_PATH%
    pause
    exit /b 1
)

echo [1/2] スタートアップフォルダにショートカットを作成中...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%VBS_PATH%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Description = 'Sovereign HUD LoL Overlay Auto-Launcher'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [成功] スタートアップ登録が完了しました！
    echo.
    echo 💡 これでWindows起動時に Sovereign HUD が自動常駐し、
    echo    LoLで試合が始まると自動的にオーバーレイが表示されます。
    echo.
    echo [2/2] 今すぐバックグラウンド常駐を開始しますか？
    set /p START_NOW="今すぐ起動しますか？ (Y/N, デフォルト: Y): "
    if /i "%START_NOW%"=="" set START_NOW=Y
    if /i "%START_NOW%"=="Y" (
        wscript.exe "%VBS_PATH%"
        echo 🚀 Sovereign HUD をバックグラウンド常駐起動しました！（タスクバー右下の通知領域に常駐）
    )
) else (
    echo [エラー] ショートカットの作成に失敗しました。
)

echo.
echo =======================================================
pause
