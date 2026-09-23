-- ポロ・クラッシュの利確判定の記録（2026-09-23）
--
-- 【なぜ必要か】
-- 「画面ではまだ飛んでいるのに、利確を押すと爆発扱いになる」という不具合を
-- 2回連続で読み違えた。crash_sessions には status(pending/settled) しか無く、
-- 「settled だが払い戻しが無い＝却下された」ことは分かっても、**なぜ却下されたのか**
-- （申告倍率が爆発値を超えていたのか、経過時間で切られたのか、サーバーの処理に
-- 何秒かかったのか）が一切残らないため、毎回タイムスタンプから推測するしかなかった。
-- 判定に使った数値をそのまま残し、次は実測で原因を特定できるようにする。
--
-- 追加するだけの変更で、既存の行・処理には影響しない。

ALTER TABLE crash_sessions
  ADD COLUMN IF NOT EXISTS settle_note JSONB;

COMMENT ON COLUMN crash_sessions.settle_note IS
  '利確判定の内訳。claimedMultiplier / crashPoint / elapsedAtRequestSec / marginedMult / handlerMs / verdict を記録する（2026-09-23 追加）';
