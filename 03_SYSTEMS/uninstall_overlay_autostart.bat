@echo off
chcp 65001 > nul
setlocal

echo =======================================================
echo   👑 Sovereign HUD - Windows自動起動の解除
echo =======================================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\Sovereign_HUD_Overlay.lnk"

if exist "%SHORTCUT_PATH%" (
    del /f /q "%SHORTCUT_PATH%"
    echo [成功] スタートアップから Sovereign HUD を解除しました。
) else (
    echo [情報] スタートアップに登録されていませんでした。
)

echo.
pause
