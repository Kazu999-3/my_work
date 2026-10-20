-- 旧形式（7章固定・2026-10-19 より前）の承認待ち記事を、新しい2段階の解析で少しずつ作り直す（2026-10-20、ユーザー判断 B-1）
--
-- 承認待ち354件のうち338件が旧形式で、動画に無い章を一般論や記憶で埋めていることが多く、承認の判断に時間がかかっていた。
-- 05 の承認画面の「🔁 再解析」と同じ依頼（edge_tasks の article_reanalyze）を、1日に p_limit 件だけ積む。
-- 処理はクラウドワーカー（scripts/reanalyze_article.py）。作り直した版は reanalysis_of 付きの承認待ちで届き、
-- 元の記事は承認画面の一覧から外れる（比べて承認できる）。
--
-- ⚠️ スイッチ（ktm_settings.legacy_reanalysis_enabled）が true になるまで何もしない。
--    10/18 から動いている PC の常駐デーモンは article_reanalyze を知らず、横取りして失敗にするため。
--    デーモンを再起動してからスイッチを入れる:
--      UPDATE ktm_settings SET value = 'true'::jsonb, updated_at = now() WHERE key = 'legacy_reanalysis_enabled';
-- Gemini の利用枠を考えて 1日20件（338件で約17日）。

INSERT INTO public.ktm_settings (key, value, updated_at)
VALUES ('legacy_reanalysis_enabled', 'false'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enqueue_legacy_reanalysis(p_limit integer DEFAULT 20)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enabled boolean;
  queued integer := 0;
  r record;
BEGIN
  SELECT (value = 'true'::jsonb) INTO enabled FROM public.ktm_settings WHERE key = 'legacy_reanalysis_enabled';
  IF enabled IS NOT TRUE THEN
    RETURN 0;
  END IF;

  -- 前の日の分がまだ終わっていなければ積み増さない（失敗が続く時に溜め込まないため）
  IF EXISTS (
    SELECT 1 FROM public.edge_tasks
     WHERE task_type = 'article_reanalyze' AND status IN ('pending', 'running')
       AND payload->>'source' = 'bulk_legacy'
  ) THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT k.id
      FROM public.personal_knowledge k
     WHERE k.review_status = 'pending'
       AND k.analysis_meta IS NULL                  -- 旧形式（新しい解析は analysis_meta を持つ）
       AND k.reanalysis_of IS NULL                  -- 再解析版そのものではない
       AND COALESCE(k.is_atomic, false) = false
       AND k.source_url ~ 'youtu'
       AND NOT (COALESCE(k.tags, '{}') && ARRAY['__DELETED__', '__SUPERSEDED__'])
       AND NOT EXISTS (SELECT 1 FROM public.personal_knowledge d WHERE d.reanalysis_of = k.id)
       AND NOT EXISTS (
         SELECT 1 FROM public.edge_tasks t
          WHERE t.task_type = 'article_reanalyze'
            AND (t.payload->>'article_id')::bigint = k.id
            AND (t.status IN ('pending', 'running') OR t.created_at > now() - interval '3 days')
       )
     ORDER BY k.created_at
     LIMIT GREATEST(p_limit, 0)
  LOOP
    INSERT INTO public.edge_tasks (task_type, status, payload)
    VALUES ('article_reanalyze', 'pending', jsonb_build_object(
      'article_id', r.id, 'base_id', r.id, 'reason', 'thin', 'focus', '[]'::jsonb,
      'note', '旧形式（7章固定）の記事を新しい解析で作り直す一括処理', 'model', 'standard', 'source', 'bulk_legacy'
    ));
    queued := queued + 1;
  END LOOP;
  RETURN queued;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_legacy_reanalysis(integer) FROM PUBLIC, anon, authenticated;

-- 毎日 4:10 JST（19:10 UTC）。動画の取り込みや他の定期実行と重なりにくい時間
SELECT cron.unschedule('legacy-article-reanalysis') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'legacy-article-reanalysis');
SELECT cron.schedule('legacy-article-reanalysis', '10 19 * * *', $$SELECT public.enqueue_legacy_reanalysis(20)$$);
