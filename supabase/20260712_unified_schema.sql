-- ============================================================
-- Sovereign OS v9.0: Unified Database Schema Migration
-- ============================================================

-- 1. プレイヤーテーブルの拡張 (MMRロール別 ＆ 不満度Pity)
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS mmr_top int DEFAULT 1000;
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS mmr_jg int DEFAULT 1000;
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS mmr_mid int DEFAULT 1000;
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS mmr_adc int DEFAULT 1000;
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS mmr_sup int DEFAULT 1000;
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS spectator_pity int DEFAULT 0;
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS off_pity int DEFAULT 0;

-- 2. YouTube タスク管理用テーブル (GAS Playlist 依存の排除)
CREATE TABLE IF NOT EXISTS youtube_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    video_url text UNIQUE,
    video_id text,
    title text,
    status text DEFAULT 'todo', -- 'todo', 'processing', 'done', 'failed'
    playlist_item_id text,
    error_log text
);

-- 3. 自律型イベント駆動タスクキュー用テーブル
CREATE TABLE IF NOT EXISTS sovereign_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    task_type text NOT NULL, -- 'youtube_absorber', 'monetize_loop', 'pulse', 'match_import'
    status text DEFAULT 'todo', -- 'todo', 'running', 'completed', 'failed'
    payload jsonb,
    error_message text
);

-- 4. 自己進化 ADO ループ用のベクトルナレッジメモリテーブル (pgvector)
-- ※ pgvector 拡張が有効化されていない場合は有効化する
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS evolved_insights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    champion text DEFAULT 'GLOBAL',
    insight_text text NOT NULL,
    embedding vector(1536), -- Gemini / OpenAI の標準次元数 1536 に対応
    source_cvr float8,
    source_pv int8
);

-- 5. Supabase Realtime (Websocket) 対象テーブルへの追加
-- ※ 既存のパブリケーションに追加
BEGIN;
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE sovereign_tasks;
    END IF;
  END $$;
COMMIT;
