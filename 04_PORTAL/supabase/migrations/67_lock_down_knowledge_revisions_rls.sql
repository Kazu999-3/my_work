-- knowledge_revisions(辞典・レーンガイドの変更履歴)のSELECTポリシーがUSING (true)のまま
-- 全公開になっていた(migration 30)。実際にanonロールでSELECTできることを確認済み。
-- 個人情報ではないが社内向けナレッジの変更履歴が誰でも読める状態で、
-- 04_PORTAL/CLAUDE.mdが名指しで禁止するパターンそのもの(2026-08-13、
-- ナレッジ/ファクトチェック系監査#15で発覚)。
--
-- このテーブルへの読み取りは admin/knowledge/revisions ルート(verifyAdminSession必須、
-- service_role経由)のみが行っており、ブラウザから直接querying している箇所は無い
-- ことを確認済みなので、anon/authenticatedの権限を完全にはく奪してよい
-- (dict_fact_check_queue等、他の同種テーブルと同じ扱いに揃える)。
DROP POLICY IF EXISTS "knowledge_revisions select" ON knowledge_revisions;
REVOKE ALL ON knowledge_revisions FROM anon, authenticated;
