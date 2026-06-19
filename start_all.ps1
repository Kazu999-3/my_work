# ============================================================
# Sovereign OS - ローカルサービス一括起動スクリプト (start_all.ps1)
# ============================================================

Write-Host "🚀 Sovereign OS のローカルサービスを起動します..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------------"

# 1. Ollama (ローカルLLM) の起動 (Port: 11434)
$ollamaConn = Get-NetTCPConnection -LocalPort 11434 -ErrorAction SilentlyContinue
if (-not $ollamaConn) {
    Write-Host "🏠 [Ollama] 起動中..." -ForegroundColor Cyan
    Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = 'C:\Users\PC_User\AppData\Local\Programs\Ollama\ollama.exe serve' } | Out-Null
    Start-Sleep -Seconds 2
} else {
    Write-Host "🏠 [Ollama] すでに起動しています (Port: 11434)。" -ForegroundColor Green
}

# 2. Next.js Portal の起動 (Port: 3000)
$portalConn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if (-not $portalConn) {
    Start-Process powershell -WindowStyle Hidden -ArgumentList "-Command", "cd d:\my_work\04_PORTAL; npm run dev > d:\my_work\00_LOGS\portal.log 2>&1"
} else {
    Write-Host "🌐 [Next.js Portal] すでに起動しています (Port: 3000)。" -ForegroundColor Green
}

# 3. Discord Bot (ktm_bot) の起動 (Port: 8787)
$botConn = Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue
if (-not $botConn) {
    Start-Process powershell -WindowStyle Hidden -ArgumentList "-Command", "cd d:\my_work\03_SYSTEMS\ktm_bot; npm run dev > d:\my_work\00_LOGS\ktm_bot.log 2>&1"
} else {
    Write-Host "🤖 [Discord Bot] すでに起動しています (Port: 8787)。" -ForegroundColor Green
}

# 4. Core API / API Gateway の起動 (Port: 8000)
$apiConn = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if (-not $apiConn) {
    Start-Process powershell -WindowStyle Hidden -ArgumentList "-Command", "cd d:\my_work\03_SYSTEMS; python -m uvicorn v2_CORE.api:app --host 0.0.0.0 --port 8000 > d:\my_work\00_LOGS\core_api.log 2>&1"
} else {
    Write-Host "🔑 [Core API] すでに起動しています (Port: 8000)。" -ForegroundColor Green
}

# 5. SRE Daemon の起動 (プロセスチェック)
$sreProc = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%sre_daemon.py%'"
if (-not $sreProc) {
    Start-Process powershell -WindowStyle Hidden -ArgumentList "-Command", "cd d:\my_work\03_SYSTEMS; python v2_CORE\sre_daemon.py > d:\my_work\00_LOGS\sre_daemon_startup.log 2>&1"
} else {
    Write-Host "🛡️ [SRE Daemon] すでに起動しています。" -ForegroundColor Green
}

Write-Host "------------------------------------------------------------"
Write-Host "✨ すべてのサービスの起動処理が完了しました！" -ForegroundColor Yellow
Write-Host "※ 各ウィンドウを閉じるとサービスが終了します。起動したままで開発を行ってください。" -ForegroundColor DarkGray
