"""
bible_restructure_batch.py - 既存176本のバイブル資産を一括再仕分け・棚卸しする高速バッチ

【特徴】
- YouTube再ダウンロードやGeminiの重いAPI呼び出しは一切不要（完全ゼロコスト＆超高速）。
- 既存のMarkdown（176本）から「普遍的JGマクロ」「note発信ネタ」「チャンピオン固有知見」を瞬時に抽出。
- レーンガイド（lane_guides の JG章）および note_stocks/ ディレクトリへ一括反映。
"""
import os
import re
import sys
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
import httpx
import dotenv

ROOT_DIR = Path(__file__).resolve().parents[3]
dotenv.load_dotenv(ROOT_DIR / ".env")

try:
    from v2_CORE.settings import settings
    from v2_CORE.logger_config import setup_sovereign_logging
    from v2_CORE._LOL.bible_dispatcher import parse_bible, save_note_stock, NOTE_STOCKS_DIR, clean_title
    logger = setup_sovereign_logging("BibleRestructureBatch")
except ImportError:
    sys.path.append(str(ROOT_DIR / "03_SYSTEMS"))
    from v2_CORE.settings import settings
    from v2_CORE.logger_config import setup_sovereign_logging
    from v2_CORE._LOL.bible_dispatcher import parse_bible, save_note_stock, NOTE_STOCKS_DIR, clean_title
    logger = setup_sovereign_logging("BibleRestructureBatch")

BIBLE_DIR = ROOT_DIR / "02_FACTORY" / "_LOL" / "bible" / "kirei_bible"
SUPABASE_URL = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = settings.SUPABASE_KEY or os.environ.get("SUPABASE_KEY")

def _get_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

def run_restructure_batch():
    logger.info("🚀 既存バイブル資産（176本）の棚卸し・再仕分けバッチを開始します...")
    
    bible_files = sorted(list(BIBLE_DIR.glob("*.md")))
    if not bible_files:
        logger.warning("⚠️ バイブルファイルが見つかりません。")
        return

    logger.info(f"📂 検出されたバイブルファイル: {len(bible_files)} 本")

    note_saved_count = 0
    macro_entries = []

    for idx, b_path in enumerate(bible_files, 1):
        video_id = b_path.stem
        try:
            content = b_path.read_text(encoding="utf-8")
        except Exception as e:
            logger.warning(f"⚠️ ファイル読み込み失敗: {b_path.name} ({e})")
            continue

        parsed = parse_bible(content, video_id=video_id)
        
        # 1. noteストックの保存
        stock_path = save_note_stock(parsed)
        if stock_path:
            note_saved_count += 1

        # 2. JGマクロ知見の集約（中身があるもののみ）
        macro = parsed.get("macro_insights", "").strip()
        gank = parsed.get("gank_lane_insights", "").strip()
        traps = parsed.get("ng_traps", "").strip()

        if macro or gank or traps:
            champ = parsed.get("champion") or "全般"
            title = parsed.get("title") or video_id
            url = parsed.get("video_url") or f"https://www.youtube.com/watch?v={video_id}"
            link_str = f"[{title}]({url})"

            entry_lines = [
                f"### 📺 {title}",
                f"- **出典・チャンピオン**: {link_str} （対象: **{champ}**）",
            ]
            if macro:
                entry_lines.append(f"- **マクロ・トラッキング判断**:\n{macro}")
            if gank:
                entry_lines.append(f"- **各レーン有利不利とガンク成立条件**:\n{gank}")
            if traps:
                entry_lines.append(f"- **回避すべきNG行動（罠）**:\n{traps}")

            macro_entries.append({
                "video_id": video_id,
                "text": "\n".join(entry_lines)
            })

        if idx % 30 == 0 or idx == len(bible_files):
            logger.info(f"⏳ 処理進捗: {idx}/{len(bible_files)} 本完了 (noteストック: {note_saved_count}件, マクロ知見: {len(macro_entries)}件)")

    # 3. レーンガイド（Supabase lane_guides の JG章）へ一括マージ
    logger.info(f"🌲 レーンガイド(JG)へ {len(macro_entries)} 件のマクロ知見を一括統合します...")
    if SUPABASE_URL and SUPABASE_KEY and macro_entries:
        try:
            url = f"{SUPABASE_URL}/rest/v1/lane_guides?lane=eq.JG"
            res = httpx.get(url, headers=_get_headers(), timeout=15)
            if res.status_code == 200 and res.json():
                jg_record = res.json()[0]
                body = jg_record.get("body", "")
                
                header_section = "## 8. 実戦動画・プロ解析からの最新マクロ知見（Why & When アーカイブ）"
                
                # 既存の第8章がある場合は、重複しないエントリのみ追記
                entries_to_add = []
                for me in macro_entries:
                    if me["video_id"] not in body:
                        entries_to_add.append(me["text"])

                if entries_to_add:
                    combined_new = "\n\n---\n\n".join(entries_to_add)
                    if header_section in body:
                        updated_body = body + f"\n\n---\n\n{combined_new}"
                    else:
                        updated_body = body + f"\n\n\n{header_section}\n\n実戦動画やトッププロの解説から抽出された、JG視点のアクション根拠（Why & When）と普遍的マクロ知見のストックです。\n\n{combined_new}"

                    # 総ソース件数を算出
                    total_sources = jg_record.get("source_count", 0) + len(entries_to_add)

                    patch_res = httpx.patch(
                        url,
                        headers=_get_headers(),
                        json={
                            "body": updated_body,
                            "source_count": total_sources,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        },
                        timeout=20
                    )
                    if patch_res.status_code in (200, 204):
                        logger.info(f"🎉 レーンガイド(JG)の更新完了！ 新たに {len(entries_to_add)} 件のマクロ知見を統合しました (総計: {total_sources}件)")
                    else:
                        logger.error(f"❌ レーンガイド更新失敗: {patch_res.status_code} {patch_res.text}")
                else:
                    logger.info("ℹ️ 全てのマクロ知見はすでにレーンガイドに統合済みでした。")
        except Exception as se:
            logger.error(f"❌ レーンガイド更新中に例外: {se}")

    logger.info("=" * 60)
    logger.info(f"✨ 【棚卸し完了サマリー】")
    logger.info(f"- 解析済みバイブル総数: {len(bible_files)} 本")
    logger.info(f"- note発信ストック生成: {note_saved_count} 本 (`02_FACTORY/_LOL/note_stocks/`)")
    logger.info(f"- レーンガイド(JG)抽出マクロ: {len(macro_entries)} 件")
    logger.info("=" * 60)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_restructure_batch()
