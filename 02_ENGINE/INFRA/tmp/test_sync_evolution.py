import os
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv

# パス設定
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR / "02_intelligence"))

# エラー回避のため load_dotenv
load_dotenv(ROOT_DIR / ".env")

from hybrid_bot.src.omni_sync import OmniSyncPro

def test_sync_evolution():
    syncer = OmniSyncPro()
    NOTION_TOKEN = os.getenv('NOTION_API_KEY')
    NOTION_DB_ID = os.getenv('NOTION_OMNI_SYNC_DB_ID')
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }

    print("🧪 テスト1: ジャンル別フォルダ仕分けの検証")
    # 既存の Shyvana レポートを特定してジャンルを 'LoL' に変更
    url = f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query"
    query = {"filter": {"property": "名前", "title": {"contains": "shyvana"}}}
    res = requests.post(url, headers=headers, json=query)
    results = res.json().get("results", [])
    
    if results:
        page_id = results[0]["id"]
        print(f"  Found page: {page_id}")
        # ジャンルを LoL に更新
        patch_url = f"https://api.notion.com/v1/pages/{page_id}"
        requests.patch(patch_url, headers=headers, json={"properties": {"ジャンル": {"select": {"name": "LoL"}}}})
        print("  Updated Notion Genre to 'LoL'")
        
        print("  🔄 同期 (Pull) 実行中...")
        syncer.cargo_pull_all()
        
        # 確認
        expected_path = ROOT_DIR / "03_factory" / "reports" / "LoL" / "shyvana_jg_p2606_deep_dive.md"
        if expected_path.exists():
            print(f"  ✅ 成功: ファイルが {expected_path} に移動されました。")
        else:
            print(f"  ❌ 失敗: ファイルが期待した場所にありません。")
            # デバッグ用に出力
            base_dir = ROOT_DIR / "03_factory" / "reports"
            print(f"  Current contents of {base_dir}: {[f.name for f in base_dir.glob('**/*.md')]}")
    else:
        print("  ❌ 失敗: 対象のページが見つかりませんでした。")

    print("\n🧪 テスト2: ゴミ箱 (05_garbage) 機能の検証")
    # ローカルにダッシュアイテムを作成し、Notion側のタイトルを変えて「消えた」ことにする
    dummy_file = ROOT_DIR / "03_factory" / "reports" / "dummy_to_delete.md"
    dummy_file.write_text("Dummy content", encoding="utf-8")
    print(f"  Created dummy file: {dummy_file.name}")
    
    # 同期実行（Notion にないのでゴミ箱へ行くはず）
    print("  🔄 同期 (Cleanup) 実行中...")
    syncer.cargo_pull_all()
    
    garbage_path = ROOT_DIR / "05_garbage" / "notion_deleted" / "Report" / "dummy_to_delete.md"
    if garbage_path.exists():
        print(f"  ✅ 成功: ダミーファイルがゴミ箱 {garbage_path} に退避されました。")
    else:
        print(f"  ❌ 失敗: ゴミ箱にファイルがありません。")

if __name__ == "__main__":
    test_sync_evolution()
