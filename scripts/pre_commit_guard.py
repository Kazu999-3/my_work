#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pre_commit_guard.py - 機密情報・APIキー誤コミット防止セキュリティ番犬
Coupen原則: 認証情報やAPIキーをナレッジやコードにハードコードしてはならない。
Gitにステージングされた差分を検査し、漏洩リスクのあるトークンを検知した場合はコミットをブロックします。
"""

import sys
import subprocess
import re
from pathlib import Path

# Windows cp932対策
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

REPO_ROOT = Path(__file__).resolve().parent.parent

# 検出対象のパターン
SECRET_PATTERNS = [
    (r"AIzaSy[A-Za-z0-9_-]{33}", "Google Gemini/Firebase API Key"),
    (r"sk-[a-zA-Z0-9]{32,}", "OpenAI/Claude API Secret Key"),
    (r"ghp_[a-zA-Z0-9]{36}", "GitHub Personal Access Token"),
    (r"xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32}", "Slack Token"),
    (r"-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----", "Private Key File"),
    (r"(?i)(password|secret|api_key|token)\s*=\s*['\"][a-zA-Z0-9_\-\.]{16,}['\"]", "Generic Hardcoded Secret"),
]

# 走査対象外（安全なダミーやテストファイル）
WHITELIST_FILES = [
    "pre_commit_guard.py",
    "known_pitfalls.md",
]

def scan_git_diff():
    print("🐕 Pre-Commit 機密ガードを走査中...")
    try:
        # ステージングされた差分を取得 (git diff --cached)
        res = subprocess.run(["git", "diff", "--cached"], cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8")
        diff_text = res.stdout
        
        # ステージングが空なら直近のワーキングツリー差分を取得
        if not diff_text.strip():
            res = subprocess.run(["git", "diff"], cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8")
            diff_text = res.stdout
    except Exception as e:
        print(f"⚠️ Git差分取得エラー: {e}")
        return True

    if not diff_text.strip():
        print("✅ 差分なし（スキャン対象なし）")
        return True

    violations = []
    current_file = "Unknown"

    for line in diff_text.splitlines():
        if line.startswith("+++ b/"):
            current_file = line[6:]
            continue
        
        # 削除行(-)は無視、追加行(+)のみチェック
        if not line.startswith("+") or line.startswith("+++"):
            continue
        
        # ホワイトリスト対象ファイルはスキップ
        if any(w in current_file for w in WHITELIST_FILES):
            continue

        added_content = line[1:]
        for pattern, desc in SECRET_PATTERNS:
            if re.search(pattern, added_content):
                # .envの参照（process.env.XXX など）は除外
                if "process.env" in added_content or "os.environ" in added_content or "getenv" in added_content:
                    continue
                violations.append({
                    "file": current_file,
                    "desc": desc,
                    "line": added_content.strip()[:60]
                })

    if violations:
        print("\n" + "🚨"*30)
        print(" ❌ 【コミット停止】機密情報またはAPIキーが検出されました！")
        print("🚨"*30 + "\n")
        for v in violations:
            print(f" - ファイル: {v['file']}")
            print(f"   種別: {v['desc']}")
            print(f"   該当行スニペット: {v['line']}...\n")
        print("⚠️ 認証情報は .env に逃がし、コードやノートに直接書き込まないでください（Coupen原則）。")
        return False

    print("✅ 機密情報・APIキーの漏洩なし。安全にコミット可能です。")
    return True

if __name__ == "__main__":
    is_safe = scan_git_diff()
    if not is_safe:
        sys.exit(1)
