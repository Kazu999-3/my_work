import os
import google.generativeai as genai

def generate_image_prompt(article_text):
    """
    記事の内容から、アイキャッチ画像を生成するための効果的なプロンプト（英語）を作成する
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return ""
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = f"""
以下の記事内容に合う、魅力的なアイキャッチ画像の生成プロンプト（英語）を1つだけ出力してください。
トーンは「クリーンでモダンなフラットデザイン、親しみやすい、ブログのサムネイル向け」です。

[記事内容の一部]
{article_text[:500]}...
"""
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except:
        return ""

def process_images_for_article(keyword_data, article_text):
    """
    画像生成の処理（プレースホルダー）。
    ※ 現在はGemini API(Python SDK)からの直接画像生成(Imagen)が制限されている場合が多いため、
      最適なプロンプトを生成し、Markdown記事の冒頭に配置用の指示（プレースホルダーURL）を埋め込む形とする。
    ※ 有料のOpenAI DALL-Eなどを導入する場合はここに実装する。
    """
    print(f"画像プロンプトを作成中... ({keyword_data.get('keyword', '')})")
    img_prompt = generate_image_prompt(article_text)
    
    if not img_prompt:
        img_prompt = "A modern flat design illustration for a blog header about AI and business."
        
    print(f"[画像生成プロンプト案]: {img_prompt}")
    
    # 画像生成自体は無料ツール枠などで手動入力するか、将来の拡張に備える
    placeholder_md = f"""
<!-- 
[AIによる画像生成プロンプト案] (以下を画像生成AIに入力してアイキャッチを作成してください)
{img_prompt}
-->
![アイキャッチ画像（※ここに画像を挿入してください）](https://placehold.co/800x400?text=Eye-Catch+Image)
"""
    return placeholder_md + "\n\n" + article_text

if __name__ == "__main__":
    dummy = "AIを使った副業は時間がない会社員に最適です。特にChatGPTを使えば..."
    res = process_images_for_article({"keyword": "AI副業"}, dummy)
    print(res)
