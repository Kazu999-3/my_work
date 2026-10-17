-- 戦績履歴の編集でゴールドも直せるようにする（2026-10-18）
-- update_match_participants_batch（migration 49）にゴールドを追加。CREATE OR REPLACE は
-- 関数の設定を置き換えるため、migration 97 で固定した search_path もここで指定し直す。

CREATE OR REPLACE FUNCTION public.update_match_participants_batch(p_match_id uuid, p_participants jsonb)
RETURNS void
LANGUAGE sql
SET search_path = public, extensions
AS $$
  UPDATE ktm_match_participants AS t
  SET
    player_name = v.player_name,
    kills = v.kills,
    deaths = v.deaths,
    assists = v.assists,
    champion_name = v.champion_name,
    kda_score = v.kda_score,
    cs = v.cs,
    gold = v.gold,
    damage_dealt = v.damage_dealt,
    vision_score = v.vision_score,
    mmr_delta = v.mmr_delta
  FROM jsonb_to_recordset(p_participants) AS v(
    role varchar, team varchar, player_name varchar, kills int, deaths int, assists int,
    champion_name text, kda_score numeric, cs int, gold int, damage_dealt int, vision_score int, mmr_delta int
  )
  WHERE t.match_id = p_match_id AND t.role = v.role AND t.team = v.team;
$$;

REVOKE EXECUTE ON FUNCTION public.update_match_participants_batch(uuid, jsonb) FROM PUBLIC, anon, authenticated;
