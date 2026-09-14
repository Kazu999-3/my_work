-- Migration 74: Mentorship Reviews & Player Reputations (匿名評価 ＆ 匿名評判制度)
-- -----------------------------------------------------------------------------------

-- 1. 師弟の匿名評価テーブル
CREATE TABLE IF NOT EXISTS mentorship_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES mentorship_matches(id) ON DELETE CASCADE,
    reviewer_discord_id TEXT NOT NULL,
    target_discord_id TEXT NOT NULL,
    target_role_type TEXT NOT NULL CHECK (target_role_type IN ('PUPIL', 'MENTOR')),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    tags TEXT[] DEFAULT '{}',
    feedback_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(match_id, reviewer_discord_id)
);

-- 2. メンバーの匿名評判（Kudos・栄誉）テーブル
CREATE TABLE IF NOT EXISTS player_reputations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_discord_id TEXT NOT NULL,
    target_player_name TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    message TEXT,
    is_report BOOLEAN DEFAULT FALSE,
    date_key TEXT NOT NULL, -- 'YYYY-MM-DD'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sender_discord_id, target_player_name, date_key)
);

-- RLS 設定
ALTER TABLE mentorship_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_reputations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for mentorship_reviews"
    ON mentorship_reviews FOR SELECT
    USING (true);

CREATE POLICY "Allow all insert for mentorship_reviews"
    ON mentorship_reviews FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public read for player_reputations"
    ON player_reputations FOR SELECT
    USING (true);

CREATE POLICY "Allow all insert for player_reputations"
    ON player_reputations FOR ALL
    USING (true)
    WITH CHECK (true);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_mentorship_reviews_target ON mentorship_reviews(target_discord_id, target_role_type);
CREATE INDEX IF NOT EXISTS idx_player_reputations_target ON player_reputations(target_player_name);
