import os
import re
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
from v2_CORE.knowledge_revisions import record_matchup_sentinel_revision
from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id, get_latest_ddragon_version, to_display_patch_version
from v2_CORE._LOL.lol_trend_collector import sanitize_trend_data

logger = setup_sovereign_logging("ChampionTrendWorker")

# collect_and_save_champion_trend()内で失敗理由がクォータ/レート制限由来だったかを記録する。
# 以前はmain()側でquota_manager.check_quota("oracle")を事後に問い合わせて判定していたが、
# これは「1日の合計上限」しか見ておらず、Google側の分単位レート制限(1分あたりのリクエスト数)
# でのみ429が起きたケース(その日全体としてはまだ余裕がある)を検知できず、"Skipped"と
# 表示すべきなのに"Failed"という不正確な見出しになっていた(2026-08-10発覚)。実際に429/
# RESOURCE_EXHAUSTED等の兆候が出たかをその場でモジュール変数に記録する方式に変更する。
_quota_hit_this_run = False


def _mark_if_quota_related(text) -> None:
    global _quota_hit_this_run
    markers = ("429", "RESOURCE_EXHAUSTED", "利用上限", "quota", "Quota", "rate limit")
    if text and any(m in str(text) for m in markers):
        _quota_hit_this_run = True


def extract_json_object(text: str) -> str:
    """AI応答からJSONオブジェクト部分だけを堅牢に取り出す。

    google_search グラウンディングを有効にすると、「JSONのみ出力」の指示を無視して
    JSONの前後に説明文（「検索結果に基づき以下にまとめました:」等）が付くことがある。
    従来は応答の先頭が```かどうかしか見ておらず、先頭に説明文が付いた瞬間に
    fence抽出が素通りしてjson.loadsへ生文章ごと渡され、
    "Expecting value: line 1 column 1 (char 0)" で毎回失敗し続けていた（再試行しても
    同じ応答パターンを繰り返すため直らない）。フェンスを応答中のどこからでも検出し、
    無ければ最初の '{' 〜 最後の '}' を取り出すことで、前後の説明文を許容する。
    """
    text = text.strip()
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
    if fence_match and fence_match.group(1).strip():
        return fence_match.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start:end + 1]
    return text


