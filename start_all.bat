@echo off
cd /d "%~dp0"

REM ポータル・Bot はクラウド(Vercel / Cloudflare Workers)で稼働しているため、
REM ローカルで起動する必要があるのは Edge Worker Daemon だけ。
REM （字幕なし動画の文字起こしなど、PCでしかできない処理を担当する）
echo [Sovereign OS] Starting Edge Worker Daemon...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_all.ps1" -Mode edge
pause
