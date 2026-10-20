-- 古い記事の一括作り直し（migration 118）に、承認済みで本文が文の途中で終わっている記事を加える（2026-10-20、ユーザー判断）
--
-- 2026-10-20 まで、記事を作る処理（scripts/article_pipeline.py 等）が Gemini の返事の最初の part だけを読んでおり、
-- 本文が途中で切れたまま承認・統合された記事があった（10/20 時点で有効なものは3件）。これを列の先頭で作り直す。
-- 作り直した版は承認待ちで届き、承認すると元の記事は __SUPERSEDED__ で隠れる（行は消さない）。

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

  IF EXISTS (
    SELECT 1 FROM public.edge_tasks
     WHERE task_type = 'article_reanalyze' AND status IN ('pending', 'running')
       AND payload->>'source' = 'bulk_legacy'
  ) THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT k.id,
           (k.review_status = 'approved') AS is_truncated_approved
      FROM public.personal_knowledge k
     WHERE (
             -- 承認待ちの旧形式（新しい解析は analysis_meta を持つ）
             (k.review_status = 'pending' AND k.analysis_meta IS NULL)
             -- 承認済みで本文が文の途中で終わっている
          OR (k.review_status = 'approved' AND length(k.content) > 300 AND right(trim(k.content), 1) ~ '[ぁ-んァ-ヶ一-龠、]')
           )
       AND k.reanalysis_of IS NULL
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
     ORDER BY (k.review_status = 'approved') DESC, k.created_at
     LIMIT GREATEST(p_limit, 0)
  LOOP
    INSERT INTO public.edge_tasks (task_type, status, payload)
    VALUES ('article_reanalyze', 'pending', jsonb_build_object(
      'article_id', r.id, 'base_id', r.id,
      'reason', CASE WHEN r.is_truncated_approved THEN 'other' ELSE 'thin' END,
      'focus', '[]'::jsonb,
      'note', CASE WHEN r.is_truncated_approved
                   THEN '本文が途中で切れていたため、同じ動画から作り直す（生成の不具合の修正）'
                   ELSE '旧形式（7章固定）の記事を新しい解析で作り直す一括処理' END,
      'model', 'standard', 'source', 'bulk_legacy'
    ));
    queued := queued + 1;
  END LOOP;
  RETURN queued;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_legacy_reanalysis(integer) FROM PUBLIC, anon, authenticated;
