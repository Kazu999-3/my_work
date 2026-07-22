"""
既存の kirei_bible 内にある「# YouTube Video」タイトルのファイルを修正するスクリプト。
- yt-dlp でファイル名（動画ID）から実際のタイトルを取得
- Markdownファイル内の `# YouTube Video` を `# 実タイトル` に置換
- Supabase の youtube_queue テーブルのタイトルも更新
- Supabase の personal_knowledge テーブルのタイトルも更新

使い方: python fix_yt_titles.py
"""

import os
import sys
import glob
import subprocess
import json
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path

# Windows のコードページ問題を回避
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


# ===== 設定 =====
ROOT_DIR = Path("d:/my_work")
KIREI_BIBLE_DIR = ROOT_DIR / "02_FACTORY" / "bible" / "kirei_bible"
VENV_YT_DLP = ROOT_DIR / ".venv" / "Scripts" / "yt-dlp.exe"

# 環境変数から取得（.envがあれば読み込む）
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT_DIR / ".env")
except ImportError:
    pass

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

def supabase_request(path, method="GET", payload=None):
    """Supabase REST API へのリクエスト"""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    data = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode("utf-8")
            return r.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return None, str(e)

import shutil

def get_real_title(video_id: str, yt_dlp_cmd: list) -> str | None:
    """yt-dlp を使って実際の動画タイトルを取得する"""
    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        result = subprocess.run(
            yt_dlp_cmd + ["--print", "%(title)s", "--no-warnings", url],
            capture_output=True, text=True, timeout=20
        )
        title = result.stdout.strip()
        if title and title != "NA":
            return title
    except Exception as e:
        print(f"  ⚠️ yt-dlp エラー ({video_id}): {e}")
    return None

def fix_md_file(md_path: Path, real_title: str):
    """Markdownファイル内の '# YouTube Video' を実タイトルに置換する"""
    content = md_path.read_text(encoding="utf-8")
    # インデントありの場合も対応
    new_content = content.replace("  # YouTube Video", f"# {real_title}")
    new_content = new_content.replace("# YouTube Video", f"# {real_title}")
    if new_content != content:
        md_path.write_text(new_content, encoding="utf-8")
        return True
    return False

def update_youtube_queue(video_id: str, real_title: str):
    """youtube_queue テーブルのタイトルを更新"""
    status, body = supabase_request(
        f"youtube_queue?id=eq.{video_id}",
        method="PATCH",
        payload={"title": real_title}
    )
    return status in (200, 201, 204)

def update_personal_knowledge(old_title: str, new_title: str):
    """personal_knowledge テーブルのタイトルを更新（[YouTube] プレフィックス付き）"""
    old_display = f"[YouTube] YouTube Video"
    new_display = f"[YouTube] {new_title}"
    status, body = supabase_request(
        f"personal_knowledge?title=eq.{urllib.parse.quote(old_display)}",
        method="PATCH",
        payload={"title": new_display}
    )
    return status in (200, 201, 204)


def main():
    yt_bin = shutil.which("yt-dlp") or shutil.which("yt-dlp.exe") or (str(VENV_YT_DLP) if VENV_YT_DLP.exists() else None)
    yt_dlp_cmd = [yt_bin] if (yt_bin and os.path.exists(yt_bin)) else [sys.executable, "-m", "yt_dlp"]
    
    # YouTube Video タイトルのファイルを検索
    problem_files = []
    for md_file in KIREI_BIBLE_DIR.glob("*.md"):
        content = md_file.read_text(encoding="utf-8")
        if "# YouTube Video" in content:
            problem_files.append(md_file)
    
    print(f"🔍 修正対象ファイル: {len(problem_files)} 件")
    print("=" * 60)
    
    fixed = 0
    failed = 0
    
    for md_file in problem_files:
        video_id = md_file.stem
        print(f"\n▶ 処理中: {video_id}")
        
        # yt-dlp で実タイトル取得
        real_title = get_real_title(video_id, yt_dlp_cmd)
        if not real_title:
            print(f"  ❌ タイトル取得失敗。スキップします。")
            failed += 1
            continue
        
        print(f"  📌 取得タイトル: {real_title}")
        
        # Markdownファイルを更新
        if fix_md_file(md_file, real_title):
            print(f"  ✅ MDファイル更新完了")
        else:
            print(f"  ℹ️ MDファイルの変更なし（既に修正済み？）")
        
        # Supabase youtube_queue を更新
        if SUPABASE_URL and SUPABASE_KEY:
            if update_youtube_queue(video_id, real_title):
                print(f"  ✅ youtube_queue 更新完了")
            else:
                print(f"  ⚠️ youtube_queue 更新失敗")
            
            # personal_knowledge も更新（既に同期済みのものがあれば）
            if update_personal_knowledge("YouTube Video", real_title):
                print(f"  ✅ personal_knowledge 更新完了")
        else:
            print(f"  ⚠️ Supabase 設定なし。ローカルファイルのみ更新。")
        
        fixed += 1
    
    print("\n" + "=" * 60)
    print(f"🎉 完了: {fixed}件修正, {failed}件スキップ")
    print(f"📂 次回の sovereign_sync 実行時に personal_knowledge も自動更新されます。")

if __name__ == "__main__":
    main()
