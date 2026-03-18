import os
import glob
import sys
from datetime import datetime

# srcディレクトリをパスに追加（モジュールとして実行される場合も考慮）
if __name__ == "__main__":
    sys.path.append(os.path.dirname(__file__))
    import gemini_analyzer
else:
    # omni_agent などからインポートされる場合
    from . import gemini_analyzer

MEMO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '02_research', 'memo'))
REPORT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '02_research', 'reports'))

def get_latest_memos(limit=10):
    """最新のメモファイルを取得する"""
    files = glob.glob(os.path.join(MEMO_DIR, "*.md"))
    # 日付プレフィックス（20260308_...）でソート
    files.sort(key=os.path.basename, reverse=True)
    return files[:limit]

def generate_daily_trend_report():
    """最新のメモからトレンド分析レポートを生成する"""
    latest_files = get_latest_memos(limit=15)
    
    if not latest_files:
        return "分析対象となるメモが見つかりませんでした。"

    # メモの内容を連結
    context_parts = []
    for fpath in latest_files:
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
                # ファイル名からタイトルを推測（要約セクションまでを抽出など簡略化）
                context_parts.append(f"--- ファイル: {os.path.basename(fpath)} ---\n{content}")
        except Exception as e:
            print(f"Error reading {fpath}: {e}")

    full_context = "\n\n".join(context_parts)

    prompt = f"""
あなたはAIトレンド分析の専門家「アンちゃん」です。
@HimazinProducer 氏の「偵察レポート」手法に基づき、最新のメモから「今日高反応が得られるフック（冒頭3行）」を特定・分析してください。

【提供されたメモデータ】
{full_context}

【出力フォーマット】
以下の構成で、極めて実戦的な「偵察レポート」を作成してください。

# 🕵️ 最新偵察レポート ({datetime.now().strftime('%Y/%m/%d')})

## 🔍 反応の良かったフック分析 (Top 3)
1. **[分析対象]**: (メモ内の具体的なフック/冒頭3行)
   - **反応の理由**: (なぜそのフックが刺さっているのか、心理的トリガーを分析)
   - **共通点**: (現在のトレンドとの関連性)

## 🔥 今日の「勝ちパターン」
- (今すぐ真似すべき、特定の言い回しや構成のルールを提示)

## 🚀 次のアクション：3つの投稿案の種
- **パターンA (集客/有益型)**: (トレンドに基づいた図解やTips案。認知を広げるためのフック)
- **パターンB (収益/感情型)**: (独自の視点や痛みを突く案。信頼を築き行動を促すためのフック)
- **パターンC (泥臭いリアル型)**: (一次情報をベースにした、人間らしさを出すフック)

## ⚖️ 収益化・品質フィルターによる最終推敲
- **収益化**: 「役に立った」で終わらせず、感情（恐怖/欲望）を突き、行動（導線）を促しているか？
- **引き算の魔法 (NGワードチェック)**: `ng_words.md` にあるレベル1〜3の表現を徹底的に排除したか？
- **独自性の担保**: AI臭いテンプレ表現を削り、あなたの「肉声」に近い言葉になっているか？
"""

    # Geminiで生成 (最新モデルを使用)
    report = gemini_analyzer._call_gemini(prompt)
    return report

def analyze_latest_memos():
    """Omhi-Agentなどから呼び出すためのエントリーポイント"""
    if not os.path.exists(REPORT_DIR):
        os.makedirs(REPORT_DIR)
        
    print("トレンドレポートを生成中...")
    report = generate_daily_trend_report()
    
    if report and "エラー" not in report and "見つかりませんでした" not in report:
        date_str = datetime.now().strftime('%Y%m%d')
        report_path = os.path.join(REPORT_DIR, f"trend_report_{date_str}.md")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"レポートを保存しました: {report_path}")
        return True
    else:
        print(f"レポート生成スキップ: {report}")
        return False

if __name__ == "__main__":
    analyze_latest_memos()
