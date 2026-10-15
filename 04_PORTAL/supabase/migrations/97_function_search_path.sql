-- 2026-10-15: Supabase Security Advisor の「Function Search Path Mutable」(WARN) 12件への対応。
-- search_path 未固定の関数は、呼び出し側のロール設定次第で別スキーマの同名オブジェクトを
-- 解決してしまう余地がある。これまでの既定（public → extensions）と同じ解決順で固定するだけなので、
-- 関数の動作は変わらない（vector / pg_net は public に入っている）。
ALTER FUNCTION public.champion_build_summary(integer, integer) SET search_path = public, extensions;
ALTER FUNCTION public.champion_duration_winrates(integer, integer) SET search_path = public, extensions;
ALTER FUNCTION public.increment_ktm_pity(text[], integer) SET search_path = public, extensions;
ALTER FUNCTION public.increment_ktm_spectator_pity(text[], integer) SET search_path = public, extensions;
ALTER FUNCTION public.match_insights(vector, double precision, integer) SET search_path = public, extensions;
ALTER FUNCTION public.purge_expired_gemini_cache() SET search_path = public, extensions;
ALTER FUNCTION public.rank_benchmark_averages(text, text, integer) SET search_path = public, extensions;
ALTER FUNCTION public.rebuild_champion_notes_batch(text[], jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.save_ktm_players_batch(jsonb, jsonb, bigint[]) SET search_path = public, extensions;
ALTER FUNCTION public.update_collab_tasks_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.update_match_participants_batch(uuid, jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.update_youtube_queue_updated_at() SET search_path = public, extensions;
