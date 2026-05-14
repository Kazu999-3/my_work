import os
import json
import logging
import time
import requests
from pathlib import Path
from champ_db_updater import update_champion_db
from google import genai
from google.genai import types
import dotenv

dotenv.load_dotenv(Path("D:/my_work/.env"))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [AutonomousFiller] %(levelname)s: %(message)s")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

def get_all_champions():
    """Data Dragonから全チャンピオンリストを取得"""
    url = "https://ddragon.leagueoflegends.com/cdn/14.10.1/data/ja_JP/champion.json"
    r = requests.get(url)
    if r.status_code == 200:
        data = r.json()
        return data["data"]
    return {}

def research_champion(champ_name: str, champ_id: str) -> str:
    """Geminiの検索能力を使用してチャンピオンの最新情報をリサーチする"""
    if not GEMINI_API_KEY:
        return "GEMINI_API_KEY not found"

    client = genai.Client(api_key=GEMINI_API_KEY)
    
    # 検索クエリ
    query = f"League of Legends {champ_name} ({champ_id}) build guide patch 14.10 lolalytics mobafire jungle full clear time"
    
    prompt = f"""
    League of Legendsのチャンピオン「{champ_name} ({champ_id})」について、最新パッチ（14.10想定）の情報をリサーチしてください。
    
    以下の項目を詳しくまとめてください：
    1. 強み (Strengths)
    2. 弱み (Weaknesses)
    3. パワースパイク (コアアイテムやレベル)
    4. 推奨ビルドと主要ルーン
    5. フルクリア時間とルート（ジャングラーの場合のみ。それ以外は「対象外」と記載）
    6. 基本的な立ち回りとメタでの位置づけ
    
    情報は Lolalytics や u.gg などの統計に基づいた客観的な内容にしてください。
    """
    
    # リトライループ (429対策)
    for attempt in range(3):
        try:
            # Google Search Tool を使わずに内部知識で生成（クォータ制限回避のため）
            response = client.models.generate_content(
                model="gemini-flash-latest",
                contents=prompt
            )
            return response.text
        except Exception as e:
            if "429" in str(e):
                wait_time = (attempt + 1) * 60
                logging.warning(f"Quota exceeded (429). Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
                continue
            
            logging.error(f"Research failed for {champ_name}: {str(e)}")
            import traceback
            logging.error(traceback.format_exc())
            return ""
    return ""

def run_autonomous_filling():
    """全チャンピオンを順に処理する"""
    champions = get_all_champions()
    logging.info(f"🚀 {len(champions)} 件のチャンピオンを順次処理します。")
    
    # すでに完了したものを取得（二重処理防止）
    url = f"{os.environ['SUPABASE_URL']}/rest/v1/matchup_sentinel?enemy=eq.GLOBAL&select=champion"
    headers = {"apikey": os.environ['SUPABASE_KEY'], "Authorization": f"Bearer {os.environ['SUPABASE_KEY']}"}
    r = requests.get(url, headers=headers)
    done_champs = [d['champion'] for d in r.json()] if r.status_code == 200 else []
    
    for champ_id, info in champions.items():
        if champ_id in done_champs:
            logging.info(f"⏭️ {champ_id} は既に完了しています。スキップします。")
            continue

        champ_name = info["name"]
        logging.info(f"🔍 Researching: {champ_name} ({champ_id})...")
        intel = research_champion(champ_name, champ_id)
        
        if intel:
            logging.info(f"📝 Updating DB for {champ_name}...")
            update_champion_db(champ_id, champ_name, intel)
            logging.info(f"✅ {champ_name} DONE.")
        else:
            logging.warning(f"⚠️ {champ_name} could not be researched.")
        
        # クォータ制限対策として30秒の固定待機
        logging.info("💤 Rate limit cooldown (30s)...")
        time.sleep(30)

if __name__ == "__main__":
    run_autonomous_filling()
