-- 格下サポートフラグ（特定の人だけ下位帯にオフレーンで参加できるフラグ）の永続化（指示文13: 2026-11-22）
ALTER TABLE public.ktm_players
  ADD COLUMN IF NOT EXISTS allow_lower_support boolean NOT NULL DEFAULT false;
