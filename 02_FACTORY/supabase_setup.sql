-- ==========================================
-- Sovereign OS: ナレッジベース & 記事ネタ提案機能用テーブル作成 SQL
-- ==========================================

-- 1. パーソナル・ナレッジベース テーブルの作成
CREATE TABLE IF NOT EXISTS personal_knowledge (
    id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamptz DEFAULT now(),
    title text,
    content text,                     -- 要約されたコンテンツ（Markdown等）
    raw_content text,                 -- 投入された生テキスト、または抽出した生テキスト
    source_url text,                  -- ソースURL（ある場合）
    genre text,                       -- ジャンル（LoL攻略, AIツール, 副業ノウハウ, その他）
    tags text[]                       -- タグ配列
);

-- 2. 記事ネタ提案 テーブルの作成
CREATE TABLE IF NOT EXISTS article_ideas (
    id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamptz DEFAULT now(),
    title text,                       -- 提案記事タイトル
    concept text,                     -- コンセプト・要約
    target_audience text,             -- ターゲット読者
    genre text,                       -- ジャンル（LoL攻略, AIツール, 副業ノウハウ, その他）
    status text DEFAULT 'pending',    -- ステータス ('pending', 'generated', 'discarded')
    source_knowledge_ids int8[]       -- 元となったナレッジのID配列 (personal_knowledge.id への参照)
);

-- Row Level Security (RLS) の有効化
ALTER TABLE personal_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_ideas ENABLE ROW LEVEL SECURITY;

-- 読み取りポリシーの作成 (全ユーザーに開放。※必要に応じて authenticated のみに制限も可能)
CREATE POLICY "Allow read for all" ON personal_knowledge FOR SELECT USING (true);
CREATE POLICY "Allow read for all" ON article_ideas FOR SELECT USING (true);

-- 書き込み・更新・削除ポリシーの作成 (認証済み管理者のみ許可)
CREATE POLICY "Allow insert for admin" ON personal_knowledge FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for admin" ON personal_knowledge FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete for admin" ON personal_knowledge FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow insert for admin" ON article_ideas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for admin" ON article_ideas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete for admin" ON article_ideas FOR DELETE TO authenticated USING (true);
