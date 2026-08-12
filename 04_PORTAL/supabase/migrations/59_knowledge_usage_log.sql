-- champion_notes/soloq_reflections/personal_knowledge/evolved_insightsは辞典生成の
-- プロンプトに毎回混ぜ込まれているが、実際にどの知見が採用されたか一切記録して
-- おらず、「記事数」はあっても「再利用率」を測る手段が無かった(note記事群の
-- Knowledge Object成果指標の考え方を参考に、2026-08-12追加)。
CREATE TABLE IF NOT EXISTS knowledge_usage_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_table TEXT NOT NULL,   -- 'champion_notes' | 'soloq_reflections' | 'personal_knowledge' | 'evolved_insights'
  source_id TEXT NOT NULL,
  champion TEXT
);

CREATE INDEX IF NOT EXISTS idx_knowledge_usage_log_source
  ON knowledge_usage_log (source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_usage_log_created
  ON knowledge_usage_log (created_at DESC);

ALTER TABLE knowledge_usage_log ENABLE ROW LEVEL SECURITY;
-- 集計はポータルUIから直接読めるよう公開読み取りにする(利用回数バッジ表示用、
-- 個人情報等の機微データは含まない)。書き込みはPythonバックエンド(service role)専用。
DROP POLICY IF EXISTS "knowledge_usage_log select" ON knowledge_usage_log;
CREATE POLICY "knowledge_usage_log select" ON knowledge_usage_log FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE ON knowledge_usage_log FROM anon, authenticated;
