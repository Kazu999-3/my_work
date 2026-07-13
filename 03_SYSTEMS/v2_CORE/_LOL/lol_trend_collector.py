import os
import sys
import json
import time
import logging
import subprocess
import urllib.request
import urllib.error
from google import genai
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_with_routing, generate_content_safe
from v2_CORE.logger_config import setup_sovereign_logging

logger = setup_sovereign_logging("LolTrendCollector")

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
              "description": "このビルドの特徴や狙いに関する短い日本語の解説（1文。AI臭い比喩は禁止し、'バースト重視'や'序盤のトレード強化'など簡潔に）"
            }}
          ]
        }}
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
        matchup_id = f"champ_{champion.lower()}_global"
        
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
        
        payload = {
            "matchup_id": matchup_id,
            "champion": champion,
            "enemy": "GLOBAL",
            "title": title,
            "strategy": strategy,
            "raw_data": raw_data
        }
        
        # 3. upsertを実行
        headers = {"Prefer": "resolution=merge-duplicates"}
        status, res_body = self._supabase_request("matchup_sentinel?on_conflict=matchup_id", method='POST', payload=payload, headers=headers)
        
        if status in (200, 201, 204):
            logger.info(f"✅ Supabase matchup_sentinel to {matchup_id} upsert success.")
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
