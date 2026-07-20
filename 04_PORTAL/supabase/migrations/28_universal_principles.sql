-- 汎用原則（Universal Principles）。
-- チャンピオン辞典やメモには「Gravesは〜」のようなキャラ固有の話と、
-- 「相手ジャングルの位置が不明なときは〜」のようなチャンプに依存しない判断・マクロが
-- 混ざっている。後者だけを抽出してテーマ別のテキストとして蓄積する。
CREATE TABLE IF NOT EXISTS universal_principles (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  theme       TEXT NOT NULL,          -- テーマ（マクロ/レーン戦/オブジェクト/視界/メンタル 等）
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,          -- Markdown本文
  source_count INT DEFAULT 0,         -- 何件の元データから抽出したか
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_universal_principles_theme ON universal_principles (theme);

ALTER TABLE universal_principles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "universal_principles select" ON universal_principles FOR SELECT USING (true);
