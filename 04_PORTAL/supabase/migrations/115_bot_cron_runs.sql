-- KTM Bot の定期実行の記録と、時間どおりに動く保険（2026-10-20、ユーザー判断）
--
-- Bot の定期実行（Cloudflare Workers の cron）は記録を残しておらず、空振りしても後から確かめられなかった
-- （TODO「Cloudflare本命cronが空振りした理由」2026-09-23〜未解決）。保険の GitHub Actions は開始が3〜4時間遅れ、
-- 21:00 を過ぎると処理を飛ばすため、取りこぼしを補えていなかった（10/17 は 17:13 予定が 21:08 開始）。
--
-- 1. bot_cron_runs: Bot が定期実行のたびに「いつ・何を・どこから」を書く（Bot の handlers/scheduled.js）
-- 2. cron_bot_backup(job, window): 予定時刻の数分後に pg_cron（時間どおりに動く）から呼び、
--    直近 window 分に本命の記録（running / success）が無い時だけ、ポータルの /api/cron/bot-backup を呼ぶ。
--    ポータルが Bot の手動実行（/trigger-scheduled、source=pg_cron）を呼ぶ。本命が動いていれば何もしないので、
--    Vercel はほとんど起動しない（Vercel 無料枠の CPU を使わない）。

CREATE TABLE IF NOT EXISTS public.bot_cron_runs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job         TEXT NOT NULL,                 -- weekly_recruit / event_notify / check_2000 / weekly_report など
  source      TEXT NOT NULL DEFAULT 'cloudflare', -- cloudflare / pg_cron / manual
  status      TEXT NOT NULL DEFAULT 'running',    -- running / success / error
  cron        TEXT,
  mode        TEXT,
  detail      JSONB,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bot_cron_runs_job_started ON public.bot_cron_runs (job, started_at DESC);

-- サーバー用のキーだけが読み書きする（RLS を有効にしてポリシーは作らない）
ALTER TABLE public.bot_cron_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_cron_runs FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.cron_bot_backup(p_job text, p_window_minutes integer DEFAULT 30)
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

  -- 本命が動いていれば何もしない（失敗した記録だけなら、やり直しのために呼ぶ）
  IF EXISTS (
    SELECT 1 FROM public.bot_cron_runs
     WHERE job = p_job
       AND status IN ('running', 'success')
       AND started_at > now() - make_interval(mins => GREATEST(p_window_minutes, 5))
  ) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'vercel_cron_secret' LIMIT 1;
  IF secret IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_get(
    url := 'https://my-work-8jbd.vercel.app/api/cron/bot-backup?job=' || p_job,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cron_bot_backup(text, integer) FROM PUBLIC, anon, authenticated;

-- pg_cron は UTC。曜日は 0=日 … 6=土。本命（Cloudflare）の予定時刻の数分後に確かめる。
--   水曜 12:00 JST 募集カード        → 水 03:15 UTC（窓 30 分）
--   金曜 19:00 JST 残り枠のお知らせ  → 金 10:15 UTC
--   土日 17:00 JST 残り枠のお知らせ  → 土日 08:15 UTC
--   土日 20:00 JST 開催判定          → 土日 11:07 UTC（21:00 開始に間に合うよう早めに）
SELECT cron.unschedule('bot-backup-weekly-recruit') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-backup-weekly-recruit');
SELECT cron.schedule('bot-backup-weekly-recruit', '15 3 * * 3', $$SELECT public.cron_bot_backup('weekly_recruit', 30)$$);

SELECT cron.unschedule('bot-backup-event-notify-fri') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-backup-event-notify-fri');
SELECT cron.schedule('bot-backup-event-notify-fri', '15 10 * * 5', $$SELECT public.cron_bot_backup('event_notify', 30)$$);

SELECT cron.unschedule('bot-backup-event-notify-weekend') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-backup-event-notify-weekend');
SELECT cron.schedule('bot-backup-event-notify-weekend', '15 8 * * 0,6', $$SELECT public.cron_bot_backup('event_notify', 30)$$);

SELECT cron.unschedule('bot-backup-check-2000') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-backup-check-2000');
SELECT cron.schedule('bot-backup-check-2000', '7 11 * * 0,6', $$SELECT public.cron_bot_backup('check_2000', 20)$$);
