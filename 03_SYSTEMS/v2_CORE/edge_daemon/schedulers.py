"""定期起動のループ（YouTube 解析の起票・再解析ローテーション・一括更新の再開・Inbox仕分け・ナレッジ点検・OP.GG同期）。
EdgeWorkerDaemon に合成するミックスイン。各ループは run() から別スレッドで起動される。
2026-10-07: edge_worker_daemon.py から分割。処理は分割前と同じ。
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


class SchedulerLoopsMixin:
    def youtube_absorb_scheduler_loop(self):
        """
        字幕なし動画のローカルwhisper文字起こし(youtube_absorb)を15分おきに自動起票する。
        """
        time.sleep(10)  # 起動直後に速やかにタスク状態をチェックして起票開始
        while getattr(self, "_heartbeat_active", True):
            try:
                # 既に pending/running の youtube_absorb があれば重複起票しない。
                # ただし「running」のまま更新が止まったゴースト行（デーモンの異常終了等で
                # 誰も完了/失敗にマークしないまま残った行）は無視する。実測で1動画あたり
                # 数分〜十数分程度のため、2時間更新が無ければ死んでいるとみなして良い。
                # URLに直接埋め込むため、"+00:00"ではなく(エンコード不要な)"Z"サフィックスにする
                stale_cutoff = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat().replace("+00:00", "Z")
                check_url = (
                    f"{self.supabase_url}/rest/v1/edge_tasks?task_type=eq.youtube_absorb"
                    f"&status=in.(pending,running)&updated_at=gt.{stale_cutoff}&select=id&limit=1"
                )
                res = httpx.get(check_url, headers=self.headers, timeout=10)
                if res.status_code == 200 and res.json():
                    logger.info("🔧 [YoutubeAbsorbScheduler] 既に未処理のyoutube_absorbタスクがあるためスキップします。")
                else:
                    post_res = httpx.post(
                        f"{self.supabase_url}/rest/v1/edge_tasks",
                        headers=self.headers,
                        json={"task_type": "youtube_absorb", "payload": {}, "status": "pending"},
                        timeout=10
                    )
                    if post_res.status_code in (200, 201):
                        logger.info("🔧 [YoutubeAbsorbScheduler] youtube_absorbタスクをキューイングしました。")
                    else:
                        logger.error(f"❌ [YoutubeAbsorbScheduler] キューイング失敗: {post_res.status_code} {post_res.text}")
            except Exception as e:
                logger.error(f"❌ [YoutubeAbsorbScheduler] エラー: {e}")
            time.sleep(900)  # 15分おき

    def youtube_queue_scheduler_loop(self):
        """
        youtube_queue(動画解析キュー)の処理(youtube_queue_process)を10分おきに自動起票する。
        youtube_absorb_scheduler_loopと同じ「重複起票しない・ゴースト行は無視する」設計。
        1回あたりMAX_ITEMS件(既定3件)ずつ少量処理することで、YouTube側の429を避ける。
        """
        time.sleep(30)  # youtube_absorbの初回起票と時間をずらす
        while getattr(self, "_heartbeat_active", True):
            try:
                stale_cutoff = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat().replace("+00:00", "Z")
                check_url = (
                    f"{self.supabase_url}/rest/v1/edge_tasks?task_type=eq.youtube_queue_process"
                    f"&status=in.(pending,running)&updated_at=gt.{stale_cutoff}&select=id&limit=1"
                )
                res = httpx.get(check_url, headers=self.headers, timeout=10)
                if res.status_code == 200 and res.json():
                    logger.info("🔧 [YoutubeQueueScheduler] 既に未処理のyoutube_queue_processタスクがあるためスキップします。")
                else:
                    post_res = httpx.post(
                        f"{self.supabase_url}/rest/v1/edge_tasks",
                        headers=self.headers,
                        json={"task_type": "youtube_queue_process", "payload": {}, "status": "pending"},
                        timeout=10
                    )
                    if post_res.status_code in (200, 201):
                        logger.info("🔧 [YoutubeQueueScheduler] youtube_queue_processタスクをキューイングしました。")
                    else:
                        logger.error(f"❌ [YoutubeQueueScheduler] キューイング失敗: {post_res.status_code} {post_res.text}")
            except Exception as e:
                logger.error(f"❌ [YoutubeQueueScheduler] エラー: {e}")
            time.sleep(600)  # 10分おき

    # 再解析ローテーションの安全弁。未処理キューがこの件数以上溜まっているときは
    # 新たに完了済み動画を差し戻さない。これが無いと、処理が追いつかないまま
    # 古い動画を積み増し続けてGeminiクォータを浪費し、新着動画の解析が永久に
    # 後回しになる(このリポジトリで過去に何度も起きたキュー滞留パターン)。
    ROTATION_PENDING_CAP = 20

    def rotate_completed_videos(self, limit=3, min_age_days=30):
        """
        解析完了から min_age_days 以上経過した動画を、古い順に limit 件だけ
        pending へ戻す(=再解析キューへ差し戻す)。
        """
        try:
            # 1. 安全弁: 未処理キューが溜まっている間は差し戻さない
            pending_res = httpx.get(
                f"{self.supabase_url}/rest/v1/youtube_queue?status=eq.pending&select=id",
                headers={**self.headers, "Prefer": "count=exact", "Range": "0-0"},
                timeout=15
            )
            # 件数が取れない時は「0件」とみなさず見送る（2026-10-04: 以前は取得失敗を0件扱いにしており、
            # 待ちが溜まっていても安全弁が開いたまま完了済み動画を差し戻していた）
            content_range = pending_res.headers.get("content-range", "")
            try:
                pending_count = int(content_range.split("/")[-1]) if "/" in content_range else None
            except ValueError:
                pending_count = None
            if pending_res.status_code not in (200, 206) or pending_count is None:
                msg = f"未処理キュー件数を取得できないためローテーションを見送りました (HTTP {pending_res.status_code}, content-range={content_range!r})"
                logger.warning(f"♻️ [Rotation] {msg}")
                return {"success": False, "rotated": 0, "error": msg}
            if pending_count >= self.ROTATION_PENDING_CAP:
                msg = f"未処理キューが{pending_count}件あるためローテーションをスキップしました(上限{self.ROTATION_PENDING_CAP}件)"
                logger.info(f"♻️ [Rotation] {msg}")
                return {"success": True, "rotated": 0, "skipped_reason": msg, "pending_count": pending_count}

            # 2. 対象の抽出(解析が古い順)
            cutoff = (datetime.now(timezone.utc) - timedelta(days=min_age_days)).isoformat().replace("+00:00", "Z")
            target_res = httpx.get(
                f"{self.supabase_url}/rest/v1/youtube_queue"
                f"?status=eq.completed&updated_at=lt.{cutoff}&order=updated_at.asc&limit={limit}"
                f"&select=id,title,updated_at",
                headers=self.headers,
                timeout=15
            )
            if target_res.status_code != 200:
                return {"success": False, "error": f"対象取得に失敗: {target_res.status_code} {target_res.text}"}

            targets = target_res.json()
            if not targets:
                msg = f"{min_age_days}日以上前に解析された完了済み動画はありません"
                logger.info(f"♻️ [Rotation] {msg}")
                return {"success": True, "rotated": 0, "skipped_reason": msg}

            # 3. pendingへ差し戻し(1件ずつ。失敗した分は正直に失敗として数える)
            rotated, failed = [], []
            for row in targets:
                vid = row.get("id")
                patch_res = httpx.patch(
                    f"{self.supabase_url}/rest/v1/youtube_queue?id=eq.{vid}",
                    headers=self.headers,
                    json={"status": "pending", "retry_count": 0, "updated_at": datetime.now(timezone.utc).isoformat()},
                    timeout=15
                )
                if patch_res.status_code in (200, 204):
                    rotated.append({"id": vid, "title": (row.get("title") or "")[:60], "last_analyzed": row.get("updated_at")})
                else:
                    failed.append({"id": vid, "status_code": patch_res.status_code, "error": patch_res.text[:200]})

            logger.info(f"♻️ [Rotation] {len(rotated)}件を再解析キューへ差し戻しました(失敗{len(failed)}件)")
            return {"success": len(failed) == 0, "rotated": len(rotated), "failed": len(failed), "items": rotated, "errors": failed}
        except Exception as e:
            logger.error(f"❌ [Rotation] エラー: {e}")
            return {"success": False, "error": str(e)}

    def youtube_rotation_scheduler_loop(self):
        """
        完了済み動画の定期ローテーション再解析を自動起票する。

        ★ 既定は無効(オプトイン)。環境変数 ENABLE_YOUTUBE_ROTATION=1 を設定したときだけ動く。
        常時ONにすると、完了→差し戻し→再解析→完了…のループでGeminiクォータを
        継続的に消費し続けることになるため、意図して有効化したときのみ回す設計にした。
        無効時もその旨をログに明示し、「実装したのに誰も気づかず動いていない/
        動きっぱなし」のどちらにもならないようにする。
        """
        if os.environ.get("ENABLE_YOUTUBE_ROTATION") != "1":
            logger.info("♻️ [RotationScheduler] 無効(既定)。有効化するには環境変数 ENABLE_YOUTUBE_ROTATION=1 を設定してください。")
            return

        interval_hours = int(os.environ.get("YOUTUBE_ROTATION_INTERVAL_HOURS", "24"))
        batch = int(os.environ.get("YOUTUBE_ROTATION_BATCH", "3"))
        min_age_days = int(os.environ.get("YOUTUBE_ROTATION_MIN_AGE_DAYS", "30"))
        logger.info(f"♻️ [RotationScheduler] 有効。{interval_hours}時間おきに最大{batch}件ずつ再解析へ差し戻します。")

        time.sleep(120)  # 起動直後の他スケジューラと時間をずらす
        while getattr(self, "_heartbeat_active", True):
            try:
                httpx.post(
                    f"{self.supabase_url}/rest/v1/edge_tasks",
                    headers=self.headers,
                    json={
                        "task_type": "youtube_rotation",
                        "payload": {"limit": batch, "min_age_days": min_age_days},
                        "status": "pending"
                    },
                    timeout=10
                )
                logger.info("♻️ [RotationScheduler] youtube_rotationタスクをキューイングしました。")
            except Exception as e:
                logger.error(f"❌ [RotationScheduler] エラー: {e}")
            time.sleep(interval_hours * 3600)

    def bulk_update_resume_scheduler_loop(self):
        """
        チャンピオン辞典一括更新がAPI制限等でsuspended状態のまま放置されると、ユーザーが
        手動でポータルの「更新を再開」を押さない限り進まなかった(2026-08-12発覚)。
        30分おきに進捗ハートビート(champdb_bulk_progress)を確認し、suspendedかつ
        直近1時間以内に再起票していなければ自動でchampion_db_bulk_updateを再起票する。
        サーキットブレーカーでまだ止まっていれば数十秒で再度suspendするだけで実害は無く、
        枠が空き次第(APIクォータの日次リセット等)自動的に続きが進むようになる。

        あわせて、「意図的な一時停止(自動再開待ち・そのうち勝手に直る)」と「静かに詰まって
        いる(自動再開を試みても進捗が動かない・要確認)」を区別できるようにする(2026-08-12)。
        completed数を毎回記録し、再開を試みても一定回数(既定3回=約1.5時間)変化しなければ、
        単なるクォータ待ちではなく別の問題(コード側の不具合等)の可能性が高いとみなし、
        通常のsuspended通知(discord=False)とは別に一度だけ強めのアラートを出す。
        """
        time.sleep(60)  # 他のスケジューラの初回起票と時間をずらす
        STAGNANT_THRESHOLD = 3
        last_seen_completed = None
        stagnant_ticks = 0
        alerted = False
        while getattr(self, "_heartbeat_active", True):
            try:
                status_url = (
                    f"{self.supabase_url}/rest/v1/edge_tasks"
                    f"?id=eq.00000000-0000-0000-0000-000000000002&select=status,payload"
                )
                res = httpx.get(status_url, headers=self.headers, timeout=10)
                rows = res.json() if res.status_code == 200 else []
                row = rows[0] if rows else None

                if not row or row.get("status") != "suspended":
                    # 稼働中/未初期化ならリセットして「詰まり」判定を仕切り直す
                    last_seen_completed = None
                    stagnant_ticks = 0
                    alerted = False
                    time.sleep(1800)
                    continue

                completed = (row.get("payload") or {}).get("completed")
                if last_seen_completed is not None and completed == last_seen_completed:
                    stagnant_ticks += 1
                else:
                    stagnant_ticks = 0
                    alerted = False
                last_seen_completed = completed

                if stagnant_ticks >= STAGNANT_THRESHOLD and not alerted:
                    logger.warning(
                        f"⚠️ [BulkUpdateResumeScheduler] 完了数(completed={completed})がAPIクォータ回復待ちのため保留中です。"
                    )
                    alerted = True

                cutoff = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat().replace("+00:00", "Z")
                check_url = (
                    f"{self.supabase_url}/rest/v1/edge_tasks?task_type=eq.champion_db_bulk_update"
                    f"&created_at=gt.{cutoff}&select=id&limit=1"
                )
                check_res = httpx.get(check_url, headers=self.headers, timeout=10)
                if check_res.status_code == 200 and check_res.json():
                    logger.info("🔧 [BulkUpdateResumeScheduler] 直近1時間以内に再起票済みのためスキップします。")
                else:
                    post_res = httpx.post(
                        f"{self.supabase_url}/rest/v1/edge_tasks",
                        headers=self.headers,
                        json={"task_type": "champion_db_bulk_update", "payload": {"source": "auto_resume"}, "status": "pending"},
                        timeout=10
                    )
                    if post_res.status_code in (200, 201):
                        logger.info("🔧 [BulkUpdateResumeScheduler] 辞典一括更新(suspended)を自動的に再起票しました。")
                    else:
                        logger.error(f"❌ [BulkUpdateResumeScheduler] キューイング失敗: {post_res.status_code} {post_res.text}")
            except Exception as e:
                logger.error(f"❌ [BulkUpdateResumeScheduler] エラー: {e}")
            time.sleep(1800)  # 30分おき

    def inbox_scheduler_loop(self):
        """
        01_INTEL/00_INBOX/ の未処理メモ・Webクリップを5分おきに自動検知し、
        TOMO式3層（Core Concept / Structured Points / Actionable Steps）で構造化・原本退避する。
        """
        import sys
        scripts_dir = str(Path("d:/my_work/scripts").resolve())
        if scripts_dir not in sys.path:
            sys.path.append(scripts_dir)
        try:
            from inbox_worker import process_inbox
        except ImportError as e:
            # 以前は黙って None にしており、スレッドは「開始しました」と出したまま何もしなかった
            logger.error(f"❌ [InboxScheduler] inbox_worker を読み込めないため受信箱の自動仕分けは動きません: {e}")
            process_inbox = None

        logger.info("📥 [InboxScheduler] 帝国インボックス自動仕分けスレッドを開始しました (5分間隔)。")
        while getattr(self, "_heartbeat_active", True):
            try:
                time.sleep(300)  # 5分おき
                if process_inbox:
                    process_inbox()
            except Exception as e:
                logger.error(f"❌ [InboxScheduler] エラー: {e}")

    def knowledge_lint_scheduler_loop(self):
        """
        毎日1回、Markdown知識ベース全体のリンク切れ・孤立ノート・知識ギャップを自律点検する。
        """
        import sys
        scripts_dir = str(Path("d:/my_work/scripts").resolve())
        if scripts_dir not in sys.path:
            sys.path.append(scripts_dir)
        try:
            from knowledge_linter import run_linter
        except ImportError as e:
            logger.error(f"❌ [KnowledgeLintScheduler] knowledge_linter を読み込めないため自律点検は動きません: {e}")
            run_linter = None

        logger.info("🧠 [KnowledgeLintScheduler] ナレッジLinter自律点検スレッドを開始しました (24時間周期)。")
        # 起動直後は少し待機（10分後から初回点検）
        time.sleep(600)
        while getattr(self, "_heartbeat_active", True):
            try:
                if run_linter:
                    run_linter(fix=False, report=True)
                time.sleep(86400)  # 24時間おき
            except Exception as e:
                logger.error(f"❌ [KnowledgeLintScheduler] エラー: {e}")
                time.sleep(3600)

    def opgg_meta_sync_scheduler_loop(self):
        """
        OP.GG公式MCPから勝率・Tier・BAN率メタデータを日次（24時間おき）で自動取得・同期する。
        """
        logger.info("📊 [OPGGMetaSyncScheduler] 日次メタデータ同期スケジューラを開始しました。")
        time.sleep(60)  # 起動直後の他スケジューラと時間をずらす
        while getattr(self, "_heartbeat_active", True):
            try:
                logger.info("📊 [OPGGMetaSyncScheduler] OP.GGメタデータ日次収集を起票します...")
                httpx.post(
                    f"{self.supabase_url}/rest/v1/edge_tasks",
                    headers=self.headers,
                    json={
                        "task_type": "opgg_meta_sync",
                        "payload": {},
                        "status": "pending"
                    },
                    timeout=10
                )
            except Exception as e:
                logger.error(f"❌ [OPGGMetaSyncScheduler] エラー: {e}")
            time.sleep(86400)  # 24時間
