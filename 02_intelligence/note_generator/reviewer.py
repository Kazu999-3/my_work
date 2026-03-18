import os
import google.generativeai as genai

def load_skill(skill_filename):
    skill_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "skills", skill_filename))
    try:
        with open(skill_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        print(f"[Warn] {skill_filename}の読み込みに失敗しました: {e}")
        return "あなたはプロのマーケターです。この記事が売れるか厳しくレビューしてください。"

def review_article(keyword_data, article_text):
    """
    MonetizationReviewer.mdのスキルを用いて、
    生成された記事が収益化に結びつく品質かをレビューし、フィードバックを返す。
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return "[Error] APIキー未設定のためレビューできません。"

    genai.configure(api_key=api_key)
    try:
        model = genai.GenerativeModel('gemini-1.5-pro')
    except:
        model = genai.GenerativeModel('gemini-1.5-flash')

    reviewer_skill = load_skill("MonetizationReviewer.md")
    
    prompt = f"""
{reviewer_skill}

上記の校正者・マーケターとしてのスキル設定に基づいて、以下の【本文案】を厳しくレビューし、
収益化のポテンシャルを引き上げるためのフィードバックを出力してください。

[ターゲット読者]
{keyword_data.get('target', '不明')}

[執筆テーマ]
{keyword_data.get('keyword', '不明')}

[本文案]
{article_text}
"""
    try:
        print(f"\n--- 収益化レビューを実行中... ({keyword_data.get('keyword', '')}) ---")
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"[Error] レビュー中にエラーが発生しました: {e}")
        return "レビューの生成に失敗しました。"

if __name__ == "__main__":
    dummy_text = "AIを使った副業は最高です！絶対に稼げます！私のnoteを買ってください！！！"
    print(review_article({"keyword": "AI副業", "target": "初心者"}, dummy_text))
