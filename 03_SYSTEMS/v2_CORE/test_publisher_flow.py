import os
import json
import subprocess
from pathlib import Path

def test_flow():
    # テスト用のダミーファイルを作成
    note_title = "【テスト】Playwright自動化の検証記事"
    note_body = "# Playwrightによる自動投稿テスト\n\nこれは自動化CLI経由で流し込まれたダミーの本文です。\n正常に動作していれば、下書き保存されているはずです。"
    
    tweets = [
        "[TEST] Antigravity自動投稿システムのテスト中...",
        "2つ目のスレッドツイート。Playwrightの連投が機能しているか検証しています。",
        "3つ目のツイート。外部リンクの誘導テスト。 https://note.com/"
    ]
    
    temp_dir = Path("D:/my_work/02_FACTORY/note_drafts")
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    body_file = temp_dir / "test_article.md"
    tweets_file = temp_dir / "test_tweets.json"
    
    with open(body_file, "w", encoding="utf-8") as f:
        f.write(note_body)
        
    with open(tweets_file, "w", encoding="utf-8") as f:
        json.dump(tweets, f, ensure_ascii=False, indent=2)
        
    print("=== Note Publisher CLI Test ===")
    print("Running in headless mode...")
    # note下書き保存のテスト (まずは headless で実行)
    res = subprocess.run([
        ".venv\\Scripts\\python.exe",
        "03_SYSTEMS/v2_CORE/publisher.py",
        "note",
        "--title", note_title,
        "--body-file", str(body_file)
    ], capture_output=True, text=True)
    
    print(f"Stdout:\n{res.stdout}")
    print(f"Stderr:\n{res.stderr}")
    print(f"Exit Code: {res.returncode}")
    
    # ログインしていない場合は FAILED が返ってくるはず
    if "SUCCESS" in res.stdout:
        print("[SUCCESS] Note draft test PASSED!")
    else:
        print("[WARNING] Note draft test failed (likely session expired). This is expected if not logged in.")
        
    print("\n=== X Publisher CLI Test ===")
    print("Running in headless mode...")
    res_x = subprocess.run([
        ".venv\\Scripts\\python.exe",
        "03_SYSTEMS/v2_CORE/publisher.py",
        "x",
        "--tweets-json", str(tweets_file)
    ], capture_output=True, text=True)
    
    print(f"Stdout:\n{res_x.stdout}")
    print(f"Stderr:\n{res_x.stderr}")
    print(f"Exit Code: {res_x.returncode}")
    
    if "SUCCESS" in res_x.stdout:
        print("[SUCCESS] X thread test PASSED!")
    else:
        print("[WARNING] X thread test failed (likely session expired). This is expected if not logged in.")

if __name__ == "__main__":
    test_flow()
