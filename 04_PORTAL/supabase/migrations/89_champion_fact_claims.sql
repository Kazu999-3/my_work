-- 辞典の各項目を「1件ずつの記述＋出典」で記録するテーブル（2026-10-07）
--
-- 経緯: champion_facts の強み・弱み等は1列1文章で、ライブラリ（動画・記事）承認時の追記も、
-- 毎週の自動更新（champion_trend_worker）による AI の記憶ベースの文章も同じ列に書かれていた。
-- 自動更新が列を丸ごと上書きしたため、ライブラリ由来の追記が84体・425項目で消え、
-- 出典が分かる記述と出典の無い AI 推定が区別できなくなっていた。
-- 調査レポート: 02_FACTORY/DICT_FACT_AUDIT_20261007.md
--
-- 方針:
--   - 1行 = 1つの記述。どこから来たか(origin)と出典を必ず持つ。
--   - library は記事ID・URL・タイトルのいずれか、web_search は URL が無いと保存できない（CHECK 制約で保証）。
--   - 出典の無い自動生成は origin='ai_estimate' としてだけ保存でき、画面では「AI推定・出典なし」と表示する。
--   - champion_facts の各列は従来どおり残し（参照箇所が多いため）、このテーブルから組み立てた表示用の文章を入れる。
CREATE TABLE IF NOT EXISTS public.champion_fact_claims (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  champion TEXT NOT NULL,             -- champion_facts.champion と同じ表記（DataDragon ID）
  field TEXT NOT NULL CHECK (field IN (
    'strengths', 'weaknesses', 'power_spikes', 'build_runes',
    'counter_champions', 'must_ban_champions', 'pick_recommendation', 'strategy'
  )),
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  origin TEXT NOT NULL CHECK (origin IN (
    'library',        -- ライブラリの動画・記事から追記したもの
    'library_mixed',  -- 記事承認時に AI が既存文と記事を混ぜて書き直したもの（AI の記憶が混ざる可能性あり）
    'web_search',     -- 検索結果を根拠に自動生成したもの
    'manual',         -- 管理画面で人が書いたもの
    'ai_estimate'     -- 出典の無い AI 生成
  )),
  source_article_id BIGINT REFERENCES public.personal_knowledge(id) ON DELETE SET NULL,
  source_url TEXT,
  source_title TEXT,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- 記述が最初に追加された日時（移行分は変更履歴の日時）
  archived_at TIMESTAMPTZ,                         -- 非表示にした日時（物理削除はしない）
  body_hash TEXT GENERATED ALWAYS AS (md5(body)) STORED,
  -- ライブラリ由来は、元記事が完全に削除されていてもタイトルが残っていれば出典として認める（移行分に135件ある）。
  -- web_search は URL 必須。
  CONSTRAINT champion_fact_claims_source_required CHECK (
    origin IN ('manual', 'ai_estimate')
    OR (origin = 'web_search' AND source_url IS NOT NULL)
    OR (origin IN ('library', 'library_mixed')
        AND (source_article_id IS NOT NULL OR source_url IS NOT NULL OR source_title IS NOT NULL))
  ),
  -- 同じ記述の二重登録防止（ON CONFLICT DO NOTHING で使う。部分インデックスにしないこと）
  CONSTRAINT champion_fact_claims_dedup_key UNIQUE (champion, field, body_hash)
);

CREATE INDEX IF NOT EXISTS idx_champion_fact_claims_lookup
  ON public.champion_fact_claims (champion, field, created_at DESC);

-- 04/05 ともサービスロールで読み書きする。公開キーからは読ませない（ポリシーを作らない）
ALTER TABLE public.champion_fact_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.champion_fact_claims FROM anon, authenticated;
