import os
import google.generativeai as genai

def load_prompt_optimizer():
    """技能(スキル)である PromptOptimizer.md の内容を読み込んでシステム指示のベースにする"""
    optimizer_path = os.path.join(os.path.dirname(__file__), "..", "..", "skills", "PromptOptimizer.md")
    try:
        with open(optimizer_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        print(f"[Warn] PromptOptimizer.mdの読み込みに失敗しました。デフォルト設定を使います。 ({e})")
        return "あなたはプロのWebライター兼マーケターです。"

def generate_outline(keyword_data):
    """
    選定されたキーワード情報を基に、PromptOptimizerの思考を用いて
    記事の構成案（Markdown形式）を生成する。
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[Error] GEMINI_API_KEY環境変数が設定されていません。")
        return "APIキー未設定のため構成案を生成できません。"

    genai.configure(api_key=api_key)
    try:
        model = genai.GenerativeModel('gemini-1.5-pro')
    except:
        model = genai.GenerativeModel('gemini-1.5-flash')

    optimizer_rules = load_prompt_optimizer()

    system_prompt = f"""
{optimizer_rules}

上記のエージェントのルール（プロンプト最適化のスキル）を遵守して、下記のキーワードとターゲットに向けた
「読者の行動（リンククリックやnote購入）を強く促す記事構成案」を作成してください。
今回は「プロンプトを出力する」のではなく、最適化された指示に従って「実際の構成案そのもの」を出力してください。
"""

    user_prompt = f"""
[タスク]
以下の情報に基づき、note記事の構成案（見出し構成）をMarkdown形式で作成してください。

- **キーワード**: {keyword_data.get('keyword', '')}
- **ターゲット**: {keyword_data.get('target', '')}
- **なぜ収益化に繋がるか**: {keyword_data.get('reason', '')}

[構成要件]
1. 共感とフック（導入部分）
2. 解決策の提示（最新AIツールの紹介など）
3. 成功のイメージ（収益化や効率化の具体例）
4. CTA（さらに詳しい情報は自分の有料noteなどへ誘導）

出力はMarkdownフォーマットのみで行ってください。
"""
    try:
        print(f"「{keyword_data.get('keyword', '不明')}」の構成案を生成中...")
        response = model.generate_content([system_prompt, user_prompt])
        return response.text.strip()
    except Exception as e:
        print(f"[Error] 構成案生成中にエラーが発生しました: {e}")
        return "構成案の生成に失敗しました。"

if __name__ == "__main__":
    dummy_data = {
        "keyword": "AIを使った動画副業",
        "target": "副業を始めたい会社員",
        "reason": "副業のハードルが下がり関心が高いため"
    }
    print(generate_outline(dummy_data))
