import os
import google.generativeai as genai

def load_skill(skill_filename):
    """skillsフォルダから特定のスキル設定ファイル（プロンプト指示書）を読み込む"""
    skill_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "skills", skill_filename))
    try:
        with open(skill_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        print(f"[Warn] スキルファイル({skill_filename})の読み込みに失敗しました: {e}")
        return ""

def generate_article(keyword_data, outline_text):
    """
    ArticleWriter.md のスキルを使用して、
    人間味と共感のある親しみやすいトーンで記事本文を執筆する。
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[Error] GEMINI_API_KEYがありません。")
        return ""

    genai.configure(api_key=api_key)
    try:
        model = genai.GenerativeModel('gemini-1.5-pro')
    except:
        model = genai.GenerativeModel('gemini-1.5-flash')

    writer_skill = load_skill("ArticleWriter.md")

    prompt = f"""
{writer_skill}

上記の指示（エージェントとしての「役割とルール」）を厳格に守り、以下の構成案に従ってnote記事の本文を執筆してください。

[ターゲット読者]
{keyword_data.get('target', '初心者')}

[記事の構成案]
{outline_text}

[注意事項]
- アウトプットは直接投稿できるMarkdown形式の完成原稿であること（「以下が原稿です」などの前置きは不要）
- 人間味のある体験談や共感（「私も最初は」「実はこれ〜」など）を積極的に盛り込むこと
- 記事の最後には自然な流れで「私のnoteではさらに具体的な稼ぎ方を公開しています」といったCTAを配置すること
"""
    try:
        print(f"本文を執筆中... ({keyword_data.get('keyword', '')})")
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"[Error] 本文執筆中にエラーが発生しました: {e}")
        return ""

if __name__ == "__main__":
    dummy_data = {"keyword": "AI副業", "target": "時間がなくて焦っている会社員"}
    dummy_outline = "# AI副業の魅力\n## 誰でもできる？\n## おすすめツール\n# まとめ"
    print(generate_article(dummy_data, dummy_outline))
