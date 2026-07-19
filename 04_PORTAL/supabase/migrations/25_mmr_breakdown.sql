-- M-03: MMR変動の内訳（勝敗ベース/Elo/KDA/係数など）を試合参加者行に保存。
-- プレイヤーページで「なぜ+18だったのか」を表示するために使う。
ALTER TABLE ktm_match_participants ADD COLUMN IF NOT EXISTS mmr_breakdown jsonb;
