#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_kirei_bible_index.py
02_FACTORY/_LOL/bible/kirei_bible/ 配下の全動画解析バイブル（約170本）をスキャンし、
INDEX.md に全動画のチャンピオン別・タイトル別リンク一覧セクションを追記・生成する。
"""

import os
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BIBLE_DIR = REPO_ROOT / "02_FACTORY" / "_LOL" / "bible" / "kirei_bible"

def main():
    if not BIBLE_DIR.exists():
        print(f"Error: {BIBLE_DIR} not found.")
        return

    files = sorted([f for f in BIBLE_DIR.glob("*.md") if f.name != "INDEX.md"])

    champ_groups = {}
    for f in files:
        with open(f, "r", encoding="utf-8", errors="ignore") as fp:
            c = fp.read(1500)
        
        # チャンピオン抽出 [Champion: ...]
        m_champ = re.search(r"\[Champion:\s*([^\]]+)\]", c)
        champ = m_champ.group(1).strip() if m_champ else "JG共通・その他"

        # タイトル抽出
        m_title = re.search(r"^#\s+(.+)$", c, re.M)
        title = m_title.group(1).strip() if m_title else f.stem
        title = re.sub(r"\s+", " ", title)

        champ_groups.setdefault(champ, []).append((title, f.name))

    index_file = BIBLE_DIR / "INDEX.md"
    existing_content = ""
    if index_file.exists():
        with open(index_file, "r", encoding="utf-8", errors="ignore") as fp:
            existing_content = fp.read()

    # 「## 🎬 全解析動画マスターリンク」セクションより前を保持
    split_marker = "## 🎬 全解析動画マスターリンク"
    if split_marker in existing_content:
        base_content = existing_content.split(split_marker)[0].rstrip()
    else:
        base_content = existing_content.rstrip()

    new_section = [
        f"\n\n---\n\n## 🎬 全解析動画マスターリンク（全 {len(files)} 本 / {len(champ_groups)} カテゴリ）\n\n",
        "> 📌 **動画解析バイブル一覧**:\n",
        "> 各動画の秒単位タイムライン、スキル温存理由、初動ルート解説への直接リンクです。\n\n"
    ]

    for champ in sorted(champ_groups.keys()):
        items = champ_groups[champ]
        new_section.append(f"### 🌲 {champ} ({len(items)}本)\n")
        for t, fname in items:
            new_section.append(f"- [{t}](file:///d:/my_work/02_FACTORY/_LOL/bible/kirei_bible/{fname})\n")
        new_section.append("\n")

    full_content = base_content + "".join(new_section)

    with open(index_file, "w", encoding="utf-8") as out:
        out.write(full_content)

    print(f"[OK] Appended {len(files)} video links across {len(champ_groups)} champions to {index_file.name}")

if __name__ == "__main__":
    main()
