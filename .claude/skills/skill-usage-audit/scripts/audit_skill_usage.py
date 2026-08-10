"""
.claude/skills/配下の各スキルが、過去のClaude Codeセッション(ローカルに残っている
トランスクリプトJSONL)で実際に何回呼ばれたかを集計する。

参考にしたnote記事群(2026-08-10)で「常設スキルは少数に絞るべき」
「実運用は結局1桁個に収束する」という指摘が複数あったため、
"作っただけで使われていないスキル"を可視化する目的で作成した。

このスキル自身は何も削除・変更しない。集計結果を表示するだけ。

使い方:
    python .claude/skills/skill-usage-audit/scripts/audit_skill_usage.py
    # トランスクリプト保存先が既定と異なる場合
    python .claude/skills/skill-usage-audit/scripts/audit_skill_usage.py --transcripts-dir "C:/path/to/projects/xxx"
"""
import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[4]
# Claude Codeはプロジェクトパスを "d:\my_work" -> "d--my-work" のようなスラッグに変換して
# ~/.claude/projects/配下に保存する。環境が変わったらここか--transcripts-dirで調整すること。
DEFAULT_TRANSCRIPTS_DIR = Path.home() / ".claude" / "projects" / "d--my-work"


EXCLUDED_PATH_PARTS = {"node_modules", ".venv", "99_ARCHIVE", ".wrangler"}


def list_known_skills():
    """リポジトリ内の全SKILL.mdを探す(ルートの.claude/skillsだけでなく、
    04_PORTAL/.claude/skillsのようなディレクトリスコープ・スキルも含む)。
    サードパーティ配布物(node_modules配下等)は除外する。"""
    names = set()
    for md in ROOT.rglob("SKILL.md"):
        rel_parts = md.relative_to(ROOT).parts
        if any(part in EXCLUDED_PATH_PARTS for part in rel_parts):
            continue
        names.add(md.parent.name)
    return sorted(names)


def extract_skill_invocations(jsonl_path: Path):
    """1つのトランスクリプトファイルから (skill_name, iso_timestamp) のリストを抽出する。"""
    results = []
    try:
        with jsonl_path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or '"Skill"' not in line:
                    continue
                try:
                    obj = json.loads(line)
                except (json.JSONDecodeError, ValueError):
                    continue
                message = obj.get("message")
                if not isinstance(message, dict):
                    continue
                content = message.get("content")
                if not isinstance(content, list):
                    continue
                for item in content:
                    if not isinstance(item, dict):
                        continue
                    if item.get("type") == "tool_use" and item.get("name") == "Skill":
                        skill_name = (item.get("input") or {}).get("skill")
                        if skill_name:
                            results.append((skill_name, obj.get("timestamp")))
    except OSError:
        pass
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--transcripts-dir", default=str(DEFAULT_TRANSCRIPTS_DIR))
    parser.add_argument("--stale-days", type=int, default=30,
                         help="この日数以上呼ばれていない/一度も呼ばれていないスキルを候補として強調する")
    args = parser.parse_args()

    transcripts_dir = Path(args.transcripts_dir)
    if not transcripts_dir.exists():
        print(f"⚠️ トランスクリプトディレクトリが見つかりません: {transcripts_dir}")
        return

    known_skills = list_known_skills()
    counts = defaultdict(int)
    last_used = {}

    jsonl_files = sorted(transcripts_dir.glob("*.jsonl"))
    for jf in jsonl_files:
        for skill_name, ts in extract_skill_invocations(jf):
            counts[skill_name] += 1
            if ts and (skill_name not in last_used or ts > last_used[skill_name]):
                last_used[skill_name] = ts

    print(f"スキャン対象: {len(jsonl_files)}件のトランスクリプト（{transcripts_dir}）")
    print(f"既知のスキル数: {len(known_skills)}件（リポジトリ内の全SKILL.mdから収集、node_modules等は除外）\n")

    now = datetime.now(timezone.utc)
    print(f"{'スキル名':40s} {'呼び出し回数':>10s}  最終使用日")
    print("-" * 80)
    never_used = []
    for name in known_skills:
        c = counts.get(name, 0)
        ts = last_used.get(name)
        if ts:
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                days_ago = (now - dt).days
                ts_display = f"{ts[:10]} ({days_ago}日前)"
            except ValueError:
                ts_display = ts
        else:
            ts_display = "-"
            never_used.append(name)
        flag = "⚠️" if c == 0 else "  "
        print(f"{flag} {name:38s} {c:>10d}  {ts_display}")

    print(f"\n合計: 既知スキル{len(known_skills)}件中、トランスクリプト上で一度も呼び出しが"
          f"確認できなかったもの {len(never_used)}件")
    if never_used:
        print("\n【重要な注意】以下はあくまで「ローカルに残っているトランスクリプトの範囲内で"
              "Skillツール経由の呼び出しが見つからなかった」という意味であり、"
              "実際に一度も役立っていない証拠ではない：")
        print("  - 古いセッションのトランスクリプトはローテーション等で既に消えている場合がある")
        print("  - スキルの中身をSkillツール経由でなく直接読んで参考にしただけのケースは検出できない")
        print("  - 作成直後でまだ使う機会が来ていないだけの新しいスキルも含まれる")
        print("これらを踏まえて、削除するかどうかは必ず人間が最終判断すること。")
        for n in never_used:
            print(f"    - {n}")


if __name__ == "__main__":
    main()
