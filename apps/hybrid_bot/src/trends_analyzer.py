import os
import glob
import sys
from datetime import datetime

# srcディレクトリをパスに追加
sys.path.append(os.path.dirname(__file__))
import gemini_analyzer

MEMO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'knowledge', 'memo'))
REPORT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'knowledge', 'reports'))

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
ユーザーが保存した最新のメモ（Xの投稿やWeb記事の要約）を基に、今日の「収益化トレンド・ダイジェスト」を作成してください。

【提供されたメモデータ】
{full_context}

【出力フォーマット】
以下の構成で、親しみやすく、かつプロフェッショナルなレポートを作成してください。

# 🌟 本日のAIトレンド・ダイジェスト ({datetime.now().strftime('%Y/%m/%d')})

## 📊 今日の主要トピック
(全体的な傾向を3行程度で)

## 🔥 注目すべきインサイト（収益化のヒント）
- (メモから得られた具体的な収益化のアイデアや成功例を3つほど)

## 🚀 今日、あなたがすべき具体的なアクションプラン
- **Action 1**: (即座に実行できる具体的な作業)
- **Action 2**: (今後の準備や調査すべきこと)

## 📝 アンちゃんの独り言
(個人的な感想や励ましのメッセージ)
"""

    # Geminiで生成
    report = gemini_analyzer._call_gemini(prompt)
    return report

if __name__ == "__main__":
    if not os.path.exists(REPORT_DIR):
        os.makedirs(REPORT_DIR)
        
    print("トレンドレポートを生成中...")
    report = generate_daily_trend_report()
    
    if report and "エラー" not in report:
        date_str = datetime.now().strftime('%Y%m%d')
        report_path = os.path.join(REPORT_DIR, f"trend_report_{date_str}.md")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"レポートを保存しました: {report_path}")
    
    print("\n" + "="*50 + "\n")
    print(report)
    print("\n" + "="*50 + "\n")
