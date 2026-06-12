-- =============================================
-- YouTube Queue テーブルに投稿日（published_at）を追加する
-- =============================================
ALTER TABLE youtube_queue ADD COLUMN IF NOT EXISTS published_at date;
CREATE INDEX IF NOT EXISTS idx_youtube_queue_published_at ON youtube_queue(published_at NULLS LAST);
