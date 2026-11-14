-- Vercel無料枠（Fluid Active CPU: 4時間/月）枯渇防止（2026-11-15 ユーザー承認）
-- 毎時5分および毎時15分に自動実行されていたオンボーディング関連の常時ポーリングジョブを停止する。
--
-- 背景:
--   Supabaseのpg_cronで毎時5分に /api/onboarding/channels/poll、毎時15分に /api/onboarding/process-intro を呼び出していた。
--   1日48回、月間約1,440回ものVercel Serverless Function空振り起動が発生し、
--   月次リセット日直前で Fluid Active CPU が 90% に達する主因となっていた。
--   オンボーディング処理は必要に応じて管理画面からの手動実行、またはDiscordイベント駆動で対応可能なため、
--   月次リセットおよび恒久的な0円運用の安定化のため定期ポーリングを安全に停止する。

SELECT cron.unschedule('poll-onboarding-channels')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'poll-onboarding-channels'
);

SELECT cron.unschedule('poll-onboarding-intros')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'poll-onboarding-intros'
);
