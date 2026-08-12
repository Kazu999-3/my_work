-- ab_test_variations / note_pv_history は、2026-07-26のコミット(1baeeffc)で
-- 削除された収益化パイプライン(記事のA/Bテスト・PV分析デーモン)の書き込み先だった。
-- 該当のPythonスクリプト(_MONETIZE/genetic_optimizer.py,
-- 03_SYSTEMS/v2_CORE/deprecated/note_analytics_daemon.py)は既に削除/deprecated化
-- 済みで、読み書きするコードがどこにも存在しない完全な残骸だったため削除する。
-- 収益化を再実装する際は、新機能としてゼロから設計し直す方針(2026-08-12、
-- ユーザー判断)。
DROP TABLE IF EXISTS ab_test_variations;
DROP TABLE IF EXISTS note_pv_history;
