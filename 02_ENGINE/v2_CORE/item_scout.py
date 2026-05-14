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
        if not self.client:
            logger.error("Gemini API Key missing.")
            return []

        # 本来的にはここで検索を行うが、今回は最新(14.10+)の情報を想定したメタ・プロンプトを実行
        # ※Serper API等の検索ツールを統合することを推奨
        
        prompt = """
        League of Legendsの最新パッチ（14.10以降）における、ゲームバランスを破壊している、あるいは非常に強力な「アイテム」または「ルーン」を3つ特定してください。
        
        それぞれの項目について、以下の情報をJSON形式で出力してください：
        1. name: アイテム/ルーンの名前
        2. impact: なぜ強いのか、何が変わったのかの要約
        3. beneficiaries: このアイテム/ルーンの変更によって最も恩恵を受けているチャンピオン（3〜5体）
        
        出力は必ず以下の構造のJSONのみにしてください：
        [
          {
            "name": "Blackfire Torch",
            "impact": "Fated Ashesからの派生。継続ダメージがスタックし、APジャングラーのクリア速度と集団戦火力を劇的に向上させた。",
            "beneficiaries": ["Lillia", "Brand", "Zyra", "Karthus"]
          },
          ...
        ]
        """

        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    response_mime_type="application/json"
                )
            )
            meta_trends = json.loads(response.text)
            logger.info(f"Detected {len(meta_trends)} meta trends.")
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
