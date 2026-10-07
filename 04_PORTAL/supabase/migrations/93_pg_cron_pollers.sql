-- 高頻度のポーリングを GitHub Actions の schedule から pg_cron に移す（2026-10-07、ユーザー承認済み）
--
-- GitHub Actions の schedule は高頻度だと大きく間引かれ、soloq-coach-poll（15分おき指定）・
-- edge-cloud-worker（5分おき指定）とも実際は1日4〜5回しか動いていなかった。
--   - ソロQの振り返り検知（/api/cron/soloq-coach）が最大5〜6時間遅れる
--   - PCデーモン停止時、ポータルのボタン（チャンピオントレンド取得・チャンネル登録など）の処理が同じだけ遅れる
--
-- pg_cron は指定どおりに動く。
--   ① 15分おきに Vercel の /api/cron/soloq-coach を呼ぶ
--   ② 5分おきに、クラウドワーカーが処理する種類の pending タスクがある時だけ、
--      edge-cloud-worker ワークフローを workflow_dispatch で起動する（無い時は何もしない）
--
-- 鍵は Vault に置く（このファイルには書かない）。未登録の間は何もしない:
--   select vault.create_secret('<Vercel の CRON_SECRET>', 'vercel_cron_secret');
--   select vault.create_secret('<GitHub の fine-grained token（このリポジトリの Actions: Read and write）>', 'github_dispatch_token');
-- GitHub Actions 側の schedule は予備として残す（ワーカーの定期処理: チャンネル監視の起票・デーモン停止検知など）。
-- 止める時: select cron.unschedule('poll-soloq-coach'); select cron.unschedule('dispatch-edge-cloud-worker');

CREATE OR REPLACE FUNCTION public.cron_poll_soloq_coach()
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
  PERFORM net.http_get(
    url := 'https://my-work-8jbd.vercel.app/api/cron/soloq-coach',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 60000
  );
END;
$$;

-- edge_cloud_worker.py の TASK_MAP と同じ種類（増減したら揃えること）
CREATE OR REPLACE FUNCTION public.cron_dispatch_edge_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.edge_tasks
    WHERE status = 'pending'
      AND task_type IN ('champion_trend', 'resolve_youtube_channel', 'resolve_youtube_playlist',
                        'youtube_channel_monitor', 'reddit_scout', 'lol_trend_collect', 'dict_synthesizer')
  ) THEN
    RETURN;
  END IF;
  SELECT decrypted_secret INTO token FROM vault.decrypted_secrets WHERE name = 'github_dispatch_token' LIMIT 1;
  IF token IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://api.github.com/repos/Kazu999-3/my_work/actions/workflows/edge-cloud-worker.yml/dispatches',
    body := '{"ref":"master"}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || token,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'supabase-pg-cron'
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cron_poll_soloq_coach() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cron_dispatch_edge_worker() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('poll-soloq-coach', '*/15 * * * *', $$SELECT public.cron_poll_soloq_coach()$$);
SELECT cron.schedule('dispatch-edge-cloud-worker', '*/5 * * * *', $$SELECT public.cron_dispatch_edge_worker()$$);
