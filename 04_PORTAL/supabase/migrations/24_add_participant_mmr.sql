-- 1. balancer_predictions の match_id を bigint 型に再定義（ktm_matches.id との紐付けを確実にするため）
ALTER TABLE public.balancer_predictions DROP COLUMN IF EXISTS match_id;
ALTER TABLE public.balancer_predictions ADD COLUMN match_id bigint;

-- 2. ktm_match_participants に試合時のMMRを記録するカラムを追加
ALTER TABLE public.ktm_match_participants ADD COLUMN IF NOT EXISTS player_mmr integer;
