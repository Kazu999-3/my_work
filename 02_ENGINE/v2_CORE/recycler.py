import logging
import os
from pathlib import Path
from google import genai
from google.genai import types
from .settings import settings
from .database import db

logger = logging.getLogger("Recycler")

class SovereignRecycler:
    """
    Antigravity Sovereign OS v2.3: 再資源化 (The Recycler)
    1つの知能資産(MD)を、マルチプラットフォーム向けの収益用コンテンツに変換・錬成する。
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.client = None
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        
        self.output_dir = settings.FORGE_DIR / "sns_assets"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.model_id = settings.DEFAULT_MODEL

    def recycle_tactics(self, tactics_path: Path):
        """
        レポートや記事から、各プラットフォーム向けのコンテンツを生成する。
        """
        logger.info(f"[Recycler] リサイクル開始: {tactics_path.name}")
        content = tactics_path.read_text(encoding="utf-8")
        
        prompt = f"""
        あなたは最高峰のマスメディア・ストラテジストです。
        提供された LoL 攻略レポートの内容を、以下の3つのプラットフォーム向けに最適化して書き換えてください。
        
        【元のレポート内容】:
        {content[:8000]}
        
        ---
        
        【出力形式】:
        
        ### 1. TikTok 用台本 (Short & Impact)
        - 構成: 3段階（Hook / Body / CTA）
        - 目的: 視聴維持率の極大化
        - 指示: 音声読み上げ用のテキストと、その背景で流すべき映像の指示を含めてください。
        
        ### 2. X (Twitter) 用連投スレッド (Logical & Engaging)
        - 構成: 5〜7ポストのスレッド。
        - 目的: 保存（ブックマーク）とインプレッションの極大化。
        - 指示: 1枚目のポストに強烈な引き（Hook）を作り、最後に note 記事への誘導を入れてください。
        
        ### 3. note 用ティーザー (Click-worthy)
        - 構成: 300文字程度の概要 ＋ 購入メリット。
        - 目的: 本編（有料ツール/記事）へのコンバージョン。
        
        ---
        口調は「～せよ」「～である」といった、自信に満ちた軍師の口調で統一してください。
        """

        if not self.client:
            logger.error("Gemini API Client is not initialized.")
            return None

        # 生成
        response = self.client.models.generate_content(
            model=self.model_id,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.8,
                top_p=0.95,
                max_output_tokens=3000
            )
        )
        
        # ファイル保存
        output_file = self.output_dir / f"recycled_{tactics_path.name}"
        output_file.write_text(response.text, encoding="utf-8")
        
        logger.info(f"[Recycler] 錬成完了: {output_file.name}")
        
        # データベースへ登録
        db.add_intelligence(
            id=f"recycled_{tactics_path.stem}",
            content=response.text,
            metadata={
                "type": "recycled_content",
                "source": tactics_path.name,
                "version": "1.0"
            }
        )
        
        return response.text, output_file

    def format_for_discord(self, recycled_text: str, source_name: str):
        """
        リサイクルされたテキストを Discord 用の Embed フィールド形式に変換する
        """
        # 簡易的なパース（実際の出力に合わせて調整が必要）
        fields = []
        
        sections = recycled_text.split("###")
        for section in sections:
            if not section.strip(): continue
            lines = section.strip().split("\n")
            title = lines[0].strip()
            body = "\n".join(lines[1:]).strip()
            
            # Discordの文字数制限(1024)に対応
            if len(body) > 1000:
                body = body[:997] + "..."
                
            fields.append({"name": f"✨ {title}", "value": body, "inline": False})
            
        return fields

# インスタンスのエクスポート
recycler = SovereignRecycler()
