"""
bible_dispatcher.py - LoL動画解析結果の二系統自動マージ & noteストック生成モジュール

【責務】
1. YouTube/X等の解析結果（バイブルテキスト）をパースし、
   「チャンピオン固有の知見」「普遍的なJGマクロ知見」「note発信ネタ」に分離する。
2. トラックA: チャンピオン辞典（matchup_sentinel）へ固有知見をマージ。
3. トラックB: レーンガイド（lane_guides の JG章）へ普遍的マクロ・ガンク判断をマージ。
4. トラックC: note発信ストック（02_FACTORY/_LOL/note_stocks/）へ即座に記事化できる形式で保存。
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

# パス解決
ROOT_DIR = Path(__file__).resolve().parents[3]
dotenv.load_dotenv(ROOT_DIR / ".env")

try:
    from v2_CORE.settings import settings
    from v2_CORE.logger_config import setup_sovereign_logging
    from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id
    logger = setup_sovereign_logging("BibleDispatcher")
except ImportError:
    sys.path.append(str(ROOT_DIR / "03_SYSTEMS"))
    from v2_CORE.settings import settings
    from v2_CORE.logger_config import setup_sovereign_logging
    from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id
    logger = setup_sovereign_logging("BibleDispatcher")

NOTE_STOCKS_DIR = ROOT_DIR / "02_FACTORY" / "_LOL" / "note_stocks"
NOTE_STOCKS_DIR.mkdir(parents=True, exist_ok=True)

SUPABASE_URL = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = settings.SUPABASE_KEY or os.environ.get("SUPABASE_KEY")

def _get_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

def clean_title(title: str) -> str:
    """タイトルの不要なタグや改行をクリーン除去"""
    if not title:
        return "Unknown"
    title = re.sub(r"\[エラー:[^\]]*\]", "", title)
    title = title.replace("\r", " ").replace("\n", " ").strip()
    return title

def parse_bible(text: str, video_id: str = "", default_title: str = "") -> dict:
    """
    バイブルMarkdown（新旧フォーマット両対応）を解析し、構造化辞書として返す。
    """
    result = {
        "video_id": video_id,
        "title": default_title,
        "video_url": f"https://www.youtube.com/watch?v={video_id}" if video_id and not video_id.startswith("x_") else "",
        "champion": "Unknown",
        "conclusion": "",
        "macro_insights": "",
        "micro_insights": "",
        "gank_lane_insights": "",
        "ng_traps": "",
        "pick_conditions": "",
        "note_stock_text": "",
        "raw_text": text
    }

    # 1. タイトルの抽出
    title_match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    if title_match:
        result["title"] = clean_title(title_match.group(1))

    # 2. URLの抽出
    url_match = re.search(r"https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/|x\.com/)[^\s\)\>]+", text)
    if url_match:
        result["video_url"] = url_match.group(0)

    # 3. チャンピオンの抽出
    champ_match = re.search(r"\[Champion[s]?:\s*([^\]]+)\]", text, re.IGNORECASE)
    if champ_match:
        raw_champ = champ_match.group(1).strip()
        result["champion"] = normalize_champion_id(raw_champ)
    else:
        # タイトルや本文から推定
        try:
            from v2_CORE.knowledge_retriever import knowledge_retriever
            guessed = knowledge_retriever.guess_champions_from_title(result["title"])
            if guessed:
                result["champion"] = guessed[0]
        except Exception:
            pass

    # 4. セクションの抽出（柱形式: 【第X柱: ...】または ## X. ...）
    h_conc = re.search(r"##\s*[📌\s]*戦術の核心[^\n]*\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    h1 = re.search(r"##\s*[🌲\d\.]*\s*1\.\s*初動3分[^\n]*\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    h2 = re.search(r"##\s*[🎯\d\.]*\s*2\.\s*各レーン[^\n]*\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    h3 = re.search(r"##\s*[👁️\d\.]*\s*3\.\s*敵JG[^\n]*\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    h4 = re.search(r"##\s*[⚔️\d\.]*\s*4\.\s*戦闘ミクロ[^\n]*\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    h5 = re.search(r"##\s*[🛒\d\.]*\s*5\.\s*リコール[^\n]*\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    h6 = re.search(r"##\s*[⚖️\d\.]*\s*6\.\s*ウィンコンディション[^\n]*\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    h7 = re.search(r"##\s*[⚠️\d\.]*\s*7\.\s*JGの罠[^\n]*\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    h8 = re.search(r"##\s*[🎯\d\.]*\s*8\.\s*ピック判断[^\n]*\n(.*?)(?=\n## |【note発信ストック|\Z)", text, re.DOTALL)
    p_note = re.search(r"【note発信ストック:[^】]+】\s*\n(.*?)(?=\Z)", text, re.DOTALL)

    # 柱タグ形式（【第1柱: ...】〜【第9柱: ...】）。youtube_absorber.py のローカルフォールバック
    # プロンプトが出力する形式。2026-10-04: プロンプトは9本柱なのにここが8本柱前提のままで、
    # 第5柱(戦闘ミクロ)をリコール、第8柱(JGの罠)をピック判断として1本ずつずれて読んでいた。
    p1 = re.search(r"【第1柱:[^】]+】(.*?)(?=【第2柱|\Z)", text, re.DOTALL)
    p2 = re.search(r"【第2柱:[^】]+】(.*?)(?=【第3柱|\Z)", text, re.DOTALL)
    p3 = re.search(r"【第3柱:[^】]+】(.*?)(?=【第4柱|\Z)", text, re.DOTALL)
    p4 = re.search(r"【第4柱:[^】]+】(.*?)(?=【第5柱|\Z)", text, re.DOTALL)
    p5 = re.search(r"【第5柱:[^】]+】(.*?)(?=【第6柱|\Z)", text, re.DOTALL)
    p6 = re.search(r"【第6柱:[^】]+】(.*?)(?=【第7柱|\Z)", text, re.DOTALL)
    p7 = re.search(r"【第7柱:[^】]+】(.*?)(?=【第8柱|【note発信ストック|\Z)", text, re.DOTALL)
    p8 = re.search(r"【第8柱:[^】]+】(.*?)(?=【第9柱|【note発信ストック|\Z)", text, re.DOTALL)
    p9 = re.search(r"【第9柱:[^】]+】(.*?)(?=【note発信ストック|\Z)", text, re.DOTALL)

    if h1 or h2 or h3 or h4 or h5 or h6:
        # 番号付きヘッダー形式が検出された場合
        if h_conc: result["conclusion"] = h_conc.group(1).strip()
        macro_parts = []
        if h1: macro_parts.append(f"#### 初動ルート & スカトル判断 & カメラワーク\n{h1.group(1).strip()}")
        if h3: macro_parts.append(f"#### 敵JGトラッキング & 視界セットアップ\n{h3.group(1).strip()}")
        if h5: macro_parts.append(f"#### リコールテンポ & スマイト管理 & 即興買い物\n{h5.group(1).strip()}")
        if h6: macro_parts.append(f"#### ウィンコンディション & 中盤の居場所 & 劣勢逆転\n{h6.group(1).strip()}")
        result["macro_insights"] = "\n\n".join(macro_parts)

        if h2: result["gank_lane_insights"] = h2.group(1).strip()
        if h4: result["micro_insights"] = h4.group(1).strip()
        if h7: result["ng_traps"] = h7.group(1).strip()
        if h8: result["pick_conditions"] = h8.group(1).strip()
        if p_note: result["note_stock_text"] = p_note.group(1).strip()
    elif p2 or p3 or p4 or p5:
        # 柱タグ形式が検出された場合
        # 見出しラベルは番号付きヘッダー形式と揃える
        if p1: result["conclusion"] = p1.group(1).strip()
        macro_parts = []
        if p2: macro_parts.append(f"#### 初動ルート & スカトル判断 & カメラワーク\n{p2.group(1).strip()}")
        if p4: macro_parts.append(f"#### 敵JGトラッキング & 視界セットアップ\n{p4.group(1).strip()}")
        if p6: macro_parts.append(f"#### リコールテンポ & スマイト管理 & 即興買い物\n{p6.group(1).strip()}")
        if p7: macro_parts.append(f"#### ウィンコンディション & 中盤の居場所 & 劣勢逆転\n{p7.group(1).strip()}")
        result["macro_insights"] = "\n\n".join(macro_parts)

        if p3: result["gank_lane_insights"] = p3.group(1).strip()
        if p5: result["micro_insights"] = p5.group(1).strip()
        if p8: result["ng_traps"] = p8.group(1).strip()
        if p9: result["pick_conditions"] = p9.group(1).strip()
        if p_note: result["note_stock_text"] = p_note.group(1).strip()
    else:
        # 旧フォーマット（## 📌 動画の結論 / ## 🧠 マクロ戦略 / ## 🗡️ ミクロ等）
        conc_match = re.search(r"## 📌\s*動画の結論[^\n]*\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
        if conc_match: result["conclusion"] = conc_match.group(1).strip()

        macro_match = re.search(r"## 🧠\s*マクロ戦略[^\n]*\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
        if macro_match: result["macro_insights"] = macro_match.group(1).strip()

        micro_match = re.search(r"## 🗡️\s*ミクロ[^\n]*\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
        if micro_match: result["micro_insights"] = micro_match.group(1).strip()

        tips_match = re.search(r"## 💡\s*重要[^\n]*\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
        if tips_match: result["ng_traps"] = tips_match.group(1).strip()

    return result

def merge_to_lane_guides(parsed: dict) -> bool:
    """
    トラックB: レーンガイド（Supabase lane_guides の JG章）へ普遍的マクロ知見をマージする
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.warning("⚠️ Supabase認証情報がないため、レーンガイドへのマージをスキップします。")
        return False

    title = parsed.get("title") or "実戦解説"
    video_url = parsed.get("video_url") or ""
    video_id = parsed.get("video_id") or ""
    champ = parsed.get("champion") or "全般"

    macro = parsed.get("macro_insights", "").strip()
    gank = parsed.get("gank_lane_insights", "").strip()
    traps = parsed.get("ng_traps", "").strip()
    pick = parsed.get("pick_conditions", "").strip()

    if not macro and not gank and not traps and not pick:
        logger.info(f"ℹ️ {title}: マクロ・ピック知見が空のためレーンガイドへのマージをスキップします。")
        return False

    try:
        # 1. 既存の JG レーンガイドを取得
        url = f"{SUPABASE_URL}/rest/v1/lane_guides?lane=eq.JG"
        res = httpx.get(url, headers=_get_headers(), timeout=15)
        if res.status_code != 200 or not res.json():
            logger.error(f"❌ lane_guides(JG) 取得失敗: {res.status_code}")
            return False

        jg_record = res.json()[0]
        body = jg_record.get("body", "")
        source_count = jg_record.get("source_count", 0)

        # 2. 重複チェック（video_id または タイトルがすでに含まれている場合）
        check_id = video_id if video_id else title
        if check_id in body:
            logger.info(f"ℹ️ {check_id} はすでに JG レーンガイドに統合済みです。スキップします。")
            return True

        # 3. 追記用ブロックを生成
        header_section = "## 8. 実戦動画・プロ解析からの最新マクロ知見（Why & When アーカイブ）"
        link_str = f"[{title}]({video_url})" if video_url else title

        block_lines = [
            f"### 📺 {title}",
            f"- **出典・チャンピオン**: {link_str} （対象: **{champ}**）",
        ]
        if pick:
            block_lines.append(f"- **🎯 ピック判断基準（先出し/後出し/構成マッチング）**:\n{pick}")
        if macro:
            block_lines.append(f"- **マクロ・トラッキング判断**:\n{macro}")
        if gank:
            block_lines.append(f"- **各レーン有利不利とガンク成立条件**:\n{gank}")
        if traps:
            block_lines.append(f"- **回避すべきNG行動（罠）**:\n{traps}")

        new_entry = "\n".join(block_lines)

        if header_section in body:
            # 既存の第8章の末尾に追記
            updated_body = body + f"\n\n---\n\n{new_entry}"
        else:
            # 第8章を新設
            updated_body = body + f"\n\n\n{header_section}\n\n実戦動画やトッププロの解説から抽出された、JG視点のアクション根拠（Why & When）と普遍的マクロ知見のストックです。\n\n{new_entry}"

        # 4. Supabaseを更新
        update_payload = {
            "body": updated_body,
            "source_count": source_count + 1,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        patch_res = httpx.patch(url, headers=_get_headers(), json=update_payload, timeout=15)
        if patch_res.status_code in (200, 204):
            logger.info(f"✅ レーンガイド(JG)へマクロ知見を統合しました: {title} (現在 {source_count + 1} 件)")
            return True
        else:
            logger.error(f"❌ レーンガイド更新失敗: {patch_res.status_code} {patch_res.text}")
            return False

    except Exception as e:
        logger.error(f"❌ レーンガイドマージ中に例外: {e}")
        return False

def save_note_stock(parsed: dict) -> str:
    """
    トラックC: note発信ストック（02_FACTORY/_LOL/note_stocks/）へ保存する
    """
    title = parsed.get("title") or "JG戦術考察"
    champ = parsed.get("champion") or "JG"
    video_id = parsed.get("video_id") or "unknown"
    video_url = parsed.get("video_url") or ""
    today_str = datetime.now().strftime("%Y-%m-%d")

    # note用タイトル（32文字以内ルール: 01_base_style.md / 30_content_factory.md）
    raw_note_title = f"【LoL/JG】{champ}実戦思考と勝率UPマクロ"
    note_title = raw_note_title[:32]

    # フロントマター生成
    frontmatter = f"""---
title: "{note_title}"
status: experimenting
source_type: official
published_at: unknown
captured_at: {today_str}
verified_at: unverified
tags: [LoL, JG, note発信ネタ, {champ}]
---
"""

    stock_content = f"""{frontmatter}

# {note_title}

> 📺 **元動画**: [{title}]({video_url})
> 🎯 **対象チャンピオン**: {champ}
> 📅 **抽出日**: {today_str}

---

## 📌 note記事で使えるキラーエピソード（Whyの言語化）
{parsed.get('note_stock_text') or parsed.get('conclusion') or '（実戦での判断理由・勝敗を分けたポイント）'}

---

## 🧠 JGマクロ思考・アクションの根拠 (Why & When)
{parsed.get('macro_insights') or '（マクロ判断の根拠）'}

---

## ⚔️ 各レーンの有利度とガンクタイミング
{parsed.get('gank_lane_insights') or '（レーン介入判断）'}

---

## 🎯 ピック判断基準（先出し・後出し・構成マッチング）
{parsed.get('pick_conditions') or '（先出し適性・後出しカウンター・味方構成とのシナジー判断）'}

---

## ⚠️ 初心者が陥るNG行動・没理由（罠の回避）
{parsed.get('ng_traps') or '（やってはいけない行動）'}

---

## 💡 note記事の見出し案（構成ドラフト）
1. **はじめに**: なぜ今{champ}で勝てるのか？（先出し・後出しの条件）
2. **多くのJGが勘違いしている罠**: 初心者が陥るNG行動と「ガンク後ウェーブ触るな問題」の真相
3. **プロが実戦でやっている「Why（根拠）」**: 画面には映らないスキル温存とカメラワーク
4. **オブジェクト戦の極意**: スマイト50/50勝負を絶対に避けるセットアップ
5. **味方が崩壊した時の逆転シナリオ**: 劣勢時に試合を長引かせるクロストレード
6. **まとめ**: 次のランク戦で即実践できるアクションリスト

---
*思考トリガー: 敵JGが逆サイドに見えた瞬間、自分のアクション（オブジェクト/カウンターJG/ガンク）を0.5秒で選べるか？*
"""

    safe_title = re.sub(r'[^a-zA-Z0-9_\-\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]', '_', f"{champ}_{video_id}")[:50]
    file_path = NOTE_STOCKS_DIR / f"{safe_title}.md"
    try:
        file_path.write_text(stock_content, encoding="utf-8")
        logger.info(f"✅ note発信ストックを保存しました: {file_path.name}")
        return str(file_path)
    except Exception as e:
        logger.error(f"❌ noteストック保存失敗: {e}")
        return ""

def dispatch_bible(bible_text: str, video_id: str = "", title: str = "") -> dict:
    """
    1本のバイブルを全トラック（レーンガイド、noteストック）へ自動ディスパッチするエントリーポイント
    """
    parsed = parse_bible(bible_text, video_id=video_id, default_title=title)
    
    # トラックB: レーンガイドへのマージ
    lane_ok = merge_to_lane_guides(parsed)
    
    # トラックC: note発信ストックへの保存
    note_path = save_note_stock(parsed)

    return {
        "parsed": parsed,
        "lane_merged": lane_ok,
        "note_stock_path": note_path
    }
