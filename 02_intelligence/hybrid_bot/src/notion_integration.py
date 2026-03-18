import os
import re
from datetime import datetime, timedelta
from notion_client import Client
from dotenv import load_dotenv

load_dotenv()

# Notion API設定
NOTION_TOKEN = os.getenv('NOTION_API_KEY')
NOTION_MEMO_DB_ID = os.getenv('NOTION_MEMO_DB_ID')
NOTION_TASKS_DB_ID = os.getenv('NOTION_TASKS_DB_ID')
NOTION_LOL_DB_ID = os.getenv('NOTION_LOL_DB_ID')

if NOTION_TOKEN:
    notion = Client(auth=NOTION_TOKEN)
else:
    notion = None

def get_tasks():
    """未完了のタスク一覧を取得する"""
    if not notion or not NOTION_TASKS_DB_ID:
        return False, "Notion APIキーまたはタスクDBのIDが設定されていません。"
    
    import requests
    try:
        url = f"https://api.notion.com/v1/databases/{NOTION_TASKS_DB_ID}/query"
        headers = {
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        }
        res = requests.post(url, headers=headers, json={"page_size": 100})
        if res.status_code != 200:
            return False, f"Notion APIからのタスク取得に失敗しました (HTTP {res.status_code}):\n{res.text}"
        
        results = res.json().get("results", [])
        
        task_list = []
        for page in results:
            props = page.get("properties", {})
            
            # タスク名を取得
            title_prop = None
            for p_name, p_data in props.items():
                if p_data.get("type") == "title":
                    title_prop = p_data
                    break
            
            title = "無題"
            if title_prop and title_prop.get("title"):
                title = title_prop["title"][0]["text"]["content"]
            
            # ステータスを取得して完了ならスキップ
            status_text = ""
            for p_name, p_data in props.items():
                if p_data.get("type") == "status" and p_data.get("status"):
                    status_text = p_data["status"]["name"]
                elif p_data.get("type") == "select" and p_data.get("select"):
                    status_text = p_data["select"]["name"]
                    
            if status_text in ["Done", "完了"]:
                continue
                
            # 期日を取得
            date_text = ""
            for p_name, p_data in props.items():
                if p_data.get("type") == "date" and p_data.get("date"):
                    date_text = f" (期日: {p_data['date']['start']})"
                    
            task_list.append(f"・{title}{date_text} [{status_text}]")
            
        if not task_list:
            return True, "未完了のタスクはありません！✨"
            
        return True, "【現在のタスク一覧】\n" + "\n".join(task_list)
        
    except Exception as e:
        return False, f"タスク一覧の取得に失敗しました。\n詳細: {e}"

def add_memo(text, url_val=None, summary_val=None):
    """Notionのメモデータベースに新しいメモを追加する（複数プロパティ対応）"""
    if not notion or not NOTION_MEMO_DB_ID:
        return False, "Notion APIキーまたはメモDBのIDが設定されていません。"
    
    # プロパティの構築
    # ※ユーザーが追加した「URL」「要約」「ステータス」「名前」に対応
    properties = {
        "名前": {"title": [{"text": {"content": text[:100]}}]} # タイトルは短く
    }
    
    if url_val:
        properties["URL"] = {"url": url_val}
    if summary_val:
        properties["要約"] = {"rich_text": [{"text": {"content": summary_val}}]}
    
    # ステータス列がある場合は「未読」に設定（存在しない場合はKeyErrorになるためtry-exceptでカバー）
    # properties["ステータス"] = {"status": {"name": "未読"}}

    try:
        new_page = notion.pages.create(
            parent={"database_id": NOTION_MEMO_DB_ID},
            properties=properties
        )
        return True, f"メモをNotionに保存しました！\nURL: {new_page['url']}"
    except Exception as e:
        # フォールバック（英語名プロパティなど）
        try:
            properties_en = {
                "Name": {"title": [{"text": {"content": text[:100]}}]}
            }
            if url_val: properties_en["URL"] = {"url": url_val}
            if summary_val: properties_en["Summary"] = {"rich_text": [{"text": {"content": summary_val}}]}
            
            new_page = notion.pages.create(
                parent={"database_id": NOTION_MEMO_DB_ID},
                properties=properties_en
            )
            return True, f"メモをNotionに保存しました！\nURL: {new_page['url']}"
        except Exception as e2:
            return False, f"Notionへの保存に失敗しました。\n詳細: {e2}"

