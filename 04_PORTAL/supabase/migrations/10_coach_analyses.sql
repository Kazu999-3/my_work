-- ============================================================
-- コーチ分析の構造化ログ (課題: コーチ強化B「分析結果の蓄積とトレンド検出」)
--
-- これまで試合後の振り返りは personal_knowledge に「[Coach振り返り]…」という
-- Markdownテキストとしてのみ保存されており、
--   ・デスがどの時間帯に偏っているか
--   ・どのチャンピオンに繰り返し狩られているか
--   ・CS/Vision が試合ごとに改善しているか
-- といった「試合をまたいだ傾向」を機械的に集計できなかった。
--
-- このテーブルは1試合＝1行の構造化データとして保存し、直近N戦の傾向分析
-- (/api/coach/analyze mode=trends) の集計対象にする。テキストの振り返りは
-- 従来どおり personal_knowledge にも残す（用途がUI表示 vs 集計で異なるため）。
-- ============================================================

CREATE TABLE IF NOT EXISTS coach_analyses (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  puuid         TEXT NOT NULL,
  match_id      TEXT NOT NULL,
  champion      TEXT,
  role          TEXT,
  enemy_champion TEXT,
  win           BOOLEAN,
  kills         INT,
  deaths        INT,
  assists       INT,
  kda_ratio     NUMERIC,
  cs_per_min    NUMERIC,
  vision_per_min NUMERIC,
  -- デス発生イベント: [{ "min": 8, "phase": "序盤", "killer": "Zed" }, ...]
  death_timeline JSONB DEFAULT '[]'::jsonb,
  -- 弱点として自動判定された項目の配列（文字列）
  weaknesses    JSONB DEFAULT '[]'::jsonb,
  -- 「今日の焦点」ループ化(課題C)で使う: この試合で意識した焦点と自己/AI判定
  focus         TEXT,
  focus_achieved BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 同じ試合を二重に保存しないための一意制約（再分析時はupsertで上書き）
  UNIQUE (puuid, match_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_analyses_puuid_created
  ON coach_analyses (puuid, created_at DESC);

ALTER TABLE coach_analyses ENABLE ROW LEVEL SECURITY;

-- 読み取りは許可（ポータルは個人利用のため）。書き込みはサーバー側の
-- サービスロールキー経由のみ（RLSをバイパスする）で行う想定。
CREATE POLICY "coach_analyses select" ON coach_analyses FOR SELECT USING (true);
