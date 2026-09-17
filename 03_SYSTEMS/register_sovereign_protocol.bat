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
reg add "HKCU\Software\Classes\sovereign" /ve /t REG_SZ /d "URL:Sovereign Protocol" /f > nul
reg add "HKCU\Software\Classes\sovereign" /v "URL Protocol" /t REG_SZ /d "" /f > nul
reg add "HKCU\Software\Classes\sovereign\shell\open\command" /ve /t REG_SZ /d "wscript.exe \"%VBS_PATH%\"" /f > nul

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
