-- =============================================
-- YouTube Queue テーブル（Supabase移行版）
-- kirei_queue.json の内容をDBで管理する
-- =============================================
CREATE TABLE IF NOT EXISTS youtube_queue (
  id           text PRIMARY KEY,           -- YouTube動画ID (例: T7k-_XfAILA)
  title        text NOT NULL DEFAULT '',   -- 動画タイトル
  channel_name text NOT NULL DEFAULT '',   -- チャンネル名
  url          text NOT NULL,             -- YouTube URL
  status       text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','completed','error_generation','error_no_transcript','failed')),
  retry_count  int NOT NULL DEFAULT 0,
  duration_sec int,                        -- 動画の長さ（秒）
  date_added   bigint,                     -- UNIXタイムスタンプ（元データ互換）
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- 更新時刻の自動更新トリガー
CREATE OR REPLACE FUNCTION update_youtube_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER youtube_queue_updated_at
  BEFORE UPDATE ON youtube_queue
  FOR EACH ROW EXECUTE FUNCTION update_youtube_queue_updated_at();

-- インデックス（status で絞り込みが多いため）
CREATE INDEX IF NOT EXISTS idx_youtube_queue_status ON youtube_queue(status);
CREATE INDEX IF NOT EXISTS idx_youtube_queue_duration ON youtube_queue(duration_sec NULLS LAST);

-- RLS設定（ポータルから読み書きできるように）
ALTER TABLE youtube_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "誰でも閲覧可能" ON youtube_queue FOR SELECT USING (true);
CREATE POLICY "誰でも追加可能" ON youtube_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "誰でも更新可能" ON youtube_queue FOR UPDATE USING (true);
CREATE POLICY "誰でも削除可能" ON youtube_queue FOR DELETE USING (true);
