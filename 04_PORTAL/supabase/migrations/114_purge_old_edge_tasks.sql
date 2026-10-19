-- edge_tasks の古い完了記録を定期的に消す（2026-10-19、ユーザー判断）
--
-- 自動処理（動画解析・辞典更新・チャンネル監視など）の完了記録が 2026-07 から消されずに溜まり続け、
-- 約12,000件・約21MB（大半が result の JSON）になっていた。毎週の DB バックアップ（pg_dump）は
-- Supabase 無料枠の転送量（月5GB）を使い、10/14 に上限を超えてサービスが止まっている。
--
-- 消すのは下の「自動処理の種類」の完了・失敗だけで、60日より古い物に限る。
-- カジノの賭け（custom_bet）・チーム分けの承認待ち（balancer_pending）・ハートビート等の状態を持つ行は対象外。
-- 画面（管理画面のパイプライン状況・タスク一覧）が読むのは直近の状態だけなので影響しない。

CREATE OR REPLACE FUNCTION public.purge_old_edge_tasks(p_days integer DEFAULT 60)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM edge_tasks
   WHERE task_type IN (
           'champion_db_bulk_update',
           'youtube_absorb',
           'youtube_queue_process',
           'youtube_channel_monitor',
           'champion_trend',
           'local_daemon_down_alert'
         )
     AND status IN ('completed', 'failed')
     AND created_at < now() - make_interval(days => GREATEST(p_days, 30))
     AND COALESCE(updated_at, created_at) < now() - make_interval(days => GREATEST(p_days, 30));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_old_edge_tasks(integer) FROM PUBLIC, anon, authenticated;

-- 毎週日曜 17:00 UTC（月曜 2:00 JST）。DB バックアップ（日曜 18:00 UTC）の前に消して、バックアップを小さくする
SELECT cron.unschedule('purge-old-edge-tasks') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-old-edge-tasks');
SELECT cron.schedule('purge-old-edge-tasks', '0 17 * * 0', $$SELECT public.purge_old_edge_tasks(60)$$);

-- 今ある分を1回消す
SELECT public.purge_old_edge_tasks(60);
