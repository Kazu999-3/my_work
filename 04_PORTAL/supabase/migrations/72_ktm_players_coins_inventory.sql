-- ============================================================
-- ktm_players に coins (コイン残高) および inventory (所持特権チケット) カラムを
-- 確実に定義し、デフォルト値とインデックスを付与する。
-- ============================================================

ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS coins int NOT NULL DEFAULT 1000;
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS inventory jsonb NOT NULL DEFAULT '[]'::jsonb;

-- コイン長者番付（ランキング）の高速化インデックス
CREATE INDEX IF NOT EXISTS idx_ktm_players_coins ON ktm_players (coins DESC);
CREATE INDEX IF NOT EXISTS idx_ktm_players_discord_id ON ktm_players (discord_id);
