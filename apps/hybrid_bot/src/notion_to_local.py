import os
import re
import requests
from datetime import datetime
from notion_client import Client
from dotenv import load_dotenv

# .envファイルの読み込み
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
NOTION_MEMO_DB_ID = os.getenv('NOTION_MEMO_DB_ID')
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'knowledge', 'memo'))

def sanitize_filename(filename):
    """ファイル名として使用できない文字を除去・置換し、長さを制限する"""
    # アンちゃん：長すぎるタイトルや不正な文字をクリーンにします！
    filename = re.sub(r'[\\/*?:"<>|\n\r\t]', "", filename)
    filename = filename.replace(" ", "_").replace("\u3000", "_") # 全角スペースも対応
    if len(filename) > 50:
        filename = filename[:50]
    return filename

def export_memos():
    if not NOTION_TOKEN or not NOTION_MEMO_DB_ID:
        print("エラー: NOTION_API_KEY または NOTION_MEMO_DB_ID が設定されていません。")
        return

    # 出力先フォルダの作成
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"ディレクトリを作成しました: {OUTPUT_DIR}")

    print(f"Notionからメモを取得中... (DB: {NOTION_MEMO_DB_ID})")

    try:
        url = f"https://api.notion.com/v1/databases/{NOTION_MEMO_DB_ID}/query"
        headers = {
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        }

        results = []
        has_more = True
        start_cursor = None

        while has_more:
            payload = {"page_size": 100}
            if start_cursor:
                payload["start_cursor"] = start_cursor
            
            res = requests.post(url, headers=headers, json=payload)
            if res.status_code != 200:
                print(f"Notionからの取得に失敗しました: {res.status_code} - {res.text}")
                break
                
            data = res.json()
            results.extend(data.get("results", []))
            has_more = data.get("has_more", False)
            start_cursor = data.get("next_cursor")

        print(f"{len(results)} 件のメモが見つかりました。同期を開始します。")

        count = 0
        for page in results:
            props = page.get("properties", {})
            
            # タイトルの取得
            title = "無題"
            for p_name, p_data in props.items():
                if p_data.get("type") == "title" and p_data.get("title"):
                    title = p_data["title"][0]["plain_text"]
                    break
            
            # 作成日（または更新日）
            created_time_str = page.get("created_time", "")
            date_prefix = ""
            if created_time_str:
                dt = datetime.fromisoformat(created_time_str.replace("Z", "+00:00"))
                date_prefix = dt.strftime("%Y%m%d")

            # 内容（要約）の取得
            summary = ""
            for p_name, p_data in props.items():
                if (p_name in ["要約", "Summary"]) and p_data.get("rich_text"):
                    summary = "".join([t.get("plain_text", "") for t in p_data["rich_text"]])
                    break
            
            # URLの取得
            url_val = ""
            for p_name, p_data in props.items():
                if p_name == "URL" and p_data.get("url"):
                    url_val = p_data["url"]
                    break

            # 保存用ファイル名の生成
            file_title = sanitize_filename(title)
            filename = f"{date_prefix}_{file_title}.md" if date_prefix else f"{file_title}.md"
            filepath = os.path.join(OUTPUT_DIR, filename)

            # Markdownコンテンツの作成
            content = f"# {title}\n\n"
            content += f"- **保存日**: {created_time_str}\n"
            if url_val:
                content += f"- **URL**: {url_val}\n"
            content += "\n---\n\n"
            content += "## 💡 要約\n"
            content += summary if summary else "要約なし"
            content += "\n"

            # 書き込み
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            
            count += 1

        print(f"同期完了: {count} 件のメモを {OUTPUT_DIR} に出力しました。")

    except Exception as e:
        print(f"同期中にエラーが発生しました: {e}")

if __name__ == "__main__":
    export_memos()
