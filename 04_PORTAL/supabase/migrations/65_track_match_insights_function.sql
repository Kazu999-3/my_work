-- match_insights RPC関数(evolved_insightsの意味検索、ai_helper.pyのfetch_similar_insightsが
-- 呼ぶ)がどのmigrationファイルにも定義されておらず、Supabase Studio上で直接作成された
-- 未追跡インフラだった(2026-08-13、ナレッジ/ファクトチェック系監査#12で発覚)。
-- DBをmigrationから再構築・別プロジェクトへ移行した場合にこの関数だけ欠落し、
-- fetch_similar_insights側は例外を投げず警告ログのみで空配列を返すため、機能が
-- 実質死んでいても誰も気づけない設計になっていた。現在ライブDBに存在する定義を
-- そのままCREATE OR REPLACEでここに移し、以後はmigrationとして追跡する。
CREATE OR REPLACE FUNCTION public.match_insights(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(id uuid, insight_text text, similarity double precision)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    evolved_insights.id,
    evolved_insights.insight_text,
    1 - (evolved_insights.embedding <=> query_embedding) AS similarity
  FROM evolved_insights
  WHERE 1 - (evolved_insights.embedding <=> query_embedding) > match_threshold
  ORDER BY evolved_insights.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$
