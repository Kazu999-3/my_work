-- apply_player_coin_delta に「持ち物の末尾に追加」を足す（2026-10-19）
--
-- ショップの購入は「読んだ持ち物 + 買った物」で丸ごと上書きしていたため、同時に2回買うと両方が同じ持ち物を
-- 土台にして、コインは2回分引かれるのにチケットは1枚分しか残らなかった。追加は DB 上で行う。
-- 引数が変わるので一度削除して作り直す（同名の別引数版が残ると PostgREST の呼び出しが曖昧になるため）。
-- 削除〜作成の間に呼ばれた場合、アプリ側は「関数が無い」と判断して従来方式で続ける（lib/playerCoins.ts）。

DROP FUNCTION IF EXISTS public.apply_player_coin_delta(text, integer, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.apply_player_coin_delta(
  p_name text,
  p_delta integer,
  p_inventory jsonb DEFAULT NULL,
  p_prefs_patch jsonb DEFAULT NULL,
  p_inventory_append jsonb DEFAULT NULL
)
RETURNS TABLE(old_coins integer, new_coins integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id bigint;
  v_col integer;
  v_pref integer;
  v_meta integer;
  v_inv jsonb;
  v_base integer;
  v_new integer;
  v_new_inv jsonb;
BEGIN
  SELECT p.id, p.coins,
         CASE WHEN jsonb_typeof(p.role_preferences->'coins') = 'number' THEN (p.role_preferences->>'coins')::numeric::integer END,
         CASE WHEN jsonb_typeof(p.metadata->'coins') = 'number' THEN (p.metadata->>'coins')::numeric::integer END,
         CASE
           WHEN jsonb_typeof(p.inventory) = 'array' THEN p.inventory
           WHEN jsonb_typeof(p.role_preferences->'inventory') = 'array' THEN p.role_preferences->'inventory'
           WHEN jsonb_typeof(p.metadata->'inventory') = 'array' THEN p.metadata->'inventory'
           ELSE '[]'::jsonb
         END
    INTO v_id, v_col, v_pref, v_meta, v_inv
    FROM ktm_players p
   WHERE p.name = p_name
   ORDER BY p.id
   LIMIT 1
   FOR UPDATE;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  v_base := CASE
    WHEN v_col IS NOT NULL AND v_col <> 1000 THEN v_col
    WHEN v_pref IS NOT NULL THEN v_pref
    WHEN v_meta IS NOT NULL THEN v_meta
    WHEN v_col IS NOT NULL THEN v_col
    ELSE 1000
  END;
  v_new := v_base + COALESCE(p_delta, 0);

  IF COALESCE(p_delta, 0) < 0 AND v_new < 0 THEN
    RETURN;
  END IF;

  -- 持ち物: 丸ごと指定があればそれ、追加の指定があれば今の持ち物の末尾に足す、どちらも無ければ触らない
  v_new_inv := CASE
    WHEN p_inventory IS NOT NULL THEN p_inventory
    WHEN p_inventory_append IS NOT NULL THEN v_inv || p_inventory_append
    ELSE NULL
  END;

  UPDATE ktm_players
     SET coins = v_new,
         inventory = COALESCE(v_new_inv, inventory),
         role_preferences = COALESCE(role_preferences, '{}'::jsonb)
           || COALESCE(p_prefs_patch, '{}'::jsonb)
           || jsonb_build_object('coins', v_new)
           || CASE WHEN v_new_inv IS NOT NULL THEN jsonb_build_object('inventory', v_new_inv) ELSE '{}'::jsonb END
   WHERE id = v_id;

  old_coins := v_base;
  new_coins := v_new;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_player_coin_delta(text, integer, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
