-- 1日1回・月1回の報酬を「印を付けられた時だけ」渡すための関数（2026-10-19）
--
-- デイリーおみくじ・破産救済保険は「受取済みか読む → 報酬を書く」の2段階で、同時に2回送ると
-- 両方が「未受取」と判定して報酬が2回出ていた（台帳の食い違いに daily_omikuji が14件）。
-- コインを DB 上の足し算にした（migration 106）ことで2回分とも確実に加算されるようになったため、
-- 受取の印を1回の UPDATE で付け、付けられた1件だけに報酬を渡す。
--
-- role_preferences[p_key] が p_value でなければ p_value にして true を返す。既に p_value なら何もせず false。

CREATE OR REPLACE FUNCTION public.claim_player_once(p_name text, p_key text, p_value text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE ktm_players
     SET role_preferences = COALESCE(role_preferences, '{}'::jsonb) || jsonb_build_object(p_key, p_value)
   WHERE id = (SELECT id FROM ktm_players WHERE name = p_name ORDER BY id LIMIT 1)
     AND COALESCE(role_preferences->>p_key, '') <> p_value;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_player_once(text, text, text) FROM PUBLIC, anon, authenticated;
