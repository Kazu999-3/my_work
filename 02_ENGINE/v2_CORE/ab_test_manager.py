import os
import json
import logging
from pathlib import Path
from v2_CORE.settings import settings

logger = logging.getLogger("ABTestManager")

class ABTestManager:
    """
    Xの投稿結果（A/Bテスト）を分析し、
    最も効果が高かったパターンの「法則」を抽出し、プロンプトを自己進化させるマネージャー
    """
    def __init__(self):
        self.rules_file = settings.ROOT_DIR / "01_INTEL" / "prompts" / "marketing_rules.txt"
        self.rules_file.parent.mkdir(parents=True, exist_ok=True)
        
        # もしルールファイルが無ければ初期化
        if not self.rules_file.exists():
            self.rules_file.write_text("【自己進化マーケティング・ルール】\n現在学習データ収集中です。\n", encoding="utf-8")

    def evaluate_and_evolve(self, recent_tweets_data: list):
        """
        直近のツイートのインプレッションデータを受け取り、Geminiに分析させてルールを更新する。
        recent_tweets_data: [{"text": "フック文A...", "impressions": 1500}, {"text": "フック文B...", "impressions": 300}]
        """
        if not recent_tweets_data or len(recent_tweets_data) < 2:
            logger.info("Not enough data to run A/B test evolution.")
            return

        logger.info("🧪 過去の投稿データを元にA/Bテストの勝者を分析中...")
        
        from google import genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY is missing.")
            return
            
        client = genai.Client(api_key=api_key)
        
        # 過去のルールを読み込む
        current_rules = self.rules_file.read_text(encoding="utf-8")
        
        prompt = f"""
        あなたは天才的なSNSマーケターです。
        過去に投稿したXのツイートとその「インプレッション数（表示回数）」のデータがあります。
        
        【直近のデータ】
        {json.dumps(recent_tweets_data, ensure_ascii=False, indent=2)}
        
        【現在のマーケティング・ルール】
        {current_rules}
        
        【指示】
        1. どのツイートが最もインプレッションを獲得したか（勝者）を分析してください。
        2. 勝者のツイートに共通する「特徴（フックの言葉遣い、文字数、絵文字の使い方、煽り方）」を抽出してください。
        3. 現在のマーケティング・ルールに、今回得られた「新しい法則」を1つだけ箇条書きで追記してください。
        4. 出力は「更新後のマーケティング・ルール全体（テキスト）」のみとしてください。他の挨拶などは一切不要です。
        """

        try:
            from v2_CORE.ai_helper import generate_content_safe
            new_rules = generate_content_safe(client, prompt, model_id=settings.DEFAULT_MODEL)
            if new_rules:
                self.rules_file.write_text(new_rules.strip(), encoding="utf-8")
                logger.info("✨ A/Bテスト完了: マーケティング・ルールが自己進化しました！")
                logger.info(f"New Rules: {new_rules.strip()[:100]}...")
        except Exception as e:
            logger.error(f"Failed to evolve rules: {e}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    mgr = ABTestManager()
    # テスト用データ
    mock_data = [
        {"text": "【悲報】今のメタ、〇〇を知らないと一生勝てません。詳細はこちら", "impressions": 8500},
        {"text": "〇〇の最新ビルドガイドです。パッチ変更点まとめ", "impressions": 1200}
    ]
    mgr.evaluate_and_evolve(mock_data)
