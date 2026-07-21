-- レーン別ガイド。
-- 攻略ライブラリの記事のうち、特定チャンピオンの話ではない「レーンのマクロ・立ち回り」を
-- レーンごとに1本の記事へ統合して蓄積する。
-- （チャンピオン固有の記事は champion_facts / champion_notes 側へ統合される）
CREATE TABLE IF NOT EXISTS lane_guides (
  lane         TEXT PRIMARY KEY,      -- TOP / JG / MID / ADC / SUP / COMMON
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,          -- Markdown本文（統合済み）
  source_count INT DEFAULT 0,          -- 統合した記事数
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lane_guides ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY は IF NOT EXISTS が使えないため、DROP してから作り直す（再実行しても安全）
DROP POLICY IF EXISTS "lane_guides select" ON lane_guides;
CREATE POLICY "lane_guides select" ON lane_guides FOR SELECT USING (true);
