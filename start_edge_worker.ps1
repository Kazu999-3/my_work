# ============================================================
# Sovereign OS - Edge Worker Launcher
# ============================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = 'Sovereign OS - Edge Worker'

$rootDir = 'd:\my_work'
$logDir = "$rootDir\03_SYSTEMS\logs"
$logFile = "$logDir\edge_worker.log"
$pythonExe = "$rootDir\.venv\Scripts\python.exe"

Clear-Host
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '   Sovereign OS - エッジワーカー デーモン ランチャー' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''

$existing = Get-CimInstance Win32_Process -Filter "name = 'python.exe'" | Where-Object {
    $_.CommandLine -match 'v2_CORE\.edge_worker_daemon'
}

if ($existing) {
    $pids = ($existing | ForEach-Object { $_.ProcessId }) -join ', '
    Write-Host '[稼働中] エッジワーカーデーモンは既に正常稼働しています！' -ForegroundColor Green
    Write-Host "   実行PID: $pids" -ForegroundColor Gray
    Write-Host "   ログ保存先: $logFile" -ForegroundColor Gray
    Write-Host ''
    Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
    Write-Host '【最新ログ (直近5行)】' -ForegroundColor Yellow
    if (Test-Path $logFile) {
        Get-Content $logFile -Tail 5 -Encoding UTF8 -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "   $_" -ForegroundColor DarkGray
        }
    }
    Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '※多重起動は安全に防止されました。5秒後に自動で閉じます...' -ForegroundColor Gray
    Start-Sleep -Seconds 5
    exit 0
}

Write-Host '[起動] エッジワーカーデーモンを開始しています...' -ForegroundColor Yellow

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
}

$env:PYTHONPATH = "$rootDir\03_SYSTEMS"
$env:PYTHONUNBUFFERED = '1'
$env:PYTHONIOENCODING = 'utf-8'

$now = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -Path $logFile -Encoding UTF8 -Value "`n===== [$now] Edge Worker Daemon 手動起動 ====="

$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = 'cmd.exe'
$startInfo.Arguments = "/c `"$pythonExe -m v2_CORE.edge_worker_daemon >> `"$logFile`" 2>&1`""
$startInfo.WorkingDirectory = "$rootDir\03_SYSTEMS"
$startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$startInfo.CreateNoWindow = $true
$startInfo.UseShellExecute = $true

$proc = [System.Diagnostics.Process]::Start($startInfo)

Start-Sleep -Milliseconds 1500

$verify = Get-CimInstance Win32_Process -Filter "name = 'python.exe'" | Where-Object {
    $_.CommandLine -match 'v2_CORE\.edge_worker_daemon'
}

if ($verify) {
    $startedPid = ($verify | ForEach-Object { $_.ProcessId }) -join ', '
    Write-Host ''
    Write-Host '【起動成功】エッジワーカーデーモンが正常に開始されました！' -ForegroundColor Green
    Write-Host "   実行PID: $startedPid" -ForegroundColor Cyan
    Write-Host "   ログ保存先: $logFile" -ForegroundColor Gray
    Write-Host ''
    Write-Host 'YouTube動画の自動処理・文字起こし・キュー巡回が常駐稼働しています。' -ForegroundColor White
    Write-Host 'このウィンドウは 4秒後に自動で閉じます...' -ForegroundColor Gray
    Start-Sleep -Seconds 4
} else {
    Write-Host ''
    Write-Host '起動プロセスが終了した可能性があります。ログをご確認ください。' -ForegroundColor Red
    Write-Host "   ログ: $logFile" -ForegroundColor Yellow
    Write-Host 'キーを押すと閉じます...'
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
}
