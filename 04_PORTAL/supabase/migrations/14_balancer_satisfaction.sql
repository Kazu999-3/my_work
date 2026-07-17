-- ============================================================
-- バランス満足度投票 (課題: 試合後Discordの👍/👎でチーム分け満足度を集計)
--
-- 試合結果メッセージ(Discord)のIDを予測行に保存し、後からbotトークンで
-- 👍/👎のリアクション数をポーリングして満足度として集計する。
-- 予測勝率検証(balancer_predictions)と同じ行に相乗りさせる。
-- ============================================================

ALTER TABLE balancer_predictions ADD COLUMN IF NOT EXISTS result_message_id  TEXT;
ALTER TABLE balancer_predictions ADD COLUMN IF NOT EXISTS result_channel_id  TEXT;
ALTER TABLE balancer_predictions ADD COLUMN IF NOT EXISTS satisfaction_up    INT;
ALTER TABLE balancer_predictions ADD COLUMN IF NOT EXISTS satisfaction_down  INT;
ALTER TABLE balancer_predictions ADD COLUMN IF NOT EXISTS satisfaction_updated_at TIMESTAMPTZ;
