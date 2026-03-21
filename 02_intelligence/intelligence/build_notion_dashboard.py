import os
import sys
from pathlib import Path
from notion_client import Client
from dotenv import load_dotenv

# モジュールパスを通す
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(ROOT_DIR / "02_intelligence"))
from hybrid_bot.src.notion_integration import get_human_tasks

load_dotenv(ROOT_DIR / ".env")

NOTION_TOKEN = os.getenv('NOTION_API_KEY')
NOTION_TASKS_DB_ID = os.getenv('NOTION_TASKS_DB_ID')
NOTION_MEMO_DB_ID = os.getenv('NOTION_MEMO_DB_ID')

if not NOTION_TOKEN:
    print("❌ NOTION_API_KEY が設定されていません。")
    sys.exit(1)

notion = Client(auth=NOTION_TOKEN)

def create_dashboard():
    """司令塔ページを生成または更新する"""
    print("🏗️ Notion 司令塔（Command Center）を構築中...")
    
    # 既存のダッシュボードを検索（簡易的にタイトルのみで判断）
    search_results = notion.search(query="司令塔 (Command Center)").get("results", [])
    dashboard_page_id = None
    for res in search_results:
        if res.get("object") == "page" and not res.get("archived"):
            dashboard_page_id = res["id"]
            break

    # 人間用のアクションを取得
    h_tasks = get_human_tasks()
    h_task_blocks = []
    if h_tasks:
        for t in h_tasks:
            h_task_blocks.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [
                        {"type": "text", "text": {"content": f"【要確認】{t['title']} ", "link": {"url": t['url']}}},
                        {"type": "text", "text": {"content": "👉 リンク", "link": {"url": t['url']}}}
                    ]
                }
            })
    else:
        h_task_blocks.append({
            "type": "paragraph",
            "paragraph": {"rich_text": [{"type": "text", "text": {"content": "✅ 現在、人間が対応すべき緊急アクションはありません。順調です！"}}]}
        })

    # ブロック構成
    children = [
        {
            "type": "heading_1",
            "heading_1": {"rich_text": [
                {"type": "text", "text": {"content": "🚀 Antigravity Command Center"}}, 
                {"type": "text", "text": {"content": " (ver 7.0)"}, "annotations": {"italic": True, "color": "gray"}}
            ]}
        },
        {
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": "ここはアンちゃんズの全インフラを統括する「司令塔」です。デスクでの意思決定に役立ててください。"}}],
                "icon": {"type": "emoji", "emoji": "🛰️"}
            }
        },
        {"type": "divider", "divider": {}},
        {
            "type": "heading_2",
            "heading_2": {"rich_text": [{"type": "text", "text": {"content": "🚨 Human Action (人間用アクション)"}}]}
        },
        *h_task_blocks,
        {"type": "divider", "divider": {}},
        {
            "type": "heading_2",
            "heading_2": {"rich_text": [
                {"type": "text", "text": {"content": "🎯 Control Panel"}}, 
                {"type": "text", "text": {"content": " (各インフラへのアクセス)"}, "annotations": {"italic": True, "color": "gray"}}
            ]}
        },
        {
            "type": "column_list",
            "column_list": {
                "children": [
                    {
                        "type": "column",
                        "column": {
                            "children": [
                                {
                                    "type": "heading_3",
                                    "heading_3": {"rich_text": [{"type": "text", "text": {"content": "📋 Task HUD"}}]}
                                },
                                {
                                    "type": "paragraph",
                                    "paragraph": {"rich_text": [{"type": "text", "text": {"content": "🔗 "}, "annotations": {"bold": True}}, {"type": "text", "text": {"content": "Tasks Database", "link": {"url": f"https://www.notion.so/{NOTION_TASKS_DB_ID.replace('-', '')}"}}}]}
                                }
                            ]
                        }
                    },
                    {
                        "type": "column",
                        "column": {
                            "children": [
                                {
                                    "type": "heading_3",
                                    "heading_3": {"rich_text": [{"type": "text", "text": {"content": "📝 Content Studio"}}]}
                                },
                                {
                                    "type": "paragraph",
                                    "paragraph": {"rich_text": [{"type": "text", "text": {"content": "🔗 "}, "annotations": {"bold": True}}, {"type": "text", "text": {"content": "Memos/Drafts", "link": {"url": f"https://www.notion.so/{NOTION_MEMO_DB_ID.replace('-', '')}"}}}]}
                                }
                            ]
                        }
                    }
                ]
            }
        },
        {"type": "divider", "divider": {}},
        {
            "type": "heading_2",
            "heading_2": {"rich_text": [{"type": "text", "text": {"content": "📚 Intelligence Assets"}}]}
        },
        {
            "type": "bulleted_list_item",
            "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": "📜 経営憲法 (ANTIGRAVITY.md)"}}]}
        },
        {
            "type": "bulleted_list_item",
            "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": "🛰️ トレンドレポート一覧"}}]}
        }
    ]

    # 親ページ ID の指定（ユーザー提供）
    PARENT_PAGE_ID = "32a61cf45439802bb27bd280dfcd4915"

    if dashboard_page_id:
        # 更新
        print(f"⚠️ 既存のダッシュボードが見つかりました: {dashboard_page_id}")
        notion.blocks.children.append(block_id=dashboard_page_id, children=children)
        page_url = notion.pages.retrieve(page_id=dashboard_page_id).get("url")
    else:
        # 新規作成
        try:
            new_page = notion.pages.create(
                parent={"page_id": PARENT_PAGE_ID},
                properties={"title": {"title": [{"text": {"content": "司令塔 (Command Center)"}}]}},
                children=children
            )
            page_url = new_page["url"]
            print(f"✅ 司令塔ページを新規作成しました！")
        except Exception as e:
            print(f"❌ ページ作成に失敗しました。親ページの権限を確認してください。\n詳細: {e}")
            sys.exit(1)
    
    print(f"🔗 Dashboard URL: {page_url}")
    return page_url

if __name__ == "__main__":
    create_dashboard()
