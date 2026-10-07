-- チャンピオン×ロール別の実測ビルド（2026-10-07）
--
-- 05 辞典の「標準コア」のアイテム・ルーンは、出典の無い AI 推定（Riot 公式名と不一致が186個/125体）だった。
-- 目標ランク平均の収集（rank_benchmark_collector.py、毎日）がすでに取得している試合詳細＋タイムラインから、
-- 同じ試合の10人全員のビルドを記録する（Riot API の呼び出しは増えない）。
--   - ランク平均(rank_benchmark_samples)は「目標ランク本人だけ」だが、ビルドの傾向はマッチングで近い実力の
--     10人で見ても差し支えないため全員を使う。sample_tier は選んだ本人のランク（他の9人はその近辺）。
--   - core_items: 完成アイテム（靴・消耗品・素材を除く）を購入順に最初の3つ。売却・購入取り消し(UNDO)を反映。
--   - skill_max_order: Q/W/E のうちレベル5に到達した順（例: 'QEW'）。R は含めない。
--   - champion は Data Dragon の ID（match の championName は 'FiddleSticks' 等の表記揺れがあるため championId から引く）。
CREATE TABLE IF NOT EXISTS public.champion_build_samples (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id TEXT NOT NULL,
  participant_id INT NOT NULL,
  champion TEXT NOT NULL,
  role TEXT NOT NULL,                -- TOP / JUNGLE / MIDDLE / BOTTOM / UTILITY
  sample_tier TEXT NOT NULL,         -- 例: 'EMERALD IV'
  patch TEXT NOT NULL,               -- 例: '16.20'
  game_start TIMESTAMPTZ NOT NULL,
  win BOOLEAN NOT NULL,
  core_items INT[] NOT NULL DEFAULT '{}',
  boots INT,
  keystone INT,
  primary_style INT,
  sub_style INT,
  perks INT[] NOT NULL DEFAULT '{}', -- メイン4つ＋サブ2つ
  skill_max_order TEXT,
  summoner_spells INT[] NOT NULL DEFAULT '{}',
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT champion_build_samples_match_participant_key UNIQUE (match_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_champion_build_samples_lookup
  ON public.champion_build_samples (champion, role, game_start DESC);

-- 05 はサービスロールで読む。公開キーからは読ませない（ポリシーを作らない）
ALTER TABLE public.champion_build_samples ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.champion_build_samples FROM anon, authenticated;

-- チャンピオン×ロール別の集計（直近 p_days 日・p_min 試合以上）。PostgREST の1000件上限を避けるため DB 側で集計する。
-- 2コア目は1コア目に選ばれたアイテムを、3コア目は1・2コア目を除いて最も多いものを選ぶ（入れ替え購入で同じアイテムが並ばないように）。
-- 各 *_rate は、そのスロットまで買い進めた試合のうちの割合(%)。
CREATE OR REPLACE FUNCTION public.champion_build_summary(p_days INT DEFAULT 30, p_min INT DEFAULT 20)
RETURNS TABLE (
  champion TEXT,
  role TEXT,
  samples INT,
  win_rate NUMERIC,
  core1 INT, core1_rate NUMERIC,
  core2 INT, core2_rate NUMERIC,
  core3 INT, core3_rate NUMERIC,
  boots INT, boots_rate NUMERIC,
  keystone INT, keystone_rate NUMERIC,
  primary_style INT, sub_style INT,
  perks INT[], perks_rate NUMERIC,
  skill_max_order TEXT, skill_rate NUMERIC,
  patches TEXT[], tiers TEXT[],
  last_game_start TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT * FROM public.champion_build_samples s
    WHERE s.game_start >= now() - make_interval(days => p_days)
  ),
  grp AS (
    SELECT b.champion, b.role, COUNT(*)::INT AS samples,
      ROUND(AVG(CASE WHEN b.win THEN 100 ELSE 0 END), 1) AS win_rate,
      ARRAY_AGG(DISTINCT b.patch ORDER BY b.patch) AS patches,
      ARRAY_AGG(DISTINCT b.sample_tier ORDER BY b.sample_tier) AS tiers,
      MAX(b.game_start) AS last_game_start
    FROM base b GROUP BY b.champion, b.role HAVING COUNT(*) >= p_min
  ),
  c1 AS (
    SELECT DISTINCT ON (x.champion, x.role) x.champion, x.role, x.item,
      ROUND(x.n * 100.0 / SUM(x.n) OVER (PARTITION BY x.champion, x.role), 1) AS rate
    FROM (SELECT b.champion, b.role, b.core_items[1] AS item, COUNT(*) AS n
          FROM base b WHERE cardinality(b.core_items) >= 1 GROUP BY 1, 2, 3) x
    ORDER BY x.champion, x.role, x.n DESC, x.item
  ),
  c2 AS (
    SELECT DISTINCT ON (x.champion, x.role) x.champion, x.role, x.item,
      ROUND(x.n * 100.0 / x.tot, 1) AS rate
    FROM (SELECT b.champion, b.role, b.core_items[2] AS item, COUNT(*) AS n,
            SUM(COUNT(*)) OVER (PARTITION BY b.champion, b.role) AS tot
          FROM base b WHERE cardinality(b.core_items) >= 2 GROUP BY 1, 2, 3) x
    JOIN c1 ON c1.champion = x.champion AND c1.role = x.role
    WHERE x.item <> c1.item
    ORDER BY x.champion, x.role, x.n DESC, x.item
  ),
  c3 AS (
    SELECT DISTINCT ON (x.champion, x.role) x.champion, x.role, x.item,
      ROUND(x.n * 100.0 / x.tot, 1) AS rate
    FROM (SELECT b.champion, b.role, b.core_items[3] AS item, COUNT(*) AS n,
            SUM(COUNT(*)) OVER (PARTITION BY b.champion, b.role) AS tot
          FROM base b WHERE cardinality(b.core_items) >= 3 GROUP BY 1, 2, 3) x
    JOIN c1 ON c1.champion = x.champion AND c1.role = x.role
    JOIN c2 ON c2.champion = x.champion AND c2.role = x.role
    WHERE x.item <> c1.item AND x.item <> c2.item
    ORDER BY x.champion, x.role, x.n DESC, x.item
  ),
  bt AS (
    SELECT DISTINCT ON (x.champion, x.role) x.champion, x.role, x.item,
      ROUND(x.n * 100.0 / SUM(x.n) OVER (PARTITION BY x.champion, x.role), 1) AS rate
    FROM (SELECT b.champion, b.role, b.boots AS item, COUNT(*) AS n
          FROM base b WHERE b.boots IS NOT NULL GROUP BY 1, 2, 3) x
    ORDER BY x.champion, x.role, x.n DESC, x.item
  ),
  ks AS (
    SELECT DISTINCT ON (x.champion, x.role) x.champion, x.role, x.keystone, x.primary_style, x.sub_style,
      ROUND(x.n * 100.0 / SUM(x.n) OVER (PARTITION BY x.champion, x.role), 1) AS rate
    FROM (SELECT b.champion, b.role, b.keystone, b.primary_style, b.sub_style, COUNT(*) AS n
          FROM base b WHERE b.keystone IS NOT NULL GROUP BY 1, 2, 3, 4, 5) x
    ORDER BY x.champion, x.role, x.n DESC, x.keystone
  ),
  pk AS (
    SELECT DISTINCT ON (x.champion, x.role) x.champion, x.role, x.perks,
      ROUND(x.n * 100.0 / SUM(x.n) OVER (PARTITION BY x.champion, x.role), 1) AS rate
    FROM (SELECT b.champion, b.role, b.perks, COUNT(*) AS n
          FROM base b WHERE cardinality(b.perks) = 6 GROUP BY 1, 2, 3) x
    ORDER BY x.champion, x.role, x.n DESC
  ),
  sk AS (
    SELECT DISTINCT ON (x.champion, x.role) x.champion, x.role, x.skill_max_order,
      ROUND(x.n * 100.0 / SUM(x.n) OVER (PARTITION BY x.champion, x.role), 1) AS rate
    FROM (SELECT b.champion, b.role, b.skill_max_order, COUNT(*) AS n
          FROM base b WHERE b.skill_max_order IS NOT NULL AND length(b.skill_max_order) = 3 GROUP BY 1, 2, 3) x
    ORDER BY x.champion, x.role, x.n DESC
  )
  SELECT g.champion, g.role, g.samples, g.win_rate,
    c1.item, c1.rate, c2.item, c2.rate, c3.item, c3.rate,
    bt.item, bt.rate,
    ks.keystone, ks.rate, ks.primary_style, ks.sub_style,
    pk.perks, pk.rate,
    sk.skill_max_order, sk.rate,
    g.patches, g.tiers, g.last_game_start
  FROM grp g
  LEFT JOIN c1 ON c1.champion = g.champion AND c1.role = g.role
  LEFT JOIN c2 ON c2.champion = g.champion AND c2.role = g.role
  LEFT JOIN c3 ON c3.champion = g.champion AND c3.role = g.role
  LEFT JOIN bt ON bt.champion = g.champion AND bt.role = g.role
  LEFT JOIN ks ON ks.champion = g.champion AND ks.role = g.role
  LEFT JOIN pk ON pk.champion = g.champion AND pk.role = g.role
  LEFT JOIN sk ON sk.champion = g.champion AND sk.role = g.role;
$$;

REVOKE EXECUTE ON FUNCTION public.champion_build_summary(INT, INT) FROM PUBLIC, anon, authenticated;
