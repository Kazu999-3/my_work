-- ポータル横断セキュリティ監査(2026-08-13)で、実際にanonロールからの書き込み/読み取りが
-- 可能なことを確認済みのテーブル群を一括ロックダウンする(監査#26,27,31)。
--
-- 対象:
--   matchup_sentinel     : 辞典本体。全読み書きがadmin API(service_role)経由と確認済み
--                           (champions/detail, dictionary-overview等)なのでSELECTも含め全遮断。
--   collab_tasks         : 個人タスクボード。全操作がadmin API経由と確認済み。
--   youtube_queue        : ghost-tacticsの動画解析キュー。同上。
--   youtube_playlists    : 同上。
--   system_patches       : コード・migration内に参照が一件も無い孤立テーブル。
--   published_posts      : 同上。
--   edge_tasks           : 汎用タスクキュー。全操作がserver-side API route(service_role)
--                           経由と確認済み。
--
-- migration 31/38/39/43で3回以上修正してきた「RLS USING(true)放置」バグの再発パターン。
-- 各テーブルの既存ポリシー名がバラバラ・一部重複していたため、動的に全ポリシーを
-- 削除してから REVOKE する。

DO $$
DECLARE
  tbl text;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['matchup_sentinel','collab_tasks','youtube_queue','youtube_playlists','system_patches','published_posts','edge_tasks']
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

REVOKE ALL ON matchup_sentinel, collab_tasks, youtube_queue, youtube_playlists, system_patches, published_posts, edge_tasks
  FROM anon, authenticated;
