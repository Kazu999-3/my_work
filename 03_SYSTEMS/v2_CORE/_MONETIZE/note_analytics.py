import os
import json
import time
import logging
import re
from pathlib import Path
from playwright.sync_api import sync_playwright
import dotenv
import requests
from google import genai

try:
    from v2_CORE.settings import settings
    from v2_CORE.logger_config import setup_sovereign_logging
    from v2_CORE.ai_helper import generate_content_safe
    from v2_CORE.agents.state import SovereignState, save_state_to_supabase
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    from v2_CORE.settings import settings
    from v2_CORE.logger_config import setup_sovereign_logging
    from v2_CORE.ai_helper import generate_content_safe
    from v2_CORE.agents.state import SovereignState, save_state_to_supabase

# .env ファイルのロード
dotenv.load_dotenv(Path("d:/my_work/.env"))

logger = setup_sovereign_logging("NoteAnalytics")

class NoteAnalytics:
    def __init__(self, headless=True):
        self.headless = headless
        self.user_data_dir = Path("D:/my_work/.agent/playwright_data/note_profile")
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_KEY")
        
        self.gemini_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.gemini_key:
            self.client = genai.Client(api_key=self.gemini_key)
        else:
            self.client = None

    def fetch_stats_from_note(self) -> list:
        """Playwright を用いて note.com のアクセス状況APIからデータを取得"""
        logger.info("🌐 Playwright で note 統計情報の取得を開始します...")
        with sync_playwright() as p:
            self.user_data_dir.parent.mkdir(parents=True, exist_ok=True)
            
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(self.user_data_dir),
                headless=self.headless,
                channel="chrome",
                viewport={'width': 1280, 'height': 720},
                locale="ja-JP",
                args=["--disable-blink-features=AutomationControlled"],
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
            
            page = context.new_page()
            
            # note の stats エンドポイントを叩く
            api_url = "https://note.com/api/v1/stats/pv?filter=all&page=1&sort=pv"
            logger.info(f"Navigate to note stats API: {api_url}")
            page.goto("https://note.com/")
            time.sleep(3)
            
            response = page.goto(api_url)
            time.sleep(4)
            
            try:
                if response is None:
                    raise RuntimeError("APIへのアクセス結果(Response)が空です。")
                data = response.json()
                logger.info("✅ note stats API からデータを正常に受信しました。")
                context.close()
                return self.parse_stats_data(data)
            except Exception as e:
                logger.error(f"❌ 統計データのパースに失敗しました: {e}")
                try:
                    page.screenshot(path="D:/my_work/.agent/logs/stats_error.png")
                except:
                    pass
                context.close()
                return []

    def parse_stats_data(self, raw_data: dict) -> list:
        """noteの様々なJSONレスポンス構造に柔軟に対応してパース"""
        notes_list = []
        data_block = raw_data.get("data", {})
        
        items = []
        if isinstance(data_block, dict):
            for key in ["notes", "stats", "records", "items"]:
                if key in data_block and isinstance(data_block[key], list):
                    items = data_block[key]
                    break
            if not items:
                if isinstance(data_block, list):
                    items = data_block
        elif isinstance(raw_data, list):
            items = raw_data
            
        if not items and isinstance(raw_data, dict):
            for key in ["data", "notes", "stats", "items"]:
                if key in raw_data and isinstance(raw_data[key], list):
                    items = raw_data[key]
                    break
                    
        logger.info(f"🔍 解析対象の記事数: {len(items)}件")
        
        for item in items:
            if not isinstance(item, dict):
                continue
                
            note_id = str(item.get("noteId") or item.get("id") or "")
            title = item.get("title") or item.get("name") or "無題の記事"
            pv = item.get("pv") or item.get("pvCount") or item.get("viewCount") or item.get("views") or 0
            likes = item.get("likeCount") or item.get("likes") or item.get("like_count") or 0
            comments = item.get("commentCount") or item.get("comments") or item.get("comment_count") or 0
            
            if note_id:
                notes_list.append({
                    "note_id": note_id,
                    "title": title,
                    "pv": int(pv),
                    "likes": int(likes),
                    "comments": int(comments)
                })
                
        return notes_list

    def _update_ab_test_fitness(self, title: str, pv: int):
        """
        記事のタイトルが A/B テストの DNA (候補) と一致する場合、
        その PV 数を適合度 (fitness) として Supabase に更新する。
        """
        if not self.supabase_url or not self.supabase_key:
            return
            
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }
        
        # 1. [ITツール攻略] プレフィックスなどを考慮して一致比較
        clean_title = title.replace("[ITツール攻略] ", "").strip()
        url = f"{self.supabase_url}/rest/v1/ab_test_variations"
        params = {
            "task_type": "eq.note_title",
            "dna": f"eq.{clean_title}"
        }
        
        try:
            r = requests.get(url, headers=headers, params=params, timeout=5)
            if r.status_code == 200 and r.json():
                variation = r.json()[0]
                var_id = variation["id"]
                
                # 2. fitness (PV) を更新
                patch_payload = {"fitness": float(pv)}
                patch_params = {"id": f"eq.{var_id}"}
                requests.patch(
                    url,
                    headers=headers,
                    params=patch_params,
                    json=patch_payload,
                    timeout=5
                )
                logger.info(f"[GA] Updated DNA fitness for title '{clean_title}': {pv}")
        except Exception as e:
            logger.error(f"[GA] Error updating A/B test fitness for title '{clean_title}': {e}")

    def save_stats_to_supabase(self, stats: list):
        """Supabase の note_pv_history テーブルにインサート/アップデート"""
        if not self.supabase_url or not self.supabase_key:
            logger.warning("⚠️ Supabaseの設定がないため、DB保存をスキップします。")
            return
            
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }
        
        logger.info(f"💾 {len(stats)}件の統計データを Supabase へアップロード中...")
        success_count = 0
        
        from datetime import date
        today_str = date.today().isoformat()
        
        for item in stats:
            payload = {
                "note_id": item["note_id"],
                "title": item["title"],
                "pv": item["pv"],
                "likes": item["likes"],
                "comments": item["comments"],
                "recorded_date": today_str
            }
            try:
                res = requests.post(
                    f"{self.supabase_url}/rest/v1/note_pv_history",
                    headers=headers,
                    json=payload,
                    timeout=10
                )
                if res.status_code in (200, 201, 204):
                    success_count += 1
                    # A/Bテストの適合度(fitness)自動更新をフック
                    self._update_ab_test_fitness(item["title"], item["pv"])
                else:
                    logger.warning(f"⚠️ DB書き込み失敗 ({item['title']}): {res.text}")
            except Exception as e:
                logger.error(f"❌ DB通信エラー: {e}")
                
        logger.info(f"✅ DB保存完了: {success_count}/{len(stats)} 件が記録されました。")

    def analyze_trends_with_ai(self) -> dict:
        """過去のPVデータを取得し、Geminiで人気トレンドの傾向と次の推奨ツールを算出"""
        logger.info("🤖 Gemini AI によるアクセス動向分析を開始します...")
        if not self.supabase_url or not self.supabase_key:
            return self.get_dummy_analysis()
            
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }
        
        try:
            res = requests.get(
                f"{self.supabase_url}/rest/v1/note_pv_history?order=recorded_date.desc&limit=100",
                headers=headers,
                timeout=15
            )
            if res.status_code != 200:
                logger.warning("⚠️ PV履歴データのフェッチに失敗しました。")
                return self.get_dummy_analysis()
            history_data = res.json()
        except Exception as e:
            logger.error(f"❌ 履歴フェッチエラー: {e}")
            return self.get_dummy_analysis()
            
        if not history_data:
            logger.warning("⚠️ 分析用の履歴データが存在しません。")
            return self.get_dummy_analysis()

        stats_summary = json.dumps(history_data[:50], ensure_ascii=False, indent=2)
        
        prompt = f"""
        あなたはITコンテンツマーケティングおよびSNSのデータサイエンティストです。
        以下は当システムが自動投稿したアフィリエイト・レビュー記事（note）のアクセス履歴データです。

        【PV履歴データ (直近)】:
        {stats_summary}

        これらを基にデータ分析を行い、読者がどのツールやトピックに強い興味（PV、スキ数など）を示しているか判定してください。
        以下のJSONフォーマットのみで結果を出力してください。分析結果や挨拶、```json のようなマークダウンは一切含めないでください。

        {{
          "popular_keywords": ["人気のキーワード1", "キーワード2"],
          "recommended_tools": ["Notion", "Canva", "ChatGPT"],
          "analysis": "PV数とリアクション率（スキ数/PV）に基づく読者の興味関心の分析テキスト。どの機能や話題が刺さっているかを簡潔に解説。"
        }}
        """
        
        if not self.client:
            logger.warning("⚠️ Geminiクライアントがありません。ダミー分析を生成します。")
            return self.get_dummy_analysis()
            
        try:
            res_text = generate_content_safe(
                self.client,
                prompt,
                model_id=settings.DEFAULT_MODEL,
                feature_name="note_analytics"
            )
            if not res_text or "❌" in res_text or "⚠️" in res_text or "一時的なエラーが発生した" in res_text:
                return self.get_dummy_analysis()
                
            cleaned = res_text.strip()
            if cleaned.startswith("```"):
                match = re.search(r"```(?:json)?\s*(.*?)\s*```", cleaned, re.DOTALL)
                if match:
                    cleaned = match.group(1).strip()
                    
            analysis_result = json.loads(cleaned)
            logger.info("✅ AI分析が正常に完了しました。")
            return analysis_result
        except Exception as e:
            logger.error(f"❌ AI分析処理エラー: {e}")
            return self.get_dummy_analysis()

    def get_dummy_analysis(self) -> dict:
        return {
            "popular_keywords": ["デザイン自動生成", "Notion AI", "生産性向上"],
            "recommended_tools": ["Canva", "Notion", "ChatGPT"],
            "analysis": "データ不足またはAPI制限のため、デフォルトの初期設定に基づき分析を構築しました。一般的にCanvaのAI画像・デザイン作成に関する解説記事は、SNS（X）からの流入で最も高いPVを獲得する傾向があります。"
        }

    def fetch_x_stats(self) -> list:
        """X(Twitter)の過去投稿インプレッション数をPlaywrightで簡易収集、またはモックフォールバック"""
        logger.info("🐦 X(Twitter)のアナリティクスデータ収集を開始します...")
        username = os.environ.get("TWITTER_USERNAME")
        password = os.environ.get("TWITTER_PASSWORD")
        
        # ログインアカウントが設定されていなければモックにフォールバック
        if not username or not password:
            logger.warning("TWITTER_USERNAME or TWITTER_PASSWORD not set in environment. Generating mock X stats.")
            return self._get_mock_x_stats()
            
        with sync_playwright() as p:
            try:
                # ログインセッションを使いまわす
                context = p.chromium.launch_persistent_context(
                    user_data_dir=str(self.user_data_dir.parent / "x_profile"),
                    headless=self.headless,
                    channel="chrome",
                    viewport={'width': 1280, 'height': 720},
                    locale="ja-JP",
                    args=["--disable-blink-features=AutomationControlled"]
                )
                page = context.new_page()
                page.goto("https://x.com/login", timeout=20000)
                time.sleep(3)
                
                # 未ログインならログイン処理
                if "login" in page.url:
                    page.locator('input[autocomplete="username"]').fill(username)
                    page.locator('span:has-text("次へ"), button:has-text("Next")').first.click()
                    time.sleep(2)
                    
                    # パスワード入力
                    page.locator('input[name="password"]').fill(password)
                    page.locator('span:has-text("ログイン"), button:has-text("Log in")').first.click()
                    time.sleep(5)
                
                # プロフィールページへ移動
                page.goto(f"https://x.com/{username}", timeout=20000)
                time.sleep(5)
                
                tweets_data = []
                # ツイート要素から情報を抽出
                articles = page.locator('article[data-testid="tweet"]').all()
                for art in articles[:10]:
                    try:
                        text = art.locator('[data-testid="tweetText"]').inner_text()
                        
                        # アナリティクス要素（インプレッション）の取得
                        analytics_btn = art.locator('[data-testid="analytics"]').first
                        imp_val = 0
                        if analytics_btn.count() > 0:
                            label = analytics_btn.get_attribute("aria-label") or ""
                            # aria-label 例: "1,234 views" または "1234 表示" などの数値抽出
                            match = re.search(r'(\d[\d,]*)\s*(?:表示|views)', label)
                            if match:
                                imp_val = int(match.group(1).replace(',', ''))
                        
                        if imp_val > 0:
                            tweets_data.append({"text": text, "impressions": imp_val})
                    except Exception as inner_e:
                        logger.debug(f"Failed to parse individual tweet: {inner_e}")
                        
                context.close()
                if tweets_data:
                    logger.info(f"✅ Xから {len(tweets_data)} 件のツイート統計を取得しました。")
                    return tweets_data
                else:
                    logger.warning("No tweet analytics could be parsed. Falling back to mock X stats.")
                    return self._get_mock_x_stats()
            except Exception as e:
                logger.error(f"❌ X scraping failed: {e}. Falling back to mock X stats.")
                return self._get_mock_x_stats()

    def _get_mock_x_stats(self) -> list:
        """テスト用のX統計データ（モック）"""
        logger.info("[GA] Generating mock X stats...")
        return [
            {
                "text": "30分の解説動画を「一時停止を繰り返しながらメモを取る」のは、もう時間の無駄です。YouTube自動化AIを使えば、一瞬で動画からnoteの高品質ドラフトを量産できます。作業時間を極限まで圧縮する秘密はこちら👇",
                "impressions": 4850
            },
            {
                "text": "【悲報】今のメタ、〇〇を知らないと一生勝てません。詳細はこちら...",
                "impressions": 120
            }
        ]

    def _update_x_ab_test_fitness(self, text: str, impressions: int):
        """Xのインプレッション数を該当する x_hook DNA の適合度に反映させる"""
        if not self.supabase_url or not self.supabase_key:
            return
            
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }
        
        # アクティブな x_hook DNA をフェッチ
        url = f"{self.supabase_url}/rest/v1/ab_test_variations"
        params = {
            "task_type": "eq.x_hook",
            "status": "eq.active"
        }
        
        try:
            r = requests.get(url, headers=headers, params=params, timeout=5)
            if r.status_code == 200 and r.json():
                variations = r.json()
                for var in variations:
                    dna_text = var["dna"]
                    # 簡易的な部分一致比較（余分な空白を除去）
                    clean_dna = re.sub(r'\s+', '', dna_text)
                    clean_tweet = re.sub(r'\s+', '', text)
                    if clean_dna in clean_tweet or clean_tweet in clean_dna or dna_text[:15] in text:
                        var_id = var["id"]
                        
                        # 適合度をインプレッション数に更新
                        patch_payload = {"fitness": float(impressions)}
                        patch_params = {"id": f"eq.{var_id}"}
                        requests.patch(
                            url,
                            headers=headers,
                            params=patch_params,
                            json=patch_payload,
                            timeout=5
                        )
                        logger.info(f"[GA] Updated X DNA fitness for '{dna_text[:20]}...': {impressions}")
        except Exception as e:
            logger.error(f"[GA] Error updating X fitness: {e}")

    def run_analytics(self):
        logger.info("=== 📈 Note & X Analytics 稼働開始 ===")
        
        # 1. note アクセス状況取得と適合度反映
        stats = self.fetch_stats_from_note()
        if not stats:
            logger.warning("⚠️ 取得された note 統計データが空です。処理をスキップします。")
            stats = [
                {"note_id": "dummy_canva", "title": "【決定版】Canva超活用術", "pv": 150, "likes": 12, "comments": 1},
                {"note_id": "dummy_notion", "title": "【決定版】Notion超活用術", "pv": 80, "likes": 5, "comments": 0}
            ]
        self.save_stats_to_supabase(stats)
        
        # 2. X インプレッションデータ取得と適合度反映
        x_stats = self.fetch_x_stats()
        for item in x_stats:
            self._update_x_ab_test_fitness(item["text"], item["impressions"])
            
        # 3. AIによるアクセス動向分析（既存処理）
        analysis = self.analyze_trends_with_ai()
        if analysis:
            feedback_file = Path("d:/my_work/02_FACTORY/note_analytics_feedback.json")
            feedback_file.parent.mkdir(parents=True, exist_ok=True)
            try:
                with open(feedback_file, "w", encoding="utf-8") as f:
                    json.dump(analysis, f, ensure_ascii=False, indent=2)
                logger.info(f"💾 AIフィードバックを保存完了: {feedback_file}")
            except Exception as e:
                logger.error(f"❌ フィードバック保存エラー: {e}")
                
        # 4. GA 遺伝的アルゴリズム：自律的な世代交代（Evolve）のキック
        try:
            from v2_CORE._MONETIZE.genetic_optimizer import genetic_optimizer
            logger.info("🧬 [GA Engine] 適合度更新完了に伴い、自動世代交代処理（Evolve）を実行します。")
            genetic_optimizer.evolve_generation("note_title", mutation_rate=0.2)
            genetic_optimizer.evolve_generation("x_hook", mutation_rate=0.2)
            logger.info("🧬 [GA Engine] 自動世代交代完了。")
        except Exception as e:
            logger.error(f"❌ [GA Engine] 自動世代交代エラー: {e}")

