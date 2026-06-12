-- =============================================
-- YouTube Queue テーブルのアップデート
-- 保留ステータス（on_hold）および優先度（priority）を追加する
-- =============================================

-- 1. status の CHECK 制約を更新（on_hold を追加）
ALTER TABLE youtube_queue DROP CONSTRAINT IF EXISTS youtube_queue_status_check;
ALTER TABLE youtube_queue ADD CONSTRAINT youtube_queue_status_check 
  CHECK (status IN ('pending', 'completed', 'error_generation', 'error_no_transcript', 'failed', 'on_hold'));

-- 2. priority カラムの追加（デフォルト: 'medium'）
ALTER TABLE youtube_queue ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'
  CHECK (priority IN ('high', 'medium', 'low'));

-- 3. 優先度ソート用のインデックス作成
CREATE INDEX IF NOT EXISTS idx_youtube_queue_priority ON youtube_queue(priority);
