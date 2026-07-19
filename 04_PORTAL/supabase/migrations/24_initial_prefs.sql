-- 初期MMR計算に使う希望レーンのスナップショット。
-- 現状は「現在の希望レーン」で初期値を計算するため、希望を変えてRebuildするたびに
-- 過去分の出発点まで変わってしまう。初回Rebuild時の希望を凍結保存し、以後の初期値計算は
-- これを使う（最高ランクは動的なまま＝ランク修正→Rebuildのフローは維持）。
ALTER TABLE ktm_players ADD COLUMN IF NOT EXISTS initial_prefs jsonb;
