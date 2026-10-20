-- Bot の定期実行の見張り（2026-10-20、ユーザー判断。migration 115 の続き）
--
-- 115 の保険（pg_cron → ポータル → Bot）は、途中で失敗しても DB の奥（net._http_response）に残るだけで、
-- 誰にも知らせなかった。本命と保険が両方こけると、以前と同じく「投稿されていないのに誰も知らない」になる。
-- 保険の確認からさらに25分後にもう一度記録を見て、成功の記録が無ければポータル経由で管理者に知らせる
-- （管理者通知 ＋ Discord の #エラーログ）。問題が無い時は Vercel を起動しない。
--
-- 「成功」でも、募集カードが見つからない・チャンネルが解決できないで何もしなかった回は知らせる対象にする
-- （Bot が bot_cron_runs.detail に { action, reason } を残す）。

CREATE OR REPLACE FUNCTION public.cron_bot_watch(p_job text, p_window_minutes integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  secret TEXT;
BEGIN
  IF p_job NOT IN ('weekly_recruit', 'event_notify', 'check_2000') THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bot_cron_runs
     WHERE job = p_job
       AND status = 'success'
       AND started_at > now() - make_interval(mins => GREATEST(p_window_minutes, 5))
       AND COALESCE(detail->>'reason', '') !~ '(見つからない|解決できない)'
  ) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'vercel_cron_secret' LIMIT 1;
  IF secret IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_get(
    url := 'https://my-work-8jbd.vercel.app/api/cron/bot-backup?alert=1&job=' || p_job,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 30000
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cron_bot_watch(text, integer) FROM PUBLIC, anon, authenticated;

-- 予定時刻（JST）の約40分後。窓は予定時刻から今までをおおむね覆う長さ。
--   水曜 12:00 募集カード        → 水 03:40 UTC（窓 45 分）
--   金曜 19:00 残り枠のお知らせ  → 金 10:40 UTC
--   土日 17:00 残り枠のお知らせ  → 土日 08:40 UTC
--   土日 20:00 開催判定          → 土日 11:35 UTC（窓 40 分）
SELECT cron.unschedule('bot-watch-weekly-recruit') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-watch-weekly-recruit');
SELECT cron.schedule('bot-watch-weekly-recruit', '40 3 * * 3', $$SELECT public.cron_bot_watch('weekly_recruit', 45)$$);

SELECT cron.unschedule('bot-watch-event-notify-fri') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-watch-event-notify-fri');
SELECT cron.schedule('bot-watch-event-notify-fri', '40 10 * * 5', $$SELECT public.cron_bot_watch('event_notify', 45)$$);

SELECT cron.unschedule('bot-watch-event-notify-weekend') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-watch-event-notify-weekend');
SELECT cron.schedule('bot-watch-event-notify-weekend', '40 8 * * 0,6', $$SELECT public.cron_bot_watch('event_notify', 45)$$);

SELECT cron.unschedule('bot-watch-check-2000') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-watch-check-2000');
SELECT cron.schedule('bot-watch-check-2000', '35 11 * * 0,6', $$SELECT public.cron_bot_watch('check_2000', 40)$$);
