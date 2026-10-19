-- コインの増減を DB 上の足し算にする（2026-10-19）
--
-- 以前は API が「読んだ残高 + 増減」を計算して上書きしていたため、同じ人の処理が同時に走ると
-- 後から書いた1回分だけが残り、先の結果が消えていた（lost update）。プリンコの連打で負けが消え、
-- 台帳と残高の食い違いが 476件・+24,842 コイン発生していた（10,666件中。409件は2秒以内の連続）。
--
-- この関数は行をロックして「今の残高 + 増減」を書くので、同時に何回呼ばれても全部の結果が反映される。
-- 残高の読み方は lib/playerCoins.ts の getPlayerCoins と同じ順番（coins 列が 1000 以外ならそれ →
-- role_preferences.coins → metadata.coins → coins 列 → 1000）。
-- 減らす時に残高がマイナスになるなら何も書かずに NULL を返す（残高不足の連打対策）。
-- p_inventory を渡した時だけ持ち物を書き換える（渡さない時は触らない。以前は古い控えで上書きしていた）。

CREATE OR REPLACE FUNCTION public.apply_player_coin_delta(
  p_name text,
  p_delta integer,
  p_inventory jsonb DEFAULT NULL,
  p_prefs_patch jsonb DEFAULT NULL
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
  v_base integer;
  v_new integer;
BEGIN
  SELECT p.id, p.coins,
         CASE WHEN jsonb_typeof(p.role_preferences->'coins') = 'number' THEN (p.role_preferences->>'coins')::numeric::integer END,
         CASE WHEN jsonb_typeof(p.metadata->'coins') = 'number' THEN (p.metadata->>'coins')::numeric::integer END
    INTO v_id, v_col, v_pref, v_meta
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

  UPDATE ktm_players
     SET coins = v_new,
         inventory = COALESCE(p_inventory, inventory),
         role_preferences = COALESCE(role_preferences, '{}'::jsonb)
           || COALESCE(p_prefs_patch, '{}'::jsonb)
           || jsonb_build_object('coins', v_new)
           || CASE WHEN p_inventory IS NOT NULL THEN jsonb_build_object('inventory', p_inventory) ELSE '{}'::jsonb END
   WHERE id = v_id;

  old_coins := v_base;
  new_coins := v_new;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_player_coin_delta(text, integer, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
