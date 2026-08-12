-- ナレッジ追加(X投稿/note記事)時に投稿者を記録し、同じ投稿者の他の記事を
-- 自動で紐づけられるようにする。プラットフォームをまたいだ同名衝突を避けるため
-- "x:{screen_name}" / "note:{username}" のプレフィックス付きで格納する
-- (2026-08-12)。

ALTER TABLE personal_knowledge ADD COLUMN IF NOT EXISTS author TEXT;

CREATE INDEX IF NOT EXISTS idx_personal_knowledge_author
  ON personal_knowledge (author) WHERE author IS NOT NULL;
