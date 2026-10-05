-- 目標ランクの実測平均（2026-10-06）
--
-- 05 コーチ「試合後」タブの「目標との比較」で、目標ランク・同じロールのプレイヤーの実際の平均値と
-- 自分の成績を並べるためのサンプル。以前の比較対象(lib/sessionAnalyticsCalculator.ts の
-- ROLE_RANK_BENCHMARKS)は手入力の値で、実在の平均ではなかった。
--
-- 収集: 03_SYSTEMS/v2_CORE/_LOL/rank_benchmark_collector.py（.github/workflows/rank-benchmark-update.yml、毎日）
--   Riot League-V4 の目標ランク一覧から選んだプレイヤー本人の、直近ランクソロ1試合の成績だけを記録する。
--   同じ試合の他の9人はランクが異なり得るため使わない。
-- 各指標の定義は 05 /api/lol/postgame-deep-analytics の自分側の計算と揃えている（変える時は両方）。
CREATE TABLE IF NOT EXISTS public.rank_benchmark_samples (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tier TEXT NOT NULL,                 -- 例: EMERALD
  division TEXT NOT NULL DEFAULT '',  -- 例: IV（MASTER以上は空文字）
  role TEXT NOT NULL,                 -- TOP / JUNGLE / MIDDLE / BOTTOM / UTILITY
  match_id TEXT NOT NULL,
  puuid TEXT NOT NULL,
  game_start TIMESTAMPTZ NOT NULL,
  game_duration_sec INT NOT NULL,
  cs_per_min NUMERIC NOT NULL,
  cs_at_15 INT,                       -- 15分以前に終わった試合は NULL
  deaths INT NOT NULL,
  vision_per_min NUMERIC NOT NULL,
  kill_participation NUMERIC NOT NULL, -- %
  damage_share NUMERIC NOT NULL,       -- %
  control_wards_bought INT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rank_benchmark_samples_match_puuid_key UNIQUE (match_id, puuid)
);

CREATE INDEX IF NOT EXISTS idx_rank_benchmark_samples_lookup
  ON public.rank_benchmark_samples (tier, division, role, game_start DESC);

-- 05 はサービスロールで読み書きする。公開キーからは読ませない（ポリシーを作らない）
ALTER TABLE public.rank_benchmark_samples ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rank_benchmark_samples FROM anon, authenticated;

-- ロール別の平均。PostgREST の1000件上限で取りこぼさないよう、集計はDB側で行う
CREATE OR REPLACE FUNCTION public.rank_benchmark_averages(p_tier TEXT, p_division TEXT, p_days INT DEFAULT 30)
RETURNS TABLE (
  role TEXT,
  sample_count BIGINT,
  cs_per_min NUMERIC,
  cs_at_15 NUMERIC,
  cs_at_15_count BIGINT,
  deaths NUMERIC,
  vision_per_min NUMERIC,
  kill_participation NUMERIC,
  damage_share NUMERIC,
  control_wards_bought NUMERIC,
  last_collected_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.role,
    COUNT(*),
    ROUND(AVG(s.cs_per_min), 2),
    ROUND(AVG(s.cs_at_15), 1),
    COUNT(s.cs_at_15),
    ROUND(AVG(s.deaths), 2),
    ROUND(AVG(s.vision_per_min), 2),
    ROUND(AVG(s.kill_participation), 1),
    ROUND(AVG(s.damage_share), 1),
    ROUND(AVG(s.control_wards_bought), 2),
    MAX(s.collected_at)
  FROM public.rank_benchmark_samples s
  WHERE s.tier = UPPER(p_tier)
    AND s.division = UPPER(COALESCE(p_division, ''))
    AND s.game_start >= now() - make_interval(days => p_days)
  GROUP BY s.role;
$$;

REVOKE EXECUTE ON FUNCTION public.rank_benchmark_averages(TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
