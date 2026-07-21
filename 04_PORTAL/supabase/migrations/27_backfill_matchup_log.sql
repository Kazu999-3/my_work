-- 既存の試合履歴から matchup_log を遡って生成する。
-- 同じ match_id・同じ role・違う team の相手を「対面」として結びつける。
-- created_at は試合日時を入れる（期間フィルタが過去データでも正しく効くように）。
-- NOT EXISTS で二重登録を防いでいるため、再実行しても安全。

-- 依存する列が無い環境でも失敗しないよう、念のため保証しておく
ALTER TABLE ktm_match_participants ADD COLUMN IF NOT EXISTS discord_id text;

-- 26 では match_id を bigint で作ったが、実運用の ktm_matches.id は uuid のため
-- 「operator does not exist: bigint = uuid」で失敗していた。
-- 実テーブルの型を正として matchup_log 側を合わせる（この時点では中身が空なので安全）。
DO $$
DECLARE
  target_type text;
  current_type text;
BEGIN
  SELECT data_type INTO target_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'ktm_match_participants'
     AND column_name = 'match_id';

  SELECT data_type INTO current_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'matchup_log'
     AND column_name = 'match_id';

  IF target_type IS NOT NULL AND current_type IS DISTINCT FROM target_type THEN
    EXECUTE format(
      'ALTER TABLE public.matchup_log ALTER COLUMN match_id TYPE %s USING match_id::text::%s',
      target_type, target_type
    );
  END IF;
END $$;

INSERT INTO matchup_log (
  match_id, discord_id, player_name, role,
  my_champion, enemy_champion, is_win,
  kills, deaths, assists, created_at
)
SELECT
  p.match_id,
  p.discord_id,
  p.player_name,
  p.role,
  p.champion_name,
  o.champion_name,
  (p.team = m.winning_team),
  COALESCE(p.kills, 0),
  COALESCE(p.deaths, 0),
  COALESCE(p.assists, 0),
  m.created_at
FROM ktm_match_participants p
JOIN ktm_matches m
  ON m.id = p.match_id
JOIN ktm_match_participants o
  ON o.match_id = p.match_id
 AND o.role = p.role
 AND o.team <> p.team
WHERE NOT EXISTS (
  SELECT 1 FROM matchup_log ml
  WHERE ml.match_id = p.match_id
    AND ml.player_name = p.player_name
    AND ml.role = p.role
);