def get_all_memos():
    """Notionのメモ帳DBから全てのメモを取得する（RAG用）"""
    if not notion or not NOTION_MEMO_DB_ID:
        return []
    
    import requests
    try:
        url = f"https://api.notion.com/v1/databases/{NOTION_MEMO_DB_ID}/query"
        headers = {
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        }
        
        all_results = []
        has_more = True
        start_cursor = None
        
        while has_more:
            payload = {"page_size": 100}
            if start_cursor:
                payload["start_cursor"] = start_cursor
                
            res = requests.post(url, headers=headers, json=payload)
            if res.status_code != 200:
                break
                
            data = res.json()
            all_results.extend(data.get("results", []))
            has_more = data.get("has_more", False)
            start_cursor = data.get("next_cursor")
            
        memos = []
        for page in all_results:
            props = page.get("properties", {})
            
            # 名前（タイトル）
            title = ""
            for p_name, p_data in props.items():
                if p_data.get("type") == "title" and p_data.get("title"):
                    title = p_data["title"][0]["text"]["content"]
                    break
            
            # 要約
            summary = ""
            for p_name, p_data in props.items():
                if (p_name == "要約" or p_name == "Summary") and p_data.get("rich_text"):
                    summary = p_data["rich_text"][0]["text"]["content"]
                    break
            
            # URL
            page_url = ""
            for p_name, p_data in props.items():
                if (p_name == "URL") and p_data.get("url"):
                    page_url = p_data["url"]
                    break
            
            memos.append(f"【タイトル】: {title}\n【URL】: {page_url}\n【要約】: {summary}\n---")
            
        return memos
    except Exception as e:
        print(f"Error fetching all memos: {e}")
        return []

def complete_task(keyword):
    """キーワードに一致するタスクを検索し、ステータスを『完了』に変更する"""
    if not notion or not NOTION_TASKS_DB_ID:
        return False, "Notion API設定が不十分です。"
    
    import requests
    try:
        # 1. まずキーワードでタスクを検索
        url = f"https://api.notion.com/v1/databases/{NOTION_TASKS_DB_ID}/query"
        headers = {
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        }
        
        # 簡易的なフィルタ：名前（タイトル）にキーワードが含まれる未完了タスクを探す
        # ※Notion APIのfilterの制限により、正確な「含む」検索は title プロパティに対して行う
        payload = {
            "filter": {
                "and": [
                    {
                        "property": "名前",
                        "title": {"contains": keyword}
                    },
                    {
                        "property": "ステータス",
                        "status": {"does_not_equal": "完了"}
                    }
                ]
            }
        }
        
        res = requests.post(url, headers=headers, json=payload)
        if res.status_code != 200:
            return False, f"検索に失敗しました (HTTP {res.status_code})"
            
        results = res.json().get("results", [])
        if not results:
            return False, f"「{keyword}」に一致する未完了タスクが見つかりませんでした。"
            
        # 最初に見つかった1件を完了にする
        target_page = results[0]
        page_id = target_page["id"]
        
        update_url = f"https://api.notion.com/v1/pages/{page_id}"
        update_payload = {
            "properties": {
                "ステータス": {"status": {"name": "完了"}}
            }
        }
        
        update_res = requests.patch(update_url, headers=headers, json=update_payload)
        if update_res.status_code == 200:
            return True, f"タスク「{keyword}」を完了にしました！✅"
        else:
            return False, f"ステータスの更新に失敗しました (HTTP {update_res.status_code})"
            
    except Exception as e:
        return False, f"エラーが発生しました: {e}"

