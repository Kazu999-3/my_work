-- 1試合1課題ループ（2026-10-19、ユーザー要望）
--
-- 05 のコーチ画面で、試合前に課題を1つだけ出し（例: デス数 5回以下）、次のランク戦の実測で達成かを判定し、
-- 結果から次の課題を決める。課題の選び方・判定は 05_PILOT/src/lib/missionLoop.ts、API は /api/coach/mission。
--
-- status: active（挑戦中・プレイヤーごとに1件だけ）/ achieved / missed / skipped（「別の課題にする」で外した）
-- 書き込み・読み取りとも 05 のサーバー（service role キー）だけ。公開キーには権限を与えない。

CREATE TABLE IF NOT EXISTS public.coach_missions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  puuid text NOT NULL,
  riot_id text,
  role text NOT NULL,
  metric text NOT NULL,
  target numeric NOT NULL,
  baseline numeric,
  benchmark numeric,
  target_tier text,
  reason text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'missed', 'skipped')),
  match_id text,
  champion text,
  actual numeric,
  -- 最後に確認した最新の試合ID（新しい試合が無ければ試合詳細を取り直さない）
  last_checked_match_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  evaluated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_coach_missions_puuid_created ON public.coach_missions (puuid, created_at DESC);
-- 挑戦中の課題はプレイヤーごとに1件（同時に開いた2画面が二重に作るのを防ぐ）
CREATE UNIQUE INDEX IF NOT EXISTS uq_coach_missions_one_active ON public.coach_missions (puuid) WHERE status = 'active';

ALTER TABLE public.coach_missions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_missions FROM anon, authenticated;
