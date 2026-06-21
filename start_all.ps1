# ============================================================
# Sovereign OS - Local Services Startup Script (start_all.ps1)
# ============================================================

Write-Host "Starting Sovereign OS local services..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------------"

# 1. Ollama (Local LLM) Startup (Port: 11434)
$ollamaConn = Get-NetTCPConnection -LocalPort 11434 -ErrorAction SilentlyContinue
if (-not $ollamaConn) {
    Write-Host "[Ollama] Starting..." -ForegroundColor Cyan
    Start-Process "C:\Users\PC_User\AppData\Local\Programs\Ollama\ollama.exe" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 2
} else {
    Write-Host "[Ollama] Already running (Port: 11434)." -ForegroundColor Green
}

# 2. Next.js Portal Startup (Port: 3000)
$portalConn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if (-not $portalConn) {
    Write-Host "[Next.js Portal] Starting background job..." -ForegroundColor Cyan
    Start-Job -Name "Portal" -ScriptBlock { cd d:\my_work\04_PORTAL; $env:NODE_OPTIONS='--max-old-space-size=512'; npm run dev > d:\my_work\00_LOGS\portal.log 2>&1 } | Out-Null
} else {
    Write-Host "[Next.js Portal] Already running (Port: 3000)." -ForegroundColor Green
}

# 3. Discord Bot (ktm_bot) Startup (Port: 8787)
$botConn = Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue
if (-not $botConn) {
    Write-Host "[Discord Bot] Starting background job..." -ForegroundColor Cyan
    Start-Job -Name "Bot" -ScriptBlock { cd d:\my_work\03_SYSTEMS\ktm_bot; npm run dev > d:\my_work\00_LOGS\ktm_bot.log 2>&1 } | Out-Null
} else {
    Write-Host "[Discord Bot] Already running (Port: 8787)." -ForegroundColor Green
}

# 4. Core API / API Gateway Startup (Port: 8000)
$apiConn = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if (-not $apiConn) {
    Write-Host "[Core API] Starting background job..." -ForegroundColor Cyan
    Start-Job -Name "CoreAPI" -ScriptBlock { cd d:\my_work\03_SYSTEMS; d:\my_work\.venv\Scripts\python.exe -m uvicorn v2_CORE.api:app --host 0.0.0.0 --port 8000 > d:\my_work\00_LOGS\core_api.log 2>&1 } | Out-Null
} else {
    Write-Host "[Core API] Already running (Port: 8000)." -ForegroundColor Green
}

# 5. SRE Daemon Startup (Process check)
$sreProc = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%sre_daemon%'"
if (-not $sreProc) {
    Write-Host "[SRE Daemon] Starting background job..." -ForegroundColor Cyan
    Start-Job -Name "SREDaemon" -ScriptBlock { cd d:\my_work\03_SYSTEMS; d:\my_work\.venv\Scripts\python.exe -m v2_CORE.sre_daemon > d:\my_work\00_LOGS\sre_daemon_startup.log 2>&1 } | Out-Null
} else {
    Write-Host "[SRE Daemon] Already running." -ForegroundColor Green
}

# 6. Edge Worker Daemon Startup (Process check)
$workerProc = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%edge_worker_daemon%'"
if (-not $workerProc) {
    Write-Host "[Edge Worker Daemon] Starting background job..." -ForegroundColor Cyan
    Start-Job -Name "EdgeWorker" -ScriptBlock { cd d:\my_work\03_SYSTEMS; d:\my_work\.venv\Scripts\python.exe -m v2_CORE.edge_worker_daemon > d:\my_work\00_LOGS\edge_worker_daemon_startup.log 2>&1 } | Out-Null
} else {
    Write-Host "[Edge Worker Daemon] Already running." -ForegroundColor Green
}

Write-Host "------------------------------------------------------------"
Write-Host "All background jobs registered!" -ForegroundColor Yellow
Write-Host "Here is the current job status:" -ForegroundColor DarkGray
Get-Job | Select-Object Name, State

Write-Host "`n============================================================" -ForegroundColor Yellow
Write-Host "Press any key to STOP all background services and exit." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
[void]$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Stop-Job *; Get-Job | Remove-Job -Force
