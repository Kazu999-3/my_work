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
from v2_CORE._LOL.herald import herald
from v2_CORE.settings import settings
from ole_youtube_analyzer import OLEAnalyzerV3

# ロギング設定
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("PlaylistWatcher")

# PIDファイルのパス
PID_FILE = Path("d:/my_work/scratch/youtube_playlist_watcher.pid")
PROCESSED_VIDEOS_FILE = Path("d:/my_work/scratch/youtube_processed_videos.txt")

def is_video_processed(video_id: str) -> bool:
    """処理済み履歴にあるか確認する"""
    if not PROCESSED_VIDEOS_FILE.exists():
        return False
    processed = PROCESSED_VIDEOS_FILE.read_text().splitlines()
    return video_id in processed

def mark_video_processed(video_id: str):
    """動画を処理済み履歴に追加する"""
    with open(PROCESSED_VIDEOS_FILE, "a", encoding="utf-8") as f:
        f.write(f"{video_id}\n")

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
    # 🛑 クォータ枯渇による一時休止のチェック
    SUSPEND_FILE = Path("d:/my_work/scratch/ole_quota_suspended.json")
    if SUSPEND_FILE.exists():
        try:
            import datetime
            data = json.loads(SUSPEND_FILE.read_text(encoding="utf-8"))
            resume_time_str = data.get("resume_time")
            if resume_time_str:
                resume_time = datetime.datetime.fromisoformat(resume_time_str)
                if datetime.datetime.now() < resume_time:
                    logger.info(f"⏸️ クォータ制限によりYouTube解析を休止中です。(再開予定: {resume_time.strftime('%Y-%m-%d %H:%M:%S')}、理由: {data.get('reason')})")
                    return
                else:
                    # 期限切れの場合は休止ファイルを削除
                    SUSPEND_FILE.unlink(missing_ok=True)
                    logger.info("🌅 クォータ休止期間が終了したため、解析を再開します。")
        except Exception as e:
            logger.error(f"一時休止ファイルのチェックに失敗: {e}")

    # 💰 コスト防止: 無料枠キーが未設定の場合、有料キーの浪費を防ぐため全スキップ
    free_key = os.environ.get("GEMINI_API_KEY_FREE")
    if not free_key:
        logger.info("⏸️ GEMINI_API_KEY_FREE が未設定のため、YouTube解析をスキップします。（有料キーのコスト防止）")
        return
    
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
        
        if expected_path.exists() or is_video_processed(video_id):
            logger.info(f"⏩ 既存レポートまたは処理済み履歴あり。スキップして削除を試行: {title}")
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
                herald.notify_error(f"長時間動画スキップ: {title} ({video_info['duration']//3600}時間)")
                continue

            report_path = analyzer.analyze(video_info)
            
            if report_path and Path(report_path).exists():
                logger.info(f"✅ 解析完了。履歴に追加し、プレイリストから削除を依頼中: {title}")
                mark_video_processed(video_id)
                success = gas_gateway.remove_youtube_item(remove_id)
                if success:
                    logger.info(f"🗑️ 削除成功: {title}")
                    herald.notify_progress(f"解析完了: {title} ({mode})", portal_link=True)
                else:
                    logger.warning(f"⚠️ 削除失敗（ID不一致の可能性）: {title}")
            else:
                # キャッシュが残っている場合 = クォータ切れによる一時的な失敗
                # → 処理済みにせず次のループで再挑戦させる
                from v2_CORE.settings import settings as _s
                cache_dir = _s.FORGE_DIR / "cache"
                cache_exists = any(cache_dir.glob(f"ole_cache_{video_id}_*.json")) if cache_dir.exists() else False
                if cache_exists:
                    logger.warning(f"⏳ クォータ切れによる一時失敗（キャッシュ保持中）。次回ループで再試行します: {title}")
                else:
                    logger.warning(f"⚠️ 解析に失敗しました（キャッシュなし）。履歴には追加しません: {title}")
            
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

