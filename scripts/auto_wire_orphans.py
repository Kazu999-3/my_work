#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
auto_wire_orphans.py - 孤立ノート自動配線エンジン (MOC Auto-Wiring)

本スクリプトは、ナレッジベース内の孤立ノート（48件）を分析し、
適切な上位目次（MOC: Map of Content）および NEXUS_INDEX.md へ
自動的に配線・リンクして知識の孤立（Orphans）を解消します。
"""

import os
import sys
import re
from pathlib import Path
from datetime import datetime

# Windows cp932対策
if sys.platform == "win32":
    import io
    if not getattr(sys.stdout, "_custom_utf8", False):
        try:
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
            sys.stdout._custom_utf8 = True
        except Exception:
            pass

REPO_ROOT = Path(__file__).resolve().parent.parent
today_str = datetime.now().strftime("%Y-%m-%d")

def wire_kirei_bible():
    """kirei_bible の未掲載動画24本を INDEX.md の末尾に配線"""
    kirei_dir = REPO_ROOT / "02_FACTORY" / "_LOL" / "bible" / "kirei_bible"
    index_file = kirei_dir / "INDEX.md"
    if not index_file.exists():
        return

    with open(index_file, "r", encoding="utf-8") as f:
        content = f.read()

    orphan_videos = [
        "27t49A38l6I.md", "2k_Afn_F24Q.md", "5uPebPSFnns.md", "BG-LtgqwU6Y.md",
        "BSFniQL1Dwk.md", "BWELW5xTtTU.md", "eNU22ef9T4M.md", "HCsyadHH7c4.md",
        "jL-8M42Y034.md", "jP0FRxS1U3A.md", "jpl1b8lT3vA.md", "lrx1X6QtJ7U.md",
        "nDGZTq5ly5c.md", "OBjIiVhzlis.md", "OdttUIfSm9A.md", "OFJ-UINYjXk.md",
        "OhmG-jdx_gM.md", "rweX_f-ic8M.md", "THzMDZljjuk.md", "TZ_Dy8iWEAQ.md",
        "v5HXoENSfmE.md", "V6NalLt74D4.md", "V733cbuaz54.md", "WyA1CdmmJRc.md",
        "xgIhwNwQmvk.md"
    ]

    section_header = "## 📦 字幕未取得・待機アーカイブ (25本)"
    if section_header in content:
        print("ℹ️ kirei_bible INDEX.md は既に待機アーカイブを配線済みです。")
        return

    append_md = f"\n\n---\n\n{section_header}\n字幕未取得またはIP制限等の理由で待機中の解析アーカイブです。\n\n"
    for v in orphan_videos:
        vf = kirei_dir / v
        if vf.exists():
            # タイトル行を取得
            vtitle = v
            try:
                with open(vf, "r", encoding="utf-8", errors="ignore") as vf_in:
                    for line in vf_in:
                        if line.startswith("# "):
                            vtitle = line.replace("# ", "").strip()
                            break
            except Exception:
                pass
            append_md += f"- [{vtitle}](./{v})\n"

    with open(index_file, "w", encoding="utf-8") as f:
        f.write(content + append_md)
    print(f"✅ kirei_bible INDEX.md に待機アーカイブ（{len(orphan_videos)}本）を配線しました。")

def wire_promo_index():
    """02_FACTORY/PROMO/ 配下の20件を束ねる INDEX.md を新設"""
    promo_dir = REPO_ROOT / "02_FACTORY" / "PROMO"
    index_file = promo_dir / "INDEX.md"

    md = f"""---
title: "プロモーション ＆ Xスレッド総合索引 (PROMO INDEX)"
status: verified
source_type: official
published_at: {today_str}
captured_at: {today_str}
verified_at: {today_str}
tags: [Promo, SNS, Thread, Funnel, Marketing]
---

# 📢 プロモーション ＆ Xスレッド総合索引 (PROMO INDEX)

本インデックスは、Sovereign OS および戦術バイブルのマーケティング・導線（ファネル）、SNS告知、X（旧Twitter）連投スレッドドラフトを統合管理するマスター目次です。

---

## 🎯 1. 販売導線・ファネル (Funnels)
- [Lillia Q2 Funnel 設計書](./FUNNELS/Lillia_Q2_Funnel.md)

---

## 📣 2. SNS告知・ベータ募集 (Social & Community)
- [OLE PRO ベータプロモーション](./SOCIAL/OLE_PRO_BETA_PROMO.md)
- [Xスレッド: リリア プレミアム告知](./SOCIAL/x_thread_lillia_premium.md)
- [Xスレッド: ヴィエゴ プレミアム告知](./SOCIAL/x_thread_viego_premium.md)

---

## 🧵 3. X（旧Twitter）連投スレッドドラフト (Threads)
チャンピオン別・パッチ別の攻略解説およびバイブル誘導スレッド：

### パッチ 26.8
- [エイトロックス (JG)](./THREADS/ai_promo_sovereign_draft_26.8.1_Aatrox_Jungle.md)
- [エイトロックス (TOP/汎用)](./THREADS/ai_promo_sovereign_draft_26.8.1_Aatrox_Unknown.md)
- [アーリ (MID)](./THREADS/ai_promo_sovereign_draft_26.8.1_Ahri_Mid.md)
- [ジャーヴァンIV (JG)](./THREADS/ai_promo_sovereign_draft_26.8.1_Jarvan%20IV_Jungle.md)
- [ジンクス (JG)](./THREADS/ai_promo_sovereign_draft_26.8.1_Jinx_Jungle.md)
- [ジンクス (ADC/汎用)](./THREADS/ai_promo_sovereign_draft_26.8.1_Jinx_Unknown.md)
- [ニダリー (JG)](./THREADS/ai_promo_sovereign_draft_26.8.1_Nidalee_Jungle.md)
- [ザイラ (JG)](./THREADS/ai_promo_sovereign_draft_26.8.1_Zyra_Jungle.md)
- [ザイラ (SUP/汎用)](./THREADS/ai_promo_sovereign_draft_26.8.1_Zyra_Unknown.md)

