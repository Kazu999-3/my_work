-- Vercel無料枠（Fluid Active CPU: 4時間/月）枯渇防止のため、
-- 毎時25分に自動実行されていたソロQコーチのポーリングジョブを停止する（2026-11-02 ユーザー判断）
--
-- 背景:
--   Supabaseのpg_cronで毎時25分に実行され、1日24回×30日=月720回Vercelの /api/cron/soloq-coach を呼び出していた。
--   これにより毎月CPU時間を大量消費し、100%枯渇警告の原因となっていた。
--   今後は試合後の手動分析ボタン（「🔍 試合後」）または必要に応じた手動/日次トリガーで運用する。

SELECT cron.unschedule('poll-soloq-coach')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'poll-soloq-coach'
);
