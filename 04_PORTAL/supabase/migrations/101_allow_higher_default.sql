-- 格上との対面の初期値を「避けたい（保護あり）」にそろえる（2026-10-17、ユーザー承認）
--
-- DB の初期値が true（格上OK）で、自己紹介からの自動登録はこの列を指定していなかったため、
-- 10月に自動登録された新しい人の多く（10人）が本人の選択なしに「保護なし」になっていた。
-- 既存の大多数（64人）は false。初期値を false に変え、10月登録で true の人を false に戻す。
-- 本人が変えたい場合はマイページの設定から変えられる。

ALTER TABLE public.ktm_players ALTER COLUMN allow_higher SET DEFAULT false;

UPDATE public.ktm_players
SET allow_higher = false
WHERE allow_higher = true
  AND created_at >= '2026-10-01T00:00:00+09:00';
