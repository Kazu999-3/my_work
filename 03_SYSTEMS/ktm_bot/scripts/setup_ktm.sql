-- ==========================================
-- KTM Sovereign OS Database Setup Script
-- Execute this script in Supabase SQL Editor
-- ==========================================

-- 1. プレイヤー管理テーブル (ktm_players)
CREATE TABLE IF NOT EXISTS ktm_players (
    id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamptz DEFAULT now(),
    discord_id text UNIQUE NOT NULL,
    name text NOT NULL,
    ign text,
    mmr int DEFAULT 1000,
    role_preferences jsonb DEFAULT '{"primary": "FILL", "secondary": "FILL"}',
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'
);

-- 2. 試合結果管理テーブル (ktm_matches)
CREATE TABLE IF NOT EXISTS ktm_matches (
    id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamptz DEFAULT now(),
    match_date timestamptz DEFAULT now(),
    team_1 jsonb NOT NULL,
    team_2 jsonb NOT NULL,
    team_1_mmr int,
    team_2_mmr int,
    winner int DEFAULT 0, -- 1: Team 1, 2: Team 2, 0: Undecided
    applied_constraints jsonb DEFAULT '[]',
    metadata jsonb DEFAULT '{}'
);

-- RLS (Row Level Security) の有効化
ALTER TABLE ktm_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE ktm_matches ENABLE ROW LEVEL SECURITY;

-- 全てのユーザー（API経由を含む）に読み取りを許可
CREATE POLICY "Allow read for all" ON ktm_players FOR SELECT USING (true);
CREATE POLICY "Allow read for all" ON ktm_matches FOR SELECT USING (true);

-- 認証済みユーザー（またはservice_role）に書き込み・更新を許可
CREATE POLICY "Allow insert/update for auth" ON ktm_players FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow insert/update for auth" ON ktm_matches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- サービスロール(バックエンド/Workers)の権限は自動的にバイパスされます
