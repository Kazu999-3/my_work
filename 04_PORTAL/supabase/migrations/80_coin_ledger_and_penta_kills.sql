-- 80_coin_ledger_and_penta_kills.sql (2026-09-22)
--
-- 目的1: コインの増減を追跡できるようにする
--   これまでコインは ktm_players.coins / role_preferences.coins の「残高スナップショット」
--   しか持っておらず、誰にいつどれだけ発行・消費されたかを一切追えなかった。
--   そのため「供給が多すぎるのか」を実測で判断できず、推測に頼るしかなかった
--   （2026-09-22の監査時点で、総流通量15,407コインに対し月間の発行が
--    試合精算 約23,000 / おみくじ 約15,000 / 破産救済 約2,100 と推定されるが、
--    吸収側が追えないため純増減が確定できなかった）。
--
-- 目的2: ペンタキル数を保存する
--   ジャックポット金庫の「ペンタキルで総取り」はカジノ画面で告知されているが、
--   ①ktm_match_participants に penta_kills 列が存在せず
--   ②判定が /api/match/record（Botがkills/deaths/assistsを0埋めで送る時点）で走り、
--     実データを埋める riot/match-sync は3分後に動く
--   という二重の理由で一度も発火しないデッドコードだった。

-- ============================================================
-- 1. コイン増減の台帳
-- ============================================================
CREATE TABLE IF NOT EXISTS coin_transactions (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id    BIGINT REFERENCES ktm_players(id) ON DELETE SET NULL,
  player_name  TEXT NOT NULL,
  discord_id   TEXT,
  -- 増減額。発行(+)と消費(-)の両方が入る
  delta        INTEGER NOT NULL,
  -- 変動後の残高。スナップショットとの突合に使う
  balance_after INTEGER NOT NULL,
  -- 何による増減か。集計の軸になるので自由記述ではなく決まった語を使うこと
  --   daily_omikuji / rescue_insurance / match_settle / bet_place / bet_payout /
  --   slot / crash / baccarat / shop_purchase / handicap / tip_send / tip_receive /
  --   lottery_prize / jackpot_claim / admin_adjust
  reason       TEXT NOT NULL,
  -- 補足（ベットのオッズ、スロットの倍率など）
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 「直近N日の発行/消費」を reason 別に集計する用途が主なので複合で張る
CREATE INDEX IF NOT EXISTS idx_coin_tx_created_reason ON coin_transactions (created_at DESC, reason);
CREATE INDEX IF NOT EXISTS idx_coin_tx_player ON coin_transactions (player_name, created_at DESC);

COMMENT ON TABLE coin_transactions IS
  'コイン増減の台帳。残高スナップショットだけでは収支を追えなかったため2026-09-22に新設。';

-- RLS: 読み取りは認証済みに限定し、書き込みはサービスロール（APIルート）のみ。
-- USING (true) のまま放置しないこと（04_PORTAL/CLAUDE.md のセキュリティチェックリスト）。
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coin_tx_no_anon_access" ON coin_transactions;
CREATE POLICY "coin_tx_no_anon_access" ON coin_transactions
  FOR SELECT
  TO authenticated
  USING (true);

-- anon ロールにはポリシーを一切与えない＝匿名からは読めない。
-- APIルートは service_role キーで接続するためRLSをバイパスして書き込める。

-- ============================================================
-- 2. ペンタキル数
-- ============================================================
ALTER TABLE ktm_match_participants
  ADD COLUMN IF NOT EXISTS penta_kills SMALLINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN ktm_match_participants.penta_kills IS
  'Riot Match-V5 の participant.pentaKills。riot/match-sync が埋める。ジャックポット総取り判定に使用。';

-- ペンタキル達成者の検索用（該当行はごく少数なので部分インデックス）
CREATE INDEX IF NOT EXISTS idx_participants_penta
  ON ktm_match_participants (match_id)
  WHERE penta_kills > 0;

-- ============================================================
-- 3. ジャックポット二重払い出しの防止
-- ============================================================
-- riot/match-sync は同じ試合に対して複数回呼ばれうる（Botの再同期、手動再実行など）。
-- ペンタキル判定をそこへ移設したため、払い出し済みフラグが無いと
-- 呼ばれるたびに金庫を総取りできてしまう。
ALTER TABLE ktm_matches
  ADD COLUMN IF NOT EXISTS jackpot_claimed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN ktm_matches.jackpot_claimed IS
  'この試合でジャックポット総取りが払い出し済みか。match-syncの再実行による二重払い出しを防ぐ。';

-- 既存の全試合は「払い出し済み扱い」にはしない（FALSE のまま）。
-- ただし penta_kills は今後の試合からしか埋まらないため、過去分が遡って
-- 当選することはない。
