-- チャンピオン辞典・レーン別ガイドの更新履歴。
-- 統合は AI が本文を丸ごと書き直すため、そのままでは「何が増えたのか」を追えない。
-- 更新のたびに直前の本文を残しておき、差分表示とロールバックを可能にする。
CREATE TABLE IF NOT EXISTS knowledge_revisions (
  id           bigserial PRIMARY KEY,
  -- 対象の種別と識別子（'lane_guide' + lane / 'champion_fact' + champion など）
  target_type  text NOT NULL,
  target_key   text NOT NULL,
  field        text NOT NULL DEFAULT 'body',  -- 辞典は項目ごとに履歴を持てるようにする
  before_text  text,                          -- 更新前（初回は NULL）
  after_text   text NOT NULL,                 -- 更新後
  source_title text,                          -- 取り込んだ記事のタイトル
  source_id    text,                          -- 取り込んだ記事のID
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_revisions_target
  ON knowledge_revisions (target_type, target_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_revisions_recent
  ON knowledge_revisions (created_at DESC);

ALTER TABLE knowledge_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge_revisions select" ON knowledge_revisions;
CREATE POLICY "knowledge_revisions select" ON knowledge_revisions FOR SELECT USING (true);
