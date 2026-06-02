import os
import sys
import glob
from pathlib import Path
from google import genai
from google.genai import types
import dotenv
import time

dotenv.load_dotenv(Path("D:/my_work/.env"))

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("Error: GEMINI_API_KEY is not set.")
    sys.exit(1)

client = genai.Client(api_key=api_key)
model_id = "gemini-2.5-flash"

ARTICLE_DIR = Path("D:/my_work/02_FACTORY/PRODUCTS/ARTICLES")

def rewrite_content(original_content: str) -> str:
    prompt = """
    以下のテキストはLeague of Legendsのチャンピオン攻略記事ですが、大げさな表現や厨二病的な煽り（例: 「愚か者どもよ、聞け」「魂を刈り取る死神」「王への道」など）が多用されています。
    これらの特殊な表現をすべて削除し、一般的なビジネスライクで丁寧な「です・ます」調の文体に書き換えてください。
    ただし、ビルド、ルーン、コンボの入力順、具体的なダメージ数値や秒数などの「攻略情報」や「具体的な実績・数値データ」は絶対に省略せず、すべて維持してください。
    また、章のタイトルも一般的なもの（例: 「はじめに」「第1章：ビルドとルーン」「第2章：コンボと基本操作」「まとめ」など）に変更してください。

    【元のテキスト】
    """ + original_content

    print("Gemini API でリライト中...")
    try:
        response = client.models.generate_content(
            model=model_id,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=8192
            )
        )
        return response.text.strip()
    except Exception as e:
        print(f"Error during rewrite: {e}")
        return ""

def main():
    target_files = glob.glob(str(ARTICLE_DIR / "HONKI_BIBLE_*.md"))
    if not target_files:
        print("No files to rewrite.")
        return

    for file_path_str in target_files:
        file_path = Path(file_path_str)
        print(f"Processing: {file_path.name}")
        
        content = file_path.read_text(encoding="utf-8")
        if not content.strip() or len(content) < 200:
            print(f"Skipping empty or very short file: {file_path.name}")
            # エラー文言のみのファイル（例: LeBlanc）などは単にリネームするか削除する
            new_name = file_path.name.replace("HONKI_BIBLE_", "ARTICLE_")
            new_path = file_path.parent / new_name
            os.rename(file_path, new_path)
            continue
            
        rewritten_content = rewrite_content(content)
        
        if rewritten_content:
            new_name = file_path.name.replace("HONKI_BIBLE_", "ARTICLE_")
            new_path = file_path.parent / new_name
            new_path.write_text(rewritten_content, encoding="utf-8")
            print(f"Saved rewritten article to: {new_path.name}")
            
            # 成功したら元のファイルを削除
            try:
                os.remove(file_path)
                print(f"Deleted original file: {file_path.name}")
            except Exception as e:
                print(f"Failed to delete original file: {e}")
        else:
            print(f"Failed to rewrite: {file_path.name}")
            
        time.sleep(2) # レートリミット回避

if __name__ == "__main__":
    main()
