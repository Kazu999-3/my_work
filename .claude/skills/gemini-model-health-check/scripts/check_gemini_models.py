#!/usr/bin/env python3
"""
コードベース内でハードコードされているGeminiモデル名を洗い出し、
このアカウントで実際にクォータがあるか(429/RESOURCE_EXHAUSTEDにならないか)を
1体ずつ実際にAPIへ軽量リクエストを送って検証する。

背景(2026-08-10): gemini-2.0-flash/gemini-2.0-flash-lite/gemini-1.5-flash/
gemini-2.5-pro等が、このアカウントのAI Studioクォータ画面上で無料枠0/0
(そもそも割り当てなし)だったにもかかわらず、コード上は「実在するモデル名」
として長期間使われ続け、数時間規模の障害調査を招いた。次に同じ問題を
繰り返さないよう、モデル名を追加・変更するたびに、または429が疑われる際に
このスクリプトで機械的に確認する。

使い方:
    python check_gemini_models.py
"""
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]  # .claude/skills/gemini-model-health-check/scripts -> リポジトリルート

# コード内のGeminiモデル名を拾う正規表現。
# "gemini-2.0-flash" "gemini-3.1-flash-lite" のような実在しうる形式のみ拾い、
# コメント中の説明文言などは基本的に引っかからない(ハイフン区切りの英数字のみ)。
MODEL_PATTERN = re.compile(r"gemini-[a-z0-9]+(?:\.[a-z0-9]+)?-?[a-z0-9-]*", re.IGNORECASE)

# 明らかにモデル名ではない誤検出(embedding系・robotics系等、通常のtext生成テストでは
# 別の呼び出し方が必要なものや、ドキュメント上の言及のみで実際には呼ばれないもの)を除外する。
EXCLUDE_SUBSTRINGS = ("embedding", "robotics", "live", "tts", "omni", "native-audio")

SEARCH_DIRS = [
    ROOT / "03_SYSTEMS",
    ROOT / "04_PORTAL" / "src",
]
SEARCH_EXTENSIONS = {".py", ".ts", ".tsx", ".js"}


def find_model_references() -> dict[str, list[str]]:
    """コードベース中の "gemini-xxx" 文字列と、それが出てくるファイル一覧を集める。"""
    hits: dict[str, set[str]] = {}
    for base in SEARCH_DIRS:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.suffix not in SEARCH_EXTENSIONS:
                continue
            if "node_modules" in path.parts or ".venv" in path.parts:
                continue
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            for m in MODEL_PATTERN.finditer(text):
                model = m.group(0).rstrip("-.")
                if any(ex in model.lower() for ex in EXCLUDE_SUBSTRINGS):
                    continue
                rel = str(path.relative_to(ROOT))
                hits.setdefault(model, set()).add(rel)
    return {k: sorted(v) for k, v in hits.items()}


def test_model(client, model: str) -> tuple[bool, str]:
    """実際に軽量リクエストを送って生死を確認する。"""
    from google.genai.errors import APIError
    try:
        res = client.models.generate_content(model=model, contents="OK とだけ返してください。")
        if res and res.text:
            return True, "OK"
        return False, "空レスポンス"
    except APIError as e:
        msg = str(e)
        if "RESOURCE_EXHAUSTED" in msg or e.code == 429:
            # limit: 0 は「そもそも割り当てが無い」、それ以外は「一時的な枯渇」の可能性がある。
            if "limit: 0" in msg:
                return False, "❌ クォータ割り当て0(このアカウントでは使用不可)"
            return False, "⚠️ 429(枯渇中。後で再確認を推奨、恒久的に0とは限らない)"
        return False, f"❌ {e.code} {getattr(e, 'status', '?')}"
    except Exception as e:
        return False, f"❌ {type(e).__name__}: {str(e)[:150]}"


def main():
    # Windows(日本語ロケール)のコンソールは既定でcp932のため、絵文字混じりの出力が
    # UnicodeEncodeErrorで落ちる。UTF-8に明示的に切り替える(2026-08-10発覚)。
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    sys.path.insert(0, str(ROOT / "03_SYSTEMS"))
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")

    api_key = os.environ.get("GEMINI_API_KEY_FREE") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY_FREE / GEMINI_API_KEY が.envに設定されていません。")
        sys.exit(1)

    from google import genai
    client = genai.Client(api_key=api_key)

    refs = find_model_references()
    if not refs:
        print("コード内にgemini-*形式のモデル名参照が見つかりませんでした。")
        return

    print(f"{'モデル名':<28} {'結果':<45} 参照元")
    print("-" * 100)
    dead_models = []
    for model in sorted(refs.keys()):
        ok, detail = test_model(client, model)
        status = "✅ 動作OK" if ok else detail
        files = ", ".join(refs[model][:3]) + (" ..." if len(refs[model]) > 3 else "")
        print(f"{model:<28} {status:<45} {files}")
        if not ok:
            dead_models.append((model, refs[model]))
        time.sleep(1.0)  # 分単位レート制限に配慮

    if dead_models:
        print("\n⚠️ 以下のモデルは現在使用できません。参照元コードの修正を検討してください:")
        for model, files in dead_models:
            print(f"  - {model}: {len(files)}ファイルで参照")
            for f in files:
                print(f"      {f}")


if __name__ == "__main__":
    main()
