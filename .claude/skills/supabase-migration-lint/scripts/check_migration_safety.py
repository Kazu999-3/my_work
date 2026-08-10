"""
新規/変更したSupabase(Postgres)マイグレーションSQLを、このプロジェクトで実際に
踏んだ既知の罠に照らしてスキャンする。ORM/PostgRESTのエラーメッセージからは
原因が分かりにくいパターンを、マイグレーションを書いた/適用する前に検出する。

使い方:
    # 特定のファイルだけチェック(新規マイグレーションを書いた直後に推奨)
    python .claude/skills/supabase-migration-lint/scripts/check_migration_safety.py \
        04_PORTAL/supabase/migrations/56_xxx.sql

    # 引数無しなら既存の全マイグレーションを一括監査
    python .claude/skills/supabase-migration-lint/scripts/check_migration_safety.py
"""
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[4]
MIGRATIONS_DIR = ROOT / "04_PORTAL" / "supabase" / "migrations"

PARTIAL_UNIQUE_INDEX_RE = re.compile(
    r"CREATE\s+UNIQUE\s+INDEX[^;]*?\bWHERE\b[^;]*;", re.IGNORECASE | re.DOTALL
)
IDENTITY_COLUMN_RE = re.compile(
    r'"?(\w+)"?\s+\w+\s+GENERATED\s+(ALWAYS|BY DEFAULT)\s+AS\s+IDENTITY', re.IGNORECASE
)
CREATE_TABLE_RE = re.compile(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\"?(\w+)\"?", re.IGNORECASE)
RLS_ENABLE_RE = re.compile(r"ENABLE\s+ROW\s+LEVEL\s+SECURITY", re.IGNORECASE)


def check_file(path: Path):
    text = path.read_text(encoding="utf-8")
    findings = []

    for m in PARTIAL_UNIQUE_INDEX_RE.finditer(text):
        findings.append((
            "⚠️ 部分ユニークインデックス(WHERE付き)",
            "supabase-jsの.upsert({onConflict: '...'})は部分インデックスのWHERE述語まで指定できず、"
            "「no unique or exclusion constraint matching the ON CONFLICT specification」で失敗する"
            "(migration 53→54で実際に発生)。このインデックスをON CONFLICTのターゲットとして使うなら、"
            "本当に部分条件が必要か再検討する(NULL同士は元々「等しくない」とみなされるため、"
            "「NULLは重複扱いしない」が目的なら部分条件は不要なことが多い)。",
            m.group(0)[:120].replace("\n", " ") + "...",
        ))

    for m in IDENTITY_COLUMN_RE.finditer(text):
        findings.append((
            f"⚠️ Identity列 '{m.group(1)}'",
            "GENERATED ALWAYS AS IDENTITYの列にアプリ側からIDを明示指定してinsert/upsertすると"
            '"cannot insert a non-DEFAULT value into column" で失敗する(CLAUDE.md §3④)。'
            "この列を使うinsert/upsertコードにIDを明示していないか確認し、更新はID指定の個別updateで行う。",
            m.group(0),
        ))

    tables_without_rls = []
    for m in CREATE_TABLE_RE.finditer(text):
        table_name = m.group(1)
        after = text[m.end():]
        if not RLS_ENABLE_RE.search(after) and not RLS_ENABLE_RE.search(text[:m.start()]):
            tables_without_rls.append(table_name)
    for t in tables_without_rls:
        findings.append((
            f"ℹ️ 新規テーブル '{t}' にこのファイル内でのRLS有効化が見当たらない",
            "同一マイグレーション内で有効化していないだけの可能性もある(既存の別ファイルで有効化している場合は無視してよい)。"
            "本当に未設定ならRLSがデフォルトで無効(全開放)になる。新規テーブルをAPIルート経由で公開する前に"
            "supabase-table-securityスキルのチェックリストに従うこと。",
            None,
        ))

    return findings


def main():
    args = sys.argv[1:]
    if args:
        targets = [Path(a) if Path(a).is_absolute() else ROOT / a for a in args]
    else:
        targets = sorted(MIGRATIONS_DIR.glob("*.sql"))

    total_findings = 0
    for path in targets:
        if not path.exists():
            print(f"⚠️ ファイルが見つかりません: {path}")
            continue
        findings = check_file(path)
        if not findings:
            continue
        total_findings += len(findings)
        print(f"\n=== {path.relative_to(ROOT)} ===")
        for title, detail, snippet in findings:
            print(f"  {title}")
            print(f"    {detail}")
            if snippet:
                print(f"    該当箇所: {snippet}")

    if total_findings == 0:
        print("✅ 既知の罠パターンは検出されませんでした。")
    else:
        print(f"\n合計 {total_findings} 件の要確認項目があります。誤検知もあるので、各項目を目視で判断すること。")


if __name__ == "__main__":
    main()
