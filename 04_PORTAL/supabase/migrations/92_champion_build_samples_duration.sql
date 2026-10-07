-- 試合時間を記録し、05 辞典の「パワースパイク推移」を実測（試合時間別の勝率）にする（2026-10-07）
--
-- それまでの「パワースパイク推移」は型（アーキタイプ）ごとの手書きの値（例: マークスマンは序盤4・中盤7・終盤10）で、
-- 同じ型のチャンピオンは全員同じ数字だった。収集（rank_benchmark_collector.py）がすでに取得している試合詳細の
-- gameDuration を記録し、短い試合・中くらい・長い試合での勝率を出す（Riot API の呼び出しは増えない）。
-- 既存の行は NULL のまま（再取得はしない）。値が貯まった分から集計に入る。
ALTER TABLE public.champion_build_samples ADD COLUMN IF NOT EXISTS game_duration_sec INT;

-- チャンピオン×ロール×試合時間帯の勝率。区分は 25分未満 / 25〜32分 / 32分以上。
-- 各区分 p_min 試合以上のものだけ返す（少ないと勝率がぶれるため）。
CREATE OR REPLACE FUNCTION public.champion_duration_winrates(p_days INT DEFAULT 60, p_min INT DEFAULT 15)
RETURNS TABLE (
  champion TEXT,
  role TEXT,
  phase TEXT,      -- 'early' / 'mid' / 'late'
  games INT,
  win_rate NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT s.champion, s.role,
    CASE WHEN s.game_duration_sec < 1500 THEN 'early'
         WHEN s.game_duration_sec < 1920 THEN 'mid'
         ELSE 'late' END AS phase,
    COUNT(*)::INT AS games,
    ROUND(AVG(CASE WHEN s.win THEN 100 ELSE 0 END), 1) AS win_rate
  FROM public.champion_build_samples s
  WHERE s.game_duration_sec IS NOT NULL
    AND s.game_start >= now() - make_interval(days => p_days)
  GROUP BY 1, 2, 3
  HAVING COUNT(*) >= p_min;
$$;

REVOKE EXECUTE ON FUNCTION public.champion_duration_winrates(INT, INT) FROM PUBLIC, anon, authenticated;
