import os
import time
import subprocess
import sys
import json
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# パス設定
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

KING_PATH = ROOT_DIR / "01_知能" / "エージェント" / "王の指揮官.py"
SCOUT_PATH = ROOT_DIR / "01_知能" / "エージェント" / "斥候スカウト.py"
SENTINEL_PATH = ROOT_DIR / "01_知能" / "エージェント" / "守護センチネル.py"
BOARD_PATH = ROOT_DIR / "00_王座" / "指令板.json"

WATCH_DIRS = [
    ROOT_DIR / "Dropbox",
    ROOT_DIR / "工房_02" / "コンテンツ制作" / "reports"
]

# 自社通知モジュールのインポート
sys.path.append(str(ROOT_DIR))
try:
    from 基盤_03.通知.Discord通知 import send_to_discord
except ImportError:
    # フォルダ名が特殊な場合のフォールバック（直接実行等）
    def send_to_discord(t, d): print(f"通知: {t} - {d}")

def log_event(message):
    print(f"🧠 [Nerves] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {message}")

def check_for_changes(last_check):
    found = False
    for d in WATCH_DIRS:
        if not d.exists(): continue
        for f in d.glob("*"):
            if f.stat().st_mtime > last_check:
                log_event(f"検知: {f.name} が更新されました。")
                found = True
    return found

def run_scout_cycle():
    """
    定期的な斥候の巡回（Webリサーチのトリガー）
    """
    log_event("📡 [DailyBeat] 自律斥候 (Scout v4.0) による哨戒を開始します。")
    try:
        subprocess.run([sys.executable, str(SCOUT_PATH)], check=True)
        log_event("✅ [Scout] 哨戒完了。")
    except Exception as e:
        log_event(f"❌ [Scout] 哨戒失敗: {e}")

def run_sentinel_cycle():
    """
    守護センチネルによる定期診断（異常検知・報告）
    """
    log_event("🛡️ [Sentinel] サーバーの健全性診断を開始します。")
    try:
        subprocess.run([sys.executable, str(SENTINEL_PATH)], check=True)
        log_event("✅ [Sentinel] 診断完了。")
    except Exception as e:
        log_event(f"❌ [Sentinel] 診断失敗: {e}")

def wake_up_king():
    """
    指令板に未読のミッションがある場合、王を起動する
    """
    if not BOARD_PATH.exists(): return
    
    with open(BOARD_PATH, "r", encoding="utf-8") as f:
        board = json.load(f)
    
    unread_intents = [i for i in board["intents"] if i["status"] == "UNREAD"]
    
    if unread_intents:
        log_event(f"👑 指令板に {len(unread_intents)} 件の未読案件あり。王を起動します。")
        send_to_discord("王の起動", f"{len(unread_intents)} 件の司令に対応するため、統治サイクルを開始します。")
        try:
            subprocess.run([sys.executable, str(KING_PATH)], check=True)
            log_event("✅ 王の統治サイクルが完了しました。")
        except Exception as e:
            log_event(f"❌ 王の起動失敗: {e}")

if __name__ == "__main__":
    log_event("🌐 Antigravity 4.0 自律循環システム（Heartbeat v4.0）を稼働。")
    send_to_discord("Heartbeat v4.0 安定稼働中", "24時間の監視と自律行動サイクルが開始されました。")
    
    last_check = time.time()
    last_scout = 0 # Epoch
    last_sentinel = 0 # Epoch

    while True:
        now = time.time()
        
        # 1. 自律斥候サイクル (1時間ごと。API負荷管理のため)
        if now - last_scout > 3600: 
            run_scout_cycle()
            last_scout = now
        
        # 2. 守護センチネルサイクル (6時間ごと)
        if now - last_sentinel > 21600:
            run_sentinel_cycle()
            last_sentinel = now
        
        # 2. 指令板のチェックと王の起動
        wake_up_king()
        
        # 3. フォルダ監視チェック
        if check_for_changes(last_check):
            # フォルダ変化時は即座に王を起動（従来互換）
            wake_up_king()

        last_check = now
        time.sleep(60) # 1分ごとに鼓動
