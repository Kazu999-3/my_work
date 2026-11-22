-- 定期カスタムの帯分け・格上繰り上げ設定（SPEC 10: 2026-11-22）
-- 既存の allow_higher（同一試合内の対面格差ガード）とは分離し、
-- 「上の帯の人数不足時に繰り上げ参加できるか」の3択を ktm_players に追加する。
--
--   - mix_ok:    カスタム混ざってもいい（積極繰り上げ・混成OK）
--   - fill_only: 人足りなければ参加してもいい（デフォルト：不足時の繰り上げ候補）
--   - never:     絶対嫌（自分の帯の試合のみ参加）
ALTER TABLE public.ktm_players
  ADD COLUMN IF NOT EXISTS tier_promotion_pref text NOT NULL DEFAULT 'fill_only';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ktm_players_tier_promotion_pref_check'
  ) THEN
    ALTER TABLE public.ktm_players
      ADD CONSTRAINT ktm_players_tier_promotion_pref_check
      CHECK (tier_promotion_pref IN ('mix_ok', 'fill_only', 'never'));
  END IF;
END $$;
