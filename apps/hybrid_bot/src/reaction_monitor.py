import os
import json
import time
from datetime import datetime, timedelta
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# .envファイルの読み込み
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

try:
    from . import gemini_analyzer
except ImportError:
    import gemini_analyzer

# 分析ログの保存先
LOG_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'knowledge', 'analytics')
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

class ReactionMonitor:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

    def fetch_note_metrics(self, url):
        """noteのスキ数・ビュー数（公開分）を取得"""
        try:
            res = requests.get(url, headers=self.headers, timeout=10)
            if res.status_code == 200:
                soup = BeautifulSoup(res.text, 'html.parser')
                # スキ数取得 (noteの構造に依存するため、複数のセレクタを試行)
                like_tag = soup.select_one('.o-noteAction__item--like .m-noteAction__label')
                likes = int(like_tag.get_text()) if like_tag and like_tag.get_text().isdigit() else 0
                
                # ビュー数は通常公開されていないため、スキ数を主要指標とする
                return {"likes": likes, "url": url, "platform": "note", "timestamp": datetime.now().isoformat()}
        except Exception as e:
            print(f"Error fetching note metrics: {e}")
        return None

    def fetch_x_metrics(self, url):
        """Xのインプレッション・いいね・リポストをVxtwitter API経由で取得"""
        try:
            api_url = url.replace("twitter.com", "api.vxtwitter.com").replace("x.com", "api.vxtwitter.com")
            res = requests.get(api_url, headers=self.headers, timeout=10)
            if res.status_code == 200:
                data = res.json()
                return {
                    "likes": data.get("likes", 0),
                    "retweets": data.get("retweets", 0),
                    "replies": data.get("replies", 0),
                    "url": url,
                    "platform": "x",
                    "timestamp": datetime.now().isoformat()
                }
        except Exception as e:
            print(f"Error fetching X metrics: {e}")
        return None

    def run_daily_analysis(self, urls):
        """リスト内の全URLの反応を確認し、分析レポートを作成"""
        results = []
        for url in urls:
            if "note.com" in url:
                metrics = self.fetch_note_metrics(url)
            elif "x.com" in url or "twitter.com" in url:
                metrics = self.fetch_x_metrics(url)
            else:
                continue
            
            if metrics:
                results.append(metrics)
        
        # ログ保存
        date_str = datetime.now().strftime("%Y%m%d")
        log_file = os.path.join(LOG_DIR, f"analytics_{date_str}.json")
        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
            
        return results

if __name__ == "__main__":
    monitor = ReactionMonitor()
    test_urls = [
        "https://x.com/JggapggLol"
    ]
    print(monitor.run_daily_analysis(test_urls))
