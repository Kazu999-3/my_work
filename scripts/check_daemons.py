#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys
import subprocess
import datetime
from pathlib import Path

# Windows 文字コード対策
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

REPO_ROOT = Path("d:/my_work")

print("=" * 60)
print(" 👑 Sovereign OS デーモン ＆ バックグラウンド稼働状況")
print("=" * 60)
print()

# 1. 常駐プロセス確認
print("--- 1. 常駐デーモン稼働状況 ---")
try:
    cmd = 'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId, CommandLine"'
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding='utf-8', errors='ignore')
    lines = res.stdout.splitlines()

    edge_pids = []
    watcher_pids = []
    overlay_pids = []

    for line in lines:
        if 'edge_worker_daemon' in line:
            parts = line.strip().split()
            if parts and parts[0].isdigit():
                edge_pids.append(parts[0])
        elif 'match_watcher_daemon' in line:
            parts = line.strip().split()
            if parts and parts[0].isdigit():
                watcher_pids.append(parts[0])
        elif 'overlay' in line and 'python' in line.lower():
            parts = line.strip().split()
            if parts and parts[0].isdigit():
                overlay_pids.append(parts[0])

    if edge_pids:
        print(f"  \033[32m[OK] Sovereign Edge Worker : 稼働中 (PID: {', '.join(edge_pids)})\033[0m")
    else:
        print("  \033[90m[--] Sovereign Edge Worker : 停止中 (起動: start_edge_worker.bat)\033[0m")

    if watcher_pids:
        print(f"  \033[32m[OK] KTM Match Watcher     : 稼働中 (PID: {', '.join(watcher_pids)})\033[0m")
    else:
        print("  \033[90m[--] KTM Match Watcher     : 待機/停止中 (起動: start_match_watcher.bat)\033[0m")

    if overlay_pids:
        print(f"  \033[32m[OK] Sovereign HUD Overlay : 稼働中 (PID: {', '.join(overlay_pids)})\033[0m")
    else:
        print("  \033[90m[--] Sovereign HUD Overlay : 待機/停止中 (Web版: http://localhost:3000/overlay)\033[0m")

except Exception as e:
    print(f"  プロセス確認エラー: {e}")

print()

# 2. ログファイル状況
print("--- 2. 最新ログ最終更新 ---")
logs = [
    ("Edge Worker ログ", REPO_ROOT / "03_SYSTEMS" / "logs" / "edge_worker.log"),
    ("Sovereign OS ログ", REPO_ROOT / "00_LOGS" / "sovereign_os.log"),
    ("HUD Overlay ログ", REPO_ROOT / "00_LOGS" / "overlay.log")
]

for label, log_path in logs:
    if log_path.exists():
        stat = log_path.stat()
        mtime = datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y/%m/%d %H:%M:%S")
        size_mb = round(stat.st_size / (1024 * 1024), 2)
        print(f"  {label:<18}: {mtime} ({size_mb} MB)")
    else:
        print(f"  {label:<18}: 未作成 / 存在しません")

print()

# 3. スタートアップ登録状況
print("--- 3. Windows スタートアップ自動起動登録 ---")
appdata = os.environ.get("APPDATA", "")
startup_dir = Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
if startup_dir.exists():
    shortcuts = list(startup_dir.glob("*Sovereign*")) + list(startup_dir.glob("*KTM*"))
    if shortcuts:
        for s in shortcuts:
            print(f"  \033[32m[登録済]\033[0m {s.name}")
    else:
        print("  \033[33m[未登録]\033[0m スタートアップにショートカットがありません (登録: scripts/register_startup.ps1)")
else:
    print("  スタートアップフォルダが見つかりません")

print()
print("=" * 60)
print(" [操作コマンド案内]")
print("  ・全起動    : start_all.bat")
print("  ・Worker起動: start_edge_worker.bat / 停止: stop_edge_worker.bat")
print("  ・試合監視  : start_match_watcher.bat / 停止: stop_match_watcher.bat")
print("=" * 60)
