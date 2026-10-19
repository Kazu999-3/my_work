-- 持ち物を「指定の id を最大 n 枚」DB 上で減らす関数（2026-10-19）
--
-- 特権の発動・全損保険・勝利ボーナス激闘チケット・宝くじの抽選は「読んだ持ち物から1枚抜いた配列」で丸ごと上書きしていたため、
--   - 同時にショップで買った物が消える（コインは引かれたまま）
--   - 特権の発動を2回連続で押すと、両方が同じ1枚を見て発動し、通知が2回出るのに消費は1枚だけ
-- となっていた。行をロックして今の持ち物から減らし、実際に減らせた枚数を返す。呼び出し側は 0 なら「持っていない」として扱う。
-- 持ち物の読み先は apply_player_coin_delta（migration 109）と同じ（列 → role_preferences → metadata）。

CREATE OR REPLACE FUNCTION public.consume_player_items(p_name text, p_item_id text, p_count integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id bigint;
  v_inv jsonb;
  v_new jsonb := '[]'::jsonb;
  v_item jsonb;
  v_removed integer := 0;
BEGIN
  IF COALESCE(p_count, 0) <= 0 THEN
    RETURN 0;
  END IF;

  SELECT p.id,
         CASE
           WHEN jsonb_typeof(p.inventory) = 'array' THEN p.inventory
           WHEN jsonb_typeof(p.role_preferences->'inventory') = 'array' THEN p.role_preferences->'inventory'
           WHEN jsonb_typeof(p.metadata->'inventory') = 'array' THEN p.metadata->'inventory'
           ELSE '[]'::jsonb
         END
    INTO v_id, v_inv
    FROM ktm_players p
   WHERE p.name = p_name
   ORDER BY p.id
   LIMIT 1
   FOR UPDATE;

  IF v_id IS NULL THEN
    RETURN 0;
  END IF;

  -- 先頭から順に、指定 id の物を p_count 枚まで抜く（古く買った物から使う）
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_inv) WITH ORDINALITY ORDER BY ordinality LOOP
    IF v_removed < p_count AND v_item->>'id' = p_item_id THEN
      v_removed := v_removed + 1;
    ELSE
      v_new := v_new || jsonb_build_array(v_item);
    END IF;
  END LOOP;

  IF v_removed > 0 THEN
    UPDATE ktm_players
       SET inventory = v_new,
           role_preferences = COALESCE(role_preferences, '{}'::jsonb) || jsonb_build_object('inventory', v_new)
     WHERE id = v_id;
  END IF;

  RETURN v_removed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_player_items(text, text, integer) FROM PUBLIC, anon, authenticated;
