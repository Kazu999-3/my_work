
import os
import sys
import asyncio
import json
import subprocess
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# 自社モジュールのパスを通す
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(ROOT_DIR / "02_intelligence"))

# 各種スクリプトをモジュールとしてインポート
from intelligence.trend_watcher import main as scout_main
from intelligence.trend_watcher import generate_with_fallback
from hybrid_bot.src.notion_to_local import export_memos
from hybrid_bot.src.trends_analyzer import analyze_latest_memos
from hybrid_bot.src.omni_sync import OmniSyncPro

class OmniAgent:
    """
    自律型ビジネスOS「アンちゃん 2.0」
    脳（推論・監査）、体（実行）、神経（フィードバック）の統合エンジン
    """
    def __init__(self):
        load_dotenv(ROOT_DIR / ".env")
        self.log_file = ROOT_DIR / "04_system" / "logs" / "omni_agent.log"
        self.syncer = OmniSyncPro()
        self.ensure_dirs()

    def ensure_dirs(self):
        (ROOT_DIR / "04_system" / "logs").mkdir(parents=True, exist_ok=True)
        (ROOT_DIR / "03_factory" / "reports").mkdir(parents=True, exist_ok=True)
        (ROOT_DIR / "03_factory" / "memo").mkdir(parents=True, exist_ok=True)
        (ROOT_DIR / "03_factory" / "daily_posts").mkdir(parents=True, exist_ok=True)
        (ROOT_DIR / "outputs" / "report").mkdir(parents=True, exist_ok=True)

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

            # 7. 日報生成 (Daily Report)
            self.log("Step 7/9: 日報の自動生成 (Daily Report)...")
            await self.generate_daily_report()

            # 8. 自己進化データの同期 (Evolution)
            self.log("Step 8/9: 自己進化用データの同期 (Evolution)...")
            self.sync_evolution_data()

            # 9. LoL戦術深掘り (LoL Tactics)
            self.log("Step 9/9: LoL戦術の深掘りリサーチ (LoL Tactics)...")
            await self.lol_tactics_deep_dive()

            # 10. メンテナンスリマインド (Maintenance)
            self.log("Step 10/10: 資産化候補のリマインドチェック...")
            self.check_asset_candidates()

            self.log("✨ すべての自律サイクルが正常に完了しました。")

        except Exception as e:
            self.log(f"❌ サイクル実行中に深刻なエラーが発生しました: {e}")
            import traceback
            self.log(traceback.format_exc())

    def strategist_reflect(self):
        """最新レポートから市場の急所（戦略フック）を特定する"""
        report_files = list((ROOT_DIR / "03_factory" / "reports").glob("trend_report_*.md"))
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
        wins = (ROOT_DIR / "01_spirit" / "wins.md").read_text(encoding="utf-8") if (ROOT_DIR / "01_spirit" / "wins.md").exists() else ""
        ng = (ROOT_DIR / "01_spirit" / "ng_words.md").read_text(encoding="utf-8") if (ROOT_DIR / "01_spirit" / "ng_words.md").exists() else ""
        failures = (ROOT_DIR / "01_spirit" / "failures.md").read_text(encoding="utf-8") if (ROOT_DIR / "01_spirit" / "failures.md").exists() else ""
        
        content = generate_with_fallback(prompt)
        if not content:
            self.log("⚠️ ドラフト生成に失敗しました（空のレスポンス）。")
            return ""
        return content

    def audit_draft(self, draft):
        """Auditor: ドラフトを検閲し、スコアリングする"""
        ng = (ROOT_DIR / "01_spirit" / "ng_words.md").read_text(encoding="utf-8") if (ROOT_DIR / "01_spirit" / "ng_words.md").exists() else ""
        
        prompt = f"""
以下のドラフトを厳格に監査し、100点満点で採点してください。

【採点基準】
1. NGワード( {ng} )が1つでも含まれていたら 0点。
2. 「いかがでしたでしょうか」「要チェックです」などのAI臭い表現があれば減点。
3. 戦略的フックが弱く、読者がスルーしそうな内容なら減点。

必ず以下のJSON形式でのみ回答してください。余計な文章やMarkdownの枠（```jsonなど）は一切不要です。
{{"score": 85, "feedback": "具体的な不足点や修正すべき箇所..."}}

【監査対象ドラフト】
{draft}
"""
        res_text = generate_with_fallback(prompt)
        try:
            import re
            # JSON部分をより柔軟に抽出
            match = re.search(r'\{.*\}', res_text, re.DOTALL)
            if match:
                clean_json = match.group(0).replace('\n', '').replace('\r', '')
                data = json.loads(clean_json)
                return int(data.get("score", 50)), data.get("feedback", "理由なし")
            return 50, f"JSON形式が見会えませんでした: {res_text[:50]}..."
        except Exception as e:
            return 50, f"監査パースエラー: {e}"

    def save_draft(self, content, score):
        draft_dir = ROOT_DIR / "03_factory" / "daily_posts"
        date_str = datetime.now().strftime('%Y%m%d_%H%M')
        path = draft_dir / f"draft_{date_str}_s{score}.md"
        path.write_text(content, encoding="utf-8")
        self.log(f"💾 ドラフトを保存しました (Score: {score}): {path.name}")

    def ship_all(self):
        """プロジェクト内の全資産をNotionに同期"""
        self.syncer.ship_file(ROOT_DIR / "01_spirit" / "ANTIGRAVITY.md", category="Foundation")
        for f in (ROOT_DIR / "01_spirit").glob("*.md"):
            self.syncer.ship_file(f, category="Foundation")
        for f in (ROOT_DIR / "03_factory" / "reports").glob("*.md"):
            self.syncer.ship_file(f, category="Report")
        for f in (ROOT_DIR / "03_factory" / "daily_posts").glob("draft_*.md"):
            self.syncer.ship_file(f, category="Draft")

    async def generate_daily_report(self):
        """今日の活動内容をサマライズして日報を作成する（1日1回）"""
        today = datetime.now().strftime("%Y-%m-%d")
        report_path = ROOT_DIR / "outputs" / "report" / f"{today}.md"
        
        if report_path.exists():
            self.log(f"⏩ 日報は既に存在します: {report_path.name}")
            return

        # ログファイルから直近の内容を取得
        log_content = ""
        log_file = ROOT_DIR / "04_system" / "logs" / "pipeline.log"
        if log_file.exists():
            log_content = log_file.read_text(encoding="utf-8")[-5000:] # 直近5000文字
        
        prompt = f"""
あなたは自律商社の経営参謀です。本日の活動ログに基づき、経営者（ユーザー）への日報を作成してください。
【本日のログ抜粋】
{log_content}

【出力形式】
# 日報: {today}
## 1. 完了した主要タスク
## 2. 発生した課題と対応
## 3. 次回への戦略的提案（収益化・自動化の観点から）

文章は簡潔かつ論理的に。
"""
        try:
            report_text = generate_with_fallback(prompt)
            if not report_text or len(report_text) < 100:
                self.log("⚠️ 日報の内容が不十分なため、生成をスキップします。")
                return

            report_path.write_text(report_text, encoding="utf-8")
            self.log(f"✅ 日報を生成しました: {report_path.name}")
        except Exception as e:
            self.log(f"❌ 日報生成エラー: {e}")

    def sync_evolution_data(self):
        """auto_evolve.py を実行して進化データを更新する"""
        import subprocess
        script_path = ROOT_DIR / "02_intelligence" / "intelligence" / "auto_evolve.py"
        try:
            result = subprocess.run([sys.executable, str(script_path)], capture_output=True, text=True)
            self.log("✅ 自己進化データの同期完了。")
        except Exception as e:
            self.log(f"❌ 自己進化データ同期エラー: {e}")

    async def lol_tactics_deep_dive(self):
        """トレンドデータに基づき、重要なチャンピオンの戦術を深掘りする"""
        # trend_reportがあれば読み込む
        report_files = list((ROOT_DIR / "03_factory" / "reports").glob("trend_report_*.md"))
        if not report_files: return
        
        report_files.sort(key=os.path.getmtime, reverse=True)
        intel_content = report_files[0].read_text(encoding="utf-8")

        prompt = f"""
以下のLoLトレンドレポートから、現在最も注目すべき（Tier上昇や勝率急増した）チャンピオンを1人選び、
そのチャンピオンの「今すぐ勝てる戦術（ビルド、マクロ、対策）」を深掘りした特化レポート（ドラフト）を作成してください。
【トレンドデータ】
{intel_content}
"""
        try:
            tactics_draft = generate_with_fallback(prompt)
            if not tactics_draft or len(tactics_draft) < 100:
                self.log("⚠️ 戦術レポートの内容が不十分なため、生成をスキップします。")
                return

            date_str = datetime.now().strftime("%Y%m%d_%H%M")
            save_path = ROOT_DIR / "03_factory" / "reports" / f"tactics_dive_{date_str}.md"
            save_path.write_text(tactics_draft, encoding="utf-8")
            self.log(f"✅ LoL戦術深掘りレポートを作成しました: {save_path.name}")
            self.syncer.ship_file(save_path, category="Tactics")
        except Exception as e:
            self.log(f"❌ LoL戦術深掘りエラー: {e}")

    def check_asset_candidates(self):
        """反応の良いドラフトや成功事例の格納リマインド用"""
        # 現在はログへの出力のみ。将来的にはNotion上でフラグが立ったものを自動格納する
        self.log("💡 順調です！ 高スコアのドラフト（s90以上）がある場合は、'hit_archive' への格納をご検討ください。")
        self.log("💡 'archives' への古いファイルの移動は次回の自動メンテナンスで処理されます。")

    def finalize_instruction(self):
        """
        [DEPRECATED] Doing全件の強制Done化は副作用が大きいため無効化。
        """
        pass

async def main():
    agent = OmniAgent()
    await agent.run_cycle()

if __name__ == "__main__":
    asyncio.run(main())
