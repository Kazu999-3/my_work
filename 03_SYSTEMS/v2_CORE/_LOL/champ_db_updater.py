import os
import json
import logging
from pathlib import Path
import requests
from google import genai
from google.genai import types
import dotenv
from v2_CORE._LOL.herald import herald

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
    3. 「fullClearTime」は最新パッチでの最適な周回ルートや時間のみを抽出すること（JG以外は空白）。
    4. 「jg_style」には、このチャンピオンのメインのプレイスタイル、先出し耐性、カウンター（後出し）耐性を客観的に判定して設定してください。
    5. 出力は必ず以下のスキーマに準拠した有効なJSON形式のみで行うこと。改行やダブルクォーテーションは正しくエスケープしてください。
    
    {{
      "strengths": "強み",
      "weaknesses": "弱み",
      "powerSpikes": "パワースパイク",
      "buildRunes": "おすすめのビルドとルーン（※具体的な理由も記述）",
      "fullClearTime": "フルクリア時間（JG以外は空白）",
      "strategy": "全体的な立ち回り",
      "jg_style": {{
        "type": "「ファーム型」「ガンク型」「侵入型」「タンク型」のいずれか1つを必ず設定",
        "description": "そのプレイスタイルの短い日本語説明（50文字以内）",
        "blind_pickable": 1から5の数値（5:先出し最強、1:先出し不可能）,
        "counter_pickable": 1から5の数値（5:カウンター特化、1:カウンター不可）
      }}
    }}
    """
    
    from v2_CORE.ai_helper import generate_content_safe
    from v2_CORE.settings import settings
    response_text = None
    try:
        response_text = generate_content_safe(
            client,
            prompt,
            config=types.GenerateContentConfig(
                temperature=0.2, # データ抽出なので温度をさらに下げる
                response_mime_type="application/json"
            ),
            model_id=settings.DEFAULT_MODEL,
            feature_name="oracle",
            sleep_on_rate_limit=False  # クォータ回避のためスリープはしない
        )
        if response_text and not response_text.startswith("❌") and not response_text.startswith("⚠️") and "本日の利用上限に達しました" not in response_text:
            result_json = json.loads(response_text.strip())
            result_json["note_draft"] = new_text
            return result_json
    except Exception as e:
        logging.warning(f"⚠️ Geminiでのマージ処理に失敗しました。Ollamaフォールバックを試みます。エラー: {e}")

    # Ollamaへのフォールバック
    logging.info(f"🏠 Ollama (ローカルLLM) を使用して {champ_name} のデータをマージ・抽出します...")
    try:
        from v2_CORE.ai_helper import _generate_with_ollama
        # JSON形式での返却を確実にするためのプロンプト調整
        ollama_prompt = prompt + "\n\n【出力形式の絶対ルール】\n必ず指定されたスキーマに従った有効なJSON形式のみを返してください。不要な前置きや説明（```json 等のコードブロック含む）は一切出力しないでください。"
        
        response_text = _generate_with_ollama(ollama_prompt, model=settings.OLLAMA_MODEL)
        if response_text:
            cleaned_text = response_text.strip()
            # Markdownコードブロックの除去
            if cleaned_text.startswith("```"):
                lines = cleaned_text.split("\n")
                if len(lines) >= 2 and (lines[0].startswith("```json") or lines[0].startswith("```")):
                    cleaned_text = "\n".join(lines[1:-1]).strip()
            
            # JSONパースの堅牢化 (不正な制御文字の除去・エスケープ)
            import re
            def escape_control_chars(match):
                char = match.group(0)
                if char == "\n": return "\\n"
                if char == "\r": return "\\r"
                if char == "\t": return "\\t"
                return "" # その他の制御文字は消去
                
            try:
                result_json = json.loads(cleaned_text)
            except json.JSONDecodeError:
                try:
                    # 生の制御文字(0x00-0x1f)をエスケープ表現に置換して再試行
                    fixed_text = re.sub(r'[\x00-\x1f]', escape_control_chars, cleaned_text)
                    result_json = json.loads(fixed_text)
                except Exception as je:
                    logging.error(f"❌ JSON parsing failed even after escaping control characters: {je}")
                    logging.error(f"Raw text was: {cleaned_text[:1000]}")
                    return None
            
            result_json["note_draft"] = new_text
            return result_json
    except Exception as oe:
        logging.error(f"❌ ローカルOllamaでのマージ処理も失敗しました: {oe}")
        
    return None

def update_champion_db(champ_id: str, champ_name: str, new_text: str, patch_version: str = "16.11"):
    """メイン関数：既存データを取得、マージ、SupabaseへUpsert"""
    logging.info(f"[{champ_id}] Auto-updating Champion DB...")
    
    existing_data = fetch_existing_champ_data(champ_id)
    merged_json = merge_and_extract_intel(champ_name, new_text, existing_data)
    
    if not merged_json:
        logging.error(f"[{champ_id}] Failed to merge data, aborting update.")
        return False
        
    # 既存データの引き継ぎ・マージ
    existing_raw = existing_data.get("raw_data", {}) if isinstance(existing_data.get("raw_data"), dict) else {}
    existing_jg_style = existing_raw.get("jg_style", {}) if isinstance(existing_raw.get("jg_style"), dict) else {}
    existing_patch_meta = existing_raw.get("patch_meta", {}) if isinstance(existing_raw.get("patch_meta"), dict) else {}
    
    # 新しい jg_style の決定
    new_jg_style = merged_json.get("jg_style", {}) if isinstance(merged_json.get("jg_style"), dict) else {}
    jg_style_type = new_jg_style.get("type") or existing_jg_style.get("type") or "ガンク型"
    jg_style_desc = new_jg_style.get("description") or existing_jg_style.get("description") or "標準的なプレイスタイルです。"
    jg_style_blind = new_jg_style.get("blind_pickable") or existing_jg_style.get("blind_pickable") or 3
    jg_style_counter = new_jg_style.get("counter_pickable") or existing_jg_style.get("counter_pickable") or 3
    
    # 新しい patch_meta の決定
    import time
    patch_meta = {
        "patch": patch_version or existing_patch_meta.get("patch") or "16.11",
        "updated_at": int(time.time()),
        "win_rate": existing_patch_meta.get("win_rate") or 50.0,
        "pick_rate": existing_patch_meta.get("pick_rate") or 5.0,
        "ban_rate": existing_patch_meta.get("ban_rate") or 5.0,
        "tier": existing_patch_meta.get("tier") or "A"
    }

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
            "note_draft": merged_json.get("note_draft", ""),
            "jg_style": {
                "type": jg_style_type,
                "description": jg_style_desc,
                "blind_pickable": int(jg_style_blind),
                "counter_pickable": int(jg_style_counter)
            },
            "patch_meta": patch_meta
        }
    }
    
    url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?on_conflict=matchup_id"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            r = requests.post(url, headers=headers, json=upsert_data, timeout=15)
            if r.status_code in (200, 201):
                logging.info(f"✅ [{champ_id}] Champion DB successfully updated & merged!")
                herald.notify_progress(f"📖 **【辞典更新完了】** {champ_name} のデータとnoteドラフトが自動ブラッシュアップされました！", portal_link=True, page="champdb")
                return True
            elif r.status_code in (429, 500, 502, 503, 504) and attempt < max_retries - 1:
                wait = 2 ** attempt
                logging.warning(f"⚠️ Supabase Upsert一時エラー({r.status_code})。{wait}秒後にリトライします... ({attempt + 1}/{max_retries})")
                import time as _time
                _time.sleep(wait)
                continue
            else:
                logging.error(f"Supabase Upsert failed: {r.status_code} - {r.text}")
                return False
        except requests.RequestException as e:
            if attempt < max_retries - 1:
                wait = 2 ** attempt
                logging.warning(f"⚠️ Supabase接続エラー。{wait}秒後にリトライします... ({attempt + 1}/{max_retries}): {e}")
                import time as _time
                _time.sleep(wait)
                continue
            logging.error(f"Supabase connection failed after {max_retries} attempts: {e}")
            return False
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
