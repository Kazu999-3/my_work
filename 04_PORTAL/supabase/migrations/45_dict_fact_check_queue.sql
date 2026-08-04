-- 辞典（matchup_sentinel/champion_facts/champion_notes/personal_knowledge）の
-- 一斉ファクトチェック結果を溜める人間レビュー用キュー。
-- AIが自動生成した内容を無検証でそのまま公開しないよう、検出した問題はここに
-- 一旦積むだけにして、実際の反映（アーカイブ・修正）は人間が個別に判断する。
--
-- 04_PORTAL/.claude/skills/supabase-table-security のチェックリストに従い、
-- RLSは有効化した上で anon/authenticated の権限を完全にはく奪する
-- （このポータルはservice_roleキー経由のAPIルートのみがDBへアクセスする設計のため）。

CREATE TABLE IF NOT EXISTS dict_fact_check_queue (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  champion TEXT NOT NULL,
  issue_type TEXT NOT NULL CHECK (issue_type IN (
    'contradiction',          -- 辞典/コーチAI知識層/ナレッジ間での記述の矛盾
    'unconfirmed_source',     -- 単一ソースのみで裏取りできない主張
    'possible_fact_error',    -- 公式データ(Data Dragon)と矛盾する可能性がある記述
    'invalid_champion_tag'    -- champion列が実在チャンピオン名に正規化できない(スキン名混入・ゴミ値等)
  )),
  summary TEXT NOT NULL,
  detail JSONB,
  source_refs JSONB,          -- 関連レコードの参照（テーブル名、invalid_champion_tagの場合は行idまで含む）
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'acknowledged', 'fixed'))
);

CREATE INDEX IF NOT EXISTS idx_dict_fact_check_queue_status ON dict_fact_check_queue (status, created_at);
CREATE INDEX IF NOT EXISTS idx_dict_fact_check_queue_champion ON dict_fact_check_queue (champion);

ALTER TABLE dict_fact_check_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dict_fact_check_queue FROM anon, authenticated;
