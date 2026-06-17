import os
import json
import time
import logging
import subprocess
import platform
from v2_CORE.settings import settings
from v2_CORE._LOL.herald import herald

logger = logging.getLogger("YouTubeCrawler")

class YouTubeCrawler:
    def __init__(self):
        self.queue_file = os.path.join(settings.ROOT_DIR, "02_FACTORY", "kirei_queue.json")
        if platform.system() == "Windows":
            self.yt_dlp = str(settings.ROOT_DIR / ".venv" / "Scripts" / "yt-dlp.exe")
        else:
            self.yt_dlp = "yt-dlp"
        self.target_url = "https://www.youtube.com/@KireiLoL"

    def _load_queue(self):
        if not os.path.exists(self.queue_file):
            return []
        with open(self.queue_file, "r", encoding="utf-8") as f:
            return json.load(f)
            
    def _save_queue(self, q):
        with open(self.queue_file, "w", encoding="utf-8") as f:
            json.dump(q, f, ensure_ascii=False, indent=4)

    def fetch_latest_videos(self):
        logger.info(f"Fetching videos from {self.target_url}...")
        cmd = [
            self.yt_dlp,
            "--flat-playlist",
            "--dump-json",
            self.target_url
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        except subprocess.CalledProcessError as e:
            logger.error(f"yt-dlp error: {e.stderr}")
            return []

        videos = []
        for line in result.stdout.strip().split('\n'):
            if not line:
                continue
            try:
                data = json.loads(line)
                v_id = data.get("id")
                title = data.get("title", "")
                url = data.get("url")
                if not url and v_id:
                    url = f"https://www.youtube.com/watch?v={v_id}"
                
                # Exclude shorts if they are mixed in, though KireiLoL might not have many
                # Usually shorts don't have standard "watch" URLs but yt-dlp normalizes them
                if v_id and url:
                    videos.append({
                        "id": v_id,
                        "title": title,
                        "url": url
                    })
            except Exception as e:
                logger.error(f"Failed to parse JSON line: {e}")
                
        return videos

    def update_queue(self):
        queue = self._load_queue()
        existing_ids = {item["id"] for item in queue}
        
        latest_videos = self.fetch_latest_videos()
        if not latest_videos:
            logger.warning("No videos found or failed to fetch.")
            return

        new_videos = []
        for v in latest_videos:
            if v["id"] not in existing_ids:
                new_videos.append({
                    "id": v["id"],
                    "title": v["title"],
                    "url": v["url"],
                    "status": "pending",
                    "date_added": int(time.time())
                })
        
        if new_videos:
            logger.info(f"Found {len(new_videos)} new videos! Adding to queue.")
            # 最新の動画をキューの先頭（または末尾）に追加。とりあえず末尾に追加
            queue.extend(new_videos)
            self._save_queue(queue)
            herald.notify_progress(f"📡 **【YouTube Crawler】** KireiLoLの新着動画を **{len(new_videos)}件** 発見し、解析キューに追加しました！")
        else:
            logger.info("No new videos found. Queue is up to date.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    crawler = YouTubeCrawler()
    crawler.update_queue()
