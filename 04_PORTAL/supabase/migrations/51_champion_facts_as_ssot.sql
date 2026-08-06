-- ============================================================
-- champion_facts を辞典の Single Source of Truth (SSOT) に昇格
--
-- 背景: matchup_sentinel (GLOBAL行) / champion_facts / champion_notes の
-- 3テーブルにデータが分散し「どれが正か」が不明だった問題を解消する。
-- champion_facts を正本とし、信頼度・自動更新履歴・根拠を追跡可能にする。
--
-- 既存カラム (15_champion_structured + 16_champion_facts_review):
--   champion(PK), strengths, weaknesses, power_spikes, build_runes,
--   full_clear_time, strategy, counter_champions, must_ban_champions,
--   pick_recommendation, note_draft, jg_type, jg_description,
--   jg_blind_pickable, jg_counter_pickable, patch, source, updated_at,
--   archived, reviewed_at, review_patch
--
-- 今回追加するカラム:
-- ============================================================

-- 情報の信頼度を機械的に管理するカラム
-- 'verified': 人間が確認済み, 'ai_generated': AI自動更新のみ, 'stale': パッチ遅れ
ALTER TABLE champion_facts
  ADD COLUMN IF NOT EXISTS confidence TEXT NOT NULL DEFAULT 'ai_generated';

-- 人間が最後に確認した日時（reviewed_atと統合も可能だが、
-- reviewed_atは鮮度レビュー用のため意味が異なる。verified=人間がOKした、
-- reviewed=LLMが「まだ有効か」を判定した、の違い）
ALTER TABLE champion_facts
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- 確認した人物（将来の複数管理者対応用）
ALTER TABLE champion_facts
  ADD COLUMN IF NOT EXISTS last_verified_by TEXT;

-- AIの自動更新が最後に走った日時
ALTER TABLE champion_facts
  ADD COLUMN IF NOT EXISTS auto_updated_at TIMESTAMPTZ;

-- 情報の根拠（例: 「パッチ15.14ノート + OP.GG統計 2026-08-05」）
ALTER TABLE champion_facts
  ADD COLUMN IF NOT EXISTS source_summary TEXT;

-- 任意の追加フィールド（拡張性確保。matchup_sentinel.raw_dataのcustomFieldsの移行先）
ALTER TABLE champion_facts
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- パッチメタ情報（raw_data.patch_metaの移行先。直近パッチでの変更内容）
ALTER TABLE champion_facts
  ADD COLUMN IF NOT EXISTS patch_meta JSONB;

-- プロビルド情報（raw_data.pro_buildsの移行先）
ALTER TABLE champion_facts
  ADD COLUMN IF NOT EXISTS pro_builds JSONB DEFAULT '[]'::jsonb;

-- matchup_sentinel GLOBAL行からの移行済みフラグ（二重参照防止用）
ALTER TABLE champion_facts
  ADD COLUMN IF NOT EXISTS migrated_from_sentinel BOOLEAN NOT NULL DEFAULT false;
