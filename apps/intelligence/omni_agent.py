
import os
import sys
import asyncio
import json
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# 自社モジュールのパスを通す
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(ROOT_DIR))

# 各種スクリプトをモジュールとしてインポート
# 注意: 各スクリプトが if __name__ == "__main__": で保護されている必要がある
from apps.intelligence.trend_watcher import main as scout_main
from apps.hybrid_bot.src.notion_to_local import export_memos
from apps.hybrid_bot.src.trends_analyzer import analyze_latest_memos

class OmniAgent:
    """
    「自律商社アンちゃん」の統合エンジン
    偵察(Scout) -> 荷揚げ(Sync) -> 分析(Analyze) -> 商品化(Draft) を一貫して行う
    """
    def __init__(self):
        load_dotenv(ROOT_DIR / ".env")
        self.log_file = ROOT_DIR / "02_research" / "reports" / "omni_agent.log"
        self.ensure_dirs()

    def ensure_dirs(self):
        (ROOT_DIR / "02_research" / "reports").mkdir(parents=True, exist_ok=True)
        (ROOT_DIR / "02_research" / "memo").mkdir(parents=True, exist_ok=True)

    def log(self, message):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        full_message = f"[{timestamp}] {message}"
        print(full_message)
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(full_message + "\n")

    async def run_cycle(self):
        self.log("🚀 Omni-Agent: 「自律商社アンちゃん」の哨戒サイクルを開始します。")

        try:
            # 1. 偵察 (Scout)
            self.log("Step 1/4: トレンド偵察 (scout_lolalytics) を実行中...")
            await scout_main() 

            # 2. 荷揚げ (Sync)
            self.log("Step 2/4: Notionからのネタ回収 (notion_to_local) を実行中...")
            # notion_to_local.py の main は export_memos()
            export_memos()

            # 3. 分析 (Analyze)
            self.log("Step 3/4: 直近データの市場分析 (trends_analyzer) を実行中...")
            # trends_analyzer.py の main は analyze_latest_memos()
            analyze_latest_memos()

            # 4. 商品化 (Draft) - 将来的にここに強力な執筆ステップを追加
            self.log("Step 4/4: コンテンツ下書き生成フェーズへ移行します。")
            self.log("⚠️ 下書き生成エンジンは現在、分析レポート形式で 02_research/reports に出力されています。")

            self.log("✨ すべての自律サイクルが正常に完了しました。")

        except Exception as e:
            self.log(f"❌ サイクル実行中に深刻なエラーが発生しました: {e}")
            import traceback
            self.log(traceback.format_exc())

async def main():
    agent = OmniAgent()
    await agent.run_cycle()

if __name__ == "__main__":
    asyncio.run(main())
