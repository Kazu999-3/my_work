# ============================================================
# Sovereign OS - Local Services Startup Script (start_all.ps1)
#
# ポータルとBotはクラウド(Vercel / Cloudflare Workers)で常時稼働しており、
# YouTube解析も字幕がある動画はクラウド(ktm-cloud-worker.yml)で処理される。
# PCが必要なのは、字幕なし動画の文字起こしなど Edge Worker が担う処理だけなので、
# このスクリプトは Edge Worker Daemon の起動のみを行う。
#
# （旧・全サービス起動モード [-Mode all] は、クラウドと二重稼働になるだけの
#   ローカル版ポータル/Bot起動や、Gatewayをバイパスしていた sre_daemon.py を
#   含んでいたため廃止した。sre_daemon.py が担っていた「字幕なし動画の
#   自動巡回起票」機能は edge_worker_daemon.py 自身に統合済み。）
# ============================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "🏰 Edge Worker Daemon を起動します..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------------"

# ロックファイルのクリーンアップ
$lockFile = "d:\my_work\03_SYSTEMS\v2_CORE\orchestrator.lock"
if (Test-Path $lockFile) {
    Remove-Item $lockFile -Force
    Write-Host "[Cleanup] Removed stale orchestrator.lock" -ForegroundColor DarkGray
}

$workerProc = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%edge_worker_daemon%'" -ErrorAction SilentlyContinue
if ($workerProc) {
    Write-Host "[Edge Worker Daemon] Already running. PID: $($workerProc.ProcessId)" -ForegroundColor Green
} else {
    Write-Host "[Edge Worker Daemon] Starting (foreground)..." -ForegroundColor Cyan
    Set-Location "d:\my_work\03_SYSTEMS"
    $env:PYTHONPATH = "d:\my_work\03_SYSTEMS"
    & "d:\my_work\.venv\Scripts\python.exe" -m v2_CORE.edge_worker_daemon
}
