import os
import sys
import json
import time
import logging
import subprocess
import urllib.request
import urllib.error
from datetime import datetime, timezone
from google import genai
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_with_routing, generate_content_safe
from v2_CORE.logger_config import setup_sovereign_logging
from v2_CORE.knowledge_revisions import record_matchup_sentinel_revision
from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id

logger = setup_sovereign_logging("LolTrendCollector")

# Geminiのgoogle_search groundingによる生成結果は、直接APIを叩くスクレイピングと違い
# ハルシネーションのリスクがある(実在しない値や範囲外の値を「それらしく」生成しうる)。
# 辞典(matchup_sentinel)へ書き込む前に軽く妥当性を検証し、異常値は捨てて既存値への
# フォールバックに任せる(2026-08-03追加)。
VALID_TIERS = {"S+", "S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "D+", "D-"}


def _sanitize_rate(value, field_name: str, champion: str):
    """0〜100%の範囲に収まる数値だけを通す。それ以外はNone(フォールバック)にする。"""
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        logger.warning(f"⚠️ [{champion}] {field_name}が数値ではありません({value!r})。破棄してフォールバックします。")
        return None
    if not (0 <= v <= 100):
        logger.warning(f"⚠️ [{champion}] {field_name}が異常値({v})です。破棄してフォールバックします。")
        return None
    return v


# ジャングルの1周目フルクリア/1コア/2コア購入タイミング。現実的な範囲外の値は
# ハルシネーションとみなして破棄する（フォールバックに任せる）。
_SECONDS_BOUNDS = {
    "full_clear_time_sec": (180, 900),    # 3分〜15分
    "first_core_timing_sec": (90, 600),   # 1分30秒〜10分
    "second_core_timing_sec": (180, 900), # 3分〜15分
}


def _sanitize_seconds(value, field_name: str, champion: str):
    """秒数として妥当な範囲(_SECONDS_BOUNDS)に収まる数値だけを通す。"""
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        logger.warning(f"⚠️ [{champion}] {field_name}が数値ではありません({value!r})。破棄してフォールバックします。")
        return None
    lo, hi = _SECONDS_BOUNDS[field_name]
    if not (lo <= v <= hi):
        logger.warning(f"⚠️ [{champion}] {field_name}が異常値({v}秒)です。破棄してフォールバックします。")
        return None
    return int(round(v))


def _sanitize_pro_builds(pro_builds, champion: str) -> list:
    """実在プロ選手に関する事実主張のため、根拠(source_hint)が無い/構造が壊れている
    項目は創作の疑いが強いとみなして丸ごと落とす(記事の「引用義務化」の考え方を適用)。"""
    if not isinstance(pro_builds, list):
        return []
    valid = []
    for entry in pro_builds:
        if not isinstance(entry, dict):
            continue
        player = str(entry.get("player") or "").strip()
        team = str(entry.get("team") or "").strip()
        build = entry.get("build")
        source_hint = str(entry.get("source_hint") or "").strip()
        if not player or not team or not isinstance(build, list) or not build:
            logger.warning(f"⚠️ [{champion}] pro_buildsの項目が不完全なため破棄します: {entry!r}")
            continue
        if not source_hint:
            logger.warning(f"⚠️ [{champion}] pro_builds({player})に根拠(source_hint)が無いため破棄します。")
            continue
        valid.append(entry)
    return valid


def sanitize_trend_data(trend_data: dict, champion: str) -> dict:
    """collect_champ_trends()の生成結果を辞典へ書き込む前に検証する。"""
    sanitized = dict(trend_data or {})
    for field in ("win_rate", "pick_rate", "ban_rate"):
        if field in sanitized:
            sanitized[field] = _sanitize_rate(sanitized.get(field), field, champion)

    tier = sanitized.get("tier")
    if tier and str(tier).strip().upper() not in VALID_TIERS:
        logger.warning(f"⚠️ [{champion}] tierが未知の値({tier!r})です。破棄してフォールバックします。")
        sanitized["tier"] = None

    if "pro_builds" in sanitized:
        sanitized["pro_builds"] = _sanitize_pro_builds(sanitized.get("pro_builds"), champion)

    jg_style = sanitized.get("jg_style")
    if isinstance(jg_style, dict):
        sanitized_jg_style = dict(jg_style)
        for field in _SECONDS_BOUNDS:
            if field in sanitized_jg_style:
                sanitized_jg_style[field] = _sanitize_seconds(sanitized_jg_style.get(field), field, champion)
        sanitized["jg_style"] = sanitized_jg_style

    return sanitized


class LolTrendCollector:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            
        if os.name == "nt":
            self.yt_dlp = str(settings.ROOT_DIR / ".venv" / "Scripts" / "yt-dlp.exe")
        else:
            self.yt_dlp = "yt-dlp"

    def _extract_json_block(self, text: str) -> str:
        """文字列内から最外郭の { } または [ ] を抽出して綺麗なJSONを返す"""
        if not text:
            return ""
        import re
        match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
        if match:
            return match.group(1)
        return text

    def _supabase_request(self, path, method='GET', payload=None, headers=None):
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            logger.error("Supabase URL or Key is not configured.")
            return None, "Not configured"
            
        url = f"{settings.SUPABASE_URL}/rest/v1/{path}"
        data = None
        if payload is not None:
            data = json.dumps(payload).encode('utf-8')
            
        req_headers = {
            'apikey': settings.SUPABASE_KEY,
            'Authorization': f'Bearer {settings.SUPABASE_KEY}',
            'Content-Type': 'application/json'
        }
        if headers:
            req_headers.update(headers)
            
        req = urllib.request.Request(
            url,
            data=data,
            headers=req_headers,
            method=method
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read().decode('utf-8')
                return r.status, body
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8')
            logger.error(f"Supabase HTTP Error {e.code}: {body}")
            return e.code, body
        except Exception as e:
            logger.error(f"Supabase request failed: {e}")
            return None, str(e)

    def is_video_in_queue(self, video_id):
        """動画がすでにキューに存在するかどうか確認する"""
        status, body = self._supabase_request(f"youtube_queue?id=eq.{video_id}&select=id", method='GET')
        if status in (200, 201):
            records = json.loads(body)
            return len(records) > 0
        return False

    def add_video_to_queue(self, video_data):
        """動画をSupabaseのキューに登録する"""
        status, body = self._supabase_request("youtube_queue", method='POST', payload=video_data)
        if status in (200, 201, 204):
            logger.info(f"Successfully added to queue: {video_data['title']} ({video_data['url']})")
            return True
        logger.error(f"Failed to add to queue: {status} - {body}")
        return False

    def detect_op_champions(self):
        """Web検索とGeminiを活用して、最新パッチのOP（強）チャンピオンを抽出する"""
        if not self.client:
            logger.error("Gemini Client is not initialized.")
            return []

        # 1. 最新パッチのOP情報を検索
        query = "LoL latest patch jungle tier list best champions"
        logger.info(f"Searching web for: {query}")
        
        try:
            # Google GenAI に google_search を有効にして質問することで、Web検索をモデル内で行わせます。
            prompt = """
            League of Legendsの最新パッチ（現時点）における、ジャングル（Jungle）またはトップ（Top）レーンで
            非常に強力（勝率やティアが高い、OPとされる）なチャンピオンを3体挙げてください。
            以下のJSONフォーマットのみで出力してください（他のテキストは一切含めないでください）。
            
            [
              {"champion": "Shyvana", "role": "Jungle"},
              {"champion": "Nidalee", "role": "Jungle"},
              ...
            ]
            """
            config = {
                "tools": [{"google_search": {}}]
            }
            text = generate_content_safe(
                self.client,
                prompt,
                config=config,
                feature_name="lol_trend"
            )
            
            text = self._extract_json_block(text)
            champions = json.loads(text)
            logger.info(f"Detected OP Champions: {champions}")
            return champions
        except Exception as e:
            logger.error(f"Failed to detect OP champions via Gemini Search: {e}")
            # エラー時のフォールバック（定番の強チャンピオン）
            return [
                {"champion": "Shyvana", "role": "Jungle"},
                {"champion": "Nidalee", "role": "Jungle"},
                {"champion": "Brand", "role": "Jungle"}
            ]

    def search_youtube_videos(self, champion, role, limit=2):
        """yt-dlp を使って、対象チャンピオンの最新Challenger/Master解説動画を検索する"""
        # 検索クエリ
        search_query = f"ytsearch{limit}:{champion} {role} guide challenger season 14"
        logger.info(f"Searching YouTube for: '{search_query}'")
        
        cmd = [
            self.yt_dlp,
            search_query,
            "--dump-json",
            "--flat-playlist",
            "--no-warnings"
        ]
        
        try:
            res = subprocess.run(cmd, capture_output=True, timeout=30)
            
            # 安全にデコードを実行（例外クラッシュの防止）
            stdout_str = res.stdout.decode("utf-8", errors="replace")
            stderr_str = res.stderr.decode("utf-8", errors="replace")
            
            if res.returncode != 0:
                logger.error(f"yt-dlp search failed: {stderr_str}")
                return []
                
            videos = []
            for line in stdout_str.strip().split('\n'):
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    video_id = data.get("id")
                    title = data.get("title")
                    channel = data.get("uploader") or data.get("channel", "Unknown")
                    if video_id and title:
                        videos.append({
                            "id": video_id,
                            "title": title,
                            "channel_name": channel,
                            "url": f"https://www.youtube.com/watch?v={video_id}",
                            "status": "pending",
                            "priority": "high",
                            "date_added": int(time.time())
                        })
                except Exception as je:
                    logger.warning(f"Failed to parse yt-dlp json line: {je}")
            return videos
        except Exception as e:
            logger.error(f"Error searching YouTube for {champion}: {e}")
            return []

    def run_collector(self):
        logger.info("🚀 Starting LoL Trend Collector...")
        champions = self.detect_op_champions()
        
        added_count = 0
        for champ_data in champions:
            champ = champ_data.get("champion")
            role = champ_data.get("role", "Jungle")
            if not champ:
                continue
                
            logger.info(f"🔍 Processing trend: {champ} ({role})")
            videos = self.search_youtube_videos(champ, role, limit=2)
            
            for v in videos:
                video_id = v["id"]
                if self.is_video_in_queue(video_id):
                    logger.info(f"⏭️ Video {video_id} already exists in queue. Skipping.")
                    continue
                    
                success = self.add_video_to_queue(v)
                if success:
                    added_count += 1
                    
        logger.info(f"✅ LoL Trend Collector finished. Added {added_count} new videos to the queue.")
        return added_count

    def collect_champ_trends(self, champion: str, role: str) -> dict:
        """指定したチャンピオンとロールの最新パッチトレンドおよびプロビルド情報を収集し、DBに保存する"""
        if not self.client:
            logger.error("Gemini Client is not initialized.")
            return {}

        logger.info(f"🔍 Collecting trends and pro builds for {champion} ({role})...")
        
        prompt = f"""
        League of Legendsの最新パッチにおける、チャンピオン「{champion}」のロール「{role}」の統計データおよびプロプレイヤーの最新ビルド情報をリサーチしてください。
        
        以下のJSONフォーマットのみで出力してください（マークダウンの```jsonや、余計な説明文は一切含めないでください。純粋なJSONオブジェクトのみを出力してください）。
        
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
              "description": "このビルドの特徴や狙いに関する短い日本語の解説（1文。AI臭い比喩は禁止し、'バースト重視'や'序盤のトレード強化'など簡潔に）",
              "source_hint": "検索で実際に確認した根拠(大会名/対戦カード/おおよその時期など)。1つも確認できない場合はそのpro_builds項目自体を出力しないこと"
            }}
          ]
        }}

        【pro_buildsに関する重要な注意】
        実在するプロ選手名を扱うため、検索結果で実際に裏付けが取れたものだけを記載すること。
        該当する情報が検索で見つからない場合は、それらしい選手名やビルドを創作せず、pro_buildsを空配列 [] にすること。
        """

        config = {
            "tools": [{"google_search": {}}]
        }
        
        try:
            text = generate_content_safe(
                self.client,
                prompt,
                config=config,
                feature_name="champ_trends",
                sleep_on_rate_limit=False
            )
            
            # デバッグ: 生レスポンスを記録（問題発生時の原因特定用）
            logger.debug(f"Gemini raw response for {champion} (first 300 chars): {repr(text[:300])}")

            if text.startswith("⚠️") or text.startswith("❌"):
                raise Exception(text)

            text = self._extract_json_block(text)
            
            # 空レスポンスのガード: JSON抽出後に中身が空の場合を防ぐ
            if not text:
                raise Exception(f"Gemini APIの応答から有効なJSONを抽出できませんでした（{champion}）。")
            
            data = json.loads(text)
            logger.info(f"Successfully collected trend data for {champion}: win_rate={data.get('win_rate')}%")
            return data
        except Exception as e:
            logger.error(f"❌ Failed to collect trends via Gemini: {e}")
            raise e

    def save_champ_trends(self, champion: str, role: str, trend_data: dict) -> bool:
        """収集したトレンド・プロビルドデータをSupabaseのmatchup_sentinel（GLOBALレコード）にマージする"""
        # 他の全書き込み経路と同じ正規化済みIDで matchup_id を作る
        # （表記ゆれ・大文字小文字違いがあると別レコードとして重複作成されてしまう）
        champion = normalize_champion_id(champion)
        matchup_id = f"champ_{champion}_global"

        # Gemini(google_search grounding)によるハルシネーション対策: 異常値を捨てる
        trend_data = sanitize_trend_data(trend_data, champion)
        
        # 1. 既存のレコードを取得
        status, body = self._supabase_request(f"matchup_sentinel?matchup_id=eq.{matchup_id}", method='GET')
        
        existing_record = None
        if status in (200, 201) and body:
            records = json.loads(body)
            if records:
                existing_record = records[0]
                
        # 2. raw_dataをマージ
        raw_data = {}
        strategy = ""
        title = f"{champion} 基本戦略・トレンド"
        
        if existing_record:
            raw_data = existing_record.get("raw_data", {}) or {}
            strategy = existing_record.get("strategy") or ""
            title = existing_record.get("title") or title
            
        # raw_data 内のメタデータを更新
        # AI応答が一部フィールドを欠くことがあるため、既存値をフォールバックにして
        # 取れなかったフィールドで前回値を消さないようにする(#⑤ 他の書き込み経路と同じ修正)
        existing_patch_meta = raw_data.get("patch_meta") if isinstance(raw_data.get("patch_meta"), dict) else {}
        raw_data["patch_meta"] = {
            "win_rate": trend_data.get("win_rate") if trend_data.get("win_rate") is not None else existing_patch_meta.get("win_rate"),
            "pick_rate": trend_data.get("pick_rate") if trend_data.get("pick_rate") is not None else existing_patch_meta.get("pick_rate"),
            "ban_rate": trend_data.get("ban_rate") if trend_data.get("ban_rate") is not None else existing_patch_meta.get("ban_rate"),
            "tier": trend_data.get("tier") or existing_patch_meta.get("tier"),
            "trend_items": trend_data.get("trend_items") or existing_patch_meta.get("trend_items", []),
            "trend_runes": trend_data.get("trend_runes") or existing_patch_meta.get("trend_runes", {}),
            "patch": trend_data.get("patch") or existing_patch_meta.get("patch"),
            "updated_at": int(time.time())
        }
        raw_data["pro_builds"] = trend_data.get("pro_builds") or raw_data.get("pro_builds", [])
        
        # 辞典一覧の「更新日」は created_at を見ているため、更新時も明示的に現在時刻を入れる
        payload = {
            "matchup_id": matchup_id,
            "champion": champion,
            "enemy": "GLOBAL",
            "title": title,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "strategy": strategy,
            "raw_data": raw_data
        }

        # 3. upsertを実行
        headers = {"Prefer": "resolution=merge-duplicates"}
        status, res_body = self._supabase_request("matchup_sentinel?on_conflict=matchup_id", method='POST', payload=payload, headers=headers)
        
        if status in (200, 201, 204):
            logger.info(f"✅ Supabase matchup_sentinel to {matchup_id} upsert success.")
            record_matchup_sentinel_revision(
                matchup_id, existing_record, payload,
                source_title="最新パッチトレンド＆プロビルド収集（AI自動収集）",
                supabase_url=settings.SUPABASE_URL, supabase_key=settings.SUPABASE_KEY
            )
            return True
        else:
            logger.error(f"❌ Failed to upsert matchup_sentinel: {status} - {res_body}")
            return False

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="LoL Trend & Pro Build Collector")
    parser.add_argument("--champion", type=str, help="Champion name (e.g. Nidalee)")
    parser.add_argument("--role", type=str, default="Jungle", help="Role (e.g. Jungle, Top, Mid, ADC, Support)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    collector = LolTrendCollector()

    if args.champion:
        trend = collector.collect_champ_trends(args.champion, args.role)
        if trend:
            success = collector.save_champ_trends(args.champion, args.role, trend)
            if success:
                print(json.dumps({"success": True, "message": f"Successfully updated trend for {args.champion}"}))
                sys.exit(0)
            else:
                print(json.dumps({"success": False, "message": "Failed to save trend to Supabase"}))
                sys.exit(1)
        else:
            print(json.dumps({"success": False, "message": "Failed to collect trend data from Gemini"}))
            sys.exit(1)
    else:
        collector.run_collector()