def extract_date(text):
    """文章から期日を推測する簡易ロジック"""
    now = datetime.now()
    if "明日" in text:
        return (now + timedelta(days=1)).strftime("%Y-%m-%d"), text.replace("明日", "").strip()
    elif "明後日" in text:
        return (now + timedelta(days=2)).strftime("%Y-%m-%d"), text.replace("明後日", "").strip()
    elif "今日" in text:
        return now.strftime("%Y-%m-%d"), text.replace("今日", "").strip()
    
    # "YYYY-MM-DD"形式などの抽出も可能だが今回は簡易版
    return None, text

def add_task(text):
    """Notionのタスクデータベースに追加する（期日対応）"""
    if not notion or not NOTION_TASKS_DB_ID:
        return False, "Notion APIキーまたはタスクDBのIDが設定されていません。"
    
    # 期日の解析
    due_date, clean_text = extract_date(text)
    
    try:
        properties = {
            "名前": {"title": [{"text": {"content": clean_text}}]}
        }
        if due_date:
            properties["期日"] = {"date": {"start": due_date}}
            
        new_page = notion.pages.create(
            parent={"database_id": NOTION_TASKS_DB_ID},
            properties=properties
        )
        return True, f"タスクをNotionに追加しました！\nURL: {new_page['url']}"
    except Exception as e:
        # プロパティ名違いのフォールバック
        try:
             properties = {
                 "Name": {"title": [{"text": {"content": clean_text}}]}
             }
             if due_date:
                 properties["Date"] = {"date": {"start": due_date}}
                 
             new_page = notion.pages.create(
                 parent={"database_id": NOTION_TASKS_DB_ID},
                 properties=properties
             )
             return True, f"タスクをNotionに追加しました！\nURL: {new_page['url']}"
        except Exception as e2:
            return False, f"Notionへのタスク追加に失敗しました（期日やステータス列が存在しない可能性があります）。\n詳細: {e2}"

def get_lol_knowledge(champion_name=None):
    """NotionのLoLチャンピオンDBから情報を取得する"""
    if not NOTION_TOKEN or not NOTION_LOL_DB_ID:
        return []
    
    import requests
    try:
        url = f"https://api.notion.com/v1/databases/{NOTION_LOL_DB_ID}/query"
        headers = {
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": "2025-09-03",
            "Content-Type": "application/json"
        }
        
        payload = {}
        if champion_name:
            payload["filter"] = {
                "property": "名前",
                "title": {"contains": champion_name}
            }
            
        res = requests.post(url, headers=headers, json=payload)
        if res.status_code != 200:
            return []
            
        results = res.json().get("results", [])
        knowledge = []
        for page in results:
            props = page.get("properties", {})
            name = props.get("名前", {}).get("title", [{}])[0].get("plain_text", "Unknown")
            
            # 各種情報の抽出
            strengths = props.get("強み", {}).get("rich_text", [{}])[0].get("plain_text", "")
            weaknesses = props.get("弱み", {}).get("rich_text", [{}])[0].get("plain_text", "")
            synergy = props.get("シナジー", {}).get("rich_text", [{}])[0].get("plain_text", "")
            win_con = props.get("主な勝ち筋", {}).get("rich_text", [{}])[0].get("plain_text", "")
            points = props.get("意識ポイント", {}).get("rich_text", [{}])[0].get("plain_text", "")
            
            entry = f"【チャンピオン】: {name}\n"
            if strengths: entry += f"- 強み: {strengths}\n"
            if weaknesses: entry += f"- 弱み: {weaknesses}\n"
            if synergy: entry += f"- シナジー: {synergy}\n"
            if win_con: entry += f"- 勝ち筋: {win_con}\n"
            if points: entry += f"- 意識ポイント: {points}\n"
            knowledge.append(entry)
            
        return knowledge
    except Exception as e:
        print(f"Error fetching LoL knowledge: {e}")
        return []

def add_posted_url(url, category="content"):
    """
    発信したURLをNotionのメモ帳DBに追加する。
    後でreaction_monitor.pyが巡回するために使用。
    """
    title = f"【発信済み】{url}"
    summary = f"カテゴリ: {category}\n投稿日: {datetime.now().strftime('%Y-%m-%d')}"
    return add_memo(title, url_val=url, summary_val=summary)

if __name__ == "__main__":
    print("Notion client tests")
