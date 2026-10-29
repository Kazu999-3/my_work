$pidFile = 'd:\my_work\.sovereign_supervisor.pid'
if (Test-Path $pidFile) {
    try {
        $pidNum = (Get-Content $pidFile -Raw).Trim()
        if ($pidNum) { Stop-Process -Id $pidNum -Force -ErrorAction SilentlyContinue }
    } catch {}
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

$patterns = @('*sovereign_supervisor.py*', '*edge_worker_daemon.py*', '*ktm_match_watcher.mjs*', '*run_overlay.py*')
foreach ($p in $patterns) {
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like $p } | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}
Write-Output "Stop finished successfully."
