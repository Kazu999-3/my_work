import os
import json
import logging
from pathlib import Path
import requests
from google import genai
from google.genai import types
import dotenv
from v2_CORE.herald import herald

dotenv.load_dotenv(Path("D:/my_work/.env"))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [ChampDB] %(levelname)s: %(message)s")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY_FREE") or os.environ.get("GEMINI_API_KEY")

def fetch_existing_champ_data(champ_id: str) -> dict:
    """Supabaseから既存のGLOBALデータを取得する"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        logging.error("Supabase credentials not found in .env")
        return {}
        
    url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?champion=eq.{champ_id}&enemy=eq.GLOBAL&select=strategy,raw_data"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data and len(data) > 0:
                return data[0]
    except Exception as e:
        logging.error(f"Failed to fetch existing data for {champ_id}: {e}")
    return {}

def merge_and_extract_intel(champ_name: str, new_text: str, existing_data: dict) -> dict:
    """Geminiを使用して既存のメモと新しいトレンド記事を賢くマージし、JSONを出力する"""
    if not GEMINI_API_KEY:
        logging.error("GEMINI_API_KEY not found in .env")
        return None

    client = genai.Client(api_key=GEMINI_API_KEY)
    
    # 既存のデータを文字列化
    old_raw = existing_data.get("raw_data", {})
    existing_text = f"""
    【既存のユーザー手書きメモ（絶対に保護し、失わないこと！）】
    - 強み: {old_raw.get('strengths', '')}
    - 弱み: {old_raw.get('weaknesses', '')}
    - パワースパイク: {old_raw.get('powerSpikes', '')}
    - ビルド/ルーン: {old_raw.get('buildRunes', '')}
    - フルクリア時間: {old_raw.get('fullClearTime', '')}
    - 立ち回り: {existing_data.get('strategy', '')}
    """
    
    prompt = f"""
    あなたはLeague of Legendsの戦略データ管理者です。
    ユーザーの【既存のメモ】と【最新のトレンド記事】を統合し、指定されたJSONフィールドのみを更新して出力してください。
    ※長文の記事作成は不要です。JSONの抽出のみを行ってください。
    
    【対象チャンピオン】: {champ_name}
    
    {existing_text}
    
    【最新のトレンド記事・AI調査結果】
    {new_text[:8000]}
    
    【厳格なルール】
    1. 既存のメモのニュアンスは絶対に削除せず、ベースとして残すこと。
    2. 新しい記事から有用な知識を見つけたら、既存のメモに「追記・整理」する形でマージすること。
    3. 「fullClearTime」は最新パッチ（シーズン14等）での最適な周回ルートや時間のみを抽出すること（JG以外は空白）。
    4. 出力は必ず以下のスキーマに準拠した有効なJSON形式のみで行うこと。改行やダブルクォーテーションは正しくエスケープしてください。
    
    {{
      "strengths": "強み",
      "weaknesses": "弱み",
      "powerSpikes": "パワースパイク",
      "buildRunes": "おすすめのビルドとルーン（※具体的な理由も記述）",
      "fullClearTime": "フルクリア時間（JG以外は空白）",
      "strategy": "全体的な立ち回り"
    }}
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2, # データ抽出なので温度をさらに下げる
                response_mime_type="application/json"
            )
        )
        result_json = json.loads(response.text.strip())
        
        # 記事(note_draft)はAIに再生成させず、引数で渡された完成版をそのまま格納する
        result_json["note_draft"] = new_text
        return result_json
    except Exception as e:
        logging.error(f"Gemini processing failed: {e}")
        return None

def update_champion_db(champ_id: str, champ_name: str, new_text: str):
    """メイン関数：既存データを取得、マージ、SupabaseへUpsert"""
    logging.info(f"[{champ_id}] Auto-updating Champion DB...")
    
    existing_data = fetch_existing_champ_data(champ_id)
    merged_json = merge_and_extract_intel(champ_name, new_text, existing_data)
    
    if not merged_json:
        logging.error(f"[{champ_id}] Failed to merge data, aborting update.")
        return False
        
    # Upsertデータ構築
    upsert_data = {
        "matchup_id": f"champ_{champ_id}_global",
        "champion": champ_id,
        "enemy": "GLOBAL",
        "title": f"{champ_name} 基本戦略・トレンド",
        "strategy": merged_json.get("strategy", ""),
        "raw_data": {
            "source": "champ_db",
            "role": "GLOBAL",
            "strengths": merged_json.get("strengths", ""),
            "weaknesses": merged_json.get("weaknesses", ""),
            "powerSpikes": merged_json.get("powerSpikes", ""),
            "buildRunes": merged_json.get("buildRunes", ""),
            "fullClearTime": merged_json.get("fullClearTime", ""),
            "note_draft": merged_json.get("note_draft", "")
        }
    }
    
    url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?on_conflict=matchup_id"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    
    try:
        r = requests.post(url, headers=headers, json=upsert_data, timeout=15)
        if r.status_code in (200, 201):
            logging.info(f"✅ [{champ_id}] Champion DB successfully updated & merged!")
            herald.notify_progress(f"📖 **【辞典更新完了】** {champ_name} のデータとnoteドラフトが自動ブラッシュアップされました！", portal_link=True, page="champdb")
            return True
        else:
            logging.error(f"Supabase Upsert failed: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        logging.error(f"Supabase connection failed: {e}")
        return False

def process_interrogation_queue():
    """UIから送信された反省会フィードバック（PROCESS_INTERROGATION_*）を処理する"""
    if not SUPABASE_URL or not SUPABASE_KEY: return
    
    url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?enemy=eq.PROCESS_INTERROGATION"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}
    
    try:
        r = requests.get(url, headers=headers)
        if r.status_code == 200:
            records = r.json()
            for record in records:
                feedback = record.get("strategy", "")
                target_enemy = record.get("raw_data", {}).get("target_enemy", "")
                
                if feedback and target_enemy:
                    # 対象のチャンピオン（敵）のDBを更新する
                    new_text = f"【最近の敗北からの学び・AI鬼コーチ反省】\n{feedback}"
                    logging.info(f"Processing Interrogation for {target_enemy}: {feedback}")
                    update_champion_db(target_enemy, target_enemy, new_text)
                    
                # 処理完了したキューを削除
                m_id = record.get("matchup_id")
                if not m_id:
                    logging.error("Critical: matchup_id is empty. Skipping deletion to prevent wiping entire table.")
                    continue
                del_url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?matchup_id=eq.{m_id}"
                requests.delete(del_url, headers=headers)
    except Exception as e:
        logging.error(f"Interrogation process failed: {e}")

if __name__ == "__main__":
    # テスト用
    test_text = "リリアの14.10パッチ最新ビルドは黒炎のトーチが最強です。コンカーラールーンを持ちます。"
    update_champion_db("Lillia", "リリア", test_text)
