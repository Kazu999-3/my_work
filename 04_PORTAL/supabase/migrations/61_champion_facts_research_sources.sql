-- Geminiのgoogle_searchグラウンディングが返す引用元URLを、これまで
-- champion_trend_worker.pyが毎回捨てていた。matchup_sentinel.raw_dataへの保存は
-- 実装済みなので、SSOT(champion_facts)側にも同じ枠組み(patch_meta/pro_builds等)で
-- 同期できるようカラムを追加する(2026-08-12)。
ALTER TABLE champion_facts ADD COLUMN IF NOT EXISTS research_sources JSONB DEFAULT '[]'::jsonb;
