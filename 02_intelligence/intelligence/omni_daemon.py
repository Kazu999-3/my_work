import time
import subprocess
import sys
from pathlib import Path
from datetime import datetime

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
AGENT_PATH = ROOT_DIR / "02_intelligence" / "intelligence" / "omni_agent.py"

def log(msg):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [Daemon] {msg}")

def run_forever():
    """アンちゃんを永続的に実行し続けるメインループ"""
    log("🚀 アンちゃん 7.0 Singularity Cycle を開始します。")
    
    while True:
        try:
            log("🔄 サイクルを開始します...")
            # omni_agent.py をサブプロセスで実行（force=True で強制実行）
            # または直接 class を instantiate しても良いが、コード書き換え後の再読み込みのためにサブプロセスが安全
            result = subprocess.run([sys.executable, str(AGENT_PATH), "--force"], capture_output=True, text=True, encoding="utf-8")
            
            if result.stdout: print(result.stdout)
            if result.stderr: print(result.stderr)
            
            log("✅ サイクルが完了しました。次回の実行まで待機します。")
            
            # 動的な待機時間は omni_agent 側が制御するが、デーモン側でも念のためスリープ
            # (実際には omni_agent が calculate_dynamic_wait を行うので、ここでは短めに)
            time.sleep(300) # 5分おきにチェック
            
        except KeyboardInterrupt:
            log("🛑 デーモンを停止します。")
            break
        except Exception as e:
            log(f"⚠️ デーモン内でエラーが発生しました: {e}")
            time.sleep(60) # 1分待機してリトライ

if __name__ == "__main__":
    run_forever()
