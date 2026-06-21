-- Sovereign OS v5.0: タスクキュー管理用テーブル定義
-- edge_tasks テーブルの作成

CREATE TABLE IF NOT EXISTS edge_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    task_type text NOT NULL,
    payload jsonb DEFAULT '{}',
    status text DEFAULT 'pending',
    result jsonb DEFAULT '{}',
    error_message text
);

-- RLS (Row Level Security) の有効化
ALTER TABLE edge_tasks ENABLE ROW LEVEL SECURITY;

-- 【ポリシー定義】
-- 1. 全ユーザー（またはAPI利用者）に読み取りを許可
CREATE POLICY "Allow read for all" ON edge_tasks FOR SELECT USING (true);

-- 2. 管理者（authenticated / service_role）のみ挿入、更新、削除を許可
CREATE POLICY "Allow insert for admin" ON edge_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for admin" ON edge_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete for admin" ON edge_tasks FOR DELETE TO authenticated USING (true);
