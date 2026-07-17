-- ============================================================
-- バランサー予測勝率の記録と的中率検証 (課題: KTM強化)
--
-- チーム分け確定時に「MMR差から算出した青チームの勝率予測」を保存し、
-- 実際の試合結果(ktm_matches)が記録されたら突き合わせて的中/不的中を記録する。
-- これにより「バランサーは本当に公平か（予測が50%付近に寄る＝拮抗しているか、
-- 予測がよく当たる＝MMRが実力を反映しているか）」をデータで検証でき、
-- ペナルティ係数の調整根拠になる。
-- ============================================================

CREATE TABLE IF NOT EXISTS balancer_predictions (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 確定時のチーム構成（名前配列）。試合記録時のロスター照合に使う
  blue_players  JSONB NOT NULL DEFAULT '[]'::jsonb,
  red_players   JSONB NOT NULL DEFAULT '[]'::jsonb,
  blue_avg_mmr  NUMERIC,
  red_avg_mmr   NUMERIC,
  -- 青チームの予測勝率(0.0〜1.0)。Eloロジスティックで算出
  predicted_blue_winprob NUMERIC,
  -- 突き合わせ結果（試合記録時に埋まる）
  match_id      UUID,
  actual_winner TEXT,          -- 'BLUE' | 'RED'
  correct       BOOLEAN        -- 予測が当たったか
);

CREATE INDEX IF NOT EXISTS idx_balancer_predictions_created
  ON balancer_predictions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_balancer_predictions_unmatched
  ON balancer_predictions (created_at DESC) WHERE match_id IS NULL;

ALTER TABLE balancer_predictions ENABLE ROW LEVEL SECURITY;

-- 読み取りは許可（管理者パネルで的中率を表示）。書き込みはサーバー側の
-- サービスロールキー経由のみ（RLSをバイパス）で行う想定。
CREATE POLICY "balancer_predictions select" ON balancer_predictions FOR SELECT USING (true);
