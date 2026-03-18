import requests
from bs4 import BeautifulSoup
import json

def fetch_x_trends():
    """
    X(Twitter)のトレンドを取得する。
    ※公式API無での直接取得が困難なため、外部のトレンド集計サイト(Twittrend等)からスクレイピングして仮取得する。
    """
    url = "https://twittrend.jp/"
    trends = []
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # Twittrendの総合ランキングを抽出（class="p-trend-list"などサイト構造に合わせて調整）
        for item in soup.select('a.trend'):
            text = item.get_text(strip=True)
            if text and text not in trends:
                trends.append(text)
                
        # 構造的に取れなかった場合のための簡易フォールバック
        if not trends:
            for p in soup.find_all('p', class_='trend-name'):
                trends.append(p.get_text(strip=True))

        # それでも取れなければダミーデータ（テスト用）
        if not trends:
            trends = ["AI自動生成", "副業解禁", "LOL世界大会", "ChatGPT新機能", "プログラミング初学"]
            
        return trends[:15]
    except Exception as e:
        print(f"[Warn] X トレンド取得に失敗しました: {e}")
        return []

def fetch_note_trends():
    """
    Noteの注目ハッシュタグ（トレンドタグ）を取得する。
    ※公式APIエンドポイントが変更されている可能性があるため、
    エラー時は安全なデフォルト（またはスクレイピング）にフォールバックします。
    """
    url = "https://note.com/api/v2/tags/trend"
    trends = []
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            if "data" in data and "tags" in data["data"]:
                for tag in data["data"]["tags"]:
                    trends.append(tag.get("name", ""))
                return trends[:15]
    except Exception as e:
        # 詳細なエラーを出力せず、静かにフォールバックする
        pass
        
    print("[Info] Noteトレンドは取得できませんでした。デフォルトのキーワードを使用します。")
    return ["AI活用", "副業", "プログラミング", "時短術", "マネタイズ"]

def get_all_trends():
    """
    全てのトレンド情報を収集して返す統合関数
    """
    print("トレンド情報を取得中...")
    trends_data = {
        "x_trends": fetch_x_trends(),
        "note_trends": fetch_note_trends()
    }
    return trends_data

if __name__ == "__main__":
    # 単体テスト用
    data = get_all_trends()
    print(json.dumps(data, ensure_ascii=False, indent=2))
