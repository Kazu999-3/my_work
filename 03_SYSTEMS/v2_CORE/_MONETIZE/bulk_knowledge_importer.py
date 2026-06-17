"""
既存データの一括インポートスクリプト
===================================
ローカルに蓄積された以下のデータを personal_knowledge テーブルへ一括登録する：
  1. 02_FACTORY/_LOL/bible/kirei_bible/ → LoL動画解析MD (135本)
  2. 02_FACTORY/_MONETIZE/note_drafts/  → 記事下書きMD (277本)
  3. 02_FACTORY/affiliate_knowledge.md  → アフィリエイトナレッジ
  4. 02_FACTORY/_MONETIZE/tool_trends.json → AIツールトレンド

既存コンテンツは「要約済み」なのでAI処理不要 → 高速バルクインポート
"""
import sys
import os
import json
import re
import glob
import time

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))

from v2_CORE.settings import settings
from v2_CORE.logger_config import setup_sovereign_logging

logger = setup_sovereign_logging("KnowledgeImporter")

import urllib.request
import urllib.error

def supabase_insert(records: list[dict]) -> int:
    """Supabaseへバルクインサート（重複はスキップ）"""
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        logger.error("Supabase接続情報が設定されていません。")
        return 0

    url = f"{settings.SUPABASE_URL}/rest/v1/personal_knowledge"
    data = json.dumps(records, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "apikey": settings.SUPABASE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=ignore-duplicates",  # タイトル重複はスキップ
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            logger.info(f"✅ {len(records)}件インサート完了 (HTTP {res.status})")
            return len(records)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.error(f"❌ インサートエラー HTTP {e.code}: {body[:300]}")
        return 0

def extract_tags_from_md(content: str) -> list[str]:
    """MDファイルのヘッダーやチャンピオン名からタグを抽出"""
    tags = []
    # [Champion: XXX] 形式
    champion_match = re.search(r"\[Champion:\s*(.+?)\]", content)
    if champion_match:
        tags.append(champion_match.group(1).strip())
    # ## で始まる見出しを最大3つタグ化
    headers = re.findall(r"##\s+(.+)", content)
    for h in headers[:3]:
        tag = h.strip().lstrip("📌🧠🎯💡").strip()[:20]
        if tag:
            tags.append(tag)
    return list(set(tags))[:5]

def import_lol_bible():
    """LoL動画解析バイブル (kirei_bible) のインポート"""
    bible_dir = os.path.join(str(settings.ROOT_DIR), "02_FACTORY", "_LOL", "bible", "kirei_bible")
    files = glob.glob(os.path.join(bible_dir, "*.md"))
    
    if not files:
        logger.warning(f"⚠️ bibleファイルが見つかりません: {bible_dir}")
        return 0

    logger.info(f"📚 LoLバイブル: {len(files)}本を処理します...")
    batch = []
    total = 0

    for fp in files:
        try:
            with open(fp, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()

            # タイトルを1行目または2行目のH1から取得
            title = os.path.basename(fp).replace(".md", "")
            h1_match = re.search(r"^#\s+(.+)", content, re.MULTILINE)
            if h1_match:
                title = h1_match.group(1).strip()[:120]

            tags = extract_tags_from_md(content)
            # summary: 最初の300文字
            summary = content[:300].strip()

            batch.append({
                "title": title,
                "content": summary,
                "raw_content": content[:8000],   # 上限8000文字
                "source_url": "",
                "genre": "LoL攻略",
                "tags": tags
            })

            # 20件ずつインサート（API負荷分散）
            if len(batch) >= 20:
                total += supabase_insert(batch)
                batch = []
                time.sleep(0.3)

        except Exception as e:
            logger.error(f"❌ ファイル読み込みエラー {fp}: {e}")

    # 残り
    if batch:
        total += supabase_insert(batch)

    return total

def import_note_drafts():
    """記事下書きMDのインポート"""
    drafts_dir = os.path.join(str(settings.ROOT_DIR), "02_FACTORY", "_MONETIZE", "note_drafts")
    files = glob.glob(os.path.join(drafts_dir, "**", "*.md"), recursive=True)

    if not files:
        logger.warning(f"⚠️ 記事下書きが見つかりません: {drafts_dir}")
        return 0

    logger.info(f"📝 記事下書き: {len(files)}本を処理します...")
    batch = []
    total = 0

    for fp in files:
        try:
            with open(fp, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()

            if len(content) < 50:   # 空ファイルはスキップ
                continue

            title = os.path.basename(fp).replace(".md", "")
            h1_match = re.search(r"^#\s+(.+)", content, re.MULTILINE)
            if h1_match:
                title = h1_match.group(1).strip()[:120]

            # ジャンル判定
            genre = "副業ノウハウ"
            if any(kw in content.lower() for kw in ["lol", "league", "チャンピオン", "ジャングル", "ランク"]):
                genre = "LoL攻略"
            elif any(kw in content.lower() for kw in ["chatgpt", "claude", "gemini", "ai", "notion", "canva"]):
                genre = "AIツール"

            tags = extract_tags_from_md(content)

            batch.append({
                "title": title,
                "content": content[:300].strip(),
                "raw_content": content[:8000],
                "source_url": "",
                "genre": genre,
                "tags": tags
            })

            if len(batch) >= 20:
                total += supabase_insert(batch)
                batch = []
                time.sleep(0.3)

        except Exception as e:
            logger.error(f"❌ ファイル読み込みエラー {fp}: {e}")

    if batch:
        total += supabase_insert(batch)

    return total

def import_affiliate_knowledge():
    """アフィリエイトナレッジMDのインポート"""
    fp = os.path.join(str(settings.ROOT_DIR), "02_FACTORY", "affiliate_knowledge.md")
    if not os.path.exists(fp):
        return 0

    with open(fp, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    record = [{
        "title": "アフィリエイト攻略ナレッジ",
        "content": content[:300].strip(),
        "raw_content": content[:8000],
        "source_url": "",
        "genre": "副業ノウハウ",
        "tags": ["アフィリエイト", "副業", "収益化"]
    }]
    return supabase_insert(record)

def import_tool_trends():
    """AIツールトレンドJSONのインポート"""
    fp = os.path.join(str(settings.ROOT_DIR), "02_FACTORY", "_MONETIZE", "tool_trends.json")
    if not os.path.exists(fp):
        return 0

    with open(fp, "r", encoding="utf-8", errors="replace") as f:
        data = json.load(f)

    content = json.dumps(data, ensure_ascii=False, indent=2)
    record = [{
        "title": "AIツールトレンド一覧",
        "content": "最新のAIツールトレンドデータ（自動収集）",
        "raw_content": content[:8000],
        "source_url": "",
        "genre": "AIツール",
        "tags": ["AIツール", "トレンド", "自動収集"]
    }]
    return supabase_insert(record)

if __name__ == "__main__":
    logger.info("🚀 既存データの一括インポートを開始します...")
    total = 0

    t1 = import_lol_bible()
    logger.info(f"  ✅ LoLバイブル: {t1}件登録")
    total += t1

    t2 = import_note_drafts()
    logger.info(f"  ✅ 記事下書き: {t2}件登録")
    total += t2

    t3 = import_affiliate_knowledge()
    logger.info(f"  ✅ アフィリエイトナレッジ: {t3}件登録")
    total += t3

    t4 = import_tool_trends()
    logger.info(f"  ✅ AIツールトレンド: {t4}件登録")
    total += t4

    logger.info(f"\n🎉 インポート完了！ 合計 {total}件 を personal_knowledge に登録しました。")
