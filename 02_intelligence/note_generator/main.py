import os
import sys
import datetime

# 各モジュールをインポート
import trend_fetcher
import keyword_analyzer
import outline_generator
import article_generator
import image_generator
import reviewer

def save_to_file(keyword, content_text, suffix="構成案"):
    """生成した情報をoutputsディレクトリに保存する"""
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    outputs_dir = os.path.join(base_dir, "outputs")
    
    if not os.path.exists(outputs_dir):
        os.makedirs(outputs_dir)
        
    date_str = datetime.datetime.now().strftime("%Y%m%d")
    safe_keyword = str(keyword).replace("/", "_").replace("\\", "_").replace(" ", "_")
    
    filename = f"{date_str}_{safe_keyword}_{suffix}.md"
    filepath = os.path.join(outputs_dir, filename)
    
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content_text)
        print(f"[Success] {suffix} を保存しました: {filepath}")
    except Exception as e:
        print(f"[Error] ファイル保存中にエラーが発生しました: {e}")

def main():
    print("=== フェーズ2: 本文執筆と画像生成アプリ 開始 ===")
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[警告] GEMINI_API_KEY が設定されていません。AI機能が正しく動作しません。")
        
    print("\n--- 1. トレンド情報取得 (Fetch) ---")
    trends_data = trend_fetcher.get_all_trends()
    
    print("\n--- 2. キーワード分析・選定 (Analyze) ---")
    keywords_list = keyword_analyzer.analyze_keywords(trends_data)
    
    if not keywords_list:
        print("キーワードが抽出できませんでした。処理を終了します。")
        sys.exit(1)
        
    print(f"抽出されたキーワード数: {len(keywords_list)} 件")
    
    # 時間短縮のため、トップ1件のみで全行程を回す設定（本番は全件回してもOK）
    target_keyword = keywords_list[0]
    keyword_str = target_keyword.get("keyword", "不明")
    
    print(f"\n>> ターゲット: {target_keyword.get('target', '')}")
    print(f">> キーワード: {keyword_str} を使用して全行程を実行します...\n")
    
    # 3. 構成案の生成
    print("--- 3. 構成案生成 (Outline) ---")
    outline_text = outline_generator.generate_outline(target_keyword)
    save_to_file(keyword_str, outline_text, "1_構成案")
    
    # 4. 本文の生成（フェーズ2）
    print("\n--- 4. 本文執筆 (Writing) ---")
    article_text = article_generator.generate_article(target_keyword, outline_text)
    
    # 5. アイキャッチ画像のプロンプトと配置（フェーズ2）
    print("\n--- 5. 画像生成・配置 (Imaging) ---")
    final_article = image_generator.process_images_for_article(target_keyword, article_text)
    save_to_file(keyword_str, final_article, "2_完成原稿")
    
    # 6. 収益化レビュー（フェーズ2）
    print("\n--- 6. 収益化検討・レビュー (Review) ---")
    review_result = reviewer.review_article(target_keyword, final_article)
    save_to_file(keyword_str, review_result, "3_レビュー指摘事項")
        
    print("\n=== フェーズ2の全処理が完了しました ===")
    print("outputs/ ディレクトリの構成案と完成原稿、そしてレビューを確認してください！")

if __name__ == "__main__":
    main()
