-- ktm_matches に match_type カラムを追加（2026-11-14）
--
-- 背景:
--   試合履歴において公式戦とお祭りカスタム（レート非干渉）を切り替える機能のため
--   match_type カラム（'NORMAL' | 'EVENT' | 'TOURNAMENT'）が必要。
--
-- 対策:
--   ktm_matches に match_type 列を追加し、過去の EXHIBITION マッチを 'EVENT' に初期化する。

ALTER TABLE public.ktm_matches
  ADD COLUMN IF NOT EXISTS match_type text DEFAULT 'NORMAL';

-- 過去に riot_match_id = 'EXHIBITION' として保存されていたお祭り試合の match_type を 'EVENT' に初期化
UPDATE public.ktm_matches
  SET match_type = 'EVENT'
  WHERE riot_match_id = 'EXHIBITION' AND (match_type IS NULL OR match_type = 'NORMAL');

CREATE INDEX IF NOT EXISTS idx_ktm_matches_match_type
  ON public.ktm_matches (match_type);
