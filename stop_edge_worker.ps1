# ============================================================
# Sovereign OS - Edge Worker Stopper
# ============================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = 'Sovereign OS - Stop Edge Worker'

Clear-Host
Write-Host '============================================================' -ForegroundColor Red
Write-Host '   Sovereign OS - エッジワーカー 停止ツール' -ForegroundColor Red
Write-Host '============================================================' -ForegroundColor Red
Write-Host ''

$targets = Get-CimInstance Win32_Process -Filter "name = 'python.exe'" | Where-Object {
    $_.CommandLine -match 'v2_CORE\.edge_worker_daemon'
}

if (-not $targets) {
    Write-Host 'エッジワーカーデーモンは現在稼働していません。' -ForegroundColor Yellow
    Write-Host '3秒後に自動で閉じます...' -ForegroundColor Gray
    Start-Sleep -Seconds 3
    exit 0
}

foreach ($p in $targets) {
    Write-Host "プロセス (PID: $($p.ProcessId)) を停止中..." -ForegroundColor Yellow
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

$lockFile = 'd:\my_work\03_SYSTEMS\v2_CORE\edge_worker_daemon.lock'
if (Test-Path $lockFile) {
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host 'エッジワーカーデーモンを正常に停止しました。' -ForegroundColor Green
Write-Host '3秒後に自動で閉じます...' -ForegroundColor Gray
Start-Sleep -Seconds 3
