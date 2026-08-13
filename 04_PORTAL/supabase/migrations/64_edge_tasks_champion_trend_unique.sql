-- チャンピオン辞典のAI更新タスク(edge_tasks, task_type='champion_trend')の重複投入防止。
--
-- dict-health/verify(個別enqueue_update・一括bulk_enqueue_stale)は、既存pendingタスクの
-- 有無をSELECTで確認してからINSERTするcheck-then-insertパターンだったため、同時押しや
-- 複数の起票経路(手動ボタン・auto-refresh cron)が重なるとTOCTOUで同一チャンピオンの
-- タスクが二重投入され、無駄なAI呼び出しが発生し得た(2026-08-13、辞典更新パイプライン
-- 監査#9で発覚)。
--
-- 部分ユニークインデックスで「同一チャンピオンのpending中champion_trendタスクは1件のみ」を
-- DB側で保証する。ON CONFLICTは使わず(部分インデックス+ON CONFLICTの不一致は既知の罠のため)、
-- アプリ側はINSERTが一意制約違反(23505)で失敗した場合を「既に投入済み」として扱う。
CREATE UNIQUE INDEX IF NOT EXISTS idx_edge_tasks_champion_trend_pending
  ON edge_tasks ((payload->>'champion'))
  WHERE task_type = 'champion_trend' AND status = 'pending';
