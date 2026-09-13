-- Migration 73: Mentorship Hub (師弟自己紹介掲示板 ＆ マッチング)
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mentorship_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id BIGINT REFERENCES ktm_players(id) ON DELETE SET NULL,
    discord_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    role_type TEXT NOT NULL CHECK (role_type IN ('PUPIL', 'MENTOR')), -- PUPIL=弟子(学びたい), MENTOR=師匠(教えたい)
    lanes TEXT[] DEFAULT '{}', -- TOP, JUNGLE, MID, BOT, SUPPORT
    champions TEXT[] DEFAULT '{}', -- 練習中チャンピオン / 指導可能チャンピオン
    current_rank TEXT DEFAULT 'UNRANKED',
    target_rank TEXT, -- 弟子の場合の目標ランク
    tags TEXT[] DEFAULT '{}', -- 悩みタグ or 指導タグ
    bio TEXT, -- 自己紹介・意気込み
    active_hours TEXT, -- 活動時間帯 (例: 平日夜 / 土日)
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'MATCHED', 'PAUSED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mentorship_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_profile_id UUID REFERENCES mentorship_profiles(id) ON DELETE CASCADE,
    pupil_profile_id UUID REFERENCES mentorship_profiles(id) ON DELETE CASCADE,
    mentor_discord_id TEXT NOT NULL,
    pupil_discord_id TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    notes TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- RLS の有効化
ALTER TABLE mentorship_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_matches ENABLE ROW LEVEL SECURITY;

-- 読み取りポリシー: 全員読み取り可能
CREATE POLICY "Allow public read for mentorship_profiles"
    ON mentorship_profiles FOR SELECT
    USING (true);

CREATE POLICY "Allow public read for mentorship_matches"
    ON mentorship_matches FOR SELECT
    USING (true);

-- 書き込みポリシー
CREATE POLICY "Allow all insert/update for mentorship_profiles"
    ON mentorship_profiles FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all insert/update for mentorship_matches"
    ON mentorship_matches FOR ALL
    USING (true)
    WITH CHECK (true);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_mentorship_profiles_role ON mentorship_profiles(role_type, status);
CREATE INDEX IF NOT EXISTS idx_mentorship_profiles_discord ON mentorship_profiles(discord_id);
