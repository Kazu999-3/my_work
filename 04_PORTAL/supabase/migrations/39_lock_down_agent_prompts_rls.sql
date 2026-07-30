-- セキュリティ監査で発覚: agent_prompts の書き込みポリシーが authenticated ロール
-- 限定でqual/with_check=trueの無防備な状態だった。このポータルは Supabase Auth の
-- サインインを一切使っておらず(anonキーのみ、persistSession:false)、リクエストは常に
-- role=anon で解決されるため実害はなかったが、/admin/prompts の保存機能自体もこの
-- 同じanonキー直叩きに依存していたため、実際には保存が失敗する状態でもあった。
--
-- 読み書きとも /api/admin/prompts（service_role経由のAPIルート。認証はproxy.tsの
-- /api/admin/* Cookieゲート）からのみ行うようにしたため、anon/authenticated からの
-- 直接アクセスは不要。31番のsaved_simulations等と同様に権限ごと完全に閉じる。
--
-- ※このスクリプトは冪等（何度でも再実行可）。

REVOKE ALL ON agent_prompts FROM anon, authenticated;
ALTER TABLE agent_prompts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ロールバック（もし何かのAPIが直接anonキーで読み書きしていて壊れた場合）
-- ------------------------------------------------------------
-- GRANT ALL ON agent_prompts TO anon, authenticated;
-- ============================================================
