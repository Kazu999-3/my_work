"""
HANDOVER_CLAUDE.md / 02_FACTORY/TODO.md を最後に更新したコミットと、
実際のgitコミット履歴を突き合わせ、「引き継ぎ更新(session-handover-update)を
使い忘れているセッションがなかったか」を検出する。

日付の文字列一致ではなくコミット祖先関係で比較する(同日中に複数セッションが
走ると日付ベースの比較は常に「まだ今日」と誤検知するため)。

このスキル自身は何も書き換えない。差分を報告するだけ。

使い方:
    python .claude/skills/handover-staleness-check/scripts/check_staleness.py
"""
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[4]
HANDOVER = "HANDOVER_CLAUDE.md"
TODO = "02_FACTORY/TODO.md"
WATCH_PATHS = ["02_FACTORY", "03_SYSTEMS", "04_PORTAL", ".claude"]
STALE_COMMIT_THRESHOLD = 8  # このファイル数を超える未反映コミットがあれば警告


def run_git(args):
    result = subprocess.run(["git"] + args, cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def last_commit_touching(path: str):
    out = run_git(["log", "-1", "--format=%H", "--", path])
    return out or None


def main():
    handover_hash = last_commit_touching(HANDOVER)
    todo_hash = last_commit_touching(TODO)

    if not handover_hash or not todo_hash:
        print("⚠️ HANDOVER_CLAUDE.mdまたはTODO.mdの更新履歴が取得できませんでした(git管理下か確認してください)。")
        sys.exit(1)

    print(f"HANDOVER_CLAUDE.mdを最後に更新したコミット: {handover_hash[:9]}")
    print(f"02_FACTORY/TODO.mdを最後に更新したコミット: {todo_hash[:9]}")

    if handover_hash == todo_hash:
        baseline = handover_hash
    else:
        full_log = run_git(["log", "--format=%H"])
        if full_log is None:
            print("⚠️ git logの取得に失敗しました。")
            sys.exit(1)
        order = full_log.splitlines()
        try:
            idx_handover = order.index(handover_hash)
            idx_todo = order.index(todo_hash)
        except ValueError:
            print("⚠️ コミット履歴の突き合わせに失敗しました(git logの出力が想定外)。")
            sys.exit(1)
        # listはnewest first。indexが大きい方=より古い=より更新が遅れている方をbaselineにする。
        baseline = handover_hash if idx_handover > idx_todo else todo_hash

    log_output = run_git(["log", f"{baseline}..HEAD", "--oneline", "--"] + WATCH_PATHS)
    commits = [l for l in (log_output or "").splitlines() if l.strip()]

    print(f"\n最終更新コミット以降の未反映コミット候補: {len(commits)}件")

    if len(commits) > STALE_COMMIT_THRESHOLD:
        print("\n⚠️ HANDOVER_CLAUDE.md / TODO.mdが古くなっている可能性があります。"
              "session-handover-updateスキルで最新の作業内容を追記することを検討してください。")
        for c in commits:
            print(f"  {c}")
    elif commits:
        print("多少の未反映コミットがありますが、閾値未満です。次回のセッション終わりにまとめて反映すれば十分です。")
        for c in commits:
            print(f"  {c}")
    else:
        print("✅ 直近のコミットはすべて反映済みのようです。")


if __name__ == "__main__":
    main()
