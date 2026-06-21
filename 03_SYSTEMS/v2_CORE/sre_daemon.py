import os
import sys
import time
import logging
import subprocess
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
        self.is_absorber_running = False  # 動画解析実行中ステータスフラグ

        # Gemini API
        api_key = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
        self.client = genai.Client(api_key=api_key) if api_key else None

        # AutoHealer初期化
        from v2_CORE.healer import AutoHealer
        self.healer = AutoHealer()

    def _enqueue_edge_task(self, task_type: str, payload: dict = None) -> bool:
        """Supabaseの edge_tasks テーブルに pending タスクを挿入する"""
        import httpx
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key: return False
        
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        data = {
            "task_type": task_type,
            "payload": payload or {},
            "status": "pending"
        }
        try:
            res = httpx.post(f"{url}/rest/v1/edge_tasks", headers=headers, json=data, timeout=10)
            if res.status_code in (200, 201):
                logger.info(f"📣 [Orchestrator] タスクをキューイングしました: {task_type}")
                return True
            else:
                logger.error(f"❌ [Orchestrator] タスク登録失敗: {res.status_code} {res.text}")
                return False
        except Exception as e:
            logger.error(f"❌ [Orchestrator] タスク登録中の通信エラー: {e}")
            return False

    def _get_error_fingerprint(self, error_text):
        """エラーのスタックトレースから不要なタイムスタンプ等を抜いたハッシュを生成"""
        # 簡易的に最初の200文字を使用
        return hashlib.md5(error_text[:200].encode()).hexdigest()

    def analyze_error_with_ai(self, error_text):
        """AIを使ってエラー原因と解決策を分析（APIゲートウェイ経由）"""
        import httpx
        url = "http://localhost:8000/api/v1/agent/generate"
        api_key = os.getenv("ANTIGRAVITY_API_KEY", "default_dev_key_2026")
        
        headers = {
            "X-Antigravity-Key": api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "prompt_id": "sre_error_analysis",
            "variables": {
                "error_text": error_text
            }
        }
        try:
            res = httpx.post(url, headers=headers, json=payload, timeout=30)
            if res.status_code == 200:
                data = res.json()
                if data.get("success"):
                    return data.get("text", "")
                else:
                    return f"⚠️ AI解析失敗 (ゲートウェイエラー): {data.get('error_message')}"
            else:
                return f"⚠️ AI解析失敗 (HTTP {res.status_code}): {res.text}"
        except Exception as e:
            return f"⚠️ AI解析通信エラー: {e}"

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
                        logger.info("🔧 [SRE Daemon] 定期タスク: 辞典整理(DictSynthesizer)をキューイングします...")
                        self._enqueue_edge_task("dict_synthesizer")
                except Exception as e:
                    logger.error(f"❌ DictSynthesizerキューイングエラー: {e}")
                time.sleep(10800)  # 3時間おきに実行

        def run_youtube_absorber_loop():
            # 起動直後のAPI競合を回避するため、初回の実行前に10分待機
            time.sleep(600)
            while True:
                try:
                    with self.task_lock:
                        logger.info("🔧 [SRE Daemon] 定期タスク: YouTube Absorberをキューイングします...")
                        self._enqueue_edge_task("youtube_absorb")
                except Exception as e:
                    logger.error(f"❌ YouTubeAbsorberキューイングエラー: {e}")
                time.sleep(900)  # 15分おきに少しずつ実行してAPI制限を回避

        def run_reddit_scout_loop():
            # 起動直後のAPI競合を回避するため、初回の実行前に1時間待機
            time.sleep(3600)
            while True:
                try:
                    with self.task_lock:
                        logger.info("🔧 [SRE Daemon] 定期タスク: Reddit Scoutをキューイングします...")
                        self._enqueue_edge_task("reddit_scout")
                except Exception as e:
                    logger.error(f"❌ RedditScoutキューイングエラー: {e}")
                time.sleep(43200)  # 12時間おきに実行


        # --- ライブラリから削除されたファイルのローカルクリーンアップ処理 ---
        def cleanup_deleted_files_loop():
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_KEY")
            if not url or not key: return
            headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
            
            interval = 15
            while True:
                try:
                    # 全件取得してPythonでフィルタ（API文法の不整合回避）
                    res = httpx.get(f"{url}/rest/v1/personal_knowledge?select=id,title,source_url,tags", headers=headers, timeout=10)
                    if res.status_code == 200:
                        articles = res.json()
                        for article in articles:
                            keywords = article.get("tags", [])
                            if keywords and "__DELETED__" in keywords:
                                file_path = article.get("source_url")
                                title = article.get("title")
                                
                                # 1. ローカルファイルの削除
                                if file_path and os.path.exists(file_path):
                                    try:
                                        os.remove(file_path)
                                        logger.info(f"🗑️ [Cleanup] ローカルファイルを削除しました: {file_path}")
                                    except Exception as e:
                                        logger.error(f"❌ ファイル削除エラー {file_path}: {e}")
                                        
                                # 2. Supabase から完全削除
                                del_res = httpx.delete(f"{url}/rest/v1/personal_knowledge?id=eq.{article['id']}", headers=headers, timeout=10)
                                if del_res.status_code in (200, 204):
                                    logger.info(f"✅ [Cleanup] データベースから完全に削除しました: {title}")
                    interval = 15
                    time.sleep(interval)
                except Exception as e:
                    err_msg = str(e)
                    is_conn_err = any(k in err_msg for k in ("getaddrinfo", "ConnectError", "ConnectTimeout", "Connection refused", "timeout")) or isinstance(e, (httpx.ConnectError, httpx.ConnectTimeout, httpx.RequestError))
                    if is_conn_err:
                        logger.warning(f"⚠️ [Cleanup] 接続エラーを検出しました。{interval}秒後に再試行します: {e}")
                        time.sleep(interval)
                        interval = min(interval * 2, 300)
                    else:
                        logger.error(f"❌ Cleanup loop error: {e}")
                        interval = 15
                        time.sleep(interval)

        # --- ダッシュボード用 システムメトリクス配信処理 ---
        def publish_system_metrics_loop():
            import socket
            from datetime import datetime

            def is_port_active(host: str, port: int) -> bool:
                try:
                    with socket.create_connection((host, port), timeout=0.3):
                        return True
                except OSError:
                    return False

            def check_log_errors(filepath: str, max_recent_errors=5) -> dict:
                path_obj = Path(filepath)
                if not path_obj.exists():
                    return {"active": False, "error_count": 0, "recent_errors": [], "last_updated": None}
                try:
                    mtime = path_obj.stat().st_mtime
                    last_updated = datetime.fromtimestamp(mtime).isoformat()
                    active = (time.time() - mtime) < 3600
                    recent_errors = []
                    with open(path_obj, 'r', encoding='utf-8', errors='replace') as f:
                        lines = f.readlines()
                        for line in reversed(lines[-100:]):
                            line_str = line.strip()
                            if not line_str:
                                continue
                            if "HTTP Request:" in line_str:
                                continue
                            if any(kw in line_str.upper() for kw in ["ERROR", "EXCEPTION", "FAIL", "FATAL", "CRITICAL"]):
                                recent_errors.append(line_str[:120])
                                if len(recent_errors) >= max_recent_errors:
                                    break
                    return {
                        "active": active,
                        "error_count": len(recent_errors),
                        "recent_errors": recent_errors,
                        "last_updated": last_updated
                    }
                except Exception:
                    return {"active": False, "error_count": 0, "recent_errors": [], "last_updated": None}

            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_KEY")
            if not url or not key: return
            headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"}
            
            queue_file = Path("d:/my_work/02_FACTORY/kirei_queue.json")

            interval = 30
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
                    is_absorber_running = False
                    try:
                        res = httpx.get(f"{url}/rest/v1/edge_tasks?status=eq.running&task_type=eq.youtube_absorb", headers=headers, timeout=5)
                        if res.status_code == 200 and res.json():
                            is_absorber_running = True
                    except Exception:
                        pass

                    services_status = {
                        "ollama": { "name": "Ollama", "port": 11434, "running": is_port_active("127.0.0.1", 11434) },
                        "portal": { "name": "Next.js Portal", "port": 3000, "running": is_port_active("127.0.0.1", 3000) },
                        "bot": { "name": "Discord Bot (KTM)", "port": 8787, "running": is_port_active("127.0.0.1", 8787) },
                        "api": { "name": "Core API", "port": 8000, "running": is_port_active("127.0.0.1", 8000) },
                        "sre": { "name": "SRE Daemon", "running": True },
                        "youtube_absorber": { "name": "YouTube Absorber", "running": is_absorber_running }
                    }

                    logs_status = {
                        "portal": check_log_errors("d:/my_work/00_LOGS/portal.log"),
                        "bot": check_log_errors("d:/my_work/00_LOGS/ktm_bot.log"),
                        "api": check_log_errors("d:/my_work/00_LOGS/core_api.log"),
                        "sre": check_log_errors("d:/my_work/00_LOGS/sre_daemon_startup.log")
                    }

                    raw_data = {
                        "queue": {
                            "pending": pending_count,
                            "completed": completed_count,
                            "error": error_count,
                            "error_details": error_details
                        },
                        "logs": recent_logs,
                        "services": services_status,
                        "logs_status": logs_status,
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
                    interval = 30
                    time.sleep(interval)
                except Exception as e:
                    err_msg = str(e)
                    is_conn_err = any(k in err_msg for k in ("getaddrinfo", "ConnectError", "ConnectTimeout", "Connection refused", "timeout")) or isinstance(e, (httpx.ConnectError, httpx.ConnectTimeout, httpx.RequestError))
                    if is_conn_err:
                        logger.warning(f"⚠️ [Metrics] 接続エラーを検出しました。{interval}秒後に再試行します: {e}")
                        time.sleep(interval)
                        interval = min(interval * 2, 300)
                    else:
                        logger.error(f"❌ Metrics publish loop error: {e}")
                        interval = 15
                        time.sleep(interval)

        # --- 定期タスク: アフィリエイト一気通貫バッチ ---
        def run_monetization_batch_loop():
            # 起動直後のAPI競合を回避するため、初回実行前に2時間待機
            time.sleep(7200)
            while True:
                try:
                    with self.task_lock:
                        logger.info("🔧 [SRE Daemon] 定期タスク: Monetization Batchをキューイングします...")
                        self._enqueue_edge_task("monetization_batch")
                except Exception as e:
                    logger.error(f"❌ MonetizationBatchキューイングエラー: {e}")
                time.sleep(201600)  # 約56時間（週3回）おきに実行

        # --- 定期タスク: note マガジン自動インポート ---
        def run_note_magazine_import_loop():
            # 起動直後の競合を避けるため、初回実行前に5分待機
            time.sleep(300)
            while True:
                try:
                    with self.task_lock:
                        logger.info("🔧 [SRE Daemon] 定期タスク: noteマガジン自動インポートをキューイングします...")
                        self._enqueue_edge_task("note_magazine_import")
                except Exception as e:
                    logger.error(f"❌ noteマガジンインポートキューイングエラー: {e}")
                time.sleep(43200)  # 12時間おきに実行
                
        # --- 定期タスク: LoLトレンド自動検知キューイング ---
        def run_lol_trend_collector_loop():
            # 起動直後の競合を避けるため、初回実行前に20分待機
            time.sleep(1200)
            while True:
                try:
                    with self.task_lock:
                        logger.info("🔧 [SRE Daemon] 定期タスク: LoLトレンド自動検知をキューイングします...")
                        self._enqueue_edge_task("lol_trend_collect")
                except Exception as e:
                    logger.error(f"❌ LoLトレンド検知キューイングエラー: {e}")
                time.sleep(86400)  # 1日（24時間）おきに実行

        # --- 定期タスク: noteアクセス・売上状況分析 ---
        def run_note_analytics_loop():
            # 起動直後の競合を避けるため、初回実行前に40分待機
            time.sleep(2400)
            while True:
                try:
                    with self.task_lock:
                        logger.info("🔧 [SRE Daemon] 定期タスク: note売上・アクセス分析をキューイングします...")
                        self._enqueue_edge_task("note_analytics")
                except Exception as e:
                    logger.error(f"❌ noteアクセス分析キューイングエラー: {e}")
                time.sleep(86400)  # 1日（24時間）おきに実行

        threading.Thread(target=run_synthesizer_loop, daemon=True).start()
        threading.Thread(target=run_youtube_absorber_loop, daemon=True).start()
        threading.Thread(target=run_reddit_scout_loop, daemon=True).start()
        threading.Thread(target=cleanup_deleted_files_loop, daemon=True).start()
        threading.Thread(target=publish_system_metrics_loop, daemon=True).start()
        threading.Thread(target=run_monetization_batch_loop, daemon=True).start()
        threading.Thread(target=run_note_magazine_import_loop, daemon=True).start()
        threading.Thread(target=run_lol_trend_collector_loop, daemon=True).start()
        threading.Thread(target=run_note_analytics_loop, daemon=True).start()

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
        elif any(k in error_text for k in ("getaddrinfo", "ConnectError", "ConnectTimeout", "Connection refused")):
            # ネットワーク接続エラーは、AI解析やDiscord通知をスキップしてローカル警告ログのみとする
            logger.warning("ℹ️ ネットワーク接続エラーをログ監視で検知しました。AI解析とDiscord通知をスキップします。")
            return
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
