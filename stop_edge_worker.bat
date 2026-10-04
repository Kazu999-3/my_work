@echo off
chcp 65001 >nul
title Sovereign OS - エッジワーカー停止
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop_edge_worker.ps1"
