-- =============================================
-- あんちゃんと私の共同タスクボード テーブル
-- =============================================
CREATE TABLE IF NOT EXISTS collab_tasks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text NOT NULL,
  description text DEFAULT '',
  owner       text NOT NULL DEFAULT 'both' CHECK (owner IN ('anchan', 'user', 'both')),
  status      text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority    text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 更新時刻を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_collab_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collab_tasks_updated_at
  BEFORE UPDATE ON collab_tasks
  FOR EACH ROW EXECUTE FUNCTION update_collab_tasks_updated_at();

-- RLS設定（認証なしの読み取り・書き込みを許可）
ALTER TABLE collab_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "誰でも閲覧可能" ON collab_tasks
  FOR SELECT USING (true);

CREATE POLICY "誰でも追加可能" ON collab_tasks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "誰でも更新可能" ON collab_tasks
  FOR UPDATE USING (true);

CREATE POLICY "誰でも削除可能" ON collab_tasks
  FOR DELETE USING (true);

-- 初期サンプルデータ
INSERT INTO collab_tasks (title, description, owner, status, priority) VALUES
  ('共同タスクボードの設置', 'ポータルダッシュボードにあんちゃんとの共同タスクを管理できるUIを追加', 'anchan', 'done', 'high'),
  ('note記事の収益化プラン策定', 'AIアフェ・ゲーム・副業のハイブリッド収益化戦略を文書化', 'both', 'in_progress', 'high'),
  ('AIアフィリエイトリンク整備', 'affiliate_links.jsonのツール一覧を拡充し、実際のリンクを設定', 'user', 'todo', 'medium'),
  ('YouTube Absorberの安定化', 'API制限エラーの根本解決（1日1本制限の最適化）', 'anchan', 'in_progress', 'high'),
  ('LoL記事の初回投稿', '26.xパッチのジャングルメタ記事をnoteに投稿', 'user', 'todo', 'medium');
