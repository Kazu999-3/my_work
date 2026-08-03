-- セキュリティレビューで発覚: soloq_reflections (メンタル評価・振り返りメモ等の個人データ)
-- が anon/authenticated に対し SELECT/INSERT/UPDATE を qual/with_check=true で全開放していた。
-- コメントには「controlled by portal」とあったが、実際には対応する
-- /api/soloq/reflections がこの時点では認証チェックを一切行っておらず、
-- 誰でも他人のメンタル評価付き振り返りを読めて、任意のmatchupメモを
-- matchup_sentinel(チャンピオン対面データ)に書き込める状態だった。
--
-- /api/soloq/reflections 側に verifyAdminSession を追加した上で、
-- 39番(agent_prompts)と同じ方針でRLSごと完全に閉じ、service_role
-- (ポータルのAPIルート)経由のみに限定する。
--
-- ※このスクリプトは冪等（何度でも再実行可）。

DROP POLICY IF EXISTS "Allow read soloq_reflections" ON soloq_reflections;
DROP POLICY IF EXISTS "Allow insert soloq_reflections" ON soloq_reflections;
DROP POLICY IF EXISTS "Allow update soloq_reflections" ON soloq_reflections;

REVOKE ALL ON soloq_reflections FROM anon, authenticated;
ALTER TABLE soloq_reflections ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ロールバック（もし何かのAPIが直接anonキーで読み書きしていて壊れた場合）
-- ------------------------------------------------------------
-- CREATE POLICY "Allow read soloq_reflections" ON soloq_reflections FOR SELECT USING (true);
-- CREATE POLICY "Allow insert soloq_reflections" ON soloq_reflections FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow update soloq_reflections" ON soloq_reflections FOR UPDATE USING (true);
-- GRANT ALL ON soloq_reflections TO anon, authenticated;
-- ============================================================
