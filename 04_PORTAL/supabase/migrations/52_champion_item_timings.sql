-- ============================================================
-- ジャングル「1周目フルクリア時間」「1コア/2コア購入タイミング」を
-- AI自動トレンド収集（辞典の「最新トレンド取得」ボタン、champion_trend_worker.py）で
-- 取得し保持するための列。秒単位の整数。UI側でmm:ss表示に変換する。
-- ============================================================

ALTER TABLE champion_facts
  ADD COLUMN IF NOT EXISTS full_clear_time_sec INTEGER;

ALTER TABLE champion_facts
  ADD COLUMN IF NOT EXISTS first_core_timing_sec INTEGER;

ALTER TABLE champion_facts
  ADD COLUMN IF NOT EXISTS second_core_timing_sec INTEGER;
