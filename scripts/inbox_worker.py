#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
inbox_worker.py - 自律型Inbox自動仕分け・構造化ワーカー (ハシ x TOMOフレームワーク準拠)

本スクリプトは、01_INTEL/00_INBOX/ に投函された雑多なメモ・Webクリップを自動検知し、
原本非破壊のままTOMO式3層（Core Concept / Structured Points / Actionable Steps）で
構造化したナレッジノートを生成し、適切なディレクトリへ自動配置・索引リンクします。
"""

import os
import sys
import shutil
import re
from datetime import datetime
from pathlib import Path

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
INBOX_DIR = REPO_ROOT / "01_INTEL" / "00_INBOX"
ARCHIVE_DIR = INBOX_DIR / "_archive"
NEXUS_PATH = REPO_ROOT / "01_INTEL" / "NEXUS_INDEX.md"

def extract_tomo_structure(raw_text):
    """
    TOMOフレームワークに基づき、テキストを以下の3層に構造化する
    1. Core Concept（核心概念）
    2. Structured Points（体系的要点）
    3. Actionable Steps（次の一手）
    """
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    if not lines:
        return "空のメモ", ["要点なし"], ["特になし"]

    # タイトル候補
    first_line = lines[0].lstrip("#").strip()
    core_concept = first_line[:100]

    # 要点抽出（箇条書きまたは短文を収集）
    points = []
    actions = []

    for line in lines[1:]:
        if line.startswith("-") or line.startswith("*") or line.startswith("•"):
            clean = line.lstrip("-*• ").strip()
            if any(act_kw in clean for act_kw in ["する", "やること", "TODO", "確認", "検証", "実装", "作成"]):
                actions.append(clean)
            else:
                points.append(clean)
        elif len(line) > 15:
            points.append(line)

    if not points:
        points = lines[1:5] if len(lines) > 1 else [first_line]
    if not actions:
        actions = ["内容の重要度を実戦・実務で検証する", "関連する既存ノートへの相互リンクを追加する"]

    return core_concept, points[:7], actions[:5]

def categorize_content(text):
    """キーワードに基づいて格納先ディレクトリとタグを決定"""
    text_lower = text.lower()
    if any(kw in text_lower for kw in ["lol", "league", "jg", "top", "mid", "adc", "sup", "ガンク", "チャンプ", "レーン", "パッチ"]):
        dest_dir = REPO_ROOT / "01_INTEL" / "_LOL" / "tactics"
        tags = ["LoL", "Tactics", "AutoIngest"]
    elif any(kw in text_lower for kw in ["note", "sns", "x", "twitter", "アフィリエイト", "収益", "マーケティング", "記事"]):
        dest_dir = REPO_ROOT / "02_FACTORY" / "03_ASSETS"
        tags = ["Marketing", "Factory", "AutoIngest"]
    else:
        dest_dir = REPO_ROOT / "01_INTEL"
        tags = ["Knowledge", "SecondBrain", "AutoIngest"]

    dest_dir.mkdir(parents=True, exist_ok=True)
    return dest_dir, tags

def process_inbox():
    INBOX_DIR.mkdir(parents=True, exist_ok=True)
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)

    candidates = [
        f for f in INBOX_DIR.iterdir()
        if f.is_file() and f.name != "README.md" and not f.name.startswith(".")
    ]

    if not candidates:
        print("📥 Inboxには現在未処理のファイルはありません。")
        return 0

    print(f"\n=======================================================")
    print(f" 📥 Inbox 自動仕分け・構造化ワーカー (ハシ x TOMOフレームワーク)")
    print(f"=======================================================")
    print(f"🔍 検出された未処理ファイル: {len(candidates)} 件\n")

    today_str = datetime.now().strftime("%Y-%m-%d")
    processed_count = 0

    for fpath in candidates:
        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            core_concept, points, actions = extract_tomo_structure(content)
            dest_dir, tags = categorize_content(content)

            safe_stem = re.sub(r'[\\/*?:"<>| ]', '_', fpath.stem)
            out_filename = f"note_{safe_stem}.md"
            out_path = dest_dir / out_filename

            archive_path = ARCHIVE_DIR / f"{today_str}_{fpath.name}"
            # 原本を退避
            shutil.move(str(fpath), str(archive_path))

            # 相対パスの計算（派生ノートから原本へのリンク）
            try:
                rel_to_archive = os.path.relpath(archive_path, dest_dir).replace("\\", "/")
            except Exception:
                rel_to_archive = archive_path.as_posix()

            # 構造化Markdownの生成
            structured_md = f"""---
title: "{core_concept}"
status: experimenting
source_type: empirical
published_at: {today_str}
captured_at: {today_str}
verified_at: unverified
tags: {tags}
---

# 📝 {core_concept}

> 📌 **原本アーカイブ（SSoT）**: [{archive_path.name}]({rel_to_archive})  
> *(原本非破壊原則に基づき、一次ソースはイミュータブルに永久保存されています)*

---

## 🎯 1. Core Concept（核心概念）
{core_concept}

## 📋 2. Structured Points（体系的要点）
"""
            for p in points:
                structured_md += f"- {p}\n"

            structured_md += """
## 🚀 3. Actionable Steps（次の一手・実践）
"""
            for a in actions:
                structured_md += f"- [ ] {a}\n"

            structured_md += f"""
---

## 🎯 思考トリガー
> 「この知見（{core_concept[:30]}）は、現在のどのプロジェクトのボトルネックを解消できるか？」
"""

            with open(out_path, "w", encoding="utf-8") as out_f:
                out_f.write(structured_md)

            # NEXUS_INDEX.md にリンクを追記
            if NEXUS_PATH.exists():
                with open(NEXUS_PATH, "r", encoding="utf-8") as nf:
                    nexus_content = nf.read()

                link_line = f"- [{core_concept}](file:///{out_path.as_posix()})\n"
                if link_line not in nexus_content:
                    with open(NEXUS_PATH, "a", encoding="utf-8") as nf:
                        nf.write(f"\n{link_line}")

            print(f"✅ 構造化完了: {fpath.name}")
            print(f"   ➔ 保存先: {out_path.relative_to(REPO_ROOT)}")
            print(f"   ➔ 原本退避: {archive_path.relative_to(REPO_ROOT)}")
            processed_count += 1

        except Exception as e:
            print(f"❌ エラー ({fpath.name}): {e}")

    print(f"\n=======================================================")
    print(f"🎉 合計 {processed_count} 件のメモを自動構造化・配置しました。")
    print(f"=======================================================\n")
    return processed_count

if __name__ == "__main__":
    process_inbox()
