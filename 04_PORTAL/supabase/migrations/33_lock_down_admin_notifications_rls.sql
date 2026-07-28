-- セキュリティ監査で発覚: admin_notifications が RLS 無効のまま作成されており、
-- anon/authenticated から誰でも管理者向け通知の閲覧・改ざん・削除ができる状態だった。
-- 読み書きは全て /api/admin/notifications・/api/admin/notifications/read・
-- /api/push/notify-admin（いずれも service_role 経由）からのみ行われており、
-- クライアントから直接Supabaseへアクセスすることは無いため、31番の
-- saved_simulations と同様に権限ごと完全に閉じる。
--
-- ※このスクリプトは冪等（何度でも再実行可）。

REVOKE ALL ON admin_notifications FROM anon, authenticated;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ロールバック（もし何かのAPIが直接anonキーで読み書きしていて壊れた場合）
-- ------------------------------------------------------------
-- GRANT ALL ON admin_notifications TO anon, authenticated;
-- ALTER TABLE admin_notifications DISABLE ROW LEVEL SECURITY;
-- ============================================================
