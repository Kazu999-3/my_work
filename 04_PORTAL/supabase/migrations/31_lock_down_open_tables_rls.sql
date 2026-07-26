-- セキュリティ監査で発覚: _migrations / matchup_log / saved_simulations の3テーブルが
-- RLS無効のまま anon/authenticated に INSERT/UPDATE/DELETE/TRUNCATE まで開放されていた。
-- 特に _migrations は誰でも publishable キーで適用履歴を削除・改ざんでき、
-- 24_add_participant_mmr.sql（先頭が DROP COLUMN）のような危険なマイグレーションを
-- 再実行させることが可能な状態だった。
-- matchup_log は 26_matchup_log.sql で一度 RLS を有効化したはずだが、本番では
-- 無効化されたまま残っていたため、ここで冪等に締め直す。
--
-- ※このスクリプトは冪等（何度でも再実行可）。

-- _migrations: migrate.mjs が DATABASE_URL 経由（RLSを迂回する接続）でのみ読み書きする
-- 内部テーブル。anon/authenticated からのアクセスは一切不要なので権限ごと剥がす。
REVOKE ALL ON _migrations FROM anon, authenticated;
ALTER TABLE _migrations ENABLE ROW LEVEL SECURITY;

-- matchup_log: 閲覧のみ anon に必要（バトルサーチの対面カルテ）。書き込みは
-- サーバーAPI（service_role・RLSバイパス）経由のみに限定する。
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON matchup_log FROM anon, authenticated;
ALTER TABLE matchup_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "matchup_log select" ON matchup_log;
CREATE POLICY "matchup_log select" ON matchup_log FOR SELECT USING (true);

-- saved_simulations: 保存・一覧・共有リンク参照のすべてが api/match/simulation
-- （service_role）経由。anon/authenticated からの直接アクセスは想定していないため
-- 権限ごと剥がして完全に閉じる。
REVOKE ALL ON saved_simulations FROM anon, authenticated;
ALTER TABLE saved_simulations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ロールバック（もし何かのAPIが直接anonキーで読み書きしていて壊れた場合）
-- ------------------------------------------------------------
-- GRANT ALL ON _migrations TO anon, authenticated;
-- ALTER TABLE _migrations DISABLE ROW LEVEL SECURITY;
-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON matchup_log TO anon, authenticated;
-- GRANT ALL ON saved_simulations TO anon, authenticated;
-- ALTER TABLE saved_simulations DISABLE ROW LEVEL SECURITY;
-- ============================================================
