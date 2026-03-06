@echo off
echo Notionのメモをローカルに同期しています...
cd /d "d:\my_work\apps\hybrid_bot"
python src\notion_to_local.py
echo 同期が完了しました！ d:\my_work\knowledge\memo フォルダを確認してください。
pause
