
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
            export_memos()

            # 3. 分析 (Analyze)
            self.log("Step 3/4: 直近データの市場分析 (trends_analyzer) を実行中...")
            analyze_latest_memos()

            # 4. 商品化 (Draft)
            self.log("Step 4/4: コンテンツ下書き生成を実行中...")
            await self.generate_drafts()

            self.log("✨ すべての自律サイクルが正常に完了しました。")

        except Exception as e:
            self.log(f"❌ サイクル実行中に深刻なエラーが発生しました: {e}")
            import traceback
            self.log(traceback.format_exc())

    async def generate_drafts(self):
        """最新のトレンドレポートからX投稿とnoteの構成案を生成する"""
        from apps.intelligence.trend_watcher import generate_with_fallback
        
        report_files = list((ROOT_DIR / "02_research" / "reports").glob("trend_report_*.md"))
        if not report_files:
            self.log("⚠️ トレンドレポートが見つからないため、下書き生成をスキップします。")
            return
            
        report_files.sort(key=os.path.getmtime, reverse=True)
        latest_report = report_files[0]
        
        with open(latest_report, "r", encoding="utf-8") as f:
            report_content = f.read()
            
        wins_path = ROOT_DIR / "01_foundation" / "wins.md"
        ng_path = ROOT_DIR / "01_foundation" / "ng_words.md"
        
        wins_data = wins_path.read_text(encoding="utf-8") if wins_path.exists() else ""
        ng_data = ng_path.read_text(encoding="utf-8") if ng_path.exists() else ""
        
        prompt = f"""
あなたは「自律商社アンちゃん」のチーフエディターです。
以下の最新の偵察レポートと勝利法則に基づき、X投稿案3つとnoteの構成案1つを作成してください。

【偵察レポート】
{report_content}

【勝利法則 (wins.md)】
{wins_data}

【禁止事項 (ng_words.md)】
{ng_data}

[条件]
- X投稿案は、3つの異なる「型」（実績、逆張り、リアル）で作成してください。
- 読者の感情（恐怖、欲望）を突き、行動（導線）を促す内容にしてください。
- AI臭い表現を完全に排除してください。
- 出力は日本語のMarkdown形式で。

[出力フォーマット]
# 📦 今日の商品ドラフト ({datetime.now().strftime('%Y/%m/%d')})

## 🐦 X投稿案 (集客/有益)
(投稿内容)

## 🐦 X投稿案 (収益/感情)
(投稿内容)

## 🐦 X投稿案 (リアル/一次情報)
(投稿内容)

## 📝 note構成案 (高単価)
(タイトルと目次案)
"""
        draft = generate_with_fallback(prompt)
        
        draft_dir = ROOT_DIR / "03_social" / "daily_posts"
        draft_dir.mkdir(parents=True, exist_ok=True)
        
        date_str = datetime.now().strftime('%Y%m%d_%H%M')
        draft_path = draft_dir / f"draft_{date_str}.md"
        
        with open(draft_path, "w", encoding="utf-8") as f:
            f.write(draft)
            
        self.log(f"✅ 商品ドラフトを保存しました: {draft_path}")

async def main():
    agent = OmniAgent()
    await agent.run_cycle()

if __name__ == "__main__":
    asyncio.run(main())
