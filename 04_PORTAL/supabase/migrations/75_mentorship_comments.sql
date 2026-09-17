-- Migration 75: Mentorship Profile Comments (プチ質問箱・ワンポイント相談掲示板)
-- -----------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mentorship_profile_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES mentorship_profiles(id) ON DELETE CASCADE,
    author_discord_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mentorship_profile_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for mentorship_profile_comments"
    ON mentorship_profile_comments FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated insert for mentorship_profile_comments"
    ON mentorship_profile_comments FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_mentorship_comments_profile ON mentorship_profile_comments(profile_id);
