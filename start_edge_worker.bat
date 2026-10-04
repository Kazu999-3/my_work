@echo off
chcp 65001 >nul
title Sovereign OS - エッジワーカー
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_edge_worker.ps1"
