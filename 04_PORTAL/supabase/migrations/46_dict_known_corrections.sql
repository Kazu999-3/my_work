-- 一斉ファクトチェック(dict_fact_check_queue)で人間が確定した「訂正内容」を
-- 記録し、以降のAI生成すべてに再発防止として効かせるためのテーブル。
-- lib/championKnowledge.ts(全AI生成の共通知識レイヤー)がこのテーブルを読み、
-- 「過去に確定した訂正」をプロンプトへ差し込む。
--
-- 04_PORTAL/.claude/skills/supabase-table-security のチェックリストに従い、
-- RLSは有効化した上で anon/authenticated の権限を完全にはく奪する。

CREATE TABLE IF NOT EXISTS dict_known_corrections (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  champion TEXT NOT NULL,
  wrong_claim TEXT NOT NULL,      -- 何が誤っていたか（ファクトチェックの検出summary）
  correct_info TEXT NOT NULL,     -- 正しい内容（人間が入力）
  issue_type TEXT,                -- 由来したissue_type（参考情報）
  source_queue_id BIGINT REFERENCES dict_fact_check_queue(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_dict_known_corrections_champion ON dict_known_corrections (champion);

ALTER TABLE dict_known_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dict_known_corrections FROM anon, authenticated;
