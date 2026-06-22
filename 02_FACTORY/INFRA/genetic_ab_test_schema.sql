-- A/Bテスト用のプロンプト/タイトルバリエーション（遺伝子DNA）管理テーブル
CREATE TABLE IF NOT EXISTS ab_test_variations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type VARCHAR(50) NOT NULL, -- 'note_title', 'x_hook', 'seo_prompt' など
    dna TEXT NOT NULL,              -- プロンプトやタイトル等のテキスト内容
    generation INTEGER NOT NULL DEFAULT 1, -- 世代番号
    fitness DOUBLE PRECISION NOT NULL DEFAULT 0.0, -- 適合度（PV、インプレッション、クリック率等の成果値）
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'active' (現在テスト中), 'dead' (淘汰), 'pending' (次世代候補)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS（行レベルセキュリティ）の設定
ALTER TABLE ab_test_variations ENABLE ROW LEVEL SECURITY;

-- 開発者/システムによるフルアクセスを許可するポリシー（認証済みロール用）
CREATE POLICY "Allow all actions for authenticated users" ON ab_test_variations
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 匿名ユーザーによる読み取りのみ許可（必要に応じて）
CREATE POLICY "Allow read for anon users" ON ab_test_variations
    FOR SELECT
    TO anon
    USING (true);

-- 初期個体（第1世代のプロンプト/タイトル例）のインサート
INSERT INTO ab_test_variations (task_type, dna, generation, fitness, status) VALUES
('note_title', '【パッチ14.X】チャレンジャー直伝ジャングル解説', 1, 1.0, 'active'),
('note_title', '動画を観ずに1秒で記事化！YouTube自動化AI 【完全版ソースコード付き】', 1, 1.0, 'active'),
('x_hook', '30分の解説動画を「一時停止を繰り返しながらメモを取る」のは、もう時間の無駄です。', 1, 1.0, 'active'),
('x_hook', '動画リサーチの時間を10分の1に削る、自律システム「YouTube Absorber」の全貌。', 1, 1.0, 'active');
