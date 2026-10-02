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
#
# -LogFile を指定すると、出力をそのファイルへ追記する（窓を出さずに起動する
# 03_SYSTEMS/start_edge_worker.vbs から使う。窓が無いとログが残らないため）。
# ============================================================
param(
    [string]$LogFile = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "🏰 Edge Worker Daemon を起動します..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------------"

# 旧デザインの名残(orchestrator.lock)。現在は何もロックしておらず起動判定には使わないが、
# ファイルが残っていると紛らわしいので掃除だけしておく。
$staleLockFile = "d:\my_work\03_SYSTEMS\v2_CORE\orchestrator.lock"
if (Test-Path $staleLockFile) {
    Remove-Item $staleLockFile -Force
    Write-Host "[Cleanup] Removed stale orchestrator.lock" -ForegroundColor DarkGray
}

# 二重起動防止ロック。以前はGet-CimInstanceでのプロセス一覧走査による判定だったが、
# start_all.batを短時間に連続実行すると「両方とも未起動と判定→両方起動」という
# TOCTOUレースが起き、実際にedge_worker_daemon.pyが2重起動したまま気づかず
# 放置されていた(2026-08-10発覚)。ファイル作成の排他性(CreateNew、既に存在すれば
# 例外)でアトミックに1つだけ通す方式に変更する(quota_manager.pyのファイルロックと
# 同じ考え方)。ロック内容はこのps1プロセス自身のPID(pythonはforegroundでその子として
# 動くため、ps1が生きている間は必ずdaemonも生きている)。
$lockFile = "d:\my_work\03_SYSTEMS\v2_CORE\edge_worker_daemon.lock"

function Test-LockOwnerAlive($path) {
    if (-not (Test-Path $path)) { return $false }
    $ownerPid = Get-Content $path -ErrorAction SilentlyContinue
    if (-not $ownerPid) { return $false }
    return $null -ne (Get-Process -Id $ownerPid -ErrorAction SilentlyContinue)
}

if (Test-LockOwnerAlive $lockFile) {
    Write-Host "[Edge Worker Daemon] Already running. PID: $(Get-Content $lockFile)" -ForegroundColor Green
    exit 0
}
# 前回の異常終了でロックファイルだけ残っている(所有者プロセスは既に死んでいる)場合は
# 取り直せるよう削除する。
Remove-Item $lockFile -Force -ErrorAction SilentlyContinue

try {
    $lockStream = [System.IO.File]::Open($lockFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write)
    $lockStream.Close()
} catch {
    # ここに来た時点で別のstart_all.ps1がこの一瞬の間に先にロックを取得している(レース)。
    # 今回は起動を見送る(=二重起動しない)。
    Write-Host "[Edge Worker Daemon] 他の起動プロセスが同時にロックを取得したため、今回は起動をスキップします。" -ForegroundColor Yellow
    exit 0
}

try {
    Set-Content -Path $lockFile -Value $PID
    Write-Host "[Edge Worker Daemon] Starting (foreground)..." -ForegroundColor Cyan
    Set-Location "d:\my_work\03_SYSTEMS"
    $env:PYTHONPATH = "d:\my_work\03_SYSTEMS"
    if ($LogFile) {
        $logDir = Split-Path -Parent $LogFile
        if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
        # 10MBを超えたら1世代だけ残してローテーションする
        if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt 10MB)) {
            Move-Item -Force $LogFile "$LogFile.1"
        }
        $env:PYTHONUNBUFFERED = "1"
        $env:PYTHONIOENCODING = "utf-8"
        Add-Content -Path $LogFile -Encoding UTF8 -Value "===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Edge Worker Daemon 起動 (PID $PID) ====="
        # PowerShell 5.1 のリダイレクトは UTF-16 で書き出すため、バイト列のまま渡せる cmd でリダイレクトする
        # （パスに空白が無い前提。cmd の引用符解釈の癖を避けるため引用符は付けない）
        cmd /c "d:\my_work\.venv\Scripts\python.exe -m v2_CORE.edge_worker_daemon >> $LogFile 2>&1"
    } else {
        & "d:\my_work\.venv\Scripts\python.exe" -m v2_CORE.edge_worker_daemon
    }
} finally {
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}
