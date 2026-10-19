-- Vercel を呼ぶ pg_cron の定期実行を1時間おきにする（2026-10-19、ユーザー判断）
--
-- 10/18 に Vercel 無料枠（Hobby）の Fluid Active CPU（月4時間）を使い切ったと通知が来た。超えると
-- プロジェクトが自動で一時停止される。5分おき×2本・15分おき×1本で1日約670回 Vercel を起動していたため間引く。
--   個別案内の新着チェック（migration 100）: 5分 → 毎時05分（本人の発言の通知が最大1時間遅れる）
--   自己紹介の検知（migration 96）        : 5分 → 毎時15分（新しい人の登録が最大1時間遅れる）
--   ソロQコーチの確認（migration 93）     : 15分 → 毎時25分（GitHub Actions 側も毎時40分に変更）
-- dispatch-edge-cloud-worker は GitHub を呼ぶもので Vercel は使わないため、そのまま。

SELECT cron.unschedule('poll-onboarding-channels') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'poll-onboarding-channels');
SELECT cron.schedule('poll-onboarding-channels', '5 * * * *', $$SELECT public.cron_poll_onboarding_channels()$$);

SELECT cron.unschedule('poll-onboarding-intros') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'poll-onboarding-intros');
SELECT cron.schedule('poll-onboarding-intros', '15 * * * *', $$SELECT public.cron_poll_onboarding_intros()$$);

SELECT cron.unschedule('poll-soloq-coach') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'poll-soloq-coach');
SELECT cron.schedule('poll-soloq-coach', '25 * * * *', $$SELECT public.cron_poll_soloq_coach()$$);
