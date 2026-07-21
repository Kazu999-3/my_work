-- F: 対面カルテ。試合記録時に「誰が・どのレーンで・誰と対面したか」を自動で残し、
-- 試合後の振り返り（メモ作成）へワンタップで飛べるようにする。
-- バトルサーチの「苦手対面ランキング(D)」や「対面クイックビュー(A)」の集計元にもなる。
CREATE TABLE IF NOT EXISTS matchup_log (
  id bigserial PRIMARY KEY,
  -- 型は 27 で ktm_match_participants.match_id に合わせて矯正される（環境により uuid / bigint）
  match_id bigint,
  discord_id text,
  player_name text,
  role text,
  my_champion text,
  enemy_champion text,
  is_win boolean,
  kills int DEFAULT 0,
  deaths int DEFAULT 0,
  assists int DEFAULT 0,
  patch text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matchup_log_player ON matchup_log (discord_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matchup_log_pair ON matchup_log (my_champion, enemy_champion);
CREATE INDEX IF NOT EXISTS idx_matchup_log_match ON matchup_log (match_id);

-- 画面(anon)から読めるようにする。書き込みはサーバー(service_role)のみ。
ALTER TABLE matchup_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "matchup_log select" ON matchup_log;
CREATE POLICY "matchup_log select" ON matchup_log FOR SELECT USING (true);
