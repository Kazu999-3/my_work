-- ============================================================
-- ktm_players の書き込み権限を絞る (課題: セキュリティ / RLS)
--
-- 【背景】ktm_players はこれまでRLS未設定で、ブラウザの anon キーから
-- 誰でも全カラム（名前・MMR・weight・discord_id 等）を書き換え・追加・削除できた。
-- URLさえ知っていれば第三者が全員のMMRを破壊したり名簿を消せる状態だった。
--
-- 【方針（ユーザー承認済み）】
--   ・参加(is_active) / 希望レーン(role_preferences) / NGレーン / Pity / 備考 …… 誰でも可
--   ・名前 / IGN / discord_id / MMR各種 / weight / highest_rank …… 管理者のみ
--   ・新規追加 / 削除 …… 管理者のみ
-- 管理者の書き込みは /api/admin/players/save（サービスロール＝RLSバイパス）に集約する。
--
-- ※このスクリプトは冪等（何度でも再実行可）。DROP POLICY IF EXISTS で作り直す。
-- ============================================================

ALTER TABLE ktm_players ENABLE ROW LEVEL SECURITY;

-- 既存の緩いポリシーがあれば掃除
DROP POLICY IF EXISTS "ktm_players select" ON ktm_players;
DROP POLICY IF EXISTS "ktm_players public update" ON ktm_players;

-- 閲覧は全員可（名簿・MMR表示に必要）
CREATE POLICY "ktm_players select" ON ktm_players FOR SELECT USING (true);

-- 行レベルではUPDATEを許可するが、実際に更新できる「列」はGRANTで制限する（下記）。
-- INSERT / DELETE のポリシーは作らない → anon/authenticated からは不可（サービスロールはRLSバイパス）。
CREATE POLICY "ktm_players public update" ON ktm_players FOR UPDATE USING (true) WITH CHECK (true);

-- ---- カラム単位の権限 ----
-- まず anon / authenticated から広い権限を剥がす
REVOKE INSERT, DELETE, UPDATE ON ktm_players FROM anon, authenticated;

-- 非センシティブな実在カラムだけ UPDATE を許可する。
-- ※ is_fixed / is_spectator_fixed はDBカラムではなくフロント側の一時フラグなので含めない。
GRANT UPDATE (
  is_active,
  role_preferences,
  ng_lane_1,
  ng_lane_2,
  allow_higher,
  pity,
  off_role_pity,
  metadata
) ON ktm_players TO anon, authenticated;

-- SELECT は従来どおり全員に必要
GRANT SELECT ON ktm_players TO anon, authenticated;

-- ============================================================
-- ロールバック（もし保存が壊れたら以下を実行して即座に元へ戻す）
-- ------------------------------------------------------------
-- ALTER TABLE ktm_players DISABLE ROW LEVEL SECURITY;
-- GRANT INSERT, UPDATE, DELETE ON ktm_players TO anon, authenticated;
-- DROP POLICY IF EXISTS "ktm_players select" ON ktm_players;
-- DROP POLICY IF EXISTS "ktm_players public update" ON ktm_players;
-- ============================================================
