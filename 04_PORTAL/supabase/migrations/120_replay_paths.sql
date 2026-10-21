-- リプレイから読み取った10人の秒単位の移動経路（2026-10-21、試作。ユーザー要望で管理画面に置く）
--
-- 書き込みは PC の読み取りスクリプト（mobilecheck/replay_paths.py → service role キーで upsert）。
-- 読み取りは 04 管理画面の「道筋（試作）」タブ → /api/admin/replay-paths（verifyAdminSession）だけ。
-- data の形: { version, matchId, gameVersion, durationSec, coveredSec, quality,
--              players: [{ participantId, teamId, championName, riotId, position, points: [[秒, x, y, 見失ってからの秒数], ...] }] }
-- 座標はサモナーズリフトの x: 0〜14870 / y: 0〜14980（左下が原点）。1秒おきに間引いてあり、1試合 300KB 前後。

CREATE TABLE IF NOT EXISTS public.replay_paths (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id text NOT NULL UNIQUE,
  game_version text,
  duration_sec integer,
  covered_sec integer,
  quality jsonb,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.replay_paths ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.replay_paths FROM anon, authenticated;
