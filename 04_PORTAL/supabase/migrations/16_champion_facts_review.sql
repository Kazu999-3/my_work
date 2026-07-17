-- ============================================================
-- 辞典の鮮度レビュー用カラム (課題#50 フェーズC)
--
-- 古いパッチの champion_facts をLLMが「現パッチでも有効か」判定し、
-- 管理者が承認したものだけを「確認済み(reviewed_at更新)」または「アーカイブ(archived)」にする。
-- 削除はしない（誤判定で良質な手書き情報を失わないため）。
-- ============================================================

ALTER TABLE champion_facts ADD COLUMN IF NOT EXISTS archived    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE champion_facts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE champion_facts ADD COLUMN IF NOT EXISTS review_patch TEXT;  -- どのパッチで有効確認したか
