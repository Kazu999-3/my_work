-- 承認待ちの動画記事を「再解析」できるようにする（2026-10-19、ユーザー要望）
--
-- 05 の承認画面（/admin/review）で、中身が薄い記事を理由・深掘りしたい観点を付けて作り直す。
-- 作り直しは scripts/reanalyze_article.py（edge_tasks の article_reanalyze）が行い、元の記事は残したまま
-- 新しい版を review_status='pending' で保存する。どちらを採用するかは承認画面で選ぶ。
--
--  - transcript   : 字幕の全文（[MM:SS] の時刻付き）。それまでは raw_content に先頭8,000字だけを入れており、
--                   2026-10-19 時点で動画記事の約3割（202件）が途中で切れていた。再解析で字幕を取り直さずに済むよう全文を残す。
--                   既存の記事には入れない（字幕の取り直しが必要なため）。新しく解析する記事から入る。
--  - reanalysis_of: 再解析で作った版の元記事の ID。採用されなかった方は行を消さず __DELETED__ / __SUPERSEDED__ タグで隠す
--  - analysis_meta: 解析の記録（プロンプトの版・モデル・抽出した事実の件数・分類ごとの件数・再解析の理由など）。
--                   承認画面の「薄い可能性」の判定にも使う

ALTER TABLE public.personal_knowledge ADD COLUMN IF NOT EXISTS transcript text;
ALTER TABLE public.personal_knowledge ADD COLUMN IF NOT EXISTS reanalysis_of bigint;
ALTER TABLE public.personal_knowledge ADD COLUMN IF NOT EXISTS analysis_meta jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personal_knowledge_reanalysis_of_fkey'
  ) THEN
    ALTER TABLE public.personal_knowledge
      ADD CONSTRAINT personal_knowledge_reanalysis_of_fkey
      FOREIGN KEY (reanalysis_of) REFERENCES public.personal_knowledge(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_personal_knowledge_reanalysis_of
  ON public.personal_knowledge (reanalysis_of)
  WHERE reanalysis_of IS NOT NULL;

-- 再解析のタスクが積まれたらクラウドワーカーを起こす（93 の関数に article_reanalyze を足す）。
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
                        'youtube_channel_monitor', 'reddit_scout', 'lol_trend_collect', 'dict_synthesizer',
                        'article_reanalyze')
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

REVOKE EXECUTE ON FUNCTION public.cron_dispatch_edge_worker() FROM PUBLIC, anon, authenticated;
