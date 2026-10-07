"""edge_tasks のタスク種別ごとの実行（EdgeWorkerDaemon に合成するミックスイン）。
2026-10-07: edge_worker_daemon.py から分割。処理は分割前と同じ。
self.update_task_status / self._run_subprocess_task / self.is_task_conflicting 等は本体（EdgeWorkerDaemon）側にある。
"""
import os
import time
import logging
import httpx
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    from v2_CORE.settings import settings
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
    from v2_CORE.settings import settings

# edge_worker_daemon.py と同じロガー（ハンドラ設定は本体側）
logger = logging.getLogger("EdgeWorkerDaemon")


class TaskDispatchMixin:
    def execute_task(self, task: dict):
        """指示されたタスクの中身に応じた実行分岐"""
        task_id = task["id"]
        task_type = task["task_type"]
        payload = task.get("payload", {})
        
        logger.info(f"🏃 タスク処理を開始します: {task_type} (ID: {task_id})")
        self.current_status = f"running:{task_type}"
        self.current_task_id = task_id
        self.send_heartbeat()
        
        try:
            if task_type == "test_ping":
                logger.info(f"📶 [test_ping] メッセージ受信: '{payload.get('message')}'")
                result = {
                    "reply": "Pong! Active on Local Windows",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "received_message": payload.get("message")
                }
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "youtube_absorb":
                logger.info("🎥 [youtube_absorb] YouTube自動解析（Whisper GPU）を実行...")
                result = self._run_subprocess_task("03_SYSTEMS/v2_CORE/_LOL/youtube_absorber.py", timeout=3600)
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "reddit_scout":
                logger.info("🤖 [reddit_scout] Redditトレンド巡回・収集を実行...")
                result = self._run_subprocess_task("03_SYSTEMS/v2_CORE/_LOL/reddit_scout.py", timeout=600)
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "lol_trend_collect":
                logger.info("⚡ [lol_trend_collect] LoL最新トレンド情報の収集を実行...")
                result = self._run_subprocess_task("03_SYSTEMS/v2_CORE/_LOL/lol_trend_collector.py", timeout=600)
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "dict_synthesizer":
                logger.info("📚 [dict_synthesizer] 攻略辞典（DictSynthesizer）の統合・整理を実行...")
                result = self._run_subprocess_task("03_SYSTEMS/v2_CORE/_LOL/dict_synthesizer.py", timeout=600)
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "champion_trend":
                champion = payload.get("champion")
                # role 未指定なら worker 側で主なロールを自動判定する（以前は "Jungle" 固定。2026-10-07）
                role = payload.get("role") or ""
                logger.info(f"🏆 [champion_trend] チャンピオントレンド取得を実行 ({champion} / {role or '自動判定'})...")
                result = self._run_subprocess_task(
                    "03_SYSTEMS/v2_CORE/_LOL/champion_trend_worker.py",
                    args=[champion, role] if role else [champion],
                    timeout=600
                )
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "opgg_meta_sync":
                logger.info("📊 [opgg_meta_sync] OP.GG公式メタデータ（勝率・Tier）収集を実行...")
                result = self._run_subprocess_task(
                    "03_SYSTEMS/v2_CORE/_LOL/opgg_meta_collector.py",
                    timeout=180
                )
                self.update_task_status(task_id, "completed", result=result)

            elif task_type == "resolve_youtube_channel":
                channel_url = payload.get("url")
                logger.info(f"📺 [resolve_youtube_channel] チャンネルURLの解決を開始: {channel_url}")
                result = self._run_subprocess_task(
                    "03_SYSTEMS/v2_CORE/_LOL/youtube_monitor.py",
                    args=["--resolve", channel_url],
                    timeout=120
                )
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "resolve_youtube_playlist":
                playlist_url = payload.get("url")
                logger.info(f"📺 [resolve_youtube_playlist] プレイリストURLの解決を開始: {playlist_url}")
                result = self._run_subprocess_task(
                    "03_SYSTEMS/v2_CORE/_LOL/youtube_monitor.py",
                    args=["--resolve-playlist", playlist_url],
                    timeout=120
                )
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "youtube_channel_monitor":
                logger.info("📺 [youtube_channel_monitor] 監視チャンネルの新着動画チェックを実行...")
                result = self._run_subprocess_task(
                    "03_SYSTEMS/v2_CORE/_LOL/youtube_monitor.py",
                    args=["--monitor"],
                    timeout=300
                )
                self.update_task_status(task_id, "completed", result=result)

            elif task_type == "video_deep_dive":
                # ポータルUIからの単発リクエスト専用: 1本の動画を対面/マクロ/ビルドの
                # 3観点で多角的に解析する「動画深堀りモード」(2026-09-21新設)。
                video_url = payload.get("video_url")
                champion = payload.get("champion", "")
                logger.info(f"🔬 [video_deep_dive] 動画深堀り解析を実行: {video_url} ({champion or '自動判定'})")
                args = [video_url]
                if champion:
                    args.extend(["--champ", champion])
                args.append("--deep-dive")
                result = self._run_subprocess_task("scripts/extract_video_tactics.py", args=args, timeout=1200)
                self.update_task_status(task_id, "completed" if result.get("success") else "failed", result=result)

            elif task_type == "youtube_rotation":
                # 完了済み動画を少数ずつ再解析キューへ戻すローテーション(2026-09-21新設)。
                # 実処理は既存のyoutube_queue_process(youtube_worker.py)が拾うため、
                # ここではstatusをcompleted→pendingへ戻すだけに徹する。
                limit = int(payload.get("limit", 3))
                min_age_days = int(payload.get("min_age_days", 30))
                logger.info(f"♻️ [youtube_rotation] 完了済み動画の再解析ローテーションを実行 (最大{limit}件 / {min_age_days}日以上前に解析されたもの)")
                result = self.rotate_completed_videos(limit=limit, min_age_days=min_age_days)
                self.update_task_status(task_id, "completed", result=result)

            elif task_type == "youtube_queue_process":
                # youtube_queue(動画解析キュー)の処理本体。以前はktm-cloud-worker.ymlの
                # youtubeジョブ(GitHub Actions)経由のみだったが、共有IPがYouTube側から
                # bot判定され続けるため2026-07-31に定期cronが停止され、キューが滞留していた
                # (2026-08-10発覚、166件滞留)。ローカルPCのIPなら比較的安定するため、
                # このデーモン経由でも処理できるようにする。MAX_ITEMS未指定時は
                # scripts/youtube_worker.py側の既定値(3件/回)で少量ずつ処理し、
                # 連続リクエストによる429を避ける。
                logger.info("🎬 [youtube_queue_process] YouTube動画解析キューの処理を実行...")
                result = self._run_subprocess_task("scripts/youtube_worker.py", timeout=2400)
                self.update_task_status(task_id, "completed", result=result)
                
            elif task_type == "champion_db_bulk_update":
                logger.info("📚 [champion_db_bulk_update] チャンピオン辞典一括更新を実行...")
                try:
                    result = self._run_subprocess_task(
                        "03_SYSTEMS/v2_CORE/_LOL/champ_db_bulk_updater.py",
                        timeout=3600
                    )
                    self.update_task_status(task_id, "completed", result=result)
                except TimeoutError as te:
                    # 全チャンピオン(約170体)を1時間では処理しきれず、ここでよく打ち切られる。
                    # champ_db_bulk_updater.py はキューファイル(champion_update_queue.json)への
                    # 進捗保存で再開可能な設計になっているため、ユーザーがボタンを押し直さなくても
                    # 続きが自動で処理されるよう、同じタスクを即座に再キューする。
                    logger.warning(f"⏰ 一括更新が時間制限で中断されました。残りを自動的に再キューします: {te}")
                    try:
                        from v2_CORE.task_queue import SovereignQueue
                        SovereignQueue().enqueue("champion_db_bulk_update", {})
                        # 自動再キュー成功時は正常な分割継続のため completed 扱いとし、管理画面で要対応エラー扱いにならないようにする
                        self.update_task_status(task_id, "completed", result={
                            "success": True,
                            "message": "タスク実行時間制限（3600秒）に達したため、残りの処理を自動的に次タスクへ引き継ぎました。"
                        })
                    except Exception as re_err:
                        logger.error(f"❌ 再キューに失敗しました: {re_err}")
                        error_message = f"{te}（再キューにも失敗したため、手動で「一括更新を開始」を押し直してください）"
                        self.update_task_status(task_id, "failed", error_message=error_message)
                
            elif task_type in ("custom_bet", "balancer_pending", "matchup_simulation_5v5"):
                # 間借りタスクが万一ロックされてしまった場合は、データを壊さず pending に戻して解放する
                logger.warning(f"⚠️ 間借りタスク ({task_type}) を検知したため、データを保護して pending に復元・解放します: ID: {task_id}")
                self.update_task_status(task_id, "pending")
                return

            else:
                raise NotImplementedError(f"未サポートのタスクタイプです: {task_type}")
                
        except Exception as e:
            logger.error(f"❌ タスク実行エラー (ID: {task_id}): {e}")
            self.update_task_status(task_id, "failed", error_message=str(e))
        finally:
            self.current_status = "idle"
            self.current_task_id = None
            self.send_heartbeat()
