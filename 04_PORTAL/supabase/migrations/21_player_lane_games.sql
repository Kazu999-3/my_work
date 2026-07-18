-- レーン別の試合数(N1)。代表MMR(mmr列)を「実際にプレイしたレーンの試合数」で
-- 重み付け平均するために、ライブ更新とリビルドの双方で参照・更新する。
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS games_top int NOT NULL DEFAULT 0;
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS games_jg  int NOT NULL DEFAULT 0;
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS games_mid int NOT NULL DEFAULT 0;
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS games_adc int NOT NULL DEFAULT 0;
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS games_sup int NOT NULL DEFAULT 0;
