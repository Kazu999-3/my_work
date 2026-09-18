#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
audit_knowledge_links.py - ナレッジリンク整合性 ＆ 孤立ファイル検知リンター
りゅう氏原則: フォルダ分類ではなくリンクで繋ぐ。リンクが切れていたり、どの索引からも
リンクされていない孤立ノート（Orphan Files）は死蔵される。
本スクリプトは、全Markdownのリンク切れと孤立ファイルを完全スキャンします。
"""

import os
import sys
import re
from pathlib import Path

# Windows cp932対策
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

REPO_ROOT = Path(__file__).resolve().parent.parent

# スキャン対象ディレクトリ
SCAN_DIRS = [
    REPO_ROOT / "01_INTEL",
    REPO_ROOT / "02_FACTORY",
    REPO_ROOT / ".agent",
    REPO_ROOT / "03_SYSTEMS",
]

# 除外フォルダ
EXCLUDE_DIRS = {
    "node_modules",
    "__pycache__",
    ".git",
    "cache",
    "vault_backups",
    "PRODUCTS",
    "sns_assets",
    "assets",
    "scratch",
}

def get_all_md_files():
    md_files = []
    for sdir in SCAN_DIRS:
        if not sdir.exists():
            continue
        for root, dirs, files in os.walk(sdir):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for file in files:
                if file.endswith(".md"):
                    md_files.append(Path(root) / file)
    return md_files

def parse_markdown_links(file_path):
    links = []
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Markdownリンク [text](target) の正規表現
    pattern = r"\[([^\]]+)\]\(([^)]+)\)"
    for m in re.finditer(pattern, content):
        text = m.group(1)
        target = m.group(2).strip()
        
        # 外部Web URL (http/https) やアンカー (#) は除外
        if target.startswith("http://") or target.startswith("https://") or target.startswith("#"):
            continue
        
        # file:/// スキームの処理
        if target.startswith("file:///"):
            clean_target = target.replace("file:///", "").replace("file://", "")
            # Windows パス修復 (d:/my_work/... -> D:\my_work\...)
            clean_target = clean_target.replace("/", "\\")
            target_path = Path(clean_target)
        else:
            # 相対パス
            clean_target = target.split("#")[0] # アンカー除去
            if not clean_target:
                continue
            target_path = (file_path.parent / clean_target).resolve()

        links.append({
            "text": text,
            "raw": target,
            "resolved_path": target_path
        })
    return links

def audit_links():
    md_files = get_all_md_files()
    file_map = {f.resolve(): f for f in md_files}
    referenced_files = set()
    broken_links = []

    for file_path in md_files:
        links = parse_markdown_links(file_path)
        for link in links:
            target = link["resolved_path"]
            # 存在チェック
            if not target.exists():
                broken_links.append({
                    "source": file_path.relative_to(REPO_ROOT),
                    "text": link["text"],
                    "target": link["raw"]
                })
            else:
                referenced_files.add(target.resolve())

    # 孤立ファイル（どのMarkdownからもリンクされていないファイル）
    # ※ NEXUS_INDEX.md や DAILY_LOG.md、TODO.md などの起点ファイルは除外
    IGNORE_ORPHANS = {"NEXUS_INDEX.md", "DAILY_LOG.md", "TODO.md", "README.md", "SYSTEM_DESIGN.md", "ANTIGRAVITY.md", "FEEDBACK_INBOX.md"}
    
    orphan_files = []
    for fpath in md_files:
        if fpath.name in IGNORE_ORPHANS:
            continue
        if fpath.resolve() not in referenced_files:
            orphan_files.append(fpath.relative_to(REPO_ROOT))

    print("\n" + "="*65)
    print(" 🔗  Sovereign OS ナレッジリンク整合性 ＆ 孤立ファイル監査")
    print("="*65 + "\n")
    print(f"📊 走査対象 Markdown ファイル数: {len(md_files)} 件\n")

    # 1. リンク切れの報告
    if not broken_links:
        print("✅ 【リンク切れ】: 検出されませんでした (0件 / 健全)")
    else:
        print(f"❌ 【リンク切れ検出】: {len(broken_links)} 件のリンク先が存在しません！")
        for b in broken_links[:10]: # 最大10件表示
            print(f"   - 参照元: {b['source']}")
            print(f"     リンク名: [{b['text']}] -> {b['target']}")
        if len(broken_links) > 10:
            print(f"   ...他 {len(broken_links) - 10} 件")

    print("\n" + "-"*65 + "\n")

    # 2. 孤立ファイルの報告
    if not orphan_files:
        print("✅ 【孤立ファイル】: 全てのノートが索引や日誌からリンクされています (0件)")
    else:
        print(f"ℹ️  【孤立（未リンク）ノート】: {len(orphan_files)} 件 (索引への登録を推奨)")
        for o in orphan_files[:10]:
            print(f"   - {o}")
        if len(orphan_files) > 10:
            print(f"   ...他 {len(orphan_files) - 10} 件")

    print("\n" + "="*65 + "\n")
    return len(broken_links)

if __name__ == "__main__":
    broken_count = audit_links()
    # 監査レポートの表示完了。運用を止めないため正常終了とする
    sys.exit(0)

