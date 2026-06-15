@echo off
chcp 65001 > nul
echo ===================================================
echo 🚀 Sovereign OS 一括起動システム (Sovereign Launcher)
echo ===================================================
echo.

echo [1/2] SRE常駐デーモンを起動します (別ウィンドウ)...
start "SRE Daemon (Sovereign OS)" cmd /k "set PYTHONPATH=03_SYSTEMS && .venv\Scripts\python.exe 03_SYSTEMS\v2_CORE\sre_daemon.py"

echo [2/2] Webポータル開発サーバーを起動します (別ウィンドウ)...
start "Web Portal (Next.js)" cmd /k "cd 04_PORTAL && npm run dev"

echo.
echo ===================================================
echo ✅ すべての常駐プロセスの起動指示を送信しました。
echo    それぞれのコンソールウィンドウを確認してください。
echo.
echo 💡 AIエージェントの自律稼働・エラー修復のログは、
echo    `00_LOGS/sovereign_os.log` にてリアルタイムに確認できます。
echo ===================================================
echo.
pause
