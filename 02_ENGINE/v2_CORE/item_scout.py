import os
import logging
import json
import re
from pathlib import Path
from google import genai
from google.genai import types
import requests
import dotenv

dotenv.load_dotenv(Path("D:/my_work/.env"))
logger = logging.getLogger("ItemScout")

HISTORY_FILE = Path("d:/my_work/scratch/item_scout_history.json")

class ItemScout:
    """
    Antigravity Sovereign OS: Item & Rune Scout
    チャンピオンではなく、アイテムやルーンの変更から「誰がOPになったか」を逆引きリサーチする。
    """
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY_FREE")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None

    def get_latest_patch(self) -> str:
        """Ddragonから最新パッチバージョンを取得"""
        url = "https://ddragon.leagueoflegends.com/api/versions.json"
        try:
            import urllib.request
            with urllib.request.urlopen(url, timeout=5) as response:
                data = json.loads(response.read().decode('utf-8'))
                return data[0]
        except Exception as e:
            logger.error(f"Failed to fetch patch version from Ddragon: {e}")
            return "16.11.1" # フォールバック

    def _load_history(self) -> list:
        if not HISTORY_FILE.exists():
            return []
        try:
            return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        except:
            return []

    def _save_history(self, history: list):
        try:
            # 直近5件まで保持
            HISTORY_FILE.write_text(json.dumps(history[-5:], ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as e:
            logger.error(f"Failed to save history: {e}")

    def get_latest_patch_meta(self):
        """Google Searchを使用して最新のパッチノートやメタトレンドを収集し、キーとなるアイテムと恩恵を受けるチャンプを特定する"""
        from v2_CORE.cache_manager import CacheManager
        cache = CacheManager()
        cache_key = "latest_patch_meta_v2"
        
        cached_data = cache.get(cache_key, max_age_seconds=86400) # 24時間キャッシュ
        if cached_data:
            logger.info("Using cached meta trends.")
            return cached_data

        if not self.client:
            logger.error("Gemini API Key missing.")
            return []

        patch = self.get_latest_patch()
        # メジャーバージョン (16.11.1 -> 16.11)
        patch_major = ".".join(patch.split(".")[:2]) if patch else "16.11"
        logger.info(f"Scouting meta trends for Patch {patch_major} (Full version: {patch})...")

        # 検索グラウンディングを前提とした、最新パッチへの感度を高めるプロンプト
        prompt = f"""
        League of Legendsの最新パッチ（パッチ {patch_major}）において、現在ゲームバランスを大きく変えている、またはプレイヤーやプロの間で非常に流行している「アイテム」または「ルーン」を3つ特定してください。
        
        Google検索などの外部情報を参照し、直近のパッチノートの調整や、メタデータサイト（U.GG, Lolalytics, OP.GG）等で勝率・採用率が急上昇している具体的なアイテム/ルーン（例：運命の灰、ブラックファイア・トーチ、デスダンス、ファーストストライクなど、パッチ {patch_major} で話題のもの）を調査してください。
        ※一般的なスターターアイテム（ドランブレードなど）や、変更のない定番アイテムは除外し、直近でOP（壊れ）化している、あるいは戦術に大きな影響を与えているものに絞ってください。
        
        それぞれの項目について、以下の情報を日本語のJSON形式で出力してください：
        1. name: アイテム/ルーンの名前（日本語名）
        2. impact: なぜ今強いのか、パッチ {patch_major} でどのような変更があったか、またはなぜ流行しているのかの具体的な理由（日本語）
        3. beneficiaries: このアイテム/ルーンによって現在勝率や採用率が急上昇している代表的なチャンピオン（3〜5体、必ず英語名でリストする。例: "Lillia", "Karthus", "Zyra"）
        
        出力は必ず以下の構造のJSONのみにしてください：
        [
          {{
            "name": "アイテム名またはルーン名",
            "impact": "流行・強さの理由と具体的な調整内容の説明",
            "beneficiaries": ["ChampionName1", "ChampionName2"]
          }}
        ]
        """

        try:
            from v2_CORE.ai_helper import generate_content_safe
            response_text = generate_content_safe(
                client=self.client,
                prompt=prompt,
                model_id="gemini-2.5-flash",
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    tools=[types.Tool(google_search=types.GoogleSearch())] # Google 検索を有効化
                ),
                feature_name="kingdom_cycle"
            )
            
            # 正規表現で [ ... ] の形になっているJSON配列を抽出
            clean_text = response_text.strip()
            json_match = re.search(r"(\[.*\])", clean_text, re.DOTALL)
            if json_match:
                clean_text = json_match.group(1)
            else:
                # フォールバック: マークダウンブロックのトリム
                if clean_text.startswith("```json"):
                    clean_text = clean_text[7:]
                if clean_text.endswith("```"):
                    clean_text = clean_text[:-3]
                clean_text = clean_text.strip()

            meta_trends = json.loads(clean_text)
            logger.info(f"Detected {len(meta_trends)} meta trends via search.")
            
            # 取得成功したらキャッシュに保存
            cache.set(cache_key, meta_trends)
            
            return meta_trends
        except Exception as e:
            raw_text = response_text if 'response_text' in locals() else "N/A"
            logger.error(f"Failed to scout items: {e}. Raw response: {raw_text}")
            return []

    def select_best_target(self):
        """トレンドの中から、履歴（クールダウン）を考慮して最も価値の高いターゲットを選定する"""
        trends = self.get_latest_patch_meta()
        if not trends:
            return None, None, []

        history = self._load_history()
        
        # 履歴に含まれていないアイテムを優先的に探す
        best_trend = None
        for trend in trends:
            name = trend.get('name')
            if name and name not in history:
                best_trend = trend
                break
        
        # もしすべてのトレンドが履歴に入っていたら、最も古い履歴のものを解除するか、単純に最初のトレンドを選ぶ
        if not best_trend:
            logger.info("All detected trends are in history. Selecting the first one.")
            best_trend = trends[0]

        # 履歴を更新して保存
        name = best_trend['name']
        if name in history:
            history.remove(name)
        history.append(name)
        self._save_history(history)

        return best_trend['name'], best_trend['impact'], best_trend['beneficiaries']

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    scout = ItemScout()
    item, impact, champs = scout.select_best_target()
    print(f"Target Item: {item}")
    print(f"Impact: {impact}")
    print(f"Champions: {champs}")
