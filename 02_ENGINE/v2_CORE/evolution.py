import logging
from pathlib import Path
from google import genai
from google.genai import types
from v2_CORE.settings import settings
import time

logger = logging.getLogger("EvolutionEngine")

class EvolutionEngine:
    """
    Antigravity Sovereign OS: 自己進化エンジン (Marketing Reviewer)
    生成されたコンテンツに対し、マーケティングのプロ（AI）が厳しいレビューを行い、
    そのフィードバックをもとに再構築（自己進化）させるマルチエージェントシステム。
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = "gemini-flash-latest"  # 高速かつ賢いモデルを採用
        else:
            self.client = None

    def _load_references(self):
        """知識ベース（リファレンス）をロードする"""
        refs = ""
        himazin_path = Path("D:/my_work/01_INTEL/reference_himazinproducer.md")
        if himazin_path.exists():
            refs += himazin_path.read_text(encoding="utf-8") + "\n\n"
        
        anti_path = Path("D:/my_work/01_INTEL/reference_antigravity.md")
        if anti_path.exists():
            refs += anti_path.read_text(encoding="utf-8")
        
        return refs

    def review_content(self, content: str) -> str:
        """生成された記事をマーケティング部として厳しくレビューする"""
        if not self.client:
            return "No Review (API Key missing)"
            
        logger.info("[Evolution] 🕵️ マーケティング部によるドラフトの厳格レビューを開始します...")
        
        references = self._load_references()
        
        prompt = f"""
        あなたは最高峰のダイレクトレスポンスマーケターであり、note販売のプロフェッショナルです。
        以下の「知識ベース（我々のマーケティング哲学）」に基づき、提出された記事の下書き（ドラフト）を厳格にレビューしてください。
        
        【知識ベース】:
        {references}
        
        【評価基準】:
        1. 有料ラインの引き方は適切か？（読者の感情がピークに達した場所で切られているか）
        2. 無料エリアで期待値が爆上がりしているか？「泥臭い失敗談」や「超・一次情報」が埋め込まれているか？
        3. アナロジーや比喩にとどまらず、読者を「購入」へ強烈に誘導する強いフックがあるか？
        
        【記事ドラフト】:
        {content}
        
        上記を踏まえ、「ここが甘い」「ここをこう直せ」という【改善フィードバック】のみを出力してください。
        （※肯定的な意見は不要です。売上を最大化するための冷酷なダメ出しをしてください）
        """
        
        try:
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.3)
            )
            feedback = response.text
            logger.info(f"[Evolution] 📝 レビュー完了: {len(feedback)}文字のフィードバックを獲得")
            return feedback
        except Exception as e:
            logger.error(f"[Evolution] レビュー中にエラー: {e}")
            return "Error during review"

    def apply_evolution(self, content: str, feedback: str) -> str:
        """フィードバックを元にコンテンツを再構築（進化）させる"""
        if not self.client or "Error" in feedback:
            return content
            
        logger.info("[Evolution] 🧬 フィードバックを基にコンテンツを再構築（進化）中...")
        
        prompt = f"""
        あなたは超一流のライター（コンテンツ制作部）です。
        マーケティング部から以下の【厳しいフィードバック】を受け取りました。
        このフィードバックを完璧に反映し、元の【記事ドラフト】を「爆売れするレベル」にリライトしてください。
        
        【マーケティング部からのフィードバック】:
        {feedback}
        
        【元の記事ドラフト】:
        {content}
        
        【指示】:
        フィードバックで指摘された弱点を完全に克服した、新しい記事（Markdown形式）のみを出力してください。
        """
        
        try:
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.5, max_output_tokens=8000)
            )
            logger.info("[Evolution] ✨ コンテンツの自己進化が完了しました！")
            return response.text
        except Exception as e:
            logger.error(f"[Evolution] 再構築中にエラー: {e}")
            return content

    def evolve_draft(self, content: str) -> str:
        """レビューと再構築を一貫して行うメイン処理"""
        feedback = self.review_content(content)
        if not feedback or "No Review" in feedback or "Error" in feedback:
            return content
            
        evolved_content = self.apply_evolution(content, feedback)
        return evolved_content

# インスタンス提供
evolution_engine = EvolutionEngine()
