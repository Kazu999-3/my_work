#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_note_stocks_index.py
02_FACTORY/_LOL/note_stocks/ 配下の224本のストック記事をスキャンし、
マスター目次 INDEX.md を自動生成する。
"""

import os
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
STOCKS_DIR = REPO_ROOT / "02_FACTORY" / "_LOL" / "note_stocks"

def main():
    if not STOCKS_DIR.exists():
        print(f"Error: {STOCKS_DIR} not found.")
        return

    files = sorted([f for f in STOCKS_DIR.glob("*.md") if f.name != "INDEX.md"])

    lines = [
        "---\n",
        'title: "note記事ストック マスター目次 (全224本)"\n',
        "status: verified\n",
        "source_type: ai_derived\n",
        "published_at: 2026-10-27\n",
        "captured_at: 2026-10-27\n",
        "verified_at: 2026-10-27\n",
        "tags: [LoL, NoteStocks, Factory, Index]\n",
        "---\n\n",
        f"# 📚 note記事ストック マスター目次 (全 {len(files)} 本)\n\n",
        "> 📌 **本インデックスの位置づけ**:\n",
        "> 動画解析・プロ解説から自動抽出された、すぐに使えるnote記事ネタ・下書きストックの総合目次です。\n\n",
        "---\n\n",
    ]

    champ_groups = {}
    for f in files:
        with open(f, "r", encoding="utf-8", errors="ignore") as fp:
            c = fp.read(1500)
        
        # タイトル抽出
        m = re.search(r"^#\s+(.+)$", c, re.M)
        title = m.group(1).strip() if m else f.stem
        # 改行や特殊文字のクリーンアップ
        title = re.sub(r"\s+", " ", title)

        champ = f.stem.split("_")[0]
        champ_groups.setdefault(champ, []).append((title, f.name))

    for champ in sorted(champ_groups.keys()):
        items = champ_groups[champ]
        lines.append(f"### ⚔️ {champ} ({len(items)}件)\n")
        for t, fname in items:
            lines.append(f"- [{t}](file:///d:/my_work/02_FACTORY/_LOL/note_stocks/{fname})\n")
        lines.append("\n")

    out_file = STOCKS_DIR / "INDEX.md"
    with open(out_file, "w", encoding="utf-8") as out:
        out.writelines(lines)

    print(f"[OK] Generated {out_file} with {len(files)} articles across {len(champ_groups)} champions.")

if __name__ == "__main__":
    main()
