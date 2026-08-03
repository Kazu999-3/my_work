-- 曜日×時間帯の勝率分析(カレンダー/ヒートマップ表示)機能用。
-- 個人のソロQ試合ごとの開始時刻・勝敗・使用チャンピオンを蓄積する。
-- 既存のcoach_analyses(分析実行時刻のみ)・soloq_reflections(手動入力分のみで網羅性なし)
-- のどちらにも実際の試合開始時刻が保存されていなかったため新設(2026-08-04)。
--
-- 個人用ポータルのため多人数を想定せず、書き込みはservice role(APIルート)経由のみに
-- 限定する(anon/authenticatedへのRLSポリシーは最初から作らない。39/40/43番と同じ方針)。
--
-- ※このスクリプトは冪等（何度でも再実行可）。

CREATE TABLE IF NOT EXISTS soloq_match_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    puuid TEXT NOT NULL,
    match_id TEXT NOT NULL,
    game_start_timestamp TIMESTAMPTZ NOT NULL,
    win BOOLEAN NOT NULL,
    champion TEXT,
    role TEXT,
    kills INT4,
    deaths INT4,
    assists INT4,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (puuid, match_id)
);

CREATE INDEX IF NOT EXISTS idx_soloq_match_history_puuid_time
    ON soloq_match_history (puuid, game_start_timestamp);

ALTER TABLE soloq_match_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON soloq_match_history FROM anon, authenticated;

-- ============================================================
-- ロールバック
-- ------------------------------------------------------------
-- DROP TABLE IF EXISTS soloq_match_history;
-- ============================================================
