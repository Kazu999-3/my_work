-- ナレッジ登録時、動画1本・記事1本を最大15,000文字の塊のまま1レコードとして
-- 保存していた(Zettelkasten的な「1ノート1アイデア」原則に反し、辞典生成プロンプトへ
-- 渡す際にノイズが増える)。登録時にAIが複数の独立した知見を検出した場合、
-- 元記事(container)とは別に、それぞれ短い原子的な知見レコードとして分割保存できる
-- ようにする(2026-08-12、既存174件は移行せず今後の新規登録のみ対象)。
ALTER TABLE personal_knowledge ADD COLUMN IF NOT EXISTS parent_id BIGINT
  REFERENCES personal_knowledge(id) ON DELETE CASCADE;
ALTER TABLE personal_knowledge ADD COLUMN IF NOT EXISTS is_atomic BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_personal_knowledge_parent_id
  ON personal_knowledge (parent_id) WHERE parent_id IS NOT NULL;
