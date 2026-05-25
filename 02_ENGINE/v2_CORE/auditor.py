import logging
from google import genai
from google.genai import types
from .settings import settings
from v2_CORE.ai_helper import generate_content_safe
import re

logger = logging.getLogger("Auditor")

class SovereignAuditor:
    """
    Antigravity Sovereign OS v2.0: 監査官 (The Auditor)
    生成されたコンテンツの「AI臭」を検出し、自律的にリライトして品質を担保する。
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = settings.DEFAULT_MODEL
        else:
            self.client = None

    def audit_and_rewrite(self, content):
        """コンテンツを監査し、必要であればリライトした結果を返す"""
        if not self.client:
            logger.warning("[Auditor] APIキーがないため監査をスキップします。")
            return content

        logger.info(f"[Auditor] 品質監査・自律リライトを開始 (Model: {self.model_id})...")
        
        # 監査兼リライト用プロンプト (憲法第2条・第5条を反映)
        prompt = f"""
        あなたは「Antigravity OS王国」の絶対監査官です。
        以下のテキストを、王国の憲法（ANTIGRAVITY.md）に準拠した最高品質の文章にリライトしてください。
        
        【絶対遵守ルール】:
        1. 「AI臭」の完全排除: 「いかがでしたでしょうか」「加速させる」「シナジー」「羅針盤」などの定型表現を徹底的に削除。
        2. 文末の単調さの回避: 「〜です」「〜ます」が3回以上連続することを禁じる。体言止めや断定、感情のこもった語尾を混ぜること。
        3. DRM（ダイレクト・レスポンス・マーケティング）: 読者が思わず「買うしかない」と思うような、断定的なトーンと強いフックを維持する。
        4. 無駄な太字(**)の削除: 重要な箇所以外の過剰な太字を削除し、スッキリした読み心地にする。
        
        【対象テキスト】:
        {content}
        
        出力は、リライト後のMarkdownテキストのみとしてください。
        """
        
        try:
            response_text = generate_content_safe(
                self.client,
                prompt,
                self.model_id,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    top_p=0.95,
                    max_output_tokens=4000
                ),
                feature_name="kingdom_cycle"
            )
            if not response_text or response_text.startswith("⚠️") or response_text.startswith("❌"):
                raise Exception("Auditor generation failed")
            
            rewritten_content = response_text
            logger.info("[Auditor] 自律リライトが完了しました。")
            return rewritten_content
        except Exception as e:
            logger.error(f"[Auditor] 監査中にエラー: {e}")
            return content

# インスタンス提供
auditor = SovereignAuditor()

def get_auditor() -> SovereignAuditor:
    return auditor
