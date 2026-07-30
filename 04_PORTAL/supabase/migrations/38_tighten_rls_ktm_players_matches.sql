-- セキュリティ監査で発覚: ktm_players が誰でも書き込み放題(ALL/UPDATEポリシーが
-- qual/with_check=trueで無防備)だった。MMRや個人情報を誰でも書き換えられる状態を解消する。
-- 読み取り(リーダーボード等は公開機能のため)は引き続き公開のままにし、書き込みは
-- service role(ポータルのAPIルート経由。04_PORTAL/src/app/api/match/record/route.ts等)
-- のみに限定する。
--
-- ktm_matches / ktm_match_participants も同様に誰でも偽の試合結果をINSERTできた
-- (MMR計算の根拠になるテーブルのため、書き込みは信頼できる経路に限定する必要がある)。
-- 読み取り(戦績閲覧)は引き続き公開のままにする。
--
-- ※このスクリプトは冪等（何度でも再実行可）。

DROP POLICY IF EXISTS "Enable all access for all users" ON ktm_players;
DROP POLICY IF EXISTS "Allow insert/update for auth" ON ktm_players;
DROP POLICY IF EXISTS "ktm_players public update" ON ktm_players;
-- 重複していた読み取りポリシーも1つに整理
DROP POLICY IF EXISTS "ktm_players select" ON ktm_players;
DROP POLICY IF EXISTS "Allow read for all" ON ktm_players;
DROP POLICY IF EXISTS "ktm_players_public_read" ON ktm_players;
CREATE POLICY "ktm_players_public_read" ON ktm_players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON ktm_matches;
DROP POLICY IF EXISTS "Enable insert access for all users" ON ktm_match_participants;

-- ============================================================
-- ロールバック
-- ------------------------------------------------------------
-- CREATE POLICY "Enable all access for all users" ON ktm_players FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Enable insert access for all users" ON ktm_matches FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Enable insert access for all users" ON ktm_match_participants FOR INSERT WITH CHECK (true);
-- ============================================================