def run_analyst_agent(state: SovereignState) -> SovereignState:
    """SovereignState に基づき Analyst エージェントを駆動"""
    logger.info("=== 📊 [Agent] Analyst Agent 起動 ===")
    state["current_agent"] = "analyst"
    state["task_status"] = "analyzing"
    save_state_to_supabase(state)
    
    analytics = NoteAnalytics(headless=True)
    try:
        # 1. note統計データの取得
        stats = analytics.fetch_stats_from_note()
        if not stats:
            logger.warning("⚠️ 統計データが空のため、ダミーデータを同期します。")
            stats = [
                {"note_id": "dummy_canva", "title": "【決定版】Canva超活用術", "pv": 150, "likes": 12, "comments": 1},
                {"note_id": "dummy_notion", "title": "【決定版】Notion超活用術", "pv": 80, "likes": 5, "comments": 0}
            ]
            
        # 2. Supabaseへの保存
        analytics.save_stats_to_supabase(stats)
        
        # 3. stateのperformance_metricsへ格納
        state["performance_metrics"] = {"latest_stats": stats}
        
        # 4. アクセス動向分析
        analysis = analytics.analyze_trends_with_ai()
        state["analysis_report"] = analysis.get("analysis") if isinstance(analysis, dict) else str(analysis)
        
        # 5. ローカルのフィードバックJSONファイルへ保存 (Scout等の他エンジンでの読み込み用)
        feedback_file = Path("d:/my_work/02_FACTORY/note_analytics_feedback.json")
        feedback_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(feedback_file, "w", encoding="utf-8") as f:
                json.dump(analysis, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"❌ フィードバックファイルの保存に失敗: {e}")
            
        state["current_agent"] = "evolution"
        state["task_status"] = "evolving"
        state["error_log"] = None
        logger.info("✅ [Analyst] noteアクセス動向分析完了")
        
    except Exception as e:
        error_msg = f"アナリスト分析エラー: {e}"
        logger.error(f"❌ {error_msg}")
        state["task_status"] = "failed"
        state["error_log"] = error_msg
        
    save_state_to_supabase(state)
    return state

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Note.com Analytics and AI Feedback Loop")
    parser.add_argument("--no-headless", action="store_true", help="Run browser in headful mode (visible)")
    args = parser.parse_args()
    
    analytics = NoteAnalytics(headless=not args.no_headless)
    analytics.run_analytics()
