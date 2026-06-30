-- =============================================
-- YouTube Playlists テーブル
-- 監視対象のYouTubeプレイリストをDBで管理する
-- =============================================
CREATE TABLE IF NOT EXISTS youtube_playlists (
  id              text PRIMARY KEY,           -- YouTubeプレイリストID (例: PL7aNfKUA-1lvPVfUoYHpD6jaK0p44HQGM)
  name            text NOT NULL DEFAULT '',   -- プレイリスト名
  url             text NOT NULL,             -- プレイリストURL
  active          boolean NOT NULL DEFAULT true,
  last_fetched_at timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 更新時刻の自動更新トリガー
CREATE OR REPLACE TRIGGER youtube_playlists_updated_at
  BEFORE UPDATE ON youtube_playlists
  FOR EACH ROW EXECUTE FUNCTION update_youtube_queue_updated_at();

-- RLS設定
ALTER TABLE youtube_playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "誰でも閲覧可能" ON youtube_playlists FOR SELECT USING (true);
CREATE POLICY "誰でも追加可能" ON youtube_playlists FOR INSERT WITH CHECK (true);
CREATE POLICY "誰でも更新可能" ON youtube_playlists FOR UPDATE USING (true);
CREATE POLICY "誰でも削除可能" ON youtube_playlists FOR DELETE USING (true);
