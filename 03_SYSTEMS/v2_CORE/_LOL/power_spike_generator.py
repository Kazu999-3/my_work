"""
チャンピオン辞典に「時間帯別の強さ（パワースパイク）」を自動生成して格納するスクリプト。
既存の champ_db_bulk_updater.py / champ_db_updater.py と同じ規約（env, ロギング, Supabase upsert,
Gemini→Ollamaフォールバック）に合わせている。champion_power_spikes テーブル
(supabase/migrations/08_champion_power_spikes.sql) に upsert する。

単体実行:
    python power_spike_generator.py            # 未生成/失敗分すべて
    python power_spike_generator.py Lillia      # 単一チャンピオンのみ

一括同期(champ_db_bulk_updater.py)に組み込む場合は generate_power_spike() を
チャンピオン処理ループの最後に1ステップとして呼び出す。
"""
import os
import sys
import json
import re
import time
import logging
from pathlib import Path
import requests
import dotenv

try:
    from v2_CORE.settings import settings
    from v2_CORE.ai_helper import generate_content_safe, _generate_with_ollama
except ImportError:
    sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
    from v2_CORE.settings import settings
    from v2_CORE.ai_helper import generate_content_safe, _generate_with_ollama

dotenv.load_dotenv(Path("d:/my_work/.env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [PowerSpike] %(levelname)s: %(message)s",
)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY_FREE") or os.environ.get("GEMINI_API_KEY")

POWER_SPIKE_PROMPT = """
League of Legendsのチャンピオン「{champion}」({role}想定、パッチ{patch})について、
序盤(1-9分)/中盤(10-20分)/終盤(20分以降)の強さを1-5の整数で厳密に評価してください。
Lolalytics/u.ggの統計傾向に基づいた客観的な評価とし、必ず以下のJSON形式のみを出力してください。
説明文やマークダウンのコードブロックは一切含めないでください。

{{
  "early_game_score": <1から5の整数>,
  "mid_game_score": <1から5の整数>,
  "late_game_score": <1から5の整数>,
  "peak_window": "<具体的な強さのピーク条件、20文字以内。例: レベル6-11、2ndアイテム完成後>",
  "summary": "<一言説明、40文字以内。例: 序盤は弱いが中盤のドラゴンファイトで最強クラス>"
}}
"""


def _extract_json(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if len(lines) >= 2:
            cleaned = "\n".join(lines[1:-1]).strip()
    return cleaned


def _call_llm(champion: str, role: str, patch: str) -> dict | None:
    prompt = POWER_SPIKE_PROMPT.format(champion=champion, role=role, patch=patch)

    if GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=GEMINI_API_KEY)
            response_text = generate_content_safe(
                client,
                prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    response_mime_type="application/json",
                ),
                model_id=settings.DEFAULT_MODEL,
                feature_name="power_spike",
                sleep_on_rate_limit=False,
            )
            if response_text and not response_text.startswith("❌") and not response_text.startswith("⚠️") \
               and "本日の利用上限に達しました" not in response_text:
                return json.loads(_extract_json(response_text))
        except Exception as e:
            logging.warning(f"⚠️ Gemini生成に失敗 ({champion})。Ollamaへフォールバックします: {e}")

    try:
        ollama_prompt = prompt + "\n\n必ずJSONのみを出力してください。前置き・後書き・コードブロックは禁止です。"
        response_text = _generate_with_ollama(ollama_prompt, model=settings.OLLAMA_MODEL)
        if response_text:
            cleaned = _extract_json(response_text)
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                fixed = re.sub(r"[\x00-\x1f]", "", cleaned)
                return json.loads(fixed)
    except Exception as e:
        logging.error(f"❌ Ollamaでの生成も失敗しました ({champion}): {e}")

    return None


def _validate(data: dict) -> bool:
    try:
        for key in ("early_game_score", "mid_game_score", "late_game_score"):
            v = int(data[key])
            if not (1 <= v <= 5):
                return False
        return True
    except (KeyError, ValueError, TypeError):
        return False


def upsert_power_spike(champion: str, data: dict, patch: str, retries: int = 3) -> bool:
    if not SUPABASE_URL or not SUPABASE_KEY:
        logging.error("Supabase credentials not found in .env")
        return False

    payload = {
        "champion": champion,
        "early_game_score": int(data["early_game_score"]),
        "mid_game_score": int(data["mid_game_score"]),
        "late_game_score": int(data["late_game_score"]),
        "peak_window": data.get("peak_window", ""),
        "summary": data.get("summary", ""),
        "source": "gemini",
        "patch": patch,
    }
    url = f"{SUPABASE_URL}/rest/v1/champion_power_spikes?on_conflict=champion"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    for attempt in range(retries):
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=15)
            if r.status_code in (200, 201):
                return True
            if r.status_code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            logging.error(f"Supabase Upsert failed for {champion}: {r.status_code} - {r.text}")
            return False
        except requests.RequestException as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            logging.error(f"Supabase connection failed for {champion}: {e}")
            return False
    return False


def generate_power_spike(champion: str, role: str = "GLOBAL", patch: str = "16.11") -> bool:
    """1チャンピオン分のパワースパイクを生成しDBへ反映する。champ_db_bulk_updater.pyのループから呼び出し可能。"""
    logging.info(f"⚡ [{champion}] パワースパイク生成を開始します...")
    data = _call_llm(champion, role, patch)
    if not data or not _validate(data):
        logging.error(f"❌ [{champion}] 生成データが不正、またはLLM生成に失敗しました。")
        return False
    ok = upsert_power_spike(champion, data, patch)
    if ok:
        logging.info(f"✅ [{champion}] パワースパイクを更新しました: {data.get('summary', '')}")
    return ok


if __name__ == "__main__":
    targets = sys.argv[1:]
    if not targets:
        logging.error("チャンピオン名を指定してください（複数可）。全件一括は champ_db_bulk_updater.py 経由で実行してください。")
        sys.exit(1)
    for champ in targets:
        generate_power_spike(champ)
        time.sleep(3)
