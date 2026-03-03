import os
import json
import google.generativeai as genai

def analyze_keywords(trends_data):
    """
    取得したトレンドデータをGemini APIに渡し、
    収益化に繋がりやすいキーワードとターゲットを組み合わせて抽出する。
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[Error] GEMINI_API_KEY環境変数が設定されていません。")
        return []

    genai.configure(api_key=api_key)
    
    # モデルの初期化 (推奨モデルである gemini-1.5-pro 等を指定)
    try:
        model = genai.GenerativeModel('gemini-1.5-pro')
    except Exception:
        # フォールバックとしてフラッシュモデルを指定
        model = genai.GenerativeModel('gemini-1.5-flash')

    prompt = f"""
あなたはプロのWebマーケターです。以下の現状のトレンド情報（X、Note）を分析し、
「副業を始めたい会社員」「AIツールに興味があるエンジニア」「ゲーム(LoL)好き」が関心を持ち、
かつ「情報商材の販売やアフィリエイトなどの収益化」に繋がりやすいキーワード案を3つ厳選して提案してください。

[取得したトレンドデータ]
{json.dumps(trends_data, ensure_ascii=False, indent=2)}

[出力形式の厳守]
以下のJSON形式のみを出力してください。Markdownの装飾(```jsonなど)は不要です。
[
  {{
    "keyword": "厳選したキーワード",
    "target": "想定する特定のターゲット層",
    "reason": "なぜこのキーワードが収益化に繋がるのかの理由"
  }},
  ...
]
"""
    try:
        print("キーワード分析を実行中...")
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Markdownのコードブロック記法が返ってきた場合のクリーニング
        if text.startswith("```"):
            lines = text.split("\n")
            if len(lines) >= 3:
                text = "\n".join(lines[1:-1])

        keywords = json.loads(text)
        return keywords
    except Exception as e:
        print(f"[Error] キーワード分析中にエラーが発生しました: {e}")
        # APIが失敗した場合のフォールバック用ダミーデータ
        return [
            {
                "keyword": "AI自動化による副業", 
                "target": "副業を始めたい会社員", 
                "reason": "AIツール等の需要が高く、ツールの紹介やノウハウの販売がしやすい"
            }
        ]

if __name__ == "__main__":
    # 単体テスト用ダミーデータ
    dummy_trends = {
        "x_trends": ["AI動画生成", "ChatGPT", "副業解禁"],
        "note_trends": ["#プログラミング初心者", "#AI術"]
    }
    result = analyze_keywords(dummy_trends)
    print(json.dumps(result, ensure_ascii=False, indent=2))
