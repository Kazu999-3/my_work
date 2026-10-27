#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_tactics_index.py
01_INTEL/tactics/ 配下の全チャンピオン戦術バイブル（168体）をスキャンし、
INDEX.md を自動生成して完全索引化する。
"""

import os
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TACTICS_DIR = REPO_ROOT / "01_INTEL" / "tactics"

def main():
    if not TACTICS_DIR.exists():
        print(f"Error: {TACTICS_DIR} not found.")
        return

    files = sorted([f for f in TACTICS_DIR.glob("*_tactics_bible.md") if f.name != "INDEX.md"])

    lines = [
        "---\n",
        'title: "全チャンピオン実戦戦術バイブル総合索引 (168体完全網羅)"\n',
        "status: verified\n",
        "source_type: official\n",
        "published_at: 2026-10-27\n",
        "captured_at: 2026-10-27\n",
        "verified_at: 2026-10-27\n",
        "tags: [LoL, Tactics, Bible, Index, AllChampions]\n",
        "---\n\n",
        f"# ⚔️ 全チャンピオン実戦戦術バイブル総合索引 (全 {len(files)} 体)\n\n",
        "> 📌 **本インデックスの位置づけ**:\n",
        "> 全168チャンピオンの対面データ、パワースパイク、スキル順、勝率分岐点を網羅した帝国正本バイブルのマスター索引です。\n\n",
        "---\n\n",
        "## 📚 チャンピオン一覧 (A to Z)\n\n"
    ]

    alphabet_groups = {}
    for f in files:
        champ_name = f.stem.replace("_tactics_bible", "")
        # 先頭アルファベット
        initial = champ_name[0].upper()
        
        # タイトル抽出
        with open(f, "r", encoding="utf-8", errors="ignore") as fp:
            c = fp.read(800)
        m = re.search(r"^#\s+(.+)$", c, re.M)
        title = m.group(1).strip() if m else f"{champ_name} 実戦戦術バイブル"

        alphabet_groups.setdefault(initial, []).append((champ_name, title, f.name))

    for initial in sorted(alphabet_groups.keys()):
        items = alphabet_groups[initial]
        lines.append(f"### 🔤 {initial} ({len(items)}体)\n")
        for cname, title, fname in items:
            lines.append(f"- **[{cname.capitalize()}]**: [{title}](file:///d:/my_work/01_INTEL/tactics/{fname})\n")
        lines.append("\n")

    index_file = TACTICS_DIR / "INDEX.md"
    with open(index_file, "w", encoding="utf-8") as out:
        out.writelines(lines)

    print(f"[OK] Generated {index_file.name} with {len(files)} champion bibles across {len(alphabet_groups)} groups.")

if __name__ == "__main__":
    main()
