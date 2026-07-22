import os
import sys
import re
import platform
import json
import time
import logging
import subprocess
import argparse
from pathlib import Path
from datetime import datetime, timezone
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
import dotenv

try:
    from v2_CORE.settings import settings
    from v2_CORE._LOL.herald import herald
except ImportError:
    sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
    from v2_CORE.settings import settings
    from v2_CORE._LOL.herald import herald

dotenv.load_dotenv(Path("d:/my_work/.env"))

# ログ設定
os.makedirs("d:/my_work/00_LOGS", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [YTMonitor] %(levelname)s: %(message)s",
    handlers=[
        logging.FileHandler("d:/my_work/00_LOGS/youtube_monitor_run.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("YTMonitor")

import shutil

yt_bin = shutil.which("yt-dlp") or shutil.which("yt-dlp.exe") or str(settings.ROOT_DIR / ".venv" / "Scripts" / "yt-dlp.exe")
if not os.path.exists(yt_bin) and not shutil.which(yt_bin):
    YT_DLP_CMD = [sys.executable, "-m", "yt_dlp"]
else:
    YT_DLP_CMD = [yt_bin]

def _supabase_request(path, method='GET', payload=None):
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        logger.error("Supabase URL or Key is not configured.")
        return None, "Not configured"
        
    url = f"{settings.SUPABASE_URL}/rest/v1/{path}"
    data = None
    if payload is not None:
        data = json.dumps(payload).encode('utf-8')
        
    headers = {
        'apikey': settings.SUPABASE_KEY,
        'Authorization': f'Bearer {settings.SUPABASE_KEY}',
        'Content-Type': 'application/json'
    }
    
    req = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method=method
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read().decode('utf-8')
            return r.status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        logger.error(f"Supabase HTTP Error {e.code}: {body}")
        return e.code, body
    except Exception as e:
        logger.error(f"Supabase request failed: {e}")
        return None, str(e)

# ============================================================
# チャンネル解決機能 (yt-dlp を使用)
# ============================================================
def resolve_and_register_channel(channel_url: str) -> bool:
    logger.info(f"🔍 チャンネルURLの解決を試行中: {channel_url}")
    try:
        # yt-dlp で channel_id と channel 名を取得する
        # 出力をJSONでパースしやすくするために --dump-json オプション等を使うことも可能だが、
        # --print オプションで改行区切りで取るのが最もシンプル
        cmd = YT_DLP_CMD + [
            "--extractor-args", "youtube:client=android",
            "--playlist-items", "1", # 1番目の動画情報を取得（チャンネル解決が安定する）
            "--print", "%(channel_id)s\n%(channel)s",
            channel_url
        ]
        
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
        if res.returncode != 0:
            logger.error(f"yt-dlp resolution failed: {res.stderr}")
            return False
            
        lines = [line.strip() for line in res.stdout.strip().split('\n') if line.strip()]
        channel_id = None
        channel_name = None
        
        for idx, line in enumerate(lines):
            if line.startswith("UC") and len(line) >= 20: # UCで始まるチャンネルID
                channel_id = line
                if idx + 1 < len(lines):
                    channel_name = lines[idx + 1]
                break
                
        if not channel_id or not channel_name:
            logger.error(f"Unexpected yt-dlp output lines: {lines}")
            return False
            
        # ハンドル名の抽出 (例: @KireiLoL)
        handle = None
        handle_match = re.search(r'(@[a-zA-Z0-9_\-\.]+)', channel_url)
        if handle_match:
            handle = handle_match.group(1)
            
        logger.info(f"✨ チャンネル解決成功: {channel_name} (ID: {channel_id}, Handle: {handle})")
        
        # Supabase へ登録
        payload = {
            "id": channel_id,
            "name": channel_name,
            "handle": handle,
            "active": True,
            "last_fetched_at": None
        }
        
        # upsert (on_conflict)
        status, body = _supabase_request(f"youtube_channels?on_conflict=id", method='POST', payload=payload)
        if status in (200, 201, 204):
            logger.info(f"✅ Supabase にチャンネルを登録しました: {channel_name}")
            herald.notify_progress(f"📺 **【チャンネル監視登録】** {channel_name} が新しく自動監視リストに追加されました！", portal_link=True, page="youtube")
            return True
        else:
            logger.error(f"Failed to upsert channel in Supabase: {status} - {body}")
            return False
            
    except Exception as e:
        logger.error(f"Error resolving channel: {e}")
        return False

# ============================================================
# プレイリスト解決機能 (yt-dlp を使用)
# ============================================================
def resolve_and_register_playlist(playlist_url: str) -> bool:
    logger.info(f"🔍 プレイリストURLの解決を試行中: {playlist_url}")
    try:
        # プレイリストIDの抽出
        pl_id_match = re.search(r"[?&]list=([a-zA-Z0-9_\-]+)", playlist_url)
        if not pl_id_match:
            logger.error(f"Invalid playlist URL: {playlist_url}")
            return False
        playlist_id = pl_id_match.group(1)
        
        # yt-dlp を使ってプレイリストのタイトルを取得
        cmd = YT_DLP_CMD + [
            "--extractor-args", "youtube:client=android",
            "--playlist-items", "1",
            "--print", "playlist_title",
            playlist_url
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
        if res.returncode != 0:
            logger.error(f"yt-dlp resolution failed: {res.stderr}")
            return False
            
        playlist_title = res.stdout.strip()
        if not playlist_title:
            playlist_title = f"Playlist {playlist_id}"
            
        logger.info(f"✨ プレイリスト解決成功: {playlist_title} (ID: {playlist_id})")
        
        payload = {
            "id": playlist_id,
            "name": playlist_title,
            "url": playlist_url,
            "active": True,
            "last_fetched_at": None
        }
        
        status, body = _supabase_request(f"youtube_playlists?on_conflict=id", method='POST', payload=payload)
        if status in (200, 201, 204):
            logger.info(f"✅ Supabase にプレイリストを登録しました: {playlist_title}")
            herald.notify_progress(f"📺 **【プレイリスト監視登録】** {playlist_title} が新しく自動監視リストに追加されました！", portal_link=True, page="youtube")
            return True
        else:
            logger.error(f"Failed to upsert playlist in Supabase: {status} - {body}")
            return False
    except Exception as e:
        logger.error(f"Error resolving playlist: {e}")
        return False

# ============================================================
# 新着動画監視機能 (RSSフィードを使用)
# ============================================================
def parse_youtube_rss(xml_content: str) -> list:
    namespaces = {
        'atom': 'http://www.w3.org/2005/Atom',
        'yt': 'http://www.youtube.com/xml/schemas/2015'
    }
    try:
        root = ET.fromstring(xml_content)
        entries = []
        for entry in root.findall('atom:entry', namespaces):
            video_id_el = entry.find('yt:videoId', namespaces)
            video_id = video_id_el.text if video_id_el is not None else None
            
            if not video_id:
                id_el = entry.find('atom:id', namespaces)
                if id_el is not None and id_el.text.startswith('yt:video:'):
                    video_id = id_el.text.replace('yt:video:', '')
                    
            title_el = entry.find('atom:title', namespaces)
            title = title_el.text if title_el is not None else ""
            
            published_el = entry.find('atom:published', namespaces)
            published = published_el.text if published_el is not None else ""
            
            if video_id:
                entries.append({
                    'video_id': video_id,
                    'title': title,
                    'published': published,
                    'url': f"https://www.youtube.com/watch?v={video_id}"
                })
        return entries
    except Exception as e:
        logger.error(f"Failed to parse RSS XML: {e}")
        return []

def monitor_channels():
    logger.info("⚡ 登録チャンネルの新着動画スキャンを開始します...")
    
    # 1. 監視対象のチャンネルリストを取得
    status, body = _supabase_request("youtube_channels?active=eq.true", method='GET')
    if status != 200:
        logger.error(f"Failed to fetch active channels from Supabase: {status}")
        return
        
    channels = json.loads(body)
    logger.info(f"監視対象チャンネル数: {len(channels)} 件")
    
    if not channels:
        return

    new_videos_found = 0

    for ch in channels:
        ch_id = ch["id"]
        ch_name = ch["name"]
        logger.info(f"📡 チャンネル巡回中: {ch_name} (ID: {ch_id})")
        
        rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={ch_id}"
        
        try:
            req = urllib.request.Request(rss_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as r:
                xml_content = r.read().decode('utf-8')
                
            videos = parse_youtube_rss(xml_content)
            logger.info(f"  RSSフィードから {len(videos)} 件の最新動画を取得しました。")
            
            if not videos:
                continue
                
            # 各動画がすでに queue に存在するかチェック
            for v in videos:
                video_id = v["video_id"]
                title = v["title"]
                url = v["url"]
                
                # youtube_queue に登録済みか調べる
                check_status, check_body = _supabase_request(f"youtube_queue?id=eq.{video_id}&select=id", method='GET')
                if check_status == 200:
                    records = json.loads(check_body)
                    if records:
                        # 登録済みの場合はスキップ
                        continue
                
                # 未登録の場合は pending で追加
                logger.info(f"  🆕 新着動画を検出しました: {title} ({video_id})")
                payload = {
                    "id": video_id,
                    "title": title,
                    "url": url,
                    "status": "pending",
                    "channel_name": ch_name,
                    "retry_count": 0,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "duration_sec": None
                }
                
                post_status, post_body = _supabase_request("youtube_queue", method='POST', payload=payload)
                if post_status in (200, 201, 204):
                    logger.info(f"    ✅ キューに追加完了: {title}")
                    new_videos_found += 1
                else:
                    logger.error(f"    ❌ キュー追加失敗: {post_status} - {post_body}")
            
            # チャンネルの last_fetched_at を更新
            _supabase_request(
                f"youtube_channels?id=eq.{ch_id}",
                method='PATCH',
                payload={"last_fetched_at": datetime.now(timezone.utc).isoformat()}
            )
            
        except Exception as e:
            logger.error(f"Error monitoring channel {ch_name}: {e}")
            
        time.sleep(2)  # チャンネル間の連続リクエストを抑える

    logger.info(f"🎉 チャンネルスキャン完了。新規動画 {new_videos_found} 件を追加しました。")
    if new_videos_found > 0:
        herald.notify_progress(f"📺 **【自動動画解析】** 監視チャンネルから新しく {new_videos_found} 本の動画を検知し、解析キューに追加しました！", portal_link=True, page="youtube")

# ============================================================
# プレイリスト動画監視機能 (yt-dlp を使用)
# ============================================================
def monitor_playlists():
    logger.info("⚡ 登録プレイリストの新着動画スキャンを開始します...")
    
    status, body = _supabase_request("youtube_playlists?active=eq.true", method='GET')
    if status != 200:
        logger.error(f"Failed to fetch active playlists from Supabase: {status}")
        return
        
    playlists = json.loads(body)
    logger.info(f"監視対象プレイリスト数: {len(playlists)} 件")
    
    if not playlists:
        return

    new_videos_found = 0

    for pl in playlists:
        pl_id = pl["id"]
        pl_name = pl["name"]
        pl_url = pl["url"]
        logger.info(f"📡 プレイリスト巡回中: {pl_name} (ID: {pl_id})")
        
        try:
            cmd = YT_DLP_CMD + [
                "--extractor-args", "youtube:client=android",
                "--flat-playlist",
                "--dump-json",
                pl_url
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
            if res.returncode != 0:
                logger.error(f"yt-dlp failed to fetch playlist {pl_name}: {res.stderr}")
                continue
                
            videos = []
            for line in res.stdout.strip().split('\n'):
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    v_id = data.get("id")
                    title = data.get("title", "")
                    if v_id:
                        videos.append({
                            "video_id": v_id,
                            "title": title,
                            "url": f"https://www.youtube.com/watch?v={v_id}"
                        })
                except Exception as e:
                    logger.error(f"Failed to parse playlist JSON line: {e}")
                    
            logger.info(f"  プレイリストから {len(videos)} 件の動画を取得しました。")
            
            if not videos:
                continue
                
            for v in videos:
                video_id = v["video_id"]
                title = v["title"]
                url = v["url"]
                
                check_status, check_body = _supabase_request(f"youtube_queue?id=eq.{video_id}&select=id", method='GET')
                if check_status == 200:
                    records = json.loads(check_body)
                    if records:
                        continue
                
                logger.info(f"  🆕 新着動画を検出しました: {title} ({video_id})")
                payload = {
                    "id": video_id,
                    "title": title,
                    "url": url,
                    "status": "pending",
                    "channel_name": f"[PL] {pl_name}",
                    "retry_count": 0,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "duration_sec": None
                }
                post_status, post_body = _supabase_request("youtube_queue", method='POST', payload=payload)
                if post_status in (200, 201, 204):
                    logger.info(f"    ✅ キューに追加完了: {title}")
                    new_videos_found += 1
                else:
                    logger.error(f"    ❌ キュー追加失敗: {post_status} - {post_body}")
            
            _supabase_request(
                f"youtube_playlists?id=eq.{pl_id}",
                method='PATCH',
                payload={"last_fetched_at": datetime.now(timezone.utc).isoformat()}
            )
            
        except Exception as e:
            logger.error(f"Error monitoring playlist {pl_name}: {e}")
            
        time.sleep(2)

    logger.info(f"🎉 プレイリストスキャン完了。新規動画 {new_videos_found} 件を追加しました。")
    if new_videos_found > 0:
        herald.notify_progress(f"📺 **【自動動画解析】** 監視プレイリストから新しく {new_videos_found} 本の動画を検知し、解析キューに追加しました！", portal_link=True, page="youtube")

# ============================================================
# メインエントリーポイント
# ============================================================
if __name__ == "__main__":
    import re
    # 簡易 handle 抽出用のインポート
    parser = argparse.ArgumentParser(description="YouTube Channel & Playlist Monitor")
    parser.add_argument("--resolve", type=str, help="Resolve YouTube channel URL and register it to Supabase")
    parser.add_argument("--resolve-playlist", type=str, help="Resolve YouTube playlist URL and register it to Supabase")
    parser.add_argument("--monitor", action="store_true", help="Monitor registered channels and playlists to pull new videos")
    
    args = parser.parse_args()
    
    if args.resolve:
        success = resolve_and_register_channel(args.resolve)
        sys.exit(0 if success else 1)
    elif args.resolve_playlist:
        success = resolve_and_register_playlist(args.resolve_playlist)
        sys.exit(0 if success else 1)
    elif args.monitor:
        monitor_channels()
        monitor_playlists()
        sys.exit(0)
    else:
        # 引数なしの場合は両方実行
        monitor_channels()
        monitor_playlists()

