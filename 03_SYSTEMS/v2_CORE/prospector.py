# ============================================================
# 【後継あり】この実装は使われていない。現役は scripts/prospector.py。
#
# 動画の自動発掘機能はクラウド(GitHub Actions)へ移行した。
#   → scripts/prospector.py
#   → .github/workflows/ktm-cloud-worker.yml の prospect ジョブ（毎日 3:30 JST）
#
# 旧実装(このファイル)を引き継がなかった理由:
#   - YouTubeの検索結果HTMLを正規表現で解析していたため、HTML構造が変わると
#     エラーにならず無言で0件になる。後継は yt-dlp の検索機能を使う
#   - 既に youtube_queue にある動画を弾く仕組みが無く、重複登録し得た
#   - 発掘したURLを返すだけで、キューに積む処理が繋がっていなかった
#   - 動画の尺を見ていないため、数十秒のクリップや数時間の配信アーカイブも拾った
#
# 参照用に残しているだけなので、現役のコードとして import しないこと。
# ============================================================
import logging
import requests
from bs4 import BeautifulSoup
from google import genai
from google.genai import types
from .settings import settings
import re

logger = logging.getLogger("Prospector")

class SovereignProspector:
    """
    Antigravity Sovereign OS v2.0: 探鉱者 (The Prospector)
    Web/YouTube から最新の攻略動画を自律的に発掘し、解析対象として選定する。
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = settings.DEFAULT_MODEL
        else:
            self.client = None

    def find_best_video(self, champion, patch):
        """チャンピオンとパッチに基づいて、YouTubeから最適な解説動画のURLを特定する"""
        BLACKLIST_VIDEOS = ['juYeqA61oPI'] # 解析に失敗し続ける、または不要な動画ID
        
        query = f"LoL {champion} patch {patch} guide kireiLOL challenger"
        logger.info(f"[Prospector] 動画を自律発掘中: {query}")
        
        # YouTube 検索結果の簡易スクレイピング
        search_url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
        headers = {"User-Agent": "Mozilla/5.0"}
        
        try:
            res = requests.get(search_url, headers=headers, timeout=15)
            # YouTube の HTML からビデオIDを抽出
            video_ids = re.findall(r"watch\?v=([a-zA-Z0-9_-]{11})", res.text)
            unique_ids = list(dict.fromkeys(video_ids))
            
            # ブラックリストと既読チェック
            valid_ids = [vid for vid in unique_ids if vid not in BLACKLIST_VIDEOS]
            
            if not valid_ids:
                logger.warning(f"[Prospector] 有効な動画が見つかりませんでした: {champion}")
                return None

            # 以前解析した動画もスキップしたいが、ここではまずブラックリストのみ適用
            best_id = valid_ids[0]
            best_url = f"https://www.youtube.com/watch?v={best_id}"
            logger.info(f"[Prospector] 最適な動画を発掘しました: {best_url}")
            return best_url

        except Exception as e:
            logger.error(f"[Prospector] 発掘中にエラー: {e}")
            return None

# インスタンス提供
prospector = SovereignProspector()

def get_prospector() -> SovereignProspector:
    return prospector
