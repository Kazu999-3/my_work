-- エージェントスキル（sovereign-factory / note_article_drafter）が生成したnote記事下書きを
-- ファイルシステム（02_FACTORY/note_drafts、.gitignore対象でVercelには存在しない）ではなく
-- DBへ投入するためのテーブル。/admin/analytics の記事下書きプレビュータブが読む。
--
-- ※このスクリプトは冪等（何度でも再実行可）。

CREATE TABLE IF NOT EXISTS note_articles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  champion text,
  patch text,
  content_free text,
  content_paid text,
  promo_text text,
  file_path text,
  status text NOT NULL DEFAULT 'draft',
  source_skill text
);

CREATE INDEX IF NOT EXISTS idx_note_articles_created_at ON note_articles (created_at DESC);

-- 読み書きとも /admin/analytics（service_role経由のAPIルート）からのみ行う。
-- anon/authenticated からの直接アクセスは想定していないため権限ごと閉じる。
REVOKE ALL ON note_articles FROM anon, authenticated;
ALTER TABLE note_articles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ロールバック
-- ------------------------------------------------------------
-- DROP TABLE IF EXISTS note_articles;
-- ============================================================
