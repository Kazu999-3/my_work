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
from v2_CORE.ai_helper import generate_with_routing
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
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=config
            )
            
            text = response.text.strip()
            text = text.replace("```json", "").replace("```", "").strip()
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
            res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=30)
            if res.returncode != 0:
                logger.error(f"yt-dlp search failed: {res.stderr}")
                return []
                
            videos = []
            for line in res.stdout.strip().split('\n'):
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

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    collector = LolTrendCollector()
    collector.run_collector()
