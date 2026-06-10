-- マイページ機能強化（PUUIDとチャンピオン情報）のためのスキーマ更新

-- 1. ktm_players テーブルに puuid カラムを追加
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS puuid text;

-- 2. ktm_match_participants テーブルにチャンピオン情報のカラムを追加
ALTER TABLE ktm_match_participants ADD COLUMN IF NOT EXISTS champion_name text;

-- (オプショナル) ktm_matchesにRiotのマッチIDを保存するカラムがあるか確認
ALTER TABLE ktm_matches ADD COLUMN IF NOT EXISTS riot_match_id text;
