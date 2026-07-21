# ============================================================
# Sovereign OS - Local Services Startup Script (start_all.ps1)
#
# 使い方:
#   start_all.bat                → Edge Worker Daemon のみ起動（通常はこれ）
#   start_all.ps1 -Mode all      → 旧・全サービス起動（下記の理由により非推奨）
#
# ポータルとBotはクラウド(Vercel / Cloudflare Workers)で常時稼働しているため、
# ローカル版を起動しても二重になるだけ。Ollama も現在は使っていない。
# YouTube解析も字幕がある動画はクラウド(ktm-cloud-worker.yml)で処理される。
# PCが必要なのは、字幕なし動画の文字起こしなど Edge Worker が担う処理だけ。
# ============================================================
param(
    [ValidateSet("all", "edge")]
    [string]$Mode = "edge"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ============================================================
# Edge Worker 単独起動モード
# ============================================================
if ($Mode -eq "edge") {
    Write-Host "🏰 Edge Worker Daemon のみを起動します..." -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------"

    # ロックファイルのクリーンアップ
    $lockFile = "d:\my_work\03_SYSTEMS\v2_CORE\orchestrator.lock"
    if (Test-Path $lockFile) {
        Remove-Item $lockFile -Force
        Write-Host "[Cleanup] Removed stale orchestrator.lock" -ForegroundColor DarkGray
    }

    $workerProc = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%task_worker%'" -ErrorAction SilentlyContinue
    if ($workerProc) {
        Write-Host "[Task Worker] Already running. PID: $($workerProc.ProcessId)" -ForegroundColor Green
    } else {
        Write-Host "[Task Worker] Starting (foreground)..." -ForegroundColor Cyan
        Set-Location "d:\my_work\03_SYSTEMS"
        $env:PYTHONPATH = "d:\my_work\03_SYSTEMS"
        & "d:\my_work\.venv\Scripts\python.exe" -m v2_CORE.task_worker
    }
    exit
}

# ============================================================
# 全サービス起動モード (デフォルト)
# ============================================================
Write-Host "Starting Sovereign OS local services..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------------"
Write-Host "[注意] このモードはポータル/Botのローカル版まで起動します。" -ForegroundColor DarkYellow
Write-Host "       どちらもクラウドで稼働中のため、通常は不要です。" -ForegroundColor DarkYellow
Write-Host "       普段は start_all.bat（Edge Workerのみ）を使ってください。" -ForegroundColor DarkYellow
Write-Host "------------------------------------------------------------"

# Cleanup stale lock file from previous crash
$lockFile = "d:\my_work\03_SYSTEMS\v2_CORE\orchestrator.lock"
if (Test-Path $lockFile) {
    Remove-Item $lockFile -Force
    Write-Host "[Cleanup] Removed stale orchestrator.lock" -ForegroundColor DarkGray
}

# 1. Ollama (Local LLM) - Port 11434
$ollamaConn = Get-NetTCPConnection -LocalPort 11434 -ErrorAction SilentlyContinue
if (-not $ollamaConn) {
    Write-Host "[Ollama] Starting..." -ForegroundColor Cyan
    Start-Process "C:\Users\PC_User\AppData\Local\Programs\Ollama\ollama.exe" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 2
} else {
    Write-Host "[Ollama] Already running (Port: 11434)." -ForegroundColor Green
}

# 2. Next.js Portal - Port 3000
$portalConn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if (-not $portalConn) {
    Write-Host "[Next.js Portal] Starting..." -ForegroundColor Cyan
    Start-Job -Name "Portal" -ScriptBlock {
        Set-Location "d:\my_work\04_PORTAL"
        $env:NODE_OPTIONS = '--max-old-space-size=512'
        npm run dev 2>&1 | Out-File "d:\my_work\00_LOGS\portal.log"
    } | Out-Null
} else {
    Write-Host "[Next.js Portal] Already running (Port: 3000)." -ForegroundColor Green
}

# 3. Discord Bot (ktm_bot) - Port 8787
$botConn = Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue
if (-not $botConn) {
    Write-Host "[Discord Bot] Starting..." -ForegroundColor Cyan
    Start-Job -Name "Bot" -ScriptBlock {
        Set-Location "d:\my_work\03_SYSTEMS\ktm_bot"
        npm run dev 2>&1 | Out-File "d:\my_work\00_LOGS\ktm_bot.log"
    } | Out-Null
} else {
    Write-Host "[Discord Bot] Already running (Port: 8787)." -ForegroundColor Green
}

# 4. Core API (uvicorn) - Port 8000
$apiConn = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if (-not $apiConn) {
    Write-Host "[Core API] Starting..." -ForegroundColor Cyan
    Start-Job -Name "CoreAPI" -ScriptBlock {
        Set-Location "d:\my_work\03_SYSTEMS"
        & "d:\my_work\.venv\Scripts\python.exe" -m uvicorn v2_CORE.api:app --host 0.0.0.0 --port 8000 2>&1 | Out-File "d:\my_work\00_LOGS\core_api.log"
    } | Out-Null
} else {
    Write-Host "[Core API] Already running (Port: 8000)." -ForegroundColor Green
}

# 5. SRE Daemon
$sreProc = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%sre_daemon%'" -ErrorAction SilentlyContinue
if (-not $sreProc) {
    Write-Host "[SRE Daemon] Starting..." -ForegroundColor Cyan
    Start-Job -Name "SREDaemon" -ScriptBlock {
        Set-Location "d:\my_work\03_SYSTEMS"
        & "d:\my_work\.venv\Scripts\python.exe" -m v2_CORE.sre_daemon 2>&1 | Out-File "d:\my_work\00_LOGS\sre_daemon.log"
    } | Out-Null
}

# 6. Task Worker (Sovereign Task Queue Monitor)
$workerProc = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%task_worker%'" -ErrorAction SilentlyContinue
if (-not $workerProc) {
    Write-Host "[Task Worker] Starting..." -ForegroundColor Cyan
    Start-Job -Name "TaskWorker" -ScriptBlock {
        Set-Location "d:\my_work\03_SYSTEMS"
        $env:PYTHONPATH = "d:\my_work\03_SYSTEMS"
        & "d:\my_work\.venv\Scripts\python.exe" -m v2_CORE.task_worker 2>&1 | Out-File "d:\my_work\00_LOGS\task_worker_startup.log"
    } | Out-Null
} else {
    Write-Host "[Task Worker] Already running." -ForegroundColor Green
}

# 7. Edge Worker Daemon (Cloud/Vercel Task Receiver)
$edgeProc = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%edge_worker_daemon%'" -ErrorAction SilentlyContinue
if (-not $edgeProc) {
    Write-Host "[Edge Worker Daemon] Starting..." -ForegroundColor Cyan
    Start-Job -Name "EdgeWorker" -ScriptBlock {
        Set-Location "d:\my_work\03_SYSTEMS"
        $env:PYTHONPATH = "d:\my_work\03_SYSTEMS"
        & "d:\my_work\.venv\Scripts\python.exe" -m v2_CORE.edge_worker_daemon 2>&1 | Out-File "d:\my_work\00_LOGS\edge_worker_daemon_startup.log"
    } | Out-Null
} else {
    Write-Host "[Edge Worker Daemon] Already running." -ForegroundColor Green
}


Write-Host "------------------------------------------------------------"
Write-Host "All background jobs registered!" -ForegroundColor Yellow
Get-Job | Select-Object Name, State

Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "Press ENTER to stop all services and exit." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Read-Host
Stop-Job *
Get-Job | Remove-Job -Force
Write-Host "All services stopped. Bye!" -ForegroundColor Yellow

