-- 希望レーン等の設定を role_preferences に「送られたキーだけ」DB 上で重ねる関数（2026-10-19）
--
-- role_preferences には希望レーン（primary / secondary 等）と、コイン残高・持ち物の控え・おみくじ/破産救済の受取印・
-- 連勝数が同居している。希望レーンの保存（Bot の /update-lane・/update-puuid、マイページ、管理画面の名簿保存、自己紹介の取り込み）は
-- 「読んだ role_preferences に希望レーンを足した物」で丸ごと上書きしていたため、
--   - 読んでから書くまでの間にコインや受取印が変わると、古い値に戻る
--   - 管理画面の名簿保存は画面を開いた時点の値を送るので、その後に受け取ったおみくじの印（lastDailyClaim）が消え、同じ日にもう一度受け取れる
-- という状態だった。サーバーだけが書くキーはこの関数では変えない（送られても捨てる）。

CREATE OR REPLACE FUNCTION public.patch_player_prefs(p_id bigint, p_patch jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE ktm_players
     SET role_preferences = COALESCE(role_preferences, '{}'::jsonb)
       || (COALESCE(p_patch, '{}'::jsonb) - ARRAY['coins', 'inventory', 'lastDailyClaim', 'lastRescueMonth', 'betStreak', 'maxBetStreak'])
   WHERE id = p_id;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.patch_player_prefs(bigint, jsonb) FROM PUBLIC, anon, authenticated;
