import os
import shutil
from datetime import datetime
from notion_client import Client
from dotenv import load_dotenv

# 自作モジュールのインポート
import sys
sys.path.append(os.path.dirname(__file__))
import notion_integration

# .envファイルの読み込み
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env'))
load_dotenv(env_path)

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
# 調査指示用DB IDに修正
NOTION_DB_ID = "32061cf4543980d8a093d19d017ebcfc"

# 出力対象ディレクトリ
DRAFT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'outputs', 'draft'))
SYNCED_DIR = os.path.join(DRAFT_DIR, 'synced')

if NOTION_TOKEN:
    notion = Client(auth=NOTION_TOKEN)
else:
    notion = None

def upload_markdown_to_notion(filepath):
    """MarkdownファイルをNotionの『本文』プロパティに出力する"""
    if not notion or not NOTION_DB_ID:
        print("エラー: Notion APIキーまたはDBのIDが設定されていません。")
        return False

    try:
        filename = os.path.basename(filepath)
        title = os.path.splitext(filename)[0]
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # タイトルが長い場合はカット
        title_display = title[:100]

        # プロパティの構築 (プロパティには名前のみ)
        properties = {
            "名前": {"title": [{"text": {"content": title_display}}]}
        }
        
        # コンテンツをブロックとして分割（安全のため1500文字単位）
        blocks = []
        for i in range(0, len(content), 1500):
            blocks.append({
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"type": "text", "text": {"content": content[i:i+1500]}}]
                }
            })

        new_page = notion.pages.create(
            parent={"database_id": NOTION_DB_ID},
            properties=properties,
            children=blocks[:100] # Notion API制限: 1回のリクエストで最大100ブロックまで
        )
        
        print(f"  [+] Notionに出力成功 (Page Content方式): {title} ({new_page['url']})")
        return True

    except Exception as e:
        print(f"  [-] エラー発生 ({os.path.basename(filepath)}): {e}")
        # フォールバック（英語名プロパティなど）
        try:
            properties_en = {
                "Name": {"title": [{"text": {"content": title_display}}]},
                "Content": {"rich_text": [{"text": {"content": content[:2000]}}]}
            }
            notion.pages.create(
                parent={"database_id": NOTION_MEMO_DB_ID},
                properties=properties_en
            )
            return True
        except:
            return False

def run_sync():
    """メイン実行処理"""
    if not os.path.exists(DRAFT_DIR):
        print(f"ディレクトリが見つかりません: {DRAFT_DIR}")
        return

    if not os.path.exists(SYNCED_DIR):
        os.makedirs(SYNCED_DIR)

    files = [f for f in os.listdir(DRAFT_DIR) if f.endswith('.md')]
    
    if not files:
        print("アップロード対象のMarkdownファイルはありませんでした。")
        return

    print(f"{len(files)} 件のファイルをNotionに送信します...")
    
    count = 0
    for filename in files:
        filepath = os.path.join(DRAFT_DIR, filename)
        if upload_markdown_to_notion(filepath):
            # 成功したら synced フォルダに移動
            dest_path = os.path.join(SYNCED_DIR, filename)
            # 重複回避
            if os.path.exists(dest_path):
                base, ext = os.path.splitext(filename)
                dest_path = os.path.join(SYNCED_DIR, f"{base}_{datetime.now().strftime('%H%M%S')}{ext}")
            
            shutil.move(filepath, dest_path)
            count += 1
    
    print(f"\n完了: {count} 件のファイルをNotionに出力し、{SYNCED_DIR} に移動しました。")

if __name__ == "__main__":
    run_sync()
