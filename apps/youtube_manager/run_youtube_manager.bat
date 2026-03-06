@echo off
echo ==================================================
echo   YouTube Automatic Manager - Daily Execution
echo ==================================================
cd /d "d:\my_work\apps\youtube_manager"
python src\main.py
echo.
echo 処理が完了しました。5秒後に自動的に閉じます...
timeout /t 5
