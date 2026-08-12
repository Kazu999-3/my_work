-- evolved_insightsは元々note記事の成果(CVR/PV)から学ぶ収益化パイプライン専用の
-- ベクトル知識基盤として作られたが、そのパイプライン自体が2026-07-26に削除され、
-- 本番ではテストコード(test_evolution_pgvector.py)しか書き込んでいなかった
-- (現存の3行もTEST_CHAMPのテストデータ)。
--
-- LoL辞典の知識循環用に転用する: dict_known_corrections(人間が確定した訂正)を
-- 埋め込みベクトル化して蓄積し、新しいチャンピオンの辞典生成時に「意味的に近い
-- 過去の訂正事例」を横断検索できるようにする(championKnowledge.tsの既存の
-- champion名完全一致でのdict_known_corrections検索を補完し、別チャンピオンでの
-- 類似の誤りの再発を防ぐのが狙い、2026-08-12)。

-- テストデータを一掃
TRUNCATE TABLE evolved_insights;

-- 収益化専用フィールドを削除し、由来のdict_known_correctionsへの参照を追加
ALTER TABLE evolved_insights DROP COLUMN IF EXISTS source_cvr;
ALTER TABLE evolved_insights DROP COLUMN IF EXISTS source_pv;
ALTER TABLE evolved_insights ADD COLUMN IF NOT EXISTS source_correction_id BIGINT
  REFERENCES dict_known_corrections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_evolved_insights_source_correction
  ON evolved_insights (source_correction_id);
