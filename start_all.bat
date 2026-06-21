@echo off
:: Check for Administrator privileges
openfiles >nul 2>&1
if %errorlevel% neq 0 (
    echo ============================================================
    echo Requesting Administrator privileges...
    echo ============================================================
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: Run script with administrator privileges
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0start_all.ps1"
