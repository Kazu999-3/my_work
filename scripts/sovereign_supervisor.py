#!/usr/bin/env python3
"""
👑 Sovereign OS - 統合スーパバイザー (Master Supervisor Daemon)
================================================================================
以下のバックグラウンドサービスを統合管理し、常時死活監視・自動自己修復（再起動）を行います：
  1. Edge Worker: YouTube動画解析・再解析ワーカー (Python)
  2. Match Watcher: LoLカスタム試合リザルト自動記録ワーカー (Node.js)
  3. HUD Overlay: ゲーム内支援HUD (Python PyQt6 / ステルス待機モード)

【特長】
- スリープ復帰時や異常終了時も、10秒以内に検知して自動復旧。
- 単一のPIDファイルで二重起動を完全防止。
- 終了時はすべての子プロセスを安全に一括シャットダウン。
"""

import os
import sys
import io
import time
import signal
import subprocess
from pathlib import Path
from datetime import datetime

# pythonw.exe (GUI/完全非表示モード) で sys.stdout / sys.stderr が None の場合の安全ガード
if sys.stdout is None:
    sys.stdout = io.StringIO()
if sys.stderr is None:
    sys.stderr = sys.stdout

# Windows(日本語ロケール cp932)での絵文字出力による UnicodeEncodeError 防止
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
SUPERVISOR_LOG = LOG_DIR / "supervisor.log"
PID_FILE = ROOT_DIR / ".sovereign_supervisor.pid"

PYTHON_EXE = ROOT_DIR / ".venv" / "Scripts" / "python.exe"
PYTHONW_EXE = ROOT_DIR / ".venv" / "Scripts" / "pythonw.exe"
NODE_EXE = "node"  # PATHから解決、または C:\Program Files\nodejs\node.exe

# Windowsで子プロセスの黒いコマンド窓を表示させないフラグ
CREATE_NO_WINDOW = 0x08000000


def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] [Supervisor] {msg}"
    print(line, flush=True)
    try:
        with open(SUPERVISOR_LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


class ManagedService:
    def __init__(self, name: str, cmd: list[str], cwd: Path, log_file: Path | None = None):
        self.name = name
        self.cmd = [str(c) for c in cmd]
        self.cwd = str(cwd)
        self.log_file = log_file
        self.log_fp = None
        self.process: subprocess.Popen | None = None
        self.restart_count = 0
        self.last_start_time = 0.0

    def start(self):
        now = time.time()
        # 連続即死（5秒未満での再起動）の場合はウェイトを入れて負荷を防止
        if now - self.last_start_time < 5.0:
            log(f"⚠️ {self.name} が直前に即死しました。5秒待機後に再試行します...")
            time.sleep(5.0)

        self.last_start_time = time.time()
        try:
            out_target = subprocess.DEVNULL
            if self.log_file:
                self.log_file.parent.mkdir(parents=True, exist_ok=True)
                self.log_fp = open(self.log_file, "a", encoding="utf-8", buffering=1)
                out_target = self.log_fp

            self.process = subprocess.Popen(
                self.cmd,
                cwd=self.cwd,
                creationflags=CREATE_NO_WINDOW,
                stdout=out_target,
                stderr=out_target,
            )
            log(f"✅ {self.name} を起動しました (PID: {self.process.pid})")
        except Exception as e:
            log(f"❌ {self.name} の起動に失敗しました: {e}")
            self.process = None

    def poll_and_recover(self):
        if self.process is None:
            log(f"🔄 {self.name} が未起動のため起動します...")
            self.start()
            return

        code = self.process.poll()
        if code is not None:
            self.restart_count += 1
            log(f"⚠️ {self.name} が停止しているのを検知しました (終了コード: {code}, 累計再起動: {self.restart_count})。自動復旧中...")
            self.start()

    def stop(self):
        if self.process and self.process.poll() is None:
            log(f"🛑 {self.name} を終了中 (PID: {self.process.pid})...")
            try:
                self.process.terminate()
                self.process.wait(timeout=3.0)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
            self.process = None
        if self.log_fp:
            try:
                self.log_fp.close()
            except Exception:
                pass
            self.log_fp = None


def ensure_single_instance():
    if PID_FILE.exists():
        try:
            old_pid = int(PID_FILE.read_text(encoding="utf-8").strip())
            # プロセスの生存確認 (Windows)
            import ctypes
            kernel32 = ctypes.windll.kernel32
            SYNCHRONIZE = 0x00100000
            handle = kernel32.OpenProcess(SYNCHRONIZE, False, old_pid)
            if handle != 0:
                kernel32.CloseHandle(handle)
                log(f"⚠️ すでに Sovereign Supervisor が稼働中です (PID: {old_pid})。終了します。")
                sys.exit(0)
        except Exception:
            pass

    PID_FILE.write_text(str(os.getpid()), encoding="utf-8")


def main():
    ensure_single_instance()
    log("============================================================")
    log(f"👑 Sovereign 統合スーパーバイザーを開始しました (PID: {os.getpid()})")
    log("============================================================")

    # 管理対象サービスの定義
    services = [
        # 1. Edge Worker (動画解析・再解析)
        ManagedService(
            name="Edge Worker (動画解析)",
            cmd=[PYTHON_EXE, "03_SYSTEMS/v2_CORE/edge_worker_daemon.py"],
            cwd=ROOT_DIR,
            log_file=ROOT_DIR / "03_SYSTEMS" / "logs" / "edge_worker.log",
        ),
        # 2. Match Watcher (試合リザルト自動記録)
        ManagedService(
            name="Match Watcher (試合監視)",
            cmd=[NODE_EXE, "scripts/ktm_match_watcher.mjs"],
            cwd=ROOT_DIR,
        ),
        # 3. HUD Overlay (ステルス待機モード)
        ManagedService(
            name="HUD Overlay (ステルスHUD)",
            cmd=[PYTHONW_EXE, "03_SYSTEMS/v2_CORE/_LOL/overlay/run_overlay.py", "--stealth"],
            cwd=ROOT_DIR,
        ),
    ]

    def shutdown(signum=None, frame=None):
        log("🛑 シャットダウンシグナルを受信しました。全子プロセスを停止します...")
        for s in reversed(services):
            s.stop()
        if PID_FILE.exists():
            try:
                PID_FILE.unlink()
            except Exception:
                pass
        log("👋 スーパーバイザーを正常終了しました。")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # 初回一括起動
    for s in services:
        s.start()

    log("👀 全サービスの死活監視ループを開始しました（監視間隔: 10秒）")

    # 死活監視ループ
    try:
        while True:
            time.sleep(10.0)
            for s in services:
                s.poll_and_recover()
    except KeyboardInterrupt:
        shutdown()
    except Exception as e:
        log(f"❌ スーパーバイザー監視ループで予期しない例外: {e}")
        shutdown()


if __name__ == "__main__":
    main()
