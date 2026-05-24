import os
import logging
import json
from pathlib import Path
from google import genai
from google.genai import types
import requests
from bs4 import BeautifulSoup
import dotenv

dotenv.load_dotenv(Path("D:/my_work/.env"))
logger = logging.getLogger("ItemScout")

class ItemScout:
    """
    Antigravity Sovereign OS: Item & Rune Scout
    チャンピオンではなく、アイテムやルーンの変更から「誰がOPになったか」を逆引きリサーチする。
    """
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None

    def get_latest_patch_meta(self):
        """Webから最新のパッチノートやメタトレンドを収集し、キーとなるアイテムと恩恵を受けるチャンプを特定する"""
        from v2_CORE.cache_manager import CacheManager
        cache = CacheManager()
        cache_key = "latest_patch_meta_v1"
        
        cached_data = cache.get(cache_key, max_age_seconds=86400) # 24時間キャッシュ
        if cached_data:
            logger.info("Using cached meta trends.")
            return cached_data

        if not self.client:
            logger.error("Gemini API Key missing.")
            return []

        # 最新のパッチ情報を想定したメタ・プロンプトを実行
        prompt = """
        League of Legendsの最新パッチ（パッチ26.0以降）における、ゲームバランスを大きく変えている「アイテム」または「ルーン」を3つ特定してください。
        
        それぞれの項目について、以下の情報を日本語のJSON形式で出力してください：
        1. name: アイテム/ルーンの名前（日本語名）
        2. impact: なぜ今強いのか、どのような変更があったのかの要約
        3. beneficiaries: このアイテム/ルーンによって現在勝率が急上昇しているチャンピオン（3〜5体）
        
        出力は必ず以下の構造のJSONのみにしてください：
        [
          {
            "name": "ブラックファイア・トーチ",
            "impact": "継続ダメージとAP上昇のシナジーにより、APジャングラーのクリア速度が極限まで加速している。",
            "beneficiaries": ["Lillia", "Brand", "Zyra", "Karthus"]
          }
        ]
        """

        try:
            from v2_CORE.ai_helper import generate_content_safe
            response_text = generate_content_safe(
                client=self.client,
                prompt=prompt,
                model_id="gemini-1.5-flash-8b",
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    response_mime_type="application/json"
                )
            )
            meta_trends = json.loads(response_text)
            logger.info(f"Detected {len(meta_trends)} meta trends.")
            
            # 取得成功したらキャッシュに保存
            cache.set(cache_key, meta_trends)
            
            return meta_trends
        except Exception as e:
            logger.error(f"Failed to scout items: {e}")
            return []

    def select_best_target(self):
        """トレンドの中から、最も収益性・記事価値の高いターゲットを選定する"""
        trends = self.get_latest_patch_meta()
        if not trends:
            return None, None, []

        # 最初のトレンドを優先的に選択
        best_trend = trends[0]
        return best_trend['name'], best_trend['impact'], best_trend['beneficiaries']

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    scout = ItemScout()
    item, impact, champs = scout.select_best_target()
    print(f"Target Item: {item}")
    print(f"Impact: {impact}")
    print(f"Champions: {champs}")
