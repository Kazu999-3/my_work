-- junglepedia.lolのフルクリア実測値は平均(avgClearMs)ではなく最速(fastestClearMs)を
-- 使ってほしいというユーザー要望(2026-08-15)。列名が"avg"のままだと将来的な誤解の
-- もとになるため、列自体をリネームする(このカラムは直前のmigration 70で追加した
-- ばかりで他に依存箇所が無いため、リネームで問題ない)。
--
-- 【2026-09-22 冪等化】
-- 当初は素の `alter table ... rename column` だったため、**既に適用済みの環境で
-- 再実行すると 42703 (column does not exist) で落ちて migrate.mjs 全体が停止していた**。
-- 実際 _migrations の記録が70番までしか無い状態でスクリプトを流したところ、
-- ここで止まって74・75・80へ到達できなかった。
-- 42703 は migrate.mjs が「適用済み」とみなすエラーコード
-- (42P07/42710/42701 等) に含まれないため、握りつぶされず停止する。
-- 旧列が残っているときだけリネームするよう条件を付けた。

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'champion_jungle_timing_agg'
      AND column_name = 'external_avg_clear_sec'
  ) THEN
    ALTER TABLE champion_jungle_timing_agg
      RENAME COLUMN external_avg_clear_sec TO external_fastest_clear_sec;
  END IF;
END $$;
