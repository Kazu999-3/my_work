#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/audit_tactics_bibles.py
戦術バイブル群（01_INTEL/tactics/）のフロントマター・パッチ状態を点検し、
イミュータブル規約や非推奨ステータスを監査・更新するスクリプト。

使い方:
  py scripts/audit_tactics_bibles.py          # 点検のみ
  py scripts/audit_tactics_bibles.py --fix    # verified_at欠落補完 ＆ パッチ差分注記反映
"""

import sys
import json
import argparse
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
TACTICS_DIR = REPO_ROOT / "01_INTEL" / "tactics"
PATCH_DIFF_FILE = REPO_ROOT / "01_INTEL" / "_LOL" / "patch_modified_champions.json"

def load_patch_diffs():
    if not PATCH_DIFF_FILE.exists():
        return {}
    try:
        data = json.loads(PATCH_DIFF_FILE.read_text(encoding="utf-8"))
        res = {}
        for c in data.get("champions", []):
            res[c["id"].lower()] = {
                "name": c["name"],
                "old_patch": data.get("old_patch", "16.18.1"),
                "new_patch": data.get("new_patch", "16.19.1"),
                "diffs": c.get("diffs", {})
            }
        return res
    except Exception as e:
        print(f"[WARN] パッチ差分JSON読み込みエラー: {e}")
        return {}

def audit_and_fix(fix=False):
    files = sorted(TACTICS_DIR.glob("*.md"))
    patch_diffs = load_patch_diffs()

    print(f"Total tactics files found: {len(files)}")
    print(f"Loaded patch diffs for champions: {list(patch_diffs.keys())}")
    print(f"{'Filename':30} | {'Status':14} | {'VerifiedAt':12} | Patch Note | Title")
    print("-" * 100)

    fixed_count = 0
    deprecated_count = 0

    for f in files:
        if f.name == "template_tactics_bible.md":
            continue
        content = f.read_text(encoding="utf-8")
        lines = content.splitlines()

        in_fm = False
        fm_end_idx = -1
        title = "N/A"
        status = "N/A"
        verified_at = None
        published_at = "2026-09-18"

        for idx, line in enumerate(lines):
            line_s = line.strip()
            if line_s == "---":
                if not in_fm:
                    in_fm = True
                    continue
                else:
                    fm_end_idx = idx
                    break
            if in_fm:
                if line_s.startswith("title:"):
                    title = line_s.split(":", 1)[1].strip().strip('"\'')
                elif line_s.startswith("status:"):
                    status = line_s.split(":", 1)[1].strip().split("#")[0].strip()
                elif line_s.startswith("verified_at:"):
                    verified_at = line_s.split(":", 1)[1].strip()
                elif line_s.startswith("published_at:"):
                    published_at = line_s.split(":", 1)[1].strip()

        # パッチ差分対象かチェック
        cid = f.name.replace("_tactics_bible.md", "").lower()
        has_patch_diff = cid in patch_diffs
        diff_info = patch_diffs.get(cid)

        # status: deprecated の場合の [旧] 接頭辞チェック
        needs_old_prefix = (status == "deprecated" and not title.startswith("[旧]"))

        patch_note_status = "OK"
        if has_patch_diff and "16.19.1" not in content:
            patch_note_status = "DIFF_PENDING"

        print(f"{f.name:30} | {status:14} | {str(verified_at):12} | {patch_note_status:12} | {title}")

        if fix:
            modified = False
            new_lines = list(lines)

            # 1. verified_at の補完（イミュータブル規約）
            if verified_at is None:
                # yorick は verified なので published_at、他は未実戦のため unverified
                v_val = published_at if status == "verified" else "unverified"
                # fm_end_idx の直前に挿入
                new_lines.insert(fm_end_idx, f"verified_at: {v_val}")
                fm_end_idx += 1
                modified = True

            # 2. [旧] プレフィックスの付与（deprecated の場合）
            if needs_old_prefix:
                for i in range(fm_end_idx):
                    if new_lines[i].startswith("title:"):
                        new_lines[i] = f'title: "[旧] {title}"'
                        modified = True
                        break

            # 3. パッチ16.19.1差分の注記追記（未反映の場合）
            if has_patch_diff and "16.19.1" not in content and diff_info:
                diff_desc = []
                for k, v in diff_info["diffs"].items():
                    diff_desc.append(f"{k}: {v.get('old')} → {v.get('new')}")
                diff_text = ", ".join(diff_desc)
                note = f"\n> ⚠️ **パッチ{diff_info['new_patch']}差分速報**: 基礎ステータス変動あり ({diff_text})。実戦数値・キルラインに留意すること。\n"
                
                # 📌 基本方針の直前に挿入
                insert_idx = -1
                for i, l in enumerate(new_lines):
                    if l.startswith("## 📌") or l.startswith("## 基本方針"):
                        insert_idx = i
                        break
                if insert_idx != -1:
                    new_lines.insert(insert_idx, note)
                else:
                    new_lines.append(note)

                # イミュータブル履歴にも追記
                hist_idx = -1
                for i, l in enumerate(new_lines):
                    if "イミュータブル変更履歴" in l or "Immutable Log" in l:
                        hist_idx = i
                        break
                hist_entry = f"- **2026-09-24**: パッチ{diff_info['new_patch']}調整差分検知（{diff_text}）を注記反映。"
                if hist_idx != -1:
                    # 見出しの次の行群の末尾に追記
                    new_lines.insert(hist_idx + 2, hist_entry)
                else:
                    new_lines.append(f"\n## 📜 イミュータブル変更履歴\n{hist_entry}\n")

                modified = True

            if modified:
                f.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
                fixed_count += 1

    print("-" * 100)
    if fix:
        print(f"🎉 監査 ＆ 修正完了: {fixed_count} ファイルを規約に準拠させました。")
    else:
        print(f"点検完了。修正を実行するには `py scripts/audit_tactics_bibles.py --fix` を実行してください。")

def main():
    parser = argparse.ArgumentParser(description="戦術バイブル棚卸し＆イミュータブル規約監査")
    parser.add_argument("--fix", action="store_true", help="verified_atの補完とパッチ差分の注記反映を実行")
    args = parser.parse_args()

    audit_and_fix(fix=args.fix)

if __name__ == "__main__":
    main()
