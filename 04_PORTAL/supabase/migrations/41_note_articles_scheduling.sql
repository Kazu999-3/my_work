-- note記事の投稿スケジュール管理用。公開前の下書きに「配信予定日」を持たせ、
-- 管理画面で今後の投稿予定を一覧できるようにする。
--
-- ※このスクリプトは冪等（何度でも再実行可）。

ALTER TABLE note_articles ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_note_articles_scheduled_at ON note_articles (scheduled_at ASC);
