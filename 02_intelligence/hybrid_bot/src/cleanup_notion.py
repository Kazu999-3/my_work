import os
import requests
from dotenv import load_dotenv

# .envファイルの読み込み
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env'))
load_dotenv(env_path)

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
NOTION_MEMO_DB_ID = os.getenv('NOTION_MEMO_DB_ID')

def cleanup_wrong_posts():
    """メモ帳DBに誤送信された『本文』を持つページをアーカイブ（削除）する"""
    if not NOTION_TOKEN or not NOTION_MEMO_DB_ID:
        print("エラー: NOTION_API_KEY または NOTION_MEMO_DB_ID が設定されていません。")
        return

    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }

    print(f"メモ帳DB ({NOTION_MEMO_DB_ID}) から誤送信データを検索中...")

    try:
        url = f"https://api.notion.com/v1/databases/{NOTION_MEMO_DB_ID}/query"
        # 「本文」プロパティが存在し、かつ空でないものを探す（簡易的な判定）
        payload = {
            "filter": {
                "property": "本文",
                "rich_text": {
                    "is_not_empty": True
                }
            }
        }
        
        res = requests.post(url, headers=headers, json=payload)
        if res.status_code != 200:
            print(f"検索に失敗しました: {res.text}")
            return

        results = res.json().get("results", [])
        print(f"{len(results)} 件の該当データが見つかりました。削除（アーカイブ）を開始します。")

        for page in results:
            page_id = page["id"]
            # アーカイブ処理
            patch_url = f"https://api.notion.com/v1/pages/{page_id}"
            patch_res = requests.patch(patch_url, headers=headers, json={"archived": True})
            if patch_res.status_code == 200:
                print(f"  [x] アーカイブ成功: {page_id}")
            else:
                print(f"  [-] アーカイブ失敗: {page_id} ({patch_res.text})")

    except Exception as e:
        print(f"クリーンアップ中にエラーが発生しました: {e}")

if __name__ == "__main__":
    cleanup_wrong_posts()
