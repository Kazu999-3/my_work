-- 手動対応不可としてクローズした動画用のステータスを追加する。
-- 以前は「クローズ」時にyoutube_queueの行を削除していたが、それだと重複チェック
-- (id一致での既存判定)が効かなくなり、チャンネル/プレイリスト監視が再度この動画を
-- 発見した際にまたpendingとしてキューに戻ってきてしまう。行は残し、ステータスだけ
-- 変えることで「既に検討済みで対応不可と判断した」記録を残す。
ALTER TABLE youtube_queue DROP CONSTRAINT IF EXISTS youtube_queue_status_check;
ALTER TABLE youtube_queue ADD CONSTRAINT youtube_queue_status_check
  CHECK (status IN ('pending', 'completed', 'error_generation', 'error_no_transcript', 'failed', 'on_hold', 'manually_closed'));
