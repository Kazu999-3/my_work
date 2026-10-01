#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
knowledge_linter.py - 自律型ナレッジベース健全性リンター (Andrey Karpathy LLM Wiki準拠)

本スクリプトは、Karpathy氏の「LLM Wiki」およびSovereign OS「第二の脳運用規範」に従い、
Markdown知識ベース全体の健全性を自動スキャン・監査・修復・ギャップ抽出します。

主な機能:
1. リンク切れ（Broken Links）の検出（Markdownリンク + [[WikiLink]] 両対応）
2. 孤立ノート（Orphan Notes）の検出（どの索引からもリンクされていないファイル）
3. イミュータブルFrontmatter検査（title, status, source_type, verified_at）
4. 知識ギャップ（Research Backlog）の自動抽出（頻出概念で専用ノート未配備のキーワード）
5. --fix オプションによる孤立ノートの索引への自動登録
6. --report オプションによるMarkdown形式レポート生成
"""

import os
import sys
import re
from pathlib import Path
from urllib.parse import unquote

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

SCAN_DIRS = [
    REPO_ROOT / "01_INTEL",
    REPO_ROOT / "02_FACTORY",
    REPO_ROOT / ".agent",
]

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
    "imperial_archive",
    "archive",
    "_archive",
    ".next",
}

IGNORE_ORPHANS = {
    "NEXUS_INDEX.md",
    "DAILY_LOG.md",
    "TODO.md",
    "TODO_ARCHIVE.md",
    "README.md",
    "SYSTEM_DESIGN_BY_FUNCTION.md",
    "ANTIGRAVITY.md",
    "FEEDBACK_INBOX.md",
    "template_tactics_bible.md",
    "template_web_clip.md",
    "template_note_skeleton.md",
    "SKILL.md",
    "GEMINI.md",
}

def get_all_md_files():
    md_files = []
    for sdir in SCAN_DIRS:
        if not sdir.exists():
            continue
        for root, dirs, files in os.walk(sdir):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".")]
            for file in files:
                if file.endswith(".md"):
                    md_files.append(Path(root) / file)
    return md_files

def parse_frontmatter(content):
    if not content.startswith("---"):
        return None
    parts = content.split("---", 2)
    if len(parts) < 3:
        return None
    raw_yaml = parts[1]
    metadata = {}
    for line in raw_yaml.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            k, v = line.split(":", 1)
            metadata[k.strip()] = v.strip().strip('"').strip("'")
    return metadata

def parse_links_and_concepts(file_path):
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # コードブロック（```...```）およびインラインコード（`...`）をマスク（誤検知防止）
    masked_content = re.sub(r"```[\s\S]*?```", "", content)
    masked_content = re.sub(r"`[^`\n]+`", "", masked_content)

    links = []
    # 1. Markdown Links [text](target) - 1段階の入れ子角括弧（例: [タイトル [注記]](url)）にも対応
    md_pattern = r"\[((?:[^\[\]]|\[[^\[\]]*\])*)\]\(([^)]+)\)"
    for m in re.finditer(md_pattern, masked_content):
        text = m.group(1).strip()
        target = m.group(2).strip()
        if target.startswith("http://") or target.startswith("https://") or target.startswith("#"):
            continue
        
        if target.startswith("file:///"):
            clean_target = target.replace("file:///", "").replace("file://", "")
            clean_target = unquote(clean_target.split("#")[0])
            clean_target = clean_target.replace("/", "\\")
            target_path = Path(clean_target)
        else:
            clean_target = unquote(target.split("#")[0])
            if not clean_target:
                continue
            target_path = (file_path.parent / clean_target).resolve()

        links.append({"text": text, "raw": target, "resolved_path": target_path, "type": "markdown"})

    # 2. Obsidian WikiLinks [[target|text]] or [[target]]
    wiki_pattern = r"\[\[([^\]]+)\]\]"
    for m in re.finditer(wiki_pattern, masked_content):
        inner = m.group(1).strip()
        if "|" in inner:
            target_name, text = inner.split("|", 1)
        else:
            target_name, text = inner, inner
        target_name = target_name.split("#")[0].strip()
        if not target_name:
            continue
        
        # WikiLinkはファイル名（拡張子なし含む）への参照
        links.append({"text": text, "raw": inner, "target_name": target_name, "type": "wikilink"})

    frontmatter = parse_frontmatter(content)

    return links, frontmatter, content

def run_linter(fix=False, report=False):
    md_files = get_all_md_files()
    filename_to_paths = {}
    for f in md_files:
        stem = f.stem.lower()
        filename_to_paths.setdefault(stem, []).append(f)
        filename_to_paths.setdefault(f.name.lower(), []).append(f)

    referenced_paths = set()
    broken_links = []
    missing_frontmatter = []
    invalid_frontmatter = []
    orphans = []

    # 頻出概念の探索用
    concept_mentions = {}
    CORE_CONCEPTS = [
        "インベード", "パワースパイク", "ローム", "スプリットプッシュ", "オブジェクト管理",
        "プライオリティ", "ウェーブフリーズ", "スロープッシュ", "ダイブ", "ガンク優先度",
        "ディープワード", "没理由", "イミュータブル", "第二の脳", "LLM Wiki"
    ]

    for fpath in md_files:
        links, fm, text = parse_links_and_concepts(fpath)

        # Frontmatter点検
        if fm is None:
            # 日誌や下書き以外のIntel系・定常WikiノートでFrontmatter欠落を警告
            if "01_INTEL" in str(fpath) and fpath.name not in IGNORE_ORPHANS:
                missing_frontmatter.append(fpath.relative_to(REPO_ROOT))
        else:
            req_keys = ["status", "source_type", "verified_at"]
            missing_keys = [k for k in req_keys if k not in fm]
            if missing_keys and "01_INTEL" in str(fpath):
                invalid_frontmatter.append((fpath.relative_to(REPO_ROOT), missing_keys))

        # リンク解決 ＆ リンク切れ点検
        for link in links:
            if link["type"] == "markdown":
                target = link["resolved_path"]
                if not target.exists():
                    broken_links.append({
                        "source": fpath.relative_to(REPO_ROOT),
                        "text": link["text"],
                        "target": link["raw"]
                    })
                else:
                    referenced_paths.add(target.resolve())
            elif link["type"] == "wikilink":
                tname = link["target_name"].lower()
                if tname in filename_to_paths:
                    for matched_file in filename_to_paths[tname]:
                        referenced_paths.add(matched_file.resolve())
                else:
                    broken_links.append({
                        "source": fpath.relative_to(REPO_ROOT),
                        "text": link["text"],
                        "target": f"[[{link['raw']}]]"
                    })

        # 概念キーワードの言及集計
        for c in CORE_CONCEPTS:
            if c in text:
                concept_mentions[c] = concept_mentions.get(c, 0) + 1

    # 孤立ファイル特定
    for fpath in md_files:
        if fpath.name in IGNORE_ORPHANS:
            continue
        if fpath.resolve() not in referenced_paths:
            orphans.append(fpath)

    # 知識ギャップ抽出（言及数 >= 3 だが専用ノートが存在しない概念）
    knowledge_gaps = []
    for concept, count in concept_mentions.items():
        if count >= 3:
            # ファイル名または概念ノートのタイトルに概念が含まれているかチェック
            exists = False
            for f in md_files:
                if concept.lower() in f.stem.lower():
                    exists = True
                    break
                if "concepts" in str(f) or "knowledge_second_brain_codex" in f.name:
                    try:
                        with open(f, "r", encoding="utf-8", errors="ignore") as cf:
                            c_head = cf.read(500)
                            if concept in c_head:
                                exists = True
                                break
                    except Exception:
                        pass
            if not exists:
                knowledge_gaps.append((concept, count))

    # コンソール出力
    print("\n" + "="*65)
    print(" 🧠 Sovereign OS ナレッジLinter（LLM Wiki健全性点検）")
    print("="*65)
    print(f"📊 走査対象 Markdown ファイル数: {len(md_files)} 件\n")

    print(f"🔗 【リンク切れ】: {len(broken_links)} 件")
    for b in broken_links[:5]:
        print(f"   - {b['source']}: [{b['text']}] -> {b['target']}")
    if len(broken_links) > 5:
        print(f"   ...他 {len(broken_links) - 5} 件")

    print(f"\n🏝️  【孤立（未リンク）ノート】: {len(orphans)} 件")
    for o in orphans[:5]:
        print(f"   - {o.relative_to(REPO_ROOT)}")
    if len(orphans) > 5:
        print(f"   ...他 {len(orphans) - 5} 件")

    print(f"\n📑 【Frontmatter規約点検】:")
    print(f"   - 未付与 (01_INTEL内): {len(missing_frontmatter)} 件")
    print(f"   - 必須フィールド欠落: {len(invalid_frontmatter)} 件")

    print(f"\n💡 【知識ギャップ（リサーチバックログ）】:")
    if knowledge_gaps:
        for concept, count in sorted(knowledge_gaps, key=lambda x: x[1], reverse=True):
            print(f"   - 「{concept}」: {count} 件のノートで言及（独立した解説ノートが未配備）")
    else:
        print("   - 検出されませんでした（主要概念はすべてノート化済み）")

    print("\n" + "="*65)

    # 自動修復（--fix）
    if fix and orphans:
        print("\n🔧 --fix: 孤立ノートを NEXUS_INDEX.md の末尾に自動補完中...")
        nexus_path = REPO_ROOT / "01_INTEL" / "NEXUS_INDEX.md"
        with open(nexus_path, "r", encoding="utf-8") as f:
            nexus_content = f.read()

        added_count = 0
        append_lines = ["\n\n### 📦 自動検知された未整理ノート (Linter Auto-Linked)\n"]
        for o in orphans:
            rel = o.relative_to(REPO_ROOT).as_posix()
            link_entry = f"- [{o.stem}](file:///{REPO_ROOT.as_posix()}/{rel})"
            if link_entry not in nexus_content:
                append_lines.append(f"{link_entry}\n")
                added_count += 1

        if added_count > 0:
            with open(nexus_path, "w", encoding="utf-8") as f:
                f.write(nexus_content + "".join(append_lines))
            print(f"✅ {added_count} 件の孤立ノートを NEXUS_INDEX.md へ追加登録しました。")
        else:
            print("ℹ️  既に追加済みのためスキップしました。")

    # レポート生成（--report）
    if report:
        report_path = REPO_ROOT / "02_FACTORY" / "KNOWLEDGE_LINT_REPORT.md"
        with open(report_path, "w", encoding="utf-8") as f:
            f.write("# 📋 Sovereign OS ナレッジ健全性点検レポート\n\n")
            f.write(f"- 走査ファイル数: {len(md_files)}\n")
            f.write(f"- リンク切れ: {len(broken_links)}\n")
            f.write(f"- 孤立ノート: {len(orphans)}\n")
            f.write(f"- Frontmatter未付与: {len(missing_frontmatter)}\n\n")
            f.write("## 💡 知識ギャップ（優先リサーチ対象）\n\n")
            for c, cnt in knowledge_gaps:
                f.write(f"- **{c}** ({cnt}回言及) ➔ 概念ノートの新設を推奨\n")
        print(f"📄 レポートを出力しました: {report_path.relative_to(REPO_ROOT)}")

    return len(broken_links)

if __name__ == "__main__":
    fix_flag = "--fix" in sys.argv
    report_flag = "--report" in sys.argv
    run_linter(fix=fix_flag, report=report_flag)
