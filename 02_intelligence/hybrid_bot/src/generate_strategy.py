import os
import sys
from datetime import datetime

# srcディレクトリをパスに追加
sys.path.append(os.path.dirname(__file__))
import gemini_analyzer

def generate_lol_advisor_strategy():
    """LoL AI Advisorの収益化戦略を生成する"""
    
    prompt = """
あなたはAIプロダクトマネージャー兼セールスライターの「アンちゃん」です。
現在開発中の「LoL AI Advisor（Discord Bot）」を、Xとnoteを組み合わせて収益化するための具体的な戦略を立案してください。

【プロジェクト情報】
- 製品名: LoL AI Advisor (アンちゃん)
- 機能: Riot APIを用いたリアルタイム試合分析、BAN/Pick支援、対面ルーン/ビルド提案。
- 特徴: 「実行するAI」として、Discordからスマホ1つでプロレベルの分析結果を15秒で得られる。

【生成すべき内容】
1. 市場分析: なぜ今、LoL×AIに需要があるのか？ターゲットの悩みは？
2. コンセプト設計: 競合（OP.GG等）との差別化ポイント。
3. X（Twitter）投稿プラン: 
   - 興味を引く「インプレッション獲得ポスト」案 (3件)
   - 信頼を構築する「実績・デモポスト」案 (2件)
   - noteへ誘導する「セールスポスト」案 (1件)
4. note構成案（販売価格 500円〜1,000円）:
   - 無料エリア: どんな価値を提供し、どう期待感を煽るか。
   - 有料エリア: 何をコンテンツとして提供するか（例：具体的な分析プロンプト、勝率を上げる設定ガイド等）。
5. 収益ステップ: 無料配布から有料移行への具体的なスケジュール。

【出力形式】
Markdown形式で、そのままnoteの下書きやXの投稿に使えるように出力してください。
"""

    print("LoL AI Advisor 収益化戦略を生成中...")
    strategy = gemini_analyzer._call_gemini(prompt)
    
    if strategy:
        output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'outputs', 'article'))
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        file_path = os.path.join(output_dir, "lol_advisor_monetization_strategy.md")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(strategy)
        print(f"戦略ドキュメントを保存しました: {file_path}")
        return strategy
    else:
        print("戦略の生成に失敗しました。")
        return None

if __name__ == "__main__":
    generate_lol_advisor_strategy()
