-- ============================================================
-- pity/spectator_pity の加算を、SELECT→計算→UPDATEの非アトミック処理から
-- 単一UPDATE文（DB側で加算）に置き換えるためのRPC関数。
-- 同時リクエスト・二重クリックが発生した場合、SELECT時点の古い値を元に
-- 計算した結果でUPDATEしてしまい、加算が失われる競合状態があった
-- (api/balancer/pending, api/discord)。
-- ============================================================

CREATE OR REPLACE FUNCTION increment_ktm_pity(p_names text[], p_amount int)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE ktm_players SET pity = COALESCE(pity, 0) + p_amount WHERE name = ANY(p_names);
$$;

CREATE OR REPLACE FUNCTION increment_ktm_spectator_pity(p_names text[], p_amount int)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE ktm_players SET spectator_pity = COALESCE(spectator_pity, 0) + p_amount WHERE name = ANY(p_names);
$$;

-- 呼び出しはservice role経由のAPIルート(supabaseAdmin)のみを想定。
-- anon/authenticatedからの直接RPC呼び出しは許可しない。
REVOKE EXECUTE ON FUNCTION increment_ktm_pity(text[], int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_ktm_spectator_pity(text[], int) FROM PUBLIC, anon, authenticated;
