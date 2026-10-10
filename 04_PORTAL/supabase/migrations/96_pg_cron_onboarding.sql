-- 新メンバー自己紹介の定期検知（オンボーディング）を pg_cron に登録（2026-10-11）
--
-- GitHub Actions の schedule は高頻度だと大きく間引かれるため、
-- DB ネイティブの pg_cron から 5分おきに直接 Vercel の /api/onboarding/process-intro を叩く。
-- 鍵は Vault の vercel_cron_secret（migration 93 で登録済み）を使用。
--
-- 止める時: select cron.unschedule('poll-onboarding-intros');

CREATE OR REPLACE FUNCTION public.cron_poll_onboarding_intros()
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
    url := 'https://my-work-8jbd.vercel.app/api/onboarding/process-intro',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cron_poll_onboarding_intros() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('poll-onboarding-intros', '*/5 * * * *', $$SELECT public.cron_poll_onboarding_intros()$$);
