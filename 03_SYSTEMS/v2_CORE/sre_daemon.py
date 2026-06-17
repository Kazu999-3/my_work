import os
import time
import logging
import hashlib
import threading
from pathlib import Path
from collections import deque
from google import genai
from google.genai import types
from v2_CORE.settings import settings
from v2_CORE.pulse import SovereignPulse

from v2_CORE.logger_config import setup_sovereign_logging
logger = setup_sovereign_logging("SREDaemon")

class SREDaemon:
    def __init__(self):
        self.log_file = settings.LOG_DIR / "sovereign_os.log"
        self.pulse = SovereignPulse()
        self.reported_errors = {}
        self.error_cooldown = 3600  # 同じエラーは1時間報告しない
        self.task_lock = threading.Lock()

        # Gemini API
        api_key = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
        self.client = genai.Client(api_key=api_key) if api_key else None

        # AutoHealer初期化
        from v2_CORE.healer import AutoHealer
        self.healer = AutoHealer()

    def _get_error_fingerprint(self, error_text):
        """エラーのスタックトレースから不要なタイムスタンプ等を抜いたハッシュを生成"""
        # 簡易的に最初の200文字を使用
        return hashlib.md5(error_text[:200].encode()).hexdigest()

    def analyze_error_with_ai(self, error_text):
        """AIを使ってエラー原因と解決策を分析"""
        if not self.client:
            return "⚠️ Gemini APIキーが未設定のため、AI解析をスキップしました。"
            
        prompt = f"""
あなたはシステムのSRE（Site Reliability Engineering）エージェントです。
以下のエラーログを解析し、原因と解決策を簡潔に回答してください。
システム用語は極力控え、ユーザーが「次にどうアクションすればよいか」を明確にすること。
Playwrightのタイムアウトの場合は、「対象サイトのUI仕様が変更された可能性があります。セレクタの再確認が必要です」と指摘してください。
API制限の場合は、「一定時間待機することで自動的に解消される見込みです」と案内してください。

[エラーログ]:
{error_text}
"""
        try:
            from v2_CORE.ai_helper import generate_content_safe
            from v2_CORE.settings import settings
            response_text = generate_content_safe(
                self.client,
                prompt,
                model_id=settings.DEFAULT_MODEL,
                feature_name="oracle"
            )
            return response_text
        except Exception as e:
            return f"⚠️ AI解析中にエラーが発生しました: {e}"

    def run(self):
        if not self.log_file.exists():
            logger.error(f"❌ ログファイルが見つかりません: {self.log_file}")
            return

        logger.info(f"🛡️ SRE Daemon (Auto-Healer) が監視を開始しました: {self.log_file}")
        self.pulse.send_discord_notification(
            title="🛡️ SRE Daemon 起動",
            description="エラーログの自律監視を開始しました。また、定期的な辞典整理（AI自動マージ）もバックグラウンドで稼働します。"
        )
        
        # 定期的な辞典整理タスク（Dict Synthesizer）を別スレッドで稼働させる
        import threading
        import subprocess
        import httpx
        
        def run_synthesizer_loop():
            # 起動直後のAPI競合を回避するため、初回の実行前に30分待機
            time.sleep(1800)
            while True:
                try:
                    with self.task_lock:
                        logger.info("🔧 [SRE Daemon] 定期タスク: 辞典整理(DictSynthesizer)を開始します...")
                        env = os.environ.copy()
                        env["PYTHONPATH"] = "d:/my_work/03_SYSTEMS"  # 絶対パスで指定しないとモジュール解決失敗
                        subprocess.run(
                            [r".venv\Scripts\python.exe", "03_SYSTEMS/v2_CORE/_LOL/dict_synthesizer.py"], 
                            cwd="d:/my_work",
                            env=env,
                            check=False
                        )
                except Exception as e:
                    logger.error(f"❌ DictSynthesizer実行エラー: {e}")
                time.sleep(10800)  # 3時間おきに実行

        def run_youtube_absorber_loop():
            # 起動直後のAPI競合を回避するため、初回の実行前に10分待機
            time.sleep(600)
            while True:
                try:
                    with self.task_lock:
                        logger.info("🔧 [SRE Daemon] 定期タスク: YouTube Absorber (動画解析)を開始します...")
                        env = os.environ.copy()
                        env["PYTHONPATH"] = "d:/my_work/03_SYSTEMS"  # 絶対パスで指定しないとモジュール解決失敗
                        subprocess.run(
                            [r".venv\Scripts\python.exe", "03_SYSTEMS/v2_CORE/_LOL/youtube_absorber.py"], 
                            cwd="d:/my_work",
                            env=env,
                            check=False
                        )
                except Exception as e:
                    logger.error(f"❌ YouTubeAbsorber実行エラー: {e}")
                time.sleep(900)  # 15分おきに少しずつ実行してAPI制限を回避

        def run_reddit_scout_loop():
            # 起動直後のAPI競合を回避するため、初回の実行前に1時間待機
            time.sleep(3600)
            while True:
                try:
                    with self.task_lock:
                        logger.info("🔧 [SRE Daemon] 定期タスク: Reddit Scout (トレンド収集)を開始します...")
                        env = os.environ.copy()
                        env["PYTHONPATH"] = "03_SYSTEMS"
                        subprocess.run(
                            [r".venv\Scripts\python.exe", "03_SYSTEMS/v2_CORE/_LOL/reddit_scout.py"], 
                            cwd="d:/my_work",
                            env=env,
                            check=False
                        )
                except Exception as e:
                    logger.error(f"❌ RedditScout実行エラー: {e}")
                time.sleep(43200)  # 12時間おきに実行

        # --- ライブラリから削除されたファイルのローカルクリーンアップ処理 ---
        def cleanup_deleted_files_loop():
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_KEY")
            if not url or not key: return
            headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
            
            while True:
                try:
                    # 全件取得してPythonでフィルタ（API文法の不整合回避）
                    res = httpx.get(f"{url}/rest/v1/bible_articles?select=id,title,file_path,keywords", headers=headers, timeout=10)
                    if res.status_code == 200:
                        articles = res.json()
                        for article in articles:
                            keywords = article.get("keywords", [])
                            if keywords and "__DELETED__" in keywords:
                                file_path = article.get("file_path")
                                title = article.get("title")
                                
                                # 1. ローカルファイルの削除
                                if file_path and os.path.exists(file_path):
                                    try:
                                        os.remove(file_path)
                                        logger.info(f"🗑️ [Cleanup] ローカルファイルを削除しました: {file_path}")
                                    except Exception as e:
                                        logger.error(f"❌ ファイル削除エラー {file_path}: {e}")
                                        
                                # 2. Supabase から完全削除
                                del_res = httpx.delete(f"{url}/rest/v1/bible_articles?id=eq.{article['id']}", headers=headers, timeout=10)
                                if del_res.status_code in (200, 204):
                                    logger.info(f"✅ [Cleanup] データベースから完全に削除しました: {title}")
                except Exception as e:
                    logger.error(f"❌ Cleanup loop error: {e}")
                time.sleep(15)  # 15秒間隔でチェック

        # --- ダッシュボード用 システムメトリクス配信処理 ---
        def publish_system_metrics_loop():
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_KEY")
            if not url or not key: return
            headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"}
            
            queue_file = Path("d:/my_work/02_FACTORY/kirei_queue.json")
            
            while True:
                try:
                    # 1. YouTube キューの集計
                    pending_count = 0
                    error_count = 0
                    completed_count = 0
                    error_details = []  # エラー詳細（動画タイトル+理由）
                    if queue_file.exists():
                        import json
                        try:
                            with open(queue_file, "r", encoding="utf-8") as f:
                                queue = json.load(f)
                                for item in queue:
                                    s = item.get("status")
                                    if s == "pending": pending_count += 1
                                    elif s == "completed": completed_count += 1
                                    elif str(s).startswith("error"):
                                        error_count += 1
                                        # エラー詳細を最大10件収集
                                        if len(error_details) < 10:
                                            error_details.append({
                                                "title": item.get("title", "不明")[:80],
                                                "error": str(s)[:100]
                                            })
                        except Exception:
                            pass
                    
                    # 2. 最新ログの取得 (直近20行)
                    recent_logs = []
                    if self.log_file.exists():
                        try:
                            with open(self.log_file, "r", encoding="utf-8", errors="replace") as f:
                                lines = f.readlines()
                                # INFO 以上の意味のあるログを抽出（新旧フォーマット両対応）
                                # 旧: "[INFO] ..." / 新: "[SREDaemon] INFO: ..."
                                filtered = []
                                for l in lines:
                                    line = l.strip()
                                    if not line:
                                        continue
                                    # httpx の HTTP Request ログはノイズなので除外
                                    if "HTTP Request:" in line:
                                        continue
                                    # AFC ログもノイズなので除外
                                    if "AFC is enabled" in line:
                                        continue
                                    # 旧形式 [INFO] / [WARNING] / [ERROR] または 新形式 INFO: / WARNING: / ERROR:
                                    if any(kw in line for kw in ("INFO:", "WARNING:", "ERROR:", "[INFO]", "[WARNING]", "[ERROR]")):
                                        filtered.append(line)
                                recent_logs = filtered[-20:] if filtered else []
                        except Exception:
                            pass
                            
                    # 3. Supabase へ送信 (matchup_sentinel に擬似的に保存)
                    raw_data = {
                        "queue": {
                            "pending": pending_count,
                            "completed": completed_count,
                            "error": error_count,
                            "error_details": error_details
                        },
                        "logs": recent_logs,
                        "updated_at": time.time()
                    }
                    
                    payload = {
                        "matchup_id": "SYSTEM_METRICS",
                        "champion": "SYSTEM",
                        "enemy": "GLOBAL",
                        "title": "System Metrics",
                        "strategy": "",
                        "raw_data": raw_data
                    }
                    
                    httpx.post(
                        f"{url}/rest/v1/matchup_sentinel?on_conflict=matchup_id",
                        headers=headers,
                        json=payload,
                        timeout=10
                    )
                except Exception as e:
                    logger.error(f"❌ Metrics publish loop error: {e}")
                
                time.sleep(15)  # 15秒間隔で更新

        # --- 定期タスク: アフィリエイト一気通貫バッチ ---
        def run_monetization_batch_loop():
            # 起動直後のAPI競合を回避するため、初回実行前に2時間待機
            time.sleep(7200)
            while True:
                try:
                    with self.task_lock:
                        logger.info("🔧 [SRE Daemon] 定期タスク: Monetization Batch (一気通貫アフィリエイトバッチ)を開始します...")
                        env = os.environ.copy()
                        env["PYTHONPATH"] = "03_SYSTEMS"
                        import subprocess
                        subprocess.run(
                            [r".venv\Scripts\python.exe", "03_SYSTEMS/v2_CORE/monetization_batch.py"], 
                            cwd="d:/my_work",
                            env=env,
                            check=False
                        )
                except Exception as e:
                    logger.error(f"❌ MonetizationBatch実行エラー: {e}")
                time.sleep(201600)  # 約56時間（週3回）おきに実行

        threading.Thread(target=run_synthesizer_loop, daemon=True).start()
        threading.Thread(target=run_youtube_absorber_loop, daemon=True).start()
        threading.Thread(target=run_reddit_scout_loop, daemon=True).start()
        threading.Thread(target=cleanup_deleted_files_loop, daemon=True).start()
        threading.Thread(target=publish_system_metrics_loop, daemon=True).start()
        threading.Thread(target=run_monetization_batch_loop, daemon=True).start()

        # Windowsでのファイルロック（PermissionError）を回避するため、開きっぱなしにせず毎回クローズする監視ロジック
        last_position = self.log_file.stat().st_size if self.log_file.exists() else 0
        error_buffer = []
        capturing = False
        capture_timeout = 0
        
        while True:
            try:
                if self.log_file.exists():
                    current_size = self.log_file.stat().st_size
                    # ファイルがローテーションされた、または切り詰められた場合
                    if current_size < last_position:
                        last_position = 0
                        
                    if current_size > last_position:
                        with open(self.log_file, 'r', encoding='utf-8', errors='replace') as f:
                            f.seek(last_position)
                            while True:
                                line = f.readline()
                                if not line:
                                    last_position = f.tell()
                                    break
                                
                                # ERROR, Exception, Timeout などのキーワードを検知
                                if not capturing and ("ERROR" in line or "Exception" in line or "TimeoutError" in line or "Locator.click: Timeout" in line):
                                    capturing = True
                                    error_buffer.append(line)
                                    capture_timeout = time.time() + 2.0  # エラー発生後、後続のスタックトレースを2秒間収集する
                                elif capturing:
                                    error_buffer.append(line)
                                    capture_timeout = time.time() + 2.0
            except Exception as e:
                logger.error(f"❌ Log watch loop error: {e}")
                
            time.sleep(1.0)
            
            # キャプチャ終了判定 (新しい行が数秒来ない場合)
            if capturing and time.time() > capture_timeout:
                self._process_error_buffer(error_buffer)
                error_buffer = []
                capturing = False

    def _process_error_buffer(self, error_buffer):
        error_text = "".join(error_buffer).strip()
        if not error_text:
            return
            
        # 429 エラーなどは pulse.py の通知抑制に引っかかる可能性があるが、SREとしてはあえて解析する
        if "429" in error_text or "RESOURCE_EXHAUSTED" in error_text:
            # 頻繁に出るため、AI解析せずに短く報告して終わる
            fingerprint = "rate_limit_429"
        else:
            fingerprint = self._get_error_fingerprint(error_text)

        now = time.time()
        if fingerprint in self.reported_errors:
            if now - self.reported_errors[fingerprint] < self.error_cooldown:
                logger.info("ℹ️ 同一エラーの報告を抑制しました。")
                return
        
        self.reported_errors[fingerprint] = now
        logger.warning(f"⚠️ エラー検知。AI解析および自己修復を試みます:\n{error_text[:200]}...")
        
        # 自己修復の実行 (429制限エラー等を除く)
        healed = False
        heal_msg = "API制限またはインフラエラーのため自己修復はスキップされました。"
        if fingerprint != "rate_limit_429":
            try:
                healed, heal_msg = self.healer.heal_error(error_text)
                if healed:
                    logger.info(f"🛡️ [SREDaemon] {heal_msg}")
                else:
                    logger.warning(f"⚠️ [SREDaemon] 自己修復失敗/スキップ: {heal_msg}")
            except Exception as e:
                heal_msg = f"自己修復実行中に致命的エラーが発生しました: {e}"
                logger.error(f"❌ [SREDaemon] Healer exception: {e}")

        # Discord通知のフォーマット構築 (通知デザイナー準拠)
        if fingerprint == "rate_limit_429":
            title = "⚠️ システムエラー検知 (API利用制限)"
            description = (
                f"**📡 API利用制限 (429 Too Many Requests)** を検知しました。\n"
                f"Exponential Backoff およびプロセススロットリングによりシステムは自律的に待機・リトライを行っています。アクションは不要です。\n\n"
                f"**📄 該当ログ抜粋**\n```text\n{error_text[:300]}...\n```"
            )
        else:
            if healed:
                title = "✨🛡️ システム自己修復成功 (SRE Auto-Healer)"
                description = (
                    f"**🤖 AIによる自律コード修復結果**:\n{heal_msg}\n\n"
                    f"**📄 該当エラーログ**\n```text\n{error_text[:400]}...\n```"
                )
            else:
                # 従来通りのAI解析を実行して通知
                analysis = self.analyze_error_with_ai(error_text[:3000])
                title = "🚨 システムエラー検知 & 修復失敗 (SRE Auto-Healer)"
                description = (
                    f"**🤖 自己修復結果**: {heal_msg}\n\n"
                    f"**✨ 原因と解決策の提案 (AI分析)**:\n{analysis}\n\n"
                    f"**📄 該当エラーログ**\n```text\n{error_text[:400]}...\n```"
                )

        self.pulse.send_discord_notification(
            title=title,
            description=description
        )

if __name__ == "__main__":
    daemon = SREDaemon()
    daemon.run()
