-- 試合参加者を「名前」ではなく「discord_id」で紐付けられるようにする（改名で過去試合が
-- 切れる問題の根治）。まず列を追加し、既存行は現在の名前一致で discord_id を埋め戻す。
-- 以降のコードは discord_id 優先・名前フォールバックで参照する（後方互換）。
ALTER TABLE ktm_match_participants ADD COLUMN IF NOT EXISTS discord_id text;

-- 既存行のバックフィル（player_name が現在の ktm_players.name と一致するものだけ）
UPDATE ktm_match_participants mp
SET discord_id = p.discord_id
FROM ktm_players p
WHERE mp.discord_id IS NULL
  AND p.discord_id IS NOT NULL
  AND lower(p.name) = lower(mp.player_name);

CREATE INDEX IF NOT EXISTS idx_mmp_discord_id ON ktm_match_participants (discord_id);
