-- 2026-10-17: 試合ごとの獲得ゴールドを記録する。
-- 記録画面に「スコアボード画像（任意）」を追加し、CS とゴールドを読み取れるようにした。
-- チームのゴールド差は、キル差よりも「接戦だったか・一方的だったか」を正確に表すため、
-- チーム分けの評価に使う。読み取れなかった試合は NULL（0 と区別する）。
ALTER TABLE public.ktm_match_participants ADD COLUMN IF NOT EXISTS gold integer;
