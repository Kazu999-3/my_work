@echo off
echo ============================================================
echo Sovereign Mind: Desktop App Build Script (PyInstaller)
echo ============================================================

cd /d "%~dp0"

echo 1. Installing dependencies (PyInstaller, pywebview)...
d:\my_work\.venv\Scripts\pip.exe install pyinstaller pywebview httpx python-dotenv

echo 2. Running PyInstaller...
d:\my_work\.venv\Scripts\pyinstaller.exe --onefile --noconsole --add-data "ui;ui" --name "SovereignMind" app.py

echo 3. Build completed! The executable is located in:
echo %~dp0dist\SovereignMind.exe
echo ============================================================
pause
