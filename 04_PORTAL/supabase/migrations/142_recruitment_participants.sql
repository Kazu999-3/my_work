-- 142_recruitment_participants.sql
-- 募集台帳のDB化（フェーズ1：週末定期カスタム）
-- 目的: Discord メッセージ本文（Embed）に依存していた参加者名簿を DB（PostgreSQL）に集約し、
--       アトミックな UPSERT による同時押しの競合耐性・データ保全性を確保する。

-- 1. 参加者子テーブルの新設
CREATE TABLE IF NOT EXISTS public.recruitment_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recruitment_id UUID NOT NULL REFERENCES public.recruitments(id) ON DELETE CASCADE,
    discord_id TEXT NOT NULL,
    user_name TEXT,
    style TEXT NOT NULL DEFAULT 'full' CHECK (style IN ('full', 'single', 'late', 'spectator')),
    lobby TEXT NOT NULL DEFAULT 'low' CHECK (lobby IN ('high', 'low', 'all')),
    primary_lane TEXT,
    secondary_lane TEXT,
    rank_tier TEXT,
    estimated_mmr INT,
    is_cancelled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_recruitment_user UNIQUE (recruitment_id, discord_id)
);

-- 2. パフォーマンスインデックス
CREATE INDEX IF NOT EXISTS idx_participants_recruitment_active
    ON public.recruitment_participants (recruitment_id) WHERE NOT is_cancelled;
CREATE INDEX IF NOT EXISTS idx_participants_user
    ON public.recruitment_participants (discord_id);

-- 3. RLS（Row Level Security）ポリシーの配備
ALTER TABLE public.recruitment_participants ENABLE ROW LEVEL SECURITY;

-- 閲覧: 公開（Portal や管理画面等から閲覧可能）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'recruitment_participants' 
        AND policyname = 'recruitment_participants_select_public'
    ) THEN
        CREATE POLICY "recruitment_participants_select_public"
            ON public.recruitment_participants FOR SELECT
            USING (true);
    END IF;
END $$;

-- 書き込み（INSERT/UPDATE/DELETE）: anon / authenticated からの直接変更は禁止（Bot の service_role のみ許可）
REVOKE INSERT, UPDATE, DELETE ON public.recruitment_participants FROM anon, authenticated;

-- 4. 過去 open レコードの掃除（確定事項1）
-- start_at が 7日以上前の古い open 募集を一括で closed に更新
UPDATE public.recruitments
SET status = 'closed', updated_at = timezone('utc'::text, now())
WHERE status = 'open' AND start_at < (timezone('utc'::text, now()) - interval '7 days');
