-- ============================================================
-- チャンピオン辞典の構造化 (課題#29 / 段階1: 新テーブル追加)
--
-- 既存の matchup_sentinel は「立ち回り+マージ記事のMarkdownを strategy に継ぎ足し、
-- 強み/弱み等は raw_data のJSON」という混在構造だった。これを:
--   champion_facts … 型付きの辞典本体（1チャンピオン1行）
--   champion_notes … 記事/メモの実体（1本1行。マージの継ぎ足しを廃止）
-- に分離する。段階1では新テーブルを追加するだけで、既存の表示・書き込みは一切変えない
-- （バックフィルは /api/admin/dict-migrate で別途実行）。
-- ============================================================

-- A. 型付きの辞典本体
CREATE TABLE IF NOT EXISTS champion_facts (
  champion            TEXT PRIMARY KEY,
  strengths           TEXT,
  weaknesses          TEXT,
  power_spikes        TEXT,
  build_runes         TEXT,
  full_clear_time     TEXT,
  strategy            TEXT,
  counter_champions   TEXT,
  must_ban_champions  TEXT,
  pick_recommendation TEXT,
  note_draft          TEXT,
  -- ジャングルスタイル（既存 raw_data.jg_style を展開）
  jg_type             TEXT,
  jg_description      TEXT,
  jg_blind_pickable   INT,
  jg_counter_pickable INT,
  patch               TEXT,
  source              TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B. 記事/メモの実体（マージの継ぎ足しを置き換える）
CREATE TABLE IF NOT EXISTS champion_notes (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  champion          TEXT NOT NULL,
  enemy             TEXT,           -- 対面別メモならセット（GLOBAL相当はNULL）
  source_article_id BIGINT,         -- personal_knowledge への参照（あれば）
  title             TEXT,
  body              TEXT,
  patch             TEXT,
  -- 出典種別: 'article'(攻略記事) / 'matchup'(対面メモ) / 'note_draft' / 'custom_field' / 'manual'
  source            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_champion_notes_champion ON champion_notes (champion);
CREATE INDEX IF NOT EXISTS idx_champion_notes_enemy ON champion_notes (champion, enemy);

ALTER TABLE champion_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE champion_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "champion_facts select" ON champion_facts FOR SELECT USING (true);
CREATE POLICY "champion_notes select" ON champion_notes FOR SELECT USING (true);
-- 書き込みはサーバー側(サービスロール)から。
