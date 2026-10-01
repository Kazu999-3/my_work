#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_frontmatter_issues.py - イミュータブルFrontmatter一括是正スクリプト

01_INTEL 配下でFrontmatterが未付与または必須フィールドが欠落しているノートに対し、
プロジェクト憲法（01_base_style.md）に準拠したイミュータブルメタデータを付与します。
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

# 1. 必須フィールド欠落の修正 (01_INTEL/_LOL/INDEX.md)
def fix_invalid():
    lol_index = REPO_ROOT / "01_INTEL" / "_LOL" / "INDEX.md"
    if lol_index.exists():
        with open(lol_index, "r", encoding="utf-8") as f:
            content = f.read()
        if "verified_at:" not in content and content.startswith("---"):
            content = content.replace("captured_at: 2026-04-19", "captured_at: 2026-04-19\nverified_at: 2026-10-01")
            with open(lol_index, "w", encoding="utf-8") as f:
                f.write(content)
            print("✅ 01_INTEL/_LOL/INDEX.md に verified_at を補完しました。")

# 2. 未付与21件のFrontmatter付与
TARGETS = [
    # vault
    ("01_INTEL/vault/HANDOVER.md", "プロジェクト運用ハンドオーバー文書", "verified", "official", ["Operations", "Handover", "SSoT"]),
    ("01_INTEL/vault/README_BUSINESS.md", "ビジネス・アフィリエイト事業設計書", "verified", "official", ["Business", "Affiliate", "Strategy"]),
    ("01_INTEL/vault/TASK_BOARD.md", "タスクボード・作業アーカイブ", "verified", "official", ["Task", "Archive"]),
    # DNA
    ("01_INTEL/_LOL/DNA/reference_antigravity.md", "Antigravity エージェント設計リファレンス", "verified", "official", ["DNA", "Antigravity", "Architecture"]),
    ("01_INTEL/_LOL/DNA/reference_himazinproducer.md", "ひまじんプロデューサー戦術思想リファレンス", "verified", "official", ["DNA", "Philosophy", "Mentality"]),
    ("01_INTEL/_LOL/DNA/reference_youtube.md", "YouTube 攻略動画リファレンスアーカイブ", "verified", "official", ["DNA", "YouTube", "Reference"]),
    # PULSE - analytics
    ("01_INTEL/_LOL/PULSE/analytics/master_hook_Jarvan IV.md", "[旧] ジャーヴァンIV マスターフック分析 (パッチ26.07)", "deprecated", "empirical", ["LoL", "PULSE", "JarvanIV"]),
    # PULSE - tactics
    ("01_INTEL/_LOL/PULSE/tactics/general_tactics_2.0.md", "汎用戦術 2.0 (マクロ・ウェーブ判断)", "verified", "empirical", ["LoL", "Tactics", "Macro"]),
    ("01_INTEL/_LOL/PULSE/tactics/lolalytics_jarvaniv_26.07.md", "[旧] Lolalytics統計: ジャーヴァンIV (パッチ26.07)", "deprecated", "official", ["LoL", "Lolalytics", "Patch26.07"]),
    ("01_INTEL/_LOL/PULSE/tactics/lolalytics_multi_initial_26.07.md", "[旧] Lolalytics初期マルチ分析 (パッチ26.07)", "deprecated", "official", ["LoL", "Lolalytics", "Patch26.07"]),
    ("01_INTEL/_LOL/PULSE/tactics/META.md", "LoL メタ分析アーカイブ", "verified", "empirical", ["LoL", "PULSE", "Meta"]),
    ("01_INTEL/_LOL/PULSE/tactics/pulse_test.md", "PULSE 疎通テスト検証メモ", "experimenting", "ai_derived", ["Test", "PULSE"]),
    ("01_INTEL/_LOL/PULSE/tactics/research_lillia_26.08.md", "[旧] リリア戦術リサーチ (パッチ26.08)", "deprecated", "empirical", ["LoL", "Lillia", "Patch26.08"]),
    # PULSE - CHAMPIONS
    ("01_INTEL/_LOL/PULSE/tactics/CHAMPIONS/champion_v1.md", "チャンピオン設計テンプレート v1", "verified", "official", ["LoL", "Template"]),
    ("01_INTEL/_LOL/PULSE/tactics/CHAMPIONS/jinx.md", "ジンクス 戦術プロファイル", "verified", "empirical", ["LoL", "ADC", "Jinx"]),
    ("01_INTEL/_LOL/PULSE/tactics/CHAMPIONS/ksante.md", "カ・サンテ 戦術プロファイル", "verified", "empirical", ["LoL", "TOP", "KSante"]),
    ("01_INTEL/_LOL/PULSE/tactics/CHAMPIONS/vayne.md", "ヴェイン 戦術プロファイル", "verified", "empirical", ["LoL", "ADC", "Vayne"]),
    # PULSE - ITEMS
    ("01_INTEL/_LOL/PULSE/tactics/ITEMS/items_2.0.md", "アイテム環境分析 2.0", "verified", "empirical", ["LoL", "Items"]),
    ("01_INTEL/_LOL/PULSE/tactics/ITEMS/item_combos_v1.md", "アイテムシナジーコンボ v1", "verified", "empirical", ["LoL", "Items", "Combos"]),
    # PULSE - META
    ("01_INTEL/_LOL/PULSE/tactics/META/jungle_pathing_v1.md", "ジャングルパス分析 v1", "verified", "empirical", ["LoL", "JG", "Pathing"]),
    ("01_INTEL/_LOL/PULSE/tactics/META/meta_2.0.md", "環境メタ分析 2.0", "verified", "empirical", ["LoL", "Meta"]),
]

def fix_missing():
    count = 0
    for rel_path, title, status, src_type, tags in TARGETS:
        file_path = REPO_ROOT / rel_path
        if not file_path.exists():
            continue
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        if content.startswith("---"):
            continue

        tag_str = ", ".join(tags)
        fm = f"""---
title: "{title}"
status: {status}
source_type: {src_type}
published_at: 2026-04-19
captured_at: 2026-04-19
verified_at: {today_str}
tags: [{tag_str}]
---

"""
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(fm + content)
        count += 1
        print(f"✅ Frontmatter付与: {rel_path}")

    print(f"\n合計 {count} 件のノートにFrontmatterを付与しました。")

def main():
    print("\n=======================================================")
    print(" 📑 Frontmatter 規約一括適合エンジン")
    print("=======================================================")
    fix_invalid()
    fix_missing()
    print("=======================================================\n")

if __name__ == "__main__":
    main()
