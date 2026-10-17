-- 個別案内チャンネルの「最後の発言」管理と、本人からの新着のプッシュ通知（2026-10-17）
--
-- Bot は Cloudflare Workers の応答専用でメッセージイベントを受け取れないため、
-- pg_cron から 5分おきに /api/onboarding/channels/poll を叩き、Discord のチャンネル一覧の
-- last_message_id の変化から新着を見つける。本人の発言なら管理者へプッシュ通知する。
--
-- 止める時: select cron.unschedule('poll-onboarding-channels');

CREATE TABLE IF NOT EXISTS public.onboarding_channel_state (
  channel_id          TEXT PRIMARY KEY,
  owner_user_id       TEXT NOT NULL,
  channel_name        TEXT,
  last_message_id     TEXT,
  last_message_at     TIMESTAMPTZ,
  last_author_id      TEXT,
  -- member = 持ち主本人 / admin = サーバー管理者 / bot = Bot / other = それ以外
  last_author_kind    TEXT CHECK (last_author_kind IN ('member', 'admin', 'bot', 'other')),
  -- 本人の発言で通知済みのメッセージID（同じ発言で二重に通知しない）
  notified_message_id TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_channel_state ENABLE ROW LEVEL SECURITY;
-- 読み書きはサーバー（サービスロール）のみ。公開ポリシーは作らない。

CREATE OR REPLACE FUNCTION public.cron_poll_onboarding_channels()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  secret TEXT;
BEGIN
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'vercel_cron_secret' LIMIT 1;
  IF secret IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://my-work-8jbd.vercel.app/api/onboarding/channels/poll',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cron_poll_onboarding_channels() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('poll-onboarding-channels', '*/5 * * * *', $$SELECT public.cron_poll_onboarding_channels()$$);
