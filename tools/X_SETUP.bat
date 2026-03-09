@echo off
chcp 65001 > nul
setlocal
cd /d "d:\my_work"

echo ========================================
echo   アンちゃん X自動投稿ツール (初期設定)
echo ========================================
echo.
echo 今からブラウザが起動します。
echo 手動でXにログインしてください。
echo ログイン完了後、この画面に戻ってEnterを押してください。
echo.
pause

.\.venv\Scripts\python apps\x_automator\session_maker.py

echo.
echo セットアップが完了しました！
echo 今後は apps\x_automator\poster.py を使って自動投稿が可能です。
echo.
pause
