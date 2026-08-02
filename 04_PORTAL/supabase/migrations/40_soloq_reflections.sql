-- Create soloq_reflections table for storing 1-minute post-match reflections
CREATE TABLE IF NOT EXISTS soloq_reflections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    match_id TEXT,
    champion TEXT NOT NULL,
    enemy_champion TEXT,
    win BOOLEAN NOT NULL,
    kda TEXT,
    cs INT4,
    game_duration INT4,
    mental_rating INT2 CHECK (mental_rating >= 1 AND mental_rating <= 5),
    win_lose_reason_tags TEXT[],
    reflection_note TEXT,
    matchup_memo TEXT,
    next_focus_point TEXT
);

-- Enable RLS
ALTER TABLE soloq_reflections ENABLE ROW LEVEL SECURITY;

-- Allow read for anon/authenticated
CREATE POLICY "Allow read soloq_reflections" ON soloq_reflections FOR SELECT USING (true);

-- Allow insert/update for anon/authenticated (controlled by portal)
CREATE POLICY "Allow insert soloq_reflections" ON soloq_reflections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update soloq_reflections" ON soloq_reflections FOR UPDATE USING (true);
