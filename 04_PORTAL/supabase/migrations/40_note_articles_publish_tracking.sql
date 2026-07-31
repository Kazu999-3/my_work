-- note_articlesに「公開管理」の列を追加する。
-- noteには公式APIが無く自動スクレイピングも過去に不安定で廃止済み(note_analytics_daemon.py)
-- のため、公開状態・成績は手入力で記録する方式にする。
--
-- ※このスクリプトは冪等（何度でも再実行可）。

ALTER TABLE note_articles ADD COLUMN IF NOT EXISTS note_url text;
ALTER TABLE note_articles ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE note_articles ADD COLUMN IF NOT EXISTS views integer;
ALTER TABLE note_articles ADD COLUMN IF NOT EXISTS likes integer;
ALTER TABLE note_articles ADD COLUMN IF NOT EXISTS sales_count integer;
ALTER TABLE note_articles ADD COLUMN IF NOT EXISTS sales_amount integer;
ALTER TABLE note_articles ADD COLUMN IF NOT EXISTS metrics_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_note_articles_published_at ON note_articles (published_at DESC);
