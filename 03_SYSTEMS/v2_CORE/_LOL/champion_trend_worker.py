import os
import sys
import json
import time
from datetime import datetime, timezone
from pathlib import Path
import httpx
from google import genai

# パス追加
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe
from v2_CORE.logger_config import setup_sovereign_logging

logger = setup_sovereign_logging("ChampionTrendWorker")

def main():
    if len(sys.argv) < 3:
        logger.error("Usage: python champion_trend_worker.py <champion> <role>")
        sys.exit(1)
        
    champion = sys.argv[1]
    role = sys.argv[2]
    
    logger.info(f"Starting trend collection for {champion} ({role})")
    
    api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
    if not api_key:
        logger.error("Gemini API key is not configured.")
        sys.exit(1)
        
    client = genai.Client(api_key=api_key)
    
    # 2026年コンテキストの付与
    now_str = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    
    # ジャングルロール時の分類指示の組み立て
    jg_instructions = ""
    jg_json_schema = ""
    if role.lower() == "jungle":
        jg_instructions = """
【重要：ジャングル（Jungle）分類指示】
このチャンピオンのジャングル運用について、アイアン〜ゴールド帯（低〜中レート帯）において最も再現性が高い強みを基準に、以下の【4つの基本タイプ】から重複なく最も合致するメイン分類を1つ決定してください：
- 侵入型（インベード・カウンターjg・1v1特化）
- ガング型（少人数戦・CC・序盤 of レーン関与特化）
- ファーム型（高速ファーム・中終盤キャリー特化）
- タンク型（フロントライン・集団戦・エンゲージ特化）

さらに、以下の【評価基準】を1〜5の数値（星の数）で評価してください：
- 先出し安定度（カウンターされにくく、先出ししやすい。1〜5）
- 後出し有利度（特定の敵に対して理不尽なカウンターになり得る。1〜5）
"""
        jg_json_schema = """,
  "jg_style": {
    "type": "侵入型" | "ガンク型" | "ファーム型" | "タンク型", // いずれか1つを厳密に選択
    "blind_pickable": 3, // 先出し安定度 (1〜5 の数値)
    "counter_pickable": 4, // 後出し有利度 (1〜5 の数値)
    "description": "なぜその先出し安定度・後出し有利度の星評価になったのかの具体的な根拠と、アイアン〜ゴールド帯を基準とした立ち回りの特徴（日本語で2〜3文程度）"
  }"""

    prompt = f"""【システムコンテキスト：現在の年は2026年です（本日は {now_str}）。この日時を基準に、未来や過去の出来事を正しく判定し、文脈を構築してください。】

League of Legendsの最新パッチにおける、チャンピオン「{champion}」のロール「{role}」の統計データおよびプロプレイヤーの最新ビルド情報をリサーチしてください。
{jg_instructions}
以下のJSONフォーマットのみで出力してください（マークダウンの ```json や、余計な説明文は一切含めないでください。純粋なJSONオブジェクトのみを出力してください）。

{{
  "champion": "{champion}",
  "role": "{role}",
  "patch": "最新パッチ番号 (例: 14.12)",
  "win_rate": 50.2, // 最新勝率 (%、数値のみ)
  "pick_rate": 5.4, // 最新ピック率 (%、数値のみ)
  "ban_rate": 8.1,  // 最新バン率 (%、数値のみ)
  "tier": "S",      // ティア (S+, S, A, B, C など)
  "trend_items": ["コアアイテム1", "コアアイテム2", "コアアイテム3"], // 主要なビルドの1st, 2nd, 3rdアイテム
  "trend_runes": {{
    "keystone": "キーストーン名",
    "primary": "メインルーンパス名 (例: Precision, Inspiration, Dominationなど)",
    "secondary": "サブルーンパス名 (例: Sorcery, Resolveなど)"
  }},
  "pro_builds": [
    {{
      "player": "プロ選手名 (例: Canyon, Oner, Faker, Chovy, Zeus, ShowMaker, Rulerなど。実在するプロ選手)",
      "team": "チーム名 (例: GEN, T1, DK, HLE, BLGなど)",
      "win_lose": "直近の勝敗 (例: 3勝1敗, 4W-1Lなど)",
      "build": ["1stコア", "2ndコア", "3rdコア"],
      "runes": ["キーストーン名", "主要ルーン"],
      "description": "このビルドの特徴や狙いに関する短い日本語の解説（1文。'バースト重視'や'序盤のトレード強化'など簡潔に）"
    }}
  ],
  "strengths": "最新パッチのトレンドを踏まえた、このチャンピオンの現在の主な強み（簡潔な日本語文章で2〜3文）",
  "weaknesses": "最新パッチのトレンドを踏まえた、現在の主な弱点・対策されやすい点（簡潔な日本語文章で2〜3文）",
  "powerSpikes": "パワースパイク（どの時間帯、どのアイテム完成時に強いか。簡潔な日本語で1〜2文）",
  "buildRunes": "推奨されるコアビルドとルーンの選び方の簡単な解説（簡潔な日本語で2〜3文）",
  "counterChampions": "対面での有利・不利、カウンターチャンピオンに関する情報（簡潔な日本語で2〜3文）",
  "pickRecommendation": "現在のメタにおけるピックの推奨度や、先出し・後出しの適性（簡潔な日本語で1〜2文）"{jg_json_schema}
}}"""

    # Gemini 呼び出し（検索ツール有効）
    from google.genai import types
    config = types.GenerateContentConfig(
        tools=[{"google_search": {}}]
    )
    
    try:
        logger.info("Calling Gemini API...")
        res_text = generate_content_safe(
            client,
            prompt,
            model_id="gemini-2.5-flash",
            config=config,
            feature_name="oracle"
        )
        
        if not res_text or res_text.startswith("⚠️") or res_text.startswith("❌"):
            raise RuntimeError(f"Gemini API returned error: {res_text}")
            
        # JSON部分の抽出
        res_text = res_text.strip()
        if res_text.startswith("```"):
            files_lines = res_text.split("\n")
            if files_lines[0].startswith("```json") or files_lines[0].startswith("```"):
                res_text = "\n".join(files_lines[1:-1])
        res_text = res_text.strip()
        
        trend_data = json.loads(res_text)
    except Exception as e:
        logger.warning(f"⚠️ Gemini API failed: {e}. Falling back to local Ollama (gemma3:12b)...")
        try:
            from v2_CORE.ai_helper import _generate_with_ollama
            res_text = _generate_with_ollama(prompt, model="gemma3:12b")
            
            # JSON部分の抽出
            res_text = res_text.strip()
            if res_text.startswith("```"):
                files_lines = res_text.split("\n")
                if files_lines[0].startswith("```json") or files_lines[0].startswith("```"):
                    res_text = "\n".join(files_lines[1:-1])
            res_text = res_text.strip()
            
            trend_data = json.loads(res_text)
            logger.info("✅ Successfully generated trend data using local Ollama model fallback.")
        except Exception as ollama_e:
            logger.error(f"❌ Both Gemini API and local Ollama fallback failed: {ollama_e}")
            sys.exit(2)
        
    # Supabase 接続準備
    supabase_url = settings.SUPABASE_URL
    supabase_key = settings.SUPABASE_KEY
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    matchup_id = f"champ_{champion}_global"
    
    # 既存データの取得
    url = f"{supabase_url}/rest/v1/matchup_sentinel?matchup_id=eq.{matchup_id}"
    try:
        res = httpx.get(url, headers=headers, timeout=10)
        existing = {}
        if res.status_code == 200 and res.json():
            existing = res.json()[0]
    except Exception as e:
        logger.error(f"Failed to fetch existing sentinel record: {e}")
        sys.exit(3)
        
    raw_data = existing.get("raw_data") or {}
    if not isinstance(raw_data, dict):
        raw_data = {}
        
    # トレンドデータのマージ
    raw_data["patch_meta"] = {
        "win_rate": trend_data.get("win_rate"),
        "pick_rate": trend_data.get("pick_rate"),
        "ban_rate": trend_data.get("ban_rate"),
        "tier": trend_data.get("tier"),
        "trend_items": trend_data.get("trend_items", []),
        "trend_runes": trend_data.get("trend_runes", {}),
        "patch": trend_data.get("patch"),
        "updated_at": int(time.time())
    }
    raw_data["pro_builds"] = trend_data.get("pro_builds", [])
    if "jg_style" in trend_data:
        raw_data["jg_style"] = trend_data.get("jg_style")
    
    # 攻略情報の上書き
    raw_data["strengths"] = trend_data.get("strengths") or raw_data.get("strengths") or ""
    raw_data["weaknesses"] = trend_data.get("weaknesses") or raw_data.get("weaknesses") or ""
    raw_data["powerSpikes"] = trend_data.get("powerSpikes") or raw_data.get("powerSpikes") or ""
    raw_data["buildRunes"] = trend_data.get("buildRunes") or raw_data.get("buildRunes") or ""
    raw_data["counterChampions"] = trend_data.get("counterChampions") or raw_data.get("counterChampions") or ""
    raw_data["pickRecommendation"] = trend_data.get("pickRecommendation") or raw_data.get("pickRecommendation") or ""
    
    title = existing.get("title") or f"{champion} 基本戦略・トレンド"
    strategy = existing.get("strategy") or ""
    
    now_iso = datetime.now(timezone.utc).isoformat()
    
    payload = {
        "matchup_id": matchup_id,
        "champion": champion,
        "enemy": "GLOBAL",
        "title": title,
        "strategy": strategy,
        "raw_data": raw_data,
        "created_at": now_iso  # 更新日を現在時刻に設定
    }
    
    # Supabase へ Upsert
    url_upsert = f"{supabase_url}/rest/v1/matchup_sentinel?on_conflict=matchup_id"
    headers_upsert = headers.copy()
    headers_upsert["Prefer"] = "resolution=merge-duplicates"
    try:
        res = httpx.post(url_upsert, headers=headers_upsert, json=payload, timeout=15)
        if res.status_code not in (200, 201, 204):
            logger.error(f"Failed to upsert matchup_sentinel: {res.status_code} - {res.text}")
            sys.exit(4)
        logger.info(f"Successfully updated trend and matchup_sentinel for {champion}")
    except Exception as e:
        logger.error(f"Exception during upsert: {e}")
        sys.exit(5)
        
    # 成功終了情報を出力
    print(json.dumps({"success": True, "message": f"Updated {champion} trend", "matchup_id": matchup_id}))

if __name__ == "__main__":
    main()
