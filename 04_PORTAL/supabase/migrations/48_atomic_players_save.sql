-- ============================================================
-- ktm_players の複数プレイヤー一括保存(update/insert/delete)を単一トランザクションに
-- まとめるRPC。以前はAPIルート側でPromise.allによる複数の独立UPDATEを並列実行しており、
-- 一部だけ失敗してもロールバックされず、どの行が失敗したかも分からなかった。
-- 1つの関数呼び出し内で例外が起きれば関数全体がロールバックされ、部分的な書き込みが
-- 残らないようにする。
-- ============================================================

CREATE OR REPLACE FUNCTION save_ktm_players_batch(
  p_updates jsonb DEFAULT '[]'::jsonb,
  p_inserts jsonb DEFAULT '[]'::jsonb,
  p_deletes bigint[] DEFAULT '{}'::bigint[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  rec jsonb;
BEGIN
  -- 更新: idで指定された行のみ、送られてきたキーだけを上書きする
  -- (jsonb_populate_recordは現在の行tを土台に、recに存在するキーだけ差し替える)
  FOR rec IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    IF rec ? 'id' THEN
      UPDATE ktm_players AS t
      SET (discord_id, name, ign, mmr, role_preferences, is_active,
           ng_lane_1, ng_lane_2, highest_rank,
           mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup,
           weight, allow_higher, pity, off_role_pity, metadata, initial_prefs)
        = (
          SELECT discord_id, name, ign, mmr, role_preferences, is_active,
                 ng_lane_1, ng_lane_2, highest_rank,
                 mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup,
                 weight, allow_higher, pity, off_role_pity, metadata, initial_prefs
          FROM jsonb_populate_record(t, rec)
        )
      WHERE t.id = (rec->>'id')::bigint;
    END IF;
  END LOOP;

  -- 新規追加（idはIDENTITY列のため指定しない）
  INSERT INTO ktm_players (
    discord_id, name, ign, mmr, role_preferences, is_active,
    ng_lane_1, ng_lane_2, highest_rank,
    mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup,
    weight, allow_higher, pity, off_role_pity, metadata, initial_prefs
  )
  SELECT
    discord_id, name, ign, mmr, role_preferences, is_active,
    ng_lane_1, ng_lane_2, highest_rank,
    mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup,
    weight, allow_higher, pity, off_role_pity, metadata, initial_prefs
  FROM jsonb_populate_recordset(null::ktm_players, p_inserts);

  -- 削除
  IF array_length(p_deletes, 1) > 0 THEN
    DELETE FROM ktm_players WHERE id = ANY(p_deletes);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION save_ktm_players_batch(jsonb, jsonb, bigint[]) FROM PUBLIC, anon, authenticated;
