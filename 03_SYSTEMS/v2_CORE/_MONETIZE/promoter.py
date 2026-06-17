from v2_CORE.settings import settings
import logging
from google import genai
from google.genai import types
from v2_CORE.ai_helper import generate_content_safe

logger = logging.getLogger("Promoter")

class XPromoter:
    """
    Antigravity Sovereign OS v2.0: 拡散 (The Promoter)
    note 記事から X (Twitter) 用の多面的なプロモーション案を錬成する。
    """
    def __init__(self):
        self.promo_dir = settings.FORGE_DIR / "sns_promotions"
        self.promo_dir.mkdir(parents=True, exist_ok=True)
        self.api_key = settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = settings.DEFAULT_MODEL
        else:
            self.client = None

    def generate_ai_hooks(self, draft_path):
        """AIを使用して記事本文から最適なプロモーションフックを抽出・生成し、内容を返す"""
        if not self.client:
            logger.warning("[Promoter] APIキーがないため簡易プロモーション案を出力します。")
            return "Gemini APIキーが設定されていないため、簡易プロモーション案を出力します。\n#LoL #SovereignForge", None

        logger.info(f"[Promoter] SNSプロモーション案をAIで錬成中 (Model: {self.model_id})...")
        content = draft_path.read_text(encoding="utf-8")
        
        prompt = f"""
        あなたは最高峰のSNSマーケターです。
        以下の LoL 攻略記事の内容を元に、X (Twitter) でインプレッションを極大化させるプロモーション案を3パターン作成してください。
        
        【記事内容】:
        {content[:5000]}
        
        【出力形式】:
        - パターンA: 【教育・権威型】（「情報の非対称性」を武器に勝つ理論を提示）
        - パターンB: 【秘匿・ミステリー型】（「誰も知らない秘密」を強調し、好奇心を刺激）
        - パターンC: 【トレンド・逆張り型】（現在の流行を否定し、AIが導き出した新常識を提示）
        - パターンD: 【能動・交流型】（フォロワーへの「問いかけ」を行い、リプライを誘発する形式）
        
        さらに、関連する投稿を見つけた際に使える「リプレイ（返信）案」を2つ作成してください。
        
        各パターンに適切なハッシュタグを含めてください。
        """
        
        try:
            response_text = generate_content_safe(
                self.client,
                prompt,
                self.model_id,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    top_p=0.95,
                    max_output_tokens=2000
                ),
                feature_name="kingdom_cycle"
            )
            
            if not response_text or response_text.startswith("⚠️") or response_text.startswith("❌"):
                 raise Exception("Promoter AI generation failed due to API error")
            
            promotion = response_text
        except Exception as e:
            logger.error(f"[Promoter] プロモーション案の生成中にエラー: {e}")
            promotion = "プロモーション案の生成に失敗いたしました。"
        
        file_name = f"ai_promo_{draft_path.name}"
        file_path = self.promo_dir / file_name
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(promotion)
            
        logger.info(f"[Promoter] SNS プロモーション案を錬成しました: {file_name}")
        return promotion, file_path

# グローバルなプロモーターインスタンス
promoter = XPromoter()

def get_promoter() -> XPromoter:
    return promoter
