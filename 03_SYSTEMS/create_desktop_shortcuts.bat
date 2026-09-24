@echo off
chcp 65001 > nul
setlocal
cd /d "%~dp0"

echo =======================================================
echo 👑 Sovereign HUD - デスクトップショートカット作成
echo =======================================================
echo.

cscript.exe //NoLogo "%~dp0create_shortcuts.vbs"

echo.
echo ✅ デスクトップに以下のショートカットを作成しました:
echo    1. Sovereign HUD (Start)
echo    2. Sovereign HUD (Stop)
echo.
echo 💡 デスクトップのアイコンをダブルクリックするだけで、
echo    黒窓なしで即座にバックグラウンド起動・停止できます。
echo =======================================================
timeout /t 3 > nul
exit /b 0
