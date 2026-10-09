-- 95_recruitment_activity_logs.sql
-- カスタム募集エントリー・辞退履歴監査ログテーブル (2026-10-10 制定)
--
-- 目的:
-- メンバーが気軽にエントリー・辞退できる体験（静かなキャンセル）を保ちつつ、
-- 管理者限定で「誰がいつ参加し、いつ辞退・変更したか」の完全なタイムライン履歴を可視化する。

CREATE TABLE IF NOT EXISTS public.recruitment_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT NOT NULL,
    recruitment_type TEXT NOT NULL, -- 'periodic_sat' | 'periodic_sun' | 'spontaneous'
    channel_id TEXT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL, -- 'JOIN' | 'LEAVE' | 'SWITCH_STYLE' | 'PROXY_ADD'
    style TEXT, -- 'full' | 'single' | 'late' | null
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_recruitment_activity_logs_created_at
    ON public.recruitment_activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recruitment_activity_logs_user_id
    ON public.recruitment_activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_activity_logs_message_id
    ON public.recruitment_activity_logs (message_id);

-- RLS (管理者API / Bot の service_role のみアクセス許可、anon / authenticated は遮断)
ALTER TABLE public.recruitment_activity_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.recruitment_activity_logs FROM anon, authenticated;