### パッチ 26.9
- [エイトロックス (汎用)](./THREADS/ai_promo_sovereign_draft_26.9.1_Aatrox_Unknown.md)
- [アーリ (MID)](./THREADS/ai_promo_sovereign_draft_26.9.1_Ahri_Mid.md)
- [ジャーヴァンIV (JG)](./THREADS/ai_promo_sovereign_draft_26.9.1_Jarvan%20IV_Jungle.md)
- [ジンクス (汎用)](./THREADS/ai_promo_sovereign_draft_26.9.1_Jinx_Unknown.md)
- [ニダリー (JG)](./THREADS/ai_promo_sovereign_draft_26.9.1_Nidalee_Jungle.md)
- [ザイラ (汎用)](./THREADS/ai_promo_sovereign_draft_26.9.1_Zyra_Unknown.md)

### 特選バイブルスレッド
- [ザイラ・バイブル連動スレッド](./THREADS/x_thread_zyra_bible.md)
"""
    with open(index_file, "w", encoding="utf-8") as f:
        f.write(md)
    print("✅ 02_FACTORY/PROMO/INDEX.md を新設配備しました。")

def wire_drafts_index():
    """02_FACTORY/01_DRAFTS/INDEX.md を新設し note_drafts を配線"""
    drafts_dir = REPO_ROOT / "02_FACTORY" / "01_DRAFTS"
    drafts_dir.mkdir(parents=True, exist_ok=True)
    index_file = drafts_dir / "INDEX.md"

    md = f"""---
title: "記事・コンテンツ下書きドラフト総合索引 (DRAFTS INDEX)"
status: verified
source_type: official
published_at: {today_str}
captured_at: {today_str}
verified_at: {today_str}
tags: [Drafts, note, SNS, Content]
---

# ✍️ 記事・コンテンツ下書きドラフト総合索引 (DRAFTS INDEX)

本インデックスは、note記事、SNS投稿、技術検証記事などの下書き（ドラフト）を一覧管理する目次です。

---

## 📝 1. note記事ドラフト (note_drafts)
- [LoL戦績テーブルツールの設計と考察](../note_drafts/note_table_tool_lol_stats.md)
- [パッチ26.13 ザイラJG攻略解説ノート](../note_drafts/zyra_jg_26.13_note.md)

---

## 🐦 2. SNS一時下書きドラフト (SNS Drafts)
- **[SNS一時下書きマスターインデックス (187件)](./sns/INDEX.md)**: パッチ別・チャンピオン別のSNS発信ドラフト一覧。
"""
    with open(index_file, "w", encoding="utf-8") as f:
        f.write(md)
    print("✅ 02_FACTORY/01_DRAFTS/INDEX.md を新設配備しました。")

def wire_nexus_index():
    """NEXUS_INDEX.md に AUTOMATION_MAP, PROMO INDEX, DRAFTS INDEX を配線"""
    nexus_path = REPO_ROOT / "01_INTEL" / "NEXUS_INDEX.md"
    with open(nexus_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. AUTOMATION_MAP.md
    if "AUTOMATION_MAP.md" not in content:
        insert_marker = "- **[総合システムデザイン](file:///d:/my_work/SYSTEM_DESIGN_BY_FUNCTION.md)**"
        new_entry = "- **[帝国オートメーション全体構成図 (AUTOMATION_MAP.md)](file:///d:/my_work/02_FACTORY/AUTOMATION_MAP.md)**: 全自動パイプライン・常駐デーモン・DB連携マップ。\n"
        if insert_marker in content:
            content = content.replace(insert_marker, new_entry + insert_marker)
        print("✅ NEXUS_INDEX.md に AUTOMATION_MAP.md を配線しました。")

    # 2. PROMO INDEX & DRAFTS INDEX
    promo_entry = "- **[プロモーション ＆ Xスレッド総合索引 (PROMO INDEX)](file:///d:/my_work/02_FACTORY/PROMO/INDEX.md)**\n"
    drafts_entry = "- **[記事・コンテンツ下書き総合索引 (DRAFTS INDEX)](file:///d:/my_work/02_FACTORY/01_DRAFTS/INDEX.md)**\n"

    section_header = "## 🏭 2. コンテンツ生産 ＆ プロモーション (Factory Domain)"
    if section_header in content:
        if "PROMO/INDEX.md" not in content:
            content = content.replace(section_header, f"{section_header}\n{promo_entry}{drafts_entry}")
            print("✅ NEXUS_INDEX.md に PROMO INDEX と DRAFTS INDEX を配線しました。")
    else:
        # 末尾に追加
        content += f"\n\n{section_header}\n{promo_entry}{drafts_entry}\n"
        print("✅ NEXUS_INDEX.md に Factory Domain セクションを新設配備しました。")

    with open(nexus_path, "w", encoding="utf-8") as f:
        f.write(content)

def main():
    print("\n=======================================================")
    print(" 🔌 孤立ノート自動配線エンジン (MOC Auto-Wiring)")
    print("=======================================================")
    wire_kirei_bible()
    wire_promo_index()
    wire_drafts_index()
    wire_nexus_index()
    print("=======================================================\n")

if __name__ == "__main__":
    main()
