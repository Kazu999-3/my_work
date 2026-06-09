import os
import json
import logging
import time
import requests
import re
from pathlib import Path
from champ_db_updater import update_champion_db
from google import genai
from google.genai import types
import dotenv

dotenv.load_dotenv(Path("D:/my_work/.env"))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [AutonomousFiller] %(levelname)s: %(message)s")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY_FREE") or os.environ.get("GEMINI_API_KEY")

def get_latest_patch() -> str:
    """Ddragonから最新パッチバージョンを取得"""
    url = "https://ddragon.leagueoflegends.com/api/versions.json"
    try:
        import urllib.request
        with urllib.request.urlopen(url, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data[0]
    except Exception as e:
        logging.error(f"Failed to fetch patch version from Ddragon: {e}")
        return "16.11.1" # デフォルトフォールバック

def get_all_champions(patch_version: str):
    """Data Dragonから全チャンピオンリストを取得"""
    url = f"https://ddragon.leagueoflegends.com/cdn/{patch_version}/data/ja_JP/champion.json"
    r = requests.get(url)
    if r.status_code == 200:
        data = r.json()
        return data["data"]
    return {}

def parse_retry_delay(err_msg: str) -> float:
    """エラーメッセージからリトライ待機時間（秒）をパースする"""
    match = re.search(r"Please retry in\s+([0-9\.]+)\s*s", err_msg, re.IGNORECASE)
    if match:
        return float(match.group(1))
    match_sec = re.search(r"'retryDelay':\s*'([0-9]+)s'", err_msg)
    if match_sec:
        return float(match_sec.group(1))
    return 0.0

def research_champion(champ_name: str, champ_id: str, patch_version: str) -> str:
    """Geminiの検索能力を使用してチャンピオンの最新情報をリサーチする"""
    if not GEMINI_API_KEY:
        return "GEMINI_API_KEY not found"

    client = genai.Client(api_key=GEMINI_API_KEY)
    
    # パッチメジャーバージョン (例: 16.11.1 -> 16.11)
    patch_major = ".".join(patch_version.split(".")[:2]) if patch_version else "16.11"
    
    prompt = f"""
    League of Legendsのチャンピオン「{champ_name} ({champ_id})」について、最新パッチ（パッチ {patch_major}想定）の情報をリサーチしてください。
    
    以下の項目を詳しくまとめてください：
    1. 強み (Strengths)
    2. 弱み (Weaknesses)
    3. パワースパイク (コアアイテムやレベル)
    4. 推奨ビルドと主要ルーン
    5. フルクリア時間とルート（ジャングラーの場合のみ。それ以外は「対象外」と記載）
    6. 基本的な立ち回りとメタでの位置づけ
    
    情報は Lolalytics や u.gg などの統計に基づいた客観的な内容にしてください。
    """
    
    from v2_CORE.ai_helper import generate_content_safe
    
    # 共通のスロットリング・フォールバック機能を使用する
    response_text = generate_content_safe(
        client, 
        prompt, 
        model_id="gemini-2.5-flash",
        feature_name="oracle"
    )
    
    if response_text and not response_text.startswith("⚠️") and not response_text.startswith("❌"):
        return response_text
        
    return ""

def run_autonomous_filling():
    """全チャンピオンを順に処理する"""
    patch_version = get_latest_patch()
    logging.info(f"🌐 最新パッチ特定: {patch_version}")
    
    champions = get_all_champions(patch_version)
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
        intel = research_champion(champ_name, champ_id, patch_version)
        
        if intel:
            logging.info(f"📝 Updating DB for {champ_name}...")
            update_champion_db(champ_id, champ_name, intel)
            logging.info(f"✅ {champ_name} DONE.")
        else:
            logging.warning(f"⚠️ {champ_name} could not be researched.")
        
        # クォータ制限対策として60秒の固定待機（動画解析の邪魔をしないよう長めにする）
        logging.info("💤 Rate limit cooldown (60s)...")
        time.sleep(60)

if __name__ == "__main__":
    run_autonomous_filling()
