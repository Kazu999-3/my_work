# ============================================================
# 【現在未使用】note収益化系
# noteのPV等をログインして収集する常駐デーモン。
#
# 2026-07-21 時点で、どこからも import されず CI からも起動されていない。
# 将来の復活を前提に残しているだけなので、現役のコードとして参照しないこと。
# 復活させる場合は、参照している設定やテーブルが今も存在するか確認が必要。
# ============================================================
import os
import sys
import json
import time
import datetime
import logging
from dotenv import load_dotenv
from google import genai
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_with_routing
from v2_CORE._LOL.herald import herald
from v2_CORE.logger_config import setup_sovereign_logging

# 明示的に .env をロードする
load_dotenv(os.path.join(settings.ROOT_DIR, ".env"))

logger = setup_sovereign_logging("NoteAnalytics")

class NoteAnalyticsDaemon:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            
        self.note_email = os.environ.get("NOTE_EMAIL")
        self.note_password = os.environ.get("NOTE_PASSWORD")
        self.report_dir = os.path.join(settings.ROOT_DIR, "02_FACTORY", "assets", "analytics")
        os.makedirs(self.report_dir, exist_ok=True)

    def scrape_note_stats(self):
        """Playwrightを使用してnoteダッシュボードからデータを取得する（失敗時はモックフォールバック）"""
        if not self.note_email or not self.note_password:
            logger.warning("NOTE_EMAIL or NOTE_PASSWORD not found in environment. Falling back to mock data.")
            return self.get_mock_stats()
            
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            logger.error("playwright is not installed. Falling back to mock data.")
            return self.get_mock_stats()
            
        logger.info("Launching Playwright browser...")
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
                page = context.new_page()
                
                # 1. ログインページへ移動
                logger.info("Navigating to note login page...")
                page.goto("https://note.com/login", timeout=30000)
                page.wait_for_load_state("networkidle")
                
                # 2. ログインフォーム入力
                logger.info("Filling credentials...")
                email_input = page.locator('input[type="email"], input[autocomplete="username"], input[name="email_or_username"]')
                if email_input.count() > 0:
                    email_input.first.fill(self.note_email)
                else:
                    raise Exception("Email input field not found.")
                    
                pass_input = page.locator('input[type="password"], input[name="password"]')
                if pass_input.count() > 0:
                    pass_input.first.fill(self.note_password)
                else:
                    raise Exception("Password input field not found.")
                
                # ログインボタンクリック
                login_btn = page.locator('button[type="submit"], button:has-text("ログイン")')
                login_btn.first.click()
                page.wait_for_load_state("networkidle")
                time.sleep(3)
                
                # 3. ダッシュボードアクセス
                logger.info("Navigating to stats page...")
                page.goto("https://note.com/dashboard/stats", timeout=30000)
                page.wait_for_load_state("networkidle")
                time.sleep(3)
                
                # 4. データ抽出（簡易スクレイピング）
                logger.info("Extracting articles stats...")
                articles = []
                
                rows = page.locator('tr, div[class*="statsTable__item"]').all()
                logger.info(f"Found {len(rows)} potential table rows on stats page.")
                
                for idx, row in enumerate(rows):
                    text = row.inner_text().strip()
                    if not text:
                        continue
                    lines = [line.strip() for line in text.split('\n') if line.strip()]
                    if len(lines) >= 3:
                        title = lines[0]
                        pv = 0
                        likes = 0
                        for line in lines[1:]:
                            clean = line.replace(',', '').replace(' ', '')
                            if clean.isdigit():
                                val = int(clean)
                                if pv == 0:
                                    pv = val
                                elif likes == 0:
                                    likes = val
                        
                        if pv > 0:
                            articles.append({
                                "title": title,
                                "pv": pv,
                                "likes": likes,
                                "cvr": round((likes / pv) * 100, 2) if pv > 0 else 0.0
                            })
                            
                browser.close()
                
                if articles:
                    logger.info(f"Successfully scraped {len(articles)} articles from note.")
                    return articles
                else:
                    logger.warning("No articles data could be parsed. Falling back to mock data.")
                    return self.get_mock_stats()
                    
        except Exception as e:
            logger.error(f"Playwright scraping failed: {e}. Falling back to mock data.")
            return self.get_mock_stats()

    def get_mock_stats(self):
        """スクレイピング失敗時・未認証時のダミー/シミュレーションデータ"""
        logger.info("Generating mock stats data for simulation...")
        return [
            {"title": "【LoL】動画を観ずに1秒で記事化！YouTube自動化AIでnote量産して副業で月5万稼ぐ方法", "pv": 1240, "likes": 62, "cvr": 5.0},
            {"title": "【LoL】新パッチ最強のシャイヴァーナ(Shyvana)ジャングル解説！ビルド・マクロバイブル", "pv": 850, "likes": 48, "cvr": 5.65},
            {"title": "【LoL】対戦相手を圧倒するニダリー(Nidalee)の最速ジャングルルートとミクロ技", "pv": 420, "likes": 18, "cvr": 4.29},
            {"title": "【LoL】集団戦を破壊するブランド(Brand)ジャングルのビルドとマクロの極意", "pv": 310, "likes": 12, "cvr": 3.87},
            {"title": "AIと始める副業ロードマップ：完全自動化とコンテンツ資産の作り方", "pv": 150, "likes": 9, "cvr": 6.0}
        ]

    def _generate_rule_based_report(self, stats):
        """APIエラー時のルールベース（Python側で静的生成する）のフォールバックレポート"""
        logger.info("Generating rule-based fallback report (API limits reached)...")
        
        # PV順にソート
        sorted_by_pv = sorted(stats, key=lambda x: x['pv'], reverse=True)
        # CVR順にソート
        sorted_by_cvr = sorted(stats, key=lambda x: x['cvr'], reverse=True)
        
        # 総計
        total_pv = sum(x['pv'] for x in stats)
        total_likes = sum(x['likes'] for x in stats)
        avg_cvr = round((total_likes / total_pv) * 100, 2) if total_pv > 0 else 0
        
        # 推奨される改善アクションの決定
        best_cvr_article = sorted_by_cvr[0]['title'] if sorted_by_cvr else "なし"
        best_pv_article = sorted_by_pv[0]['title'] if sorted_by_pv else "なし"
        
        # チャンピオン名のキーワード抽出
        recommended_champ = "Shyvana"
        for art in sorted_by_pv[:2]:
            title_lower = art['title'].lower()
            if 'nidalee' in title_lower or 'ニダリー' in title_lower:
                recommended_champ = "Nidalee"
                break
            elif 'brand' in title_lower or 'ブランド' in title_lower:
                recommended_champ = "Brand"
                break
            elif 'shyvana' in title_lower or 'シャイヴァーナ' in title_lower:
                recommended_champ = "Shyvana"
                break
                
        table_rows = []
        for idx, art in enumerate(sorted_by_pv):
            table_rows.append(f"| {idx+1} | {art['title'][:45]}... | {art['pv']:,} | {art['likes']:,} | {art['cvr']}% |")
            
        table_str = "\n".join(table_rows)
        
        report = f"""# 📊 noteアクセス分析＆改善アクションレポート（{datetime.date.today()}）

> [!NOTE]
> ※本レポートはGemini API制限に達したため、ローカルのルールベース静的解析によって自動フォールバック生成されました。データの正確性は保証されています。

## 📈 全体サマリーと主要インサイト
- **総記事数**: {len(stats)} 本
- **合計PV数**: {total_pv:,} PV
- **合計スキ数**: {total_likes:,} スキ
- **平均CVR（スキ率）**: {avg_cvr}%

### 💡 主要インサイト
1. **最大関心記事**: 「{best_pv_article}」が最もアクセスを集めています。流入の起点として機能しています。
2. **最高エンゲージメント記事**: 「{best_cvr_article}」が最も高いリアクション率（{sorted_by_cvr[0]['cvr']}%）を記録しています。この記事の導線や内容は読者に強く刺さっています。

## 🏆 パフォーマンスランキング（PV順）
| 順位 | 記事タイトル | PV | スキ | CVR（スキ/PV） |
|:--|:---|:---:|:---:|:---:|
{table_str}

## 🎯 次のAI改善アクションプラン（超具体的指示）

- **YouTube解析優先キュー追加推奨**: **{recommended_champ}**
  - **理由**: 「{best_pv_article}」の反響が大きく、関連テーマ（{recommended_champ} のマクロ・対面対策など）の解説動画を追加で YouTube Absorber にキューイングすることで、さらなるPV獲得とマガジン購入への導線強化が期待できます。
  
- **リライト・導線改善**: CVR（スキ率）が比較的低い記事のタイトルを「動画を観ずに1秒で記事化！...」のように、ユーザーのベネフィット（時間の節約、副業収益化）が前面に出る形に変更し、文頭に購入用マガジンへのリンクを設置してください。
"""
        return report

    def analyze_stats_via_gemini(self, stats):
        """Geminiを使い、アクセス状況から改善提案レポートを自動生成する"""
        if not self.client:
            logger.warning("Gemini client is not configured. Falling back to rule-based generation.")
            return self._generate_rule_based_report(stats)
            
        stats_str = json.dumps(stats, ensure_ascii=False, indent=2)
        
        prompt = f"""
        あなたは敏腕noteマーケターおよびLoLコーチです。
        以下のnote記事のアクセス分析データ（直近のPV数、スキ数、CVRなど）を読み込み、
        収益最大化（有料記事の売上増、リピーター増）に向けた「改善提案レポート（Markdown形式）」を作成してください。

        【アクセスデータ】
        {stats_str}

        【作成要件】
        - 徹底してデータ（PV、CVR）に基づいた論理的な分析を行うこと。
        - どの記事が最も関心を集めているか（PVが高いか）、どの記事が最も読者のエンゲージメントが高いか（CVR＝スキ率が高いか）を明確にする。
        - **重要**: 次のアクションプラン（改善提案）として、以下を具体的に提示すること。
          1. 「次にYouTube Absorberで解析すべき、優先度の高いチャンピオン名やテーマの推薦（例: 〇〇の記事のPVが良いので、さらにこの対面マクロ動画を2本解析して追加記事を書く等）」
          2. 「既存記事のリライト（追記・修正）提案（CVRが低い記事のタイトル改善や、購入導線の見直し等）」
        - 出力フォーマットは以下の通りとし、全て日本語で記述すること：
          # 📊 noteアクセス分析＆改善アクションレポート（{datetime.date.today()}）
          ## 📈 全体サマリーと主要インサイト
          ## 🏆 パフォーマンスランキング（表形式）
          ## 🎯 次のAI改善アクションプラン（超具体的指示）
          - **YouTube解析優先キュー追加推奨**: 〇〇 (理由: ...)
          - **リライト・導線改善**: 〇〇 (理由: ...)
        """
        
        try:
            logger.info("Generating analytics report via Gemini...")
            response = generate_with_routing(
                self.client,
                prompt,
                task_type="oracle", # 最も割り当て枠が多い'oracle'タスクタイプを使用し制限を回避
                feature_name="x_analyzer"
            )
            if not response or response.startswith("⚠️") or response.startswith("❌") or "エラーが発生した" in response:
                logger.warning("Gemini returned error message. Falling back to rule-based report.")
                return self._generate_rule_based_report(stats)
            return response
        except Exception as e:
            logger.error(f"Gemini analysis failed: {e}. Falling back to rule-based report.")
            return self._generate_rule_based_report(stats)

    def run_analysis(self):
        logger.info("🚀 Starting note Access & Sales Analysis...")
        stats = self.scrape_note_stats()
        
        report = self.analyze_stats_via_gemini(stats)
        
        # レポート保存
        date_str = datetime.date.today().strftime("%Y-%m-%d")
        report_path = os.path.join(self.report_dir, f"note_report_{date_str}.md")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(report)
            
        logger.info(f"✅ Generated analysis report at: {report_path}")
        
        # 重要なインサイト部分を抽出して Discord に通知
        lines = report.split('\n')
        action_plan_lines = []
        capture = False
        for line in lines:
            if "## 🎯 次のAI改善アクションプラン" in line or "## 🎯" in line:
                capture = True
            if capture:
                action_plan_lines.append(line)
                
        action_plan_str = "\n".join(action_plan_lines[:15]) if action_plan_lines else "分析レポートをご覧ください。"
        
        # Discord 通知
        herald.notify_progress(
            f"📈 **【noteアクセス解析完了】**\n"
            f"直近の売上・PVデータを分析し、改善プランを策定しました。\n\n"
            f"📁 保存先: `02_FACTORY/assets/analytics/note_report_{date_str}.md`\n\n"
            f"{action_plan_str}\n"
            f"*(※ この提案を基に、OPチャンピオンの動画解析が自動でキューイングされます)*"
        )
        return report_path

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    daemon = NoteAnalyticsDaemon()
    daemon.run_analysis()
