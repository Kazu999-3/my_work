-- ============================================================
-- ソロQ LP推移のスナップショット (課題: シーズン目標トラッカー)
--
-- 目標ランクまでの到達予測日・必要ペースを出すには、LPの時系列が必要。
-- コーチの「試合前」分析でランクを取得するたびに、その日のLPを1日1件スナップショット
-- （puuid + 日付でユニーク、同日は最新値で上書き）として貯める。
--
-- abs_lp は「絶対LP」= ティア/ディビジョンを跨いで単調増加する数値に正規化したもの
-- （IRON IV 0LP = 0 / GOLD IV 0LP = 1200 / DIAMOND I 0LP = 2700 …）。傾き計算に使う。
-- ============================================================

CREATE TABLE IF NOT EXISTS soloq_lp_history (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  puuid         TEXT NOT NULL,
  tier          TEXT,
  division      TEXT,
  lp            INT,
  abs_lp        INT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Tokyo')::date,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (puuid, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_soloq_lp_history_puuid_date
  ON soloq_lp_history (puuid, snapshot_date DESC);

ALTER TABLE soloq_lp_history ENABLE ROW LEVEL SECURITY;

-- 読み取りは許可（本人の推移表示）。書き込みはサーバー側(サービスロール)から。
CREATE POLICY "soloq_lp_history select" ON soloq_lp_history FOR SELECT USING (true);
