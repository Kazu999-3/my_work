import sys
import logging
import time
import subprocess
import json
import os
from pathlib import Path

# v2_CORE のパスを通す
sys.path.append(str(Path(__file__).resolve().parent))
from v2_CORE.gas_gateway import gas_gateway
from v2_CORE.herald import herald
from v2_CORE.settings import settings
from ole_youtube_analyzer import OLEAnalyzerV3

# ロギング設定
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("PlaylistWatcher")

# PIDファイルのパス
PID_FILE = Path("d:/my_work/scratch/youtube_playlist_watcher.pid")

def check_single_instance():
    """PIDファイルを使用して二重起動を防止する"""
    if PID_FILE.exists():
        try:
            pid = int(PID_FILE.read_text())
            # プロセスが存在するか確認 (Windows)
            subprocess.run(["taskkill", "/0", "/PID", str(pid)], capture_output=True, check=True)
            logger.error(f"❌ 既に別のインスタンス (PID: {pid}) が実行されています。終了します。")
            sys.exit(1)
        except (ValueError, subprocess.CalledProcessError):
            # PIDファイルが古い、またはプロセスが存在しない場合は無視して上書き
            pass
    
    PID_FILE.write_text(str(os.getpid()))

def detect_mode(title: str, description: str) -> str:
    """タイトルや説明文から解析モードを自動判定する"""
    safe_title = title or ""
    safe_description = description or ""
    text = (safe_title + " " + safe_description).lower()
    lol_keywords = ["lol", "league of legends", "nautilus", "nidalee", "jungle", "meta", "build", "challenger", "rank", "guide", "fullclearing", "coaching", "kr", "matchup", "jgl"]
    if any(k in text for k in lol_keywords):
        return "TACTICAL"
    content_keywords = ["note", "マーケティング", "ライティング", "執筆", "副業", "収益", "コンテンツ", "記事", "SNS"]
    if any(k in text for k in content_keywords):
        return "CONTENT"
    return "STUDY"

def get_tasks_via_ytdlp(playlist_id: str):
    """yt-dlp を使用してプレイリストから動画一覧を取得する (GASの代替)"""
    url = f"https://www.youtube.com/playlist?list={playlist_id}"
    cmd = [
        str(settings.ROOT_DIR / ".venv/Scripts/python.exe"), "-m", "yt_dlp", 
        "--flat-playlist", "--dump-json", 
        url
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        tasks = []
        for line in result.stdout.splitlines():
            if not line.strip(): continue
            video_data = json.loads(line)
            tasks.append({
                "videoId": video_data.get("id"),
                "title": video_data.get("title"),
                "description": video_data.get("description", ""),
                "playlistId": playlist_id,
                "duration": video_data.get("duration") # flat-playlist では取れない場合が多い
            })
        return tasks
    except Exception as e:
        logger.error(f"yt-dlp でのプレイリスト取得失敗: {e}")
        return []

def process_playlists():
    """プレイリストを巡回し、動画を解析・処理する"""
    logger.info("📡 タスクを取得中...")
    
    # 1. GAS ゲートウェイからタスク取得を試みる
    all_tasks = gas_gateway.get_youtube_tasks()
    
    # 2. GAS が空、または失敗した場合は yt-dlp で直接取得を試みる (Fallback)
    if not all_tasks:
        logger.info("GASからのタスクが空です。yt-dlp Fallback を試行します...")
        WATCH_PLAYLIST_IDS = ['PL7aNfKUA-1lvPVfUoYHpD6jaK0p44HQGM']
        for pid in WATCH_PLAYLIST_IDS:
            all_tasks.extend(get_tasks_via_ytdlp(pid))
    
    if not all_tasks:
        logger.info("✅ 処理待ちの動画はありません。")
        return

    logger.info(f"🚀 {len(all_tasks)} 件の動画を検知しました。解析を開始します。")

    for task in all_tasks:
        video_id = task.get("videoId")
        title = task.get("title")
        description = task.get("description", "")
        # GASからは playlistItemId, yt-dlp Fallback時は videoId を削除キーとして使う
        remove_id = task.get("playlistItemId") or video_id
        
        if not video_id: continue

        mode = detect_mode(title, description)
        
        # 既存レポートのチェック (ダウンロード前に実行)
        report_prefix = {"TACTICAL": "TACTICAL", "STUDY": "STUDY", "CONTENT": "NOTE"}.get(mode, "TACTICAL")
        expected_path = settings.FORGE_DIR / f"note_drafts/youtube_intel/{mode}/{report_prefix}_{video_id}.md"
        
        if expected_path.exists():
            logger.info(f"⏩ 既存レポートあり。スキップして削除を試行: {title}")
            gas_gateway.remove_youtube_item(remove_id)
            continue

        logger.info(f"🎬 処理開始: {title} (Mode: {mode})")
        
        try:
            # 解析エンジンの起動
            analyzer = OLEAnalyzerV3(mode=mode)
            
            # 動画情報の取得 (ここで duration チェック)
            video_info = analyzer.download_audio(f"https://www.youtube.com/watch?v={video_id}")
            
            # 1時間以上の動画はスキップ (28時間動画対策)
            if video_info.get("duration", 0) > 3600:
                logger.warning(f"⚠️ 動画が長すぎます ({video_info['duration']}s)。スキップします: {title}")
                # プレイリストからは削除せず、ユーザーに通知
                herald.notify_error(f"長時間動画スキップ: {title} ({video_info['duration']//3600}時間)")
                continue

            report_path = analyzer.analyze(video_info)
            
            if report_path:
                logger.info(f"✅ 解析完了。プレイリストから削除を依頼中: {title}")
                success = gas_gateway.remove_youtube_item(remove_id) 
                if success:
                    logger.info(f"🗑️ 削除成功: {title}")
                    herald.notify_progress(f"解析完了・プレイリストから削除しました: {title} ({mode})")
                else:
                    logger.warning(f"⚠️ 削除失敗（プレイリスト内でのID不一致の可能性）: {title}")
            
        except Exception as e:
            logger.error(f"❌ 動画 {title} の処理中にエラー: {e}")
            herald.notify_error(f"YouTube解析エラー: {title}\n{e}")

def main():
    check_single_instance()
    logger.info("=== Antigravity YouTube Playlist Watcher v3.2 起動 ===")
    try:
        while True:
            try:
                process_playlists()
            except Exception as e:
                logger.error(f"システムループ内でエラー: {e}")
            
            logger.info("💤 待機中 (30分後...)")
            time.sleep(1800)
    finally:
        if PID_FILE.exists():
            PID_FILE.unlink()

if __name__ == "__main__":
    main()

