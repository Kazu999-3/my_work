-- ⑤(ジャングル序盤タイミングがAI検索頼みで不正確)・①(Riot APIで面白い情報ないの？)への対応(2026-08-13)。
-- Riot Match Timeline APIから実際の高ELO帯(エメラルド)対戦データを収集し、
-- AIの推定値とは別枠の「実測値」として辞典に追加する。既存のAI推定フィールドは
-- 一切上書きしない(過去に「かんけきないでーたかきかわるのはこわい」との懸念があったため)。
CREATE TABLE IF NOT EXISTS champion_jungle_timing_samples (
  id BIGSERIAL PRIMARY KEY,
  champion TEXT NOT NULL,
  match_id TEXT NOT NULL,
  full_clear_sec INT,
  first_core_sec INT,
  second_core_sec INT,
  tier TEXT NOT NULL DEFAULT 'EMERALD',
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, champion)
);

CREATE INDEX IF NOT EXISTS idx_champion_jungle_timing_samples_champion ON champion_jungle_timing_samples (champion);

-- 生サンプルの平均を集計スクリプト側で都度書き込む(読み取り側でのGROUP BYを避けるため)
CREATE TABLE IF NOT EXISTS champion_jungle_timing_agg (
  champion TEXT PRIMARY KEY,
  sample_count INT NOT NULL,
  avg_full_clear_sec INT,
  avg_first_core_sec INT,
  avg_second_core_sec INT,
  tier TEXT NOT NULL DEFAULT 'EMERALD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE champion_jungle_timing_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE champion_jungle_timing_agg ENABLE ROW LEVEL SECURITY;

CREATE POLICY "champion_jungle_timing_samples_public_read" ON champion_jungle_timing_samples
  FOR SELECT USING (true);
CREATE POLICY "champion_jungle_timing_agg_public_read" ON champion_jungle_timing_agg
  FOR SELECT USING (true);

REVOKE INSERT, UPDATE, DELETE ON champion_jungle_timing_samples FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON champion_jungle_timing_agg FROM anon, authenticated;
