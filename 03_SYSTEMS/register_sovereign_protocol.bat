@echo off
chcp 65001 > nul
setlocal

echo =======================================================
echo   👑 Sovereign Protocol (sovereign://) 登録ランチャー
echo =======================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "VBS_PATH=%SCRIPT_DIR%start_overlay_silent.vbs"

if not exist "%VBS_PATH%" (
    echo [エラー] ランチャーファイルが見つかりません: %VBS_PATH%
    pause
    exit /b 1
)

echo [1/2] HKCUレジストリに sovereign:// プロトコルを登録中...
powershell -NoProfile -Command "Set-ItemProperty -Path 'HKCU:\Software\Classes\sovereign' -Name '(default)' -Value 'URL:Sovereign Protocol' -Force; Set-ItemProperty -Path 'HKCU:\Software\Classes\sovereign' -Name 'URL Protocol' -Value '' -Force; New-Item -Path 'HKCU:\Software\Classes\sovereign\shell\open\command' -Force | Out-Null; Set-ItemProperty -Path 'HKCU:\Software\Classes\sovereign\shell\open\command' -Name '(default)' -Value 'wscript.exe \"%VBS_PATH%\" \"%%1\"' -Force"

if %ERRORLEVEL% EQU 0 (
    echo [成功] sovereign:// プロトコルの登録が完了しました！
    echo.
    echo 💡 これでブラウザ（Vercel上のポータル画面など）から
    echo    「👑 オーバーレイ起動」ボタンを押すだけで、
    echo    ローカルPCの Sovereign HUD がワンクリックで直接起動します。
    echo.
    echo [2/2] テスト起動しますか？
    set /p START_NOW="今すぐ起動テストを行いますか？ (Y/N, デフォルト: Y): "
    if /i "%START_NOW%"=="" set START_NOW=Y
    if /i "%START_NOW%"=="Y" (
        start sovereign://launch-overlay
        echo 🚀 Sovereign HUD を起動しました！（タスクバー通知領域に常駐）
    )
) else (
    echo [エラー] レジストリ登録に失敗しました。
)

echo.
echo =======================================================
pause
