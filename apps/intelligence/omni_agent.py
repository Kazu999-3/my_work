
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
from apps.intelligence.trend_watcher import main as scout_main
from apps.intelligence.trend_watcher import generate_with_fallback
from apps.hybrid_bot.src.notion_to_local import export_memos
from apps.hybrid_bot.src.trends_analyzer import analyze_latest_memos
from apps.hybrid_bot.src.omni_sync import OmniSyncPro

class OmniAgent:
    """
    自律型ビジネスOS「アンちゃん 2.0」
    脳（推論・監査）、体（実行）、神経（フィードバック）の統合エンジン
    """
    def __init__(self):
        load_dotenv(ROOT_DIR / ".env")
        self.log_file = ROOT_DIR / "02_research" / "reports" / "omni_agent.log"
        self.syncer = OmniSyncPro()
        self.ensure_dirs()

    def ensure_dirs(self):
        (ROOT_DIR / "02_research" / "reports").mkdir(parents=True, exist_ok=True)
        (ROOT_DIR / "02_research" / "memo").mkdir(parents=True, exist_ok=True)
        (ROOT_DIR / "03_social" / "daily_posts").mkdir(parents=True, exist_ok=True)

    def log(self, message):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        full_message = f"[{timestamp}] {message}"
        print(full_message)
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(full_message + "\n")

    async def run_cycle(self):
        self.log("🚀 Omni-Agent 2.0: 「自律商社アンちゃん」の超知能サイクルを開始します。")

        try:
            # 0. 荷下ろし (Cargo Pull)
            self.log("Step 0/6: スマホ修正の反映 (Cargo Pull)...")
            self.syncer.cargo_pull_all()

            # 1. 偵察 (Scout)
            self.log("Step 1/6: 市場トレンドの偵察 (scout_lolalytics)...")
            await scout_main() 

            # 2. 荷揚げ (Sync)
            self.log("Step 2/6: ネタの同期 (notion_to_local)...")
            export_memos()

            # 3. 戦略立案 (Strategist)
            self.log("Step 3/6: 戦略脳 (Strategist) による今日のフック立案...")
            strategy_hook = self.strategist_reflect()
            self.log(f"💡 今日の戦略: {strategy_hook[:100]}...")

            # 4. 商品化 & 監査 (Worker & Auditor)
            self.log("Step 4/6: 商品化と監査脳による検閲...")
            await self.generate_and_audit_drafts(strategy_hook)
            
            # 5. 出荷 (Ship)
            self.log("Step 5/6: 全成果物のスマホ同期 (Ship)...")
            self.ship_all()

            # 6. 完遂 (Finalize)
            self.finalize_instruction()

            self.log("✨ すべての自律サイクルが正常に完了しました。")

        except Exception as e:
            self.log(f"❌ サイクル実行中に深刻なエラーが発生しました: {e}")
            import traceback
            self.log(traceback.format_exc())

    def strategist_reflect(self):
        """最新レポートから市場の急所（戦略フック）を特定する"""
        report_files = list((ROOT_DIR / "02_research" / "reports").glob("trend_report_*.md"))
        if not report_files: return "普遍的な勝利法則に基づく発信"
        
        report_files.sort(key=os.path.getmtime, reverse=True)
        content = report_files[0].read_text(encoding="utf-8")
        
        prompt = f"以下のトレンドレポートから、今日読者の心を最も動かす『140文字の戦略的なフック（急所）』を1つだけ抽出してください。箇条書きや説明は不要です。\n\n{content}"
        return generate_with_fallback(prompt)

    async def generate_and_audit_drafts(self, strategy_hook):
        """ドラフト生成と監査を最大2回繰り返す"""
        max_retries = 2
        feedback = ""
        
        for i in range(max_retries + 1):
            draft = await self.produce_draft(strategy_hook, feedback)
            score, audit_log = self.audit_draft(draft)
            
            if score >= 70:
                self.log(f"✅ 監査合格 (Score: {score})")
                self.save_draft(draft, score)
                return
            else:
                self.log(f"⚠️ 監査不合格 (Score: {score}): {audit_log[:50]}...")
                feedback = audit_log
                if i < max_retries:
                    self.log(f"🔄 自動リワークを実行します ({i+1}/2)")
                else:
                    self.log("❗ 最大リトライ数に達しました。不格好なまま保存します。")
                    self.save_draft(draft, score)

    async def produce_draft(self, strategy_hook, feedback=""):
        """Worker: ドラフトを執筆する"""
        wins = (ROOT_DIR / "01_foundation" / "wins.md").read_text(encoding="utf-8") if (ROOT_DIR / "01_foundation" / "wins.md").exists() else ""
        ng = (ROOT_DIR / "01_foundation" / "ng_words.md").read_text(encoding="utf-8") if (ROOT_DIR / "01_foundation" / "ng_words.md").exists() else ""
        failures = (ROOT_DIR / "01_foundation" / "failures.md").read_text(encoding="utf-8") if (ROOT_DIR / "01_foundation" / "failures.md").exists() else ""
        
        prompt = f"""
あなたは自律商社のチーフエディターです。
戦略フック: {strategy_hook}

【過去のリジェクト理由と修正指示】
{feedback if feedback else "初回執筆"}

【勝利法則】
{wins}

【過去の失敗事例】
{failures}

【禁止事項】
{ng}

上記を厳守し、AI臭さを排した最高品質のX投稿案3つとnote構成案を作成してください。
出力は日本語のMarkdown形式で。タイトルにはその日の日付を。
"""
        return generate_with_fallback(prompt)

    def audit_draft(self, draft):
        """Auditor: ドラフトを検閲し、スコアリングする"""
        ng = (ROOT_DIR / "01_foundation" / "ng_words.md").read_text(encoding="utf-8") if (ROOT_DIR / "01_foundation" / "ng_words.md").exists() else ""
        
        prompt = f"""
以下のドラフトを厳格に監査し、100点満点で採点してください。

【採点基準】
1. NGワード( {ng} )が1つでも含まれていたら 0点。
2. 「いかがでしたでしょうか」「要チェックです」などのAI臭い表現があれば減点。
3. 戦略的フックが弱く、読者がスルーしそうな内容なら減点。

出力形式(JSONのみ):
{{"score": 85, "feedback": "具体的な不足点や修正すべき箇所..."}}

【監査対象ドラフト】
{draft}
"""
        res_text = generate_with_fallback(prompt)
        try:
            import re
            match = re.search(r'\{.*\}', res_text, re.DOTALL)
            data = json.loads(match.group(0)) if match else {"score": 50, "feedback": "JSON解析失敗"}
            return int(data.get("score", 50)), data.get("feedback", "理由なし")
        except:
            return 50, "監査エンジンエラー"

    def save_draft(self, content, score):
        draft_dir = ROOT_DIR / "03_social" / "daily_posts"
        date_str = datetime.now().strftime('%Y%m%d_%H%M')
        path = draft_dir / f"draft_{date_str}_s{score}.md"
        path.write_text(content, encoding="utf-8")
        self.log(f"💾 ドラフトを保存しました (Score: {score}): {path.name}")

    def ship_all(self):
        """プロジェクト内の全資産をNotionに同期"""
        self.syncer.ship_file(ROOT_DIR / "ANTIGRAVITY.md", category="Foundation")
        for f in (ROOT_DIR / "01_foundation").glob("*.md"):
            self.syncer.ship_file(f, category="Foundation")
        for f in (ROOT_DIR / "02_research" / "reports").glob("*.md"):
            self.syncer.ship_file(f, category="Report")
        for f in (ROOT_DIR / "03_social" / "daily_posts").glob("draft_*.md"):
            self.syncer.ship_file(f, category="Draft")

    def finalize_instruction(self):
        import requests
        token = os.getenv("NOTION_API_KEY")
        db_id = os.getenv("NOTION_DB_ID")
        if not token or not db_id: return
        headers = {"Authorization": f"Bearer {token}", "Notion-Version": "2022-06-28", "Content-Type": "application/json"}
        payload = {"filter": {"property": "ステータス", "status": {"equals": "Doing"}}}
        try:
            res = requests.post(f"https://api.notion.com/v1/databases/{db_id}/query", headers=headers, json=payload)
            for page in res.json().get("results", []):
                requests.patch(f"https://api.notion.com/v1/pages/{page['id']}", headers=headers, json={"properties": {"ステータス": {"status": {"name": "Done"}}}})
        except Exception as e: self.log(f"Finalize Error: {e}")

async def main():
    agent = OmniAgent()
    await agent.run_cycle()

if __name__ == "__main__":
    asyncio.run(main())