def fetch_champion_notes(champ_id: str, supabase_url: str, supabase_key: str) -> str:
    """Supabaseのchampion_notesから最新の攻略ノート・記事を取得する"""
    champ_id = normalize_champion_id(champ_id)
    if not supabase_url or not supabase_key: return ""
    url = f"{supabase_url}/rest/v1/champion_notes?champion=ilike.{champ_id}&order=created_at.desc&limit=5"
    headers = {"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}
    try:
        r = httpx.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            notes = r.json()
            if notes:
                lines = ["【攻略ライブラリ・関連ノートの知見（最新5件）】"]
                for n in notes:
                    title = n.get("title") or "無題"
                    body = (n.get("body") or "").strip()[:300]
                    lines.append(f"- 【{title}】 {body}")
                return "\n".join(lines)
    except Exception as e:
        logger.warning(f"Failed to fetch champion_notes for {champ_id}: {e}")
    return ""


def collect_and_save_champion_trend(champion: str, role: str, client=None) -> bool:
    """1チャンピオン分のAIトレンド収集〜保存を行う共通エンジン。

    辞典の「最新トレンド取得」ボタン(CLI経由のmain)と、champ_db_bulk_updater.pyの
    一括更新ループの両方から呼ばれる(2026-08-08、旧・自由記述ベースの一括更新
    パイプラインをこちらへ統合)。呼び出し元ごとにGemini APIキーのクォータを
    分離したい場合があるため、clientを外部から注入できるようにしている
    (未指定時はこのモジュール自身のデフォルトキーで生成する)。
    例外は投げず、成功時True・失敗時Falseを返す。
    """
    global _quota_hit_this_run
    _quota_hit_this_run = False

    champion = normalize_champion_id(champion)
    logger.info(f"Starting trend collection for {champion} ({role})")

    if client is None:
        api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if not api_key:
            logger.error("Gemini API key is not configured.")
            return False
        client = genai.Client(api_key=api_key)

    now_str = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    notes_context = fetch_champion_notes(champion, settings.SUPABASE_URL, settings.SUPABASE_KEY)
    
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

加えて、このチャンピオンの標準的なジャングルルーティンについて、以下のタイミングを秒数（整数）でリサーチしてください（攻略サイトやガイド記事に掲載されている一般的な目安値。不明な場合は無理に数字を作らずnullにすること）：
- 1周目フルクリア時間（ジャングル開始からジャングルモンスター1周を終えるまでの目安秒数）
- 1個目のコアアイテムが完成する目安タイミング（試合開始からの秒数）
- 2個目のコアアイテムが完成する目安タイミング（試合開始からの秒数）
"""
        jg_json_schema = """,
  "jg_style": {
    "type": "侵入型" | "ガンク型" | "ファーム型" | "タンク型", // いずれか1つを厳密に選択
    "blind_pickable": 3, // 先出し安定度 (1〜5 の数値)
    "counter_pickable": 4, // 後出し有利度 (1〜5 の数値)
    "description": "なぜその先出し安定度・後出し有利度の星評価になったのかの具体的な根拠と、アイアン〜ゴールド帯を基準とした立ち回りの特徴（日本語で2〜3文程度）",
    "full_clear_time_sec": 480, // 1周目フルクリアの目安秒数（数値のみ。不明ならnull）
    "first_core_timing_sec": 210, // 1個目コアアイテム完成の目安秒数（数値のみ。不明ならnull）
    "second_core_timing_sec": 420 // 2個目コアアイテム完成の目安秒数（数値のみ。不明ならnull）
  }"""

    prompt = f"""【システムコンテキスト：現在の年は2026年です（本日は {now_str}）。この日時を基準に、未来や過去の出来事を正しく判定し、文脈を構築してください。】

{notes_context}

League of Legendsの最新パッチにおける、チャンピオン「{champion}」のロール「{role}」の統計データおよびプロプレイヤーの最新ビルド情報をリサーチしてください。
- ※ 同キャラ対決（ミラーマッチ）の試合データは勝率が50%に強制固定されるため必ず除外して、異対面における純粋な対戦勝率・ピック率・BAN率のみを集計してください。
- 同ロール( {role} )における現状の立ち位置、強み、弱み、パワースパイク、推奨ビルド・ルーン、有利な対面/苦手な対面を分析してください。
{jg_instructions}
以下のJSONフォーマットのみで出力してください（マークダウンの ```json や、余計な説明文は一切含めないでください。純粋なJSONオブジェクトのみを出力してください）。

{{
  "champion": "{champion}",
  "role": "{role}",
  "patch": "最新パッチ番号 (西暦下2桁基準の表記。例: 26.12)",
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
            model_id="gemini-3.1-flash-lite",
            config=config,
            feature_name="oracle"
        )
        
        if not res_text or res_text.startswith("⚠️") or res_text.startswith("❌"):
            # ツール無しで標準再試行
            logger.warning(f"Retrying Gemini API without search tools: {res_text}")
            res_text = generate_content_safe(
                client,
                prompt,
                model_id="gemini-3.1-flash-lite",
                config=None,
                feature_name="oracle"
            )

        if not res_text or res_text.startswith("⚠️") or res_text.startswith("❌"):
            _mark_if_quota_related(res_text)
            raise RuntimeError(f"Gemini API returned error: {res_text}")

        # JSON部分の抽出
        res_text = extract_json_object(res_text)
        trend_data = json.loads(res_text)
    except Exception as e:
        _mark_if_quota_related(e)
        logger.warning(f"⚠️ Gemini API with search failed: {e}. Retrying without search tools...")
        try:
            res_text = generate_content_safe(client, prompt, model_id="gemini-3.1-flash-lite", config=None, feature_name="oracle")
            _mark_if_quota_related(res_text)
            res_text = extract_json_object(res_text)
            trend_data = json.loads(res_text)
            logger.info("✅ Successfully generated trend data using standard Gemini API fallback.")
        except Exception as retry_e:
            _mark_if_quota_related(retry_e)
            logger.warning(f"⚠️ Standard Gemini API retry failed: {retry_e}. Falling back to local Ollama...")
            try:
                from v2_CORE.ai_helper import _generate_with_ollama
                res_text = _generate_with_ollama(prompt, model="gemma3:12b")
                res_text = extract_json_object(res_text)
                trend_data = json.loads(res_text)
                logger.info("✅ Successfully generated trend data using local Ollama model fallback.")
            except Exception as ollama_e:
                logger.warning(f"⚠️ API制限のため今回の定期更新は安全にスキップされました (既存データを維持します): {ollama_e}")
                return False
        
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
        return False
        
    raw_data = existing.get("raw_data") or {}
    if not isinstance(raw_data, dict):
        raw_data = {}

    # Gemini(google_search grounding)によるハルシネーション対策: 異常値を捨てる
    trend_data = sanitize_trend_data(trend_data, champion)

    # トレンドデータのマージ
    # Gemini応答が特定フィールド(tier/trend_itemsなど)を欠くことがあるため、
    # 単純上書きだと既存の正常な値まで消してしまう。既存値をフォールバックにして
    # 「取得できたものだけ更新、取れなかったものは前回値を維持」する(#⑤)。
    existing_patch_meta = raw_data.get("patch_meta") if isinstance(raw_data.get("patch_meta"), dict) else {}

    # AIに「最新パッチ番号」を自己申告させると、google_searchグラウンディングが
    # 有効でも学習知識ベースの古いパッチに寄ってしまい、実際より約1ヶ月古い値が
    # 返ることがあった(2026-08-09発覚)。DDragonの実データから確実に取得し、
    # AIの回答(trend_data.get("patch"))は使わない。DDragon疎通失敗時のみ
    # AI回答→前回値の順にフォールバックする。
    real_patch = to_display_patch_version(get_latest_ddragon_version(timeout=10))

    raw_data["patch_meta"] = {
        "win_rate": trend_data.get("win_rate") if trend_data.get("win_rate") is not None else existing_patch_meta.get("win_rate"),
        "pick_rate": trend_data.get("pick_rate") if trend_data.get("pick_rate") is not None else existing_patch_meta.get("pick_rate"),
        "ban_rate": trend_data.get("ban_rate") if trend_data.get("ban_rate") is not None else existing_patch_meta.get("ban_rate"),
        "tier": trend_data.get("tier") or existing_patch_meta.get("tier"),
        "trend_items": trend_data.get("trend_items") or existing_patch_meta.get("trend_items", []),
        "trend_runes": trend_data.get("trend_runes") or existing_patch_meta.get("trend_runes", {}),
        "patch": real_patch or trend_data.get("patch") or existing_patch_meta.get("patch"),
        "updated_at": int(time.time())
    }
    raw_data["pro_builds"] = trend_data.get("pro_builds") or raw_data.get("pro_builds", [])

    # jg_styleも同様に、応答に含まれるサブフィールドだけを反映し、欠けている
    # サブフィールド(type/blind_pickable/counter_pickable/description)は既存値を維持する。
    new_jg_style = trend_data.get("jg_style") if isinstance(trend_data.get("jg_style"), dict) else None
    if new_jg_style:
        existing_jg_style = raw_data.get("jg_style") if isinstance(raw_data.get("jg_style"), dict) else {}
        raw_data["jg_style"] = {
            "type": new_jg_style.get("type") or existing_jg_style.get("type"),
            "description": new_jg_style.get("description") or existing_jg_style.get("description"),
            "blind_pickable": new_jg_style.get("blind_pickable") if new_jg_style.get("blind_pickable") is not None else existing_jg_style.get("blind_pickable"),
            "counter_pickable": new_jg_style.get("counter_pickable") if new_jg_style.get("counter_pickable") is not None else existing_jg_style.get("counter_pickable"),
            "full_clear_time_sec": new_jg_style.get("full_clear_time_sec") if new_jg_style.get("full_clear_time_sec") is not None else existing_jg_style.get("full_clear_time_sec"),
            "first_core_timing_sec": new_jg_style.get("first_core_timing_sec") if new_jg_style.get("first_core_timing_sec") is not None else existing_jg_style.get("first_core_timing_sec"),
            "second_core_timing_sec": new_jg_style.get("second_core_timing_sec") if new_jg_style.get("second_core_timing_sec") is not None else existing_jg_style.get("second_core_timing_sec"),
        }
    
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
            return False
        logger.info(f"Successfully updated trend and matchup_sentinel for {champion}")
    except Exception as e:
        logger.error(f"Exception during upsert: {e}")
        return False

    record_matchup_sentinel_revision(
        matchup_id, existing or None, payload,
        source_title="最新トレンド取得（AI自動収集）",
        supabase_url=supabase_url, supabase_key=supabase_key
    )

    # --- SSOT: champion_facts にも並行書き込み ---
    # 日次の dict-migrate cron を待たず、トレンド取得直後に champion_facts を最新化する。
    jg_style_data = raw_data.get("jg_style") if isinstance(raw_data.get("jg_style"), dict) else {}
    patch_meta_data = raw_data.get("patch_meta") if isinstance(raw_data.get("patch_meta"), dict) else {}
    facts_payload = {
        "champion": champion,
        "strengths": raw_data.get("strengths") or None,
        "weaknesses": raw_data.get("weaknesses") or None,
        "power_spikes": raw_data.get("powerSpikes") or None,
        "build_runes": raw_data.get("buildRunes") or None,
        "full_clear_time": raw_data.get("fullClearTime") or None,
        "counter_champions": raw_data.get("counterChampions") or None,
        "pick_recommendation": raw_data.get("pickRecommendation") or None,
        "jg_type": jg_style_data.get("type") or None,
        "jg_description": jg_style_data.get("description") or None,
        "jg_blind_pickable": jg_style_data.get("blind_pickable"),
        "jg_counter_pickable": jg_style_data.get("counter_pickable"),
        "full_clear_time_sec": jg_style_data.get("full_clear_time_sec"),
        "first_core_timing_sec": jg_style_data.get("first_core_timing_sec"),
        "second_core_timing_sec": jg_style_data.get("second_core_timing_sec"),
        "patch": patch_meta_data.get("patch") or None,
        "patch_meta": patch_meta_data or None,
        "pro_builds": raw_data.get("pro_builds") or [],
        "source": "champion_trend_worker",
        "confidence": "ai_generated",
        "auto_updated_at": now_iso,
        "source_summary": f"AI自動トレンド収集 ({now_iso[:10]})",
        "updated_at": now_iso,
        "migrated_from_sentinel": True,
    }
    try:
        facts_url = f"{supabase_url}/rest/v1/champion_facts?on_conflict=champion"
        facts_headers = headers.copy()
        facts_headers["Prefer"] = "resolution=merge-duplicates"
        facts_res = httpx.post(facts_url, headers=facts_headers, json=facts_payload, timeout=15)
        if facts_res.status_code in (200, 201, 204):
            logger.info(f"✅ [{champion}] champion_facts (SSOT) も更新しました")
        else:
            logger.warning(f"⚠️ [{champion}] champion_facts upsert失敗 (sentinel側は成功): {facts_res.status_code} - {facts_res.text}")
    except Exception as fe:
        logger.warning(f"⚠️ [{champion}] champion_facts 書き込み例外 (sentinel側は成功): {fe}")

    return True


def main():
    if len(sys.argv) < 3:
        logger.error("Usage: python champion_trend_worker.py <champion> <role>")
        sys.exit(1)

    champion = sys.argv[1]
    role = sys.argv[2]
    success = collect_and_save_champion_trend(champion, role)

    # exit codeはchampion_facts/matchup_sentinelが実際に更新されたかどうかを正確に反映する
    # 必要がある(ポータルの個別更新ボタンはstatus==='completed'を見た瞬間に「更新しました！」と
    # 表示するため、クォータ枯渇でexit 0にすると何も更新していないのに成功したと嘘をつくことに
    # なる)。exit codeはsuccessのみで判定し、変えない。一方でクォータ枯渇による安全スキップは
    # バグによる異常終了ではなく想定内の一時停止であり、ここではその区別をメッセージ文言だけに
    # 反映する(区別自体はedge_worker_daemon.py側の_run_subprocess_taskがこのJSONの"message"を
    # 拾ってエラーメッセージを分かりやすくする、2026-08-10)。
    # 判定にはquota_manager.check_quota("oracle")(1日の合計上限)ではなく_quota_hit_this_run
    # (このチャンピオン1体の呼び出し中に実際に429/RESOURCE_EXHAUSTEDの兆候が出たか)を使う。
    # 前者は分単位レート制限だけで失敗したケース(1日全体としてはまだ余裕がある)を検知できず、
    # 「Skipped」と表示すべきなのに「Failed」という不正確な見出しになっていた(2026-08-10発覚)。
    is_quota_skip = (not success) and _quota_hit_this_run

    print(json.dumps({
        "success": success,
        "skipped": is_quota_skip,
        "message": (
            f"Updated {normalize_champion_id(champion)} trend" if success
            else f"Skipped {normalize_champion_id(champion)} trend (quota exhausted, existing data preserved)" if is_quota_skip
            else f"Failed to update {normalize_champion_id(champion)} trend"
        ),
    }))
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
