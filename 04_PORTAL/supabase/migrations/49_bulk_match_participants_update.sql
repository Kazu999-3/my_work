-- ============================================================
-- 試合結果編集時、参加者10人の更新がforループの逐次UPDATE(N+1)だったのを
-- jsonb配列を1回のUPDATE文で反映するRPCに置き換える。
-- kda_score等の値計算自体は引き続きAPIルート側(TypeScript)で行い、
-- ここでは計算済みの値をmatch_id×role×teamで突き合わせて書き込むだけ。
-- ============================================================

CREATE OR REPLACE FUNCTION update_match_participants_batch(p_match_id uuid, p_participants jsonb)
RETURNS void
LANGUAGE sql
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
    damage_dealt = v.damage_dealt,
    vision_score = v.vision_score,
    mmr_delta = v.mmr_delta
  FROM jsonb_to_recordset(p_participants) AS v(
    role varchar, team varchar, player_name varchar, kills int, deaths int, assists int,
    champion_name text, kda_score numeric, cs int, damage_dealt int, vision_score int, mmr_delta int
  )
  WHERE t.match_id = p_match_id AND t.role = v.role AND t.team = v.team;
$$;

REVOKE EXECUTE ON FUNCTION update_match_participants_batch(uuid, jsonb) FROM PUBLIC, anon, authenticated;
