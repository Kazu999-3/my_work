import os
import sys
import re
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path("d:/my_work/05_PILOT/src")

# 置換パターンの定義
# slate-* -> zinc-*
# indigo-* -> amber-*
# purple-* -> amber-* (ただし紫が特定の意味を持つ場合を除く)

patterns = [
    (re.compile(r'\bslate-(\d+)\b'), r'zinc-\1'),
    (re.compile(r'\bindigo-(\d+)\b'), r'amber-\1'),
]

files = list(BASE_DIR.glob("**/*.tsx")) + list(BASE_DIR.glob("**/*.ts")) + list(BASE_DIR.glob("**/*.css"))

total_replacements = 0
modified_files = []

for f in sorted(files):
    # .next ディレクトリ等は除外
    if ".next" in str(f) or "node_modules" in str(f):
        continue
    
    content = f.read_text(encoding="utf-8")
    orig = content
    
    # 置換
    for pat, repl in patterns:
        content = pat.sub(repl, content)
        
    if content != orig:
        count = len(re.findall(r'\b(slate|indigo)-\d+\b', orig))
        modified_files.append((f, count, content))
        total_replacements += count

print(f"🔍 検出結果: {len(modified_files)} ファイル, 計 {total_replacements} 箇所の置換候補")
for f, count, _ in modified_files[:15]:
    rel = f.relative_to(Path("d:/my_work/05_PILOT"))
    print(f"  - {str(rel):50s}: {count:3d} 箇所")

if len(sys.argv) > 1 and sys.argv[1] == "--apply":
    print("\n🚀 置換を適用します...")
    for f, _, new_content in modified_files:
        f.write_text(new_content, encoding="utf-8")
    print(f"✅ {len(modified_files)} ファイルの置換を完了しました。")
else:
    print("\nℹ️ 実際の書き換えを行うには `py -3.14 scripts/unify_05_palette.py --apply` を実行してください。")
