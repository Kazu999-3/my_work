@echo off
title Antigravity Edge Worker Daemon
echo 🏰 Antigravity Sovereign OS: Edge Worker Daemon を起動します...
cd /d "%~dp0"
.venv\Scripts\python.exe 03_SYSTEMS/v2_CORE/edge_worker_daemon.py
pause
