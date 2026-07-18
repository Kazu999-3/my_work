-- 5v5 AIシミュレータの結果を保存・共有するためのテーブル。
-- id を共有リンク(?sim=<id>)に使う。青/赤の構成と分析結果をJSONで保持する。
CREATE TABLE IF NOT EXISTS saved_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blue jsonb NOT NULL,
  red jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
