-- migration 53で作成した部分ユニークインデックス(WHERE match_id IS NOT NULL)は、
-- PostgreSQLのON CONFLICT推論が部分インデックスをそのままでは使えないため、
-- reflections/route.tsのupsert(..., {onConflict: 'match_id'})が
-- 「there is no unique or exclusion constraint matching the ON CONFLICT specification」
-- で失敗していた(2026-08-10発覚)。
-- PostgreSQLの標準UNIQUE制約はNULL同士を「等しくない」とみなし複数NULLを許容するため、
-- そもそも部分インデックス(WHERE match_id IS NOT NULL)にする必要がなかった。
-- 通常の(部分条件なしの)UNIQUEインデックスへ置き換える。
DROP INDEX IF EXISTS soloq_reflections_match_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS soloq_reflections_match_id_unique
  ON soloq_reflections (match_id);
