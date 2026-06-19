import sys
import json
import argparse
from pathlib import Path
from google import genai
from google.genai import types
import logging

# v2_CORE の相対インポートまたは絶対インポートに対応するためのパス処理
sys.path.append(str(Path(__file__).parent.parent))

from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe

def main():
    import sys
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='ignore')

    parser = argparse.ArgumentParser(description="長文から短文（要約・Xスレッド）を自動生成するツール")
    parser.add_argument("input_file", help="長文テキストファイルのパス")
    parser.add_argument("--out", "-o", help="出力先JSONファイルのパス", default=None)
    args = parser.parse_args()

    input_path = Path(args.input_file)
    if not input_path.exists():
        print(f"[ERROR] 入力ファイルが見つかりません: {args.input_file}")
        sys.exit(1)

    with open(input_path, "r", encoding="utf-8") as f:
        source_text = f.read()

    print(f"[INFO] {input_path.name} を元に、要約とXスレッドを生成中...")

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        print("[ERROR] GEMINI_API_KEY が設定されていません。")
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    model_id = settings.DEFAULT_MODEL

    prompt = f"""
    提供された長文のテキストを元に、要約とX(Twitter)用の連続スレッド（1ポスト140文字以内、最大5ポスト）を生成し、JSONで出力してください。
    
    テキスト本文:
    {source_text}
    
    出力フォーマット(JSON):
    {{
        "summary": "長文の主要な要点（中学生でもわかるよう簡潔に）",
        "x_thread": [
            "1/5 ポスト1の内容（強力なフック）",
            "2/5 ポスト2の内容（具体的なベネフィット）",
            "3/5 ポスト3の内容（詳細や解説）",
            "4/5 ポスト4の内容（補足や具体例）",
            "5/5 ポスト5の内容（行動の呼びかけやまとめ）"
        ]
    }}
    """

    try:
        response_text = generate_content_safe(
            client,
            prompt,
            model_id,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
            feature_name="kingdom_cycle"
        )
        if not response_text or response_text.startswith("[WARNING]") or response_text.startswith("[ERROR]"):
            raise Exception("AI生成に失敗しました。")
            
        result = json.loads(response_text)
        
        print("\n=== 生成された要約 ===")
        print(result.get("summary"))
        print("\n=== 生成されたXスレッド ===")
        for i, post in enumerate(result.get("x_thread", [])):
            print(f"【Post {i+1}】\n{post}\n")

        if args.out:
            out_path = Path(args.out)
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=4)
            print(f"[SAVED] 結果を {out_path} に保存しました。")
            
    except Exception as e:
        print(f"[ERROR] エラーが発生しました: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
