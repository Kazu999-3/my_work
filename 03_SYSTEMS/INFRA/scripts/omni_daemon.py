import time
import datetime
import importlib
import sys
import os

# パス設定
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(BASE_DIR, "modules"))

# モジュールのインポート
import monitor_notion_tasks
import proactive_proposer

def log_event(message):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [DAEMON] {message}")

def main():
    log_event("omni_daemon 起動。特異点プロセスを開始します。")
    
    interval = 300 # 5分ごとにチェック（デモ用。本番は3600推奨）
    
    try:
        while True:
            log_event("サイクル実行開始...")
            
            # 1. Notion監視 ＆ タスク実行
            try:
                monitor_notion_tasks.run()
            except Exception as e:
                log_event(f"Notion監視ユニットでエラー: {e}")
                
            # 2. プロアクティブ提案
            try:
                proactive_proposer.run()
            except Exception as e:
                log_event(f"プロポーザーユニットでエラー: {e}")
            
            log_event("サイクル完了。待機に入ります。")
            time.sleep(interval)
            
    except KeyboardInterrupt:
        log_event("デーモンを手動停止しました。")

if __name__ == "__main__":
    main()
