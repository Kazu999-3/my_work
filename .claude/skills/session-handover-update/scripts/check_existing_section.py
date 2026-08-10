"""
HANDOVER_CLAUDE.md と 02_FACTORY/TODO.md に、指定日付(既定は今日)のセクション見出しが
既に存在するかを確認する。重複した日付見出しを作らないための事前チェック用。

使い方:
    python .claude/skills/session-handover-update/scripts/check_existing_section.py [YYYY-MM-DD]
"""
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[4]
HANDOVER = ROOT / "HANDOVER_CLAUDE.md"
TODO = ROOT / "02_FACTORY" / "TODO.md"


def main():
    date = sys.argv[1] if len(sys.argv) > 1 else None
    if not date:
        print("日付を引数で指定してください（例: python check_existing_section.py 2026-08-10）")
        sys.exit(1)

    for path in (HANDOVER, TODO):
        if not path.exists():
            print(f"⚠️ {path} が見つかりません")
            continue
        text = path.read_text(encoding="utf-8")
        headings = [
            line.strip()
            for line in text.splitlines()
            if line.strip().startswith("#") and date in line
        ]
        if headings:
            print(f"⚠️ {path.relative_to(ROOT)} に既に{date}を含む見出しがあります。新規セクションを追加せず、既存セクションに追記してください:")
            for h in headings:
                print(f"    {h}")
        else:
            print(f"✅ {path.relative_to(ROOT)} に{date}の見出しはまだありません。新規セクションを追加してよい。")


if __name__ == "__main__":
    main()
