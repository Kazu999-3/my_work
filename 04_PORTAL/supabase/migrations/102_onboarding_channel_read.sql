-- 個別案内の「未読」「既読・未返信」と「返信不要」（2026-10-17）
--
-- Discord の既読状態は Bot の API から読めないため、管理画面の「開く」を押した時点の
-- 最新メッセージIDを既読位置として記録する。本人の最新の発言がこれより新しければ未読。
-- 「返信不要」を押すと、その時点の最新メッセージまでは要返信から外す。本人が新しく発言すれば再び要返信になる。

ALTER TABLE public.onboarding_channel_state ADD COLUMN IF NOT EXISTS read_message_id TEXT;
ALTER TABLE public.onboarding_channel_state ADD COLUMN IF NOT EXISTS reply_dismissed_message_id TEXT;
