-- ============================================================
-- balancer_predictions.match_id の型を uuid へ戻す（2026-09-30）
--
-- 【何が起きていたか】
-- 11_balancer_predictions.sql は `match_id UUID` として正しく定義していたが、
-- 24_add_participant_mmr.sql が
--     「ktm_matches.id との紐付けを確実にするため」というコメントを付けたうえで
--     DROP COLUMN match_id; ADD COLUMN match_id bigint;
-- を実行し、**uuid を bigint に変えてしまった**。ktm_matches.id は uuid のため、
-- 以降 match_id への書き込みはすべて型エラーで失敗していた。
--
-- 失敗はコード側の try/catch と「supabase-js の返す error を見ていない」ことで
-- 黙殺されており、画面上は何も壊れていないように見えていた。実害:
--   1. チーム分け満足度（管理者が記録時に選ぶ good/normal/bad）が一件も保存されない
--      → 45件中4件だけ値があるが、それは2026-07-19までの旧方式（Discordの👍/👎集計）の残骸
--   2. 予測勝率の検証（actual_winner / correct）が一件も記録されない → 45件すべてNULL
--   3. 結果メッセージID（result_message_id / result_channel_id）の紐付けも保存されない
--   4. /api/match/history の `.in('match_id', <uuid[]>)` が成立せず、履歴に予測の的中が出ない
-- なお勝敗予想ベットの精算は balancer_predictions.id を使うため影響を受けていない。
--
-- 【この移行の安全性】
-- 現在 match_id は全45行が NULL（書き込みが一度も成功していないため）。
-- 変換すべき既存データが無いので、DROP して uuid で作り直すのが最も確実。
--
-- 【あわせて復旧するもの】
-- 11_balancer_predictions.sql が作っていた部分インデックス
-- idx_balancer_predictions_unmatched は、24 の DROP COLUMN で列ごと消えたまま
-- 再作成されていなかった（`.is('match_id', null)` の検索が毎回インデックス無し）。
-- ここで作り直す。
-- ============================================================

-- 1. 型を uuid へ戻す（全行NULLのため USING は不要）
ALTER TABLE public.balancer_predictions DROP COLUMN IF EXISTS match_id;
ALTER TABLE public.balancer_predictions ADD COLUMN match_id uuid;

-- 2. 24 で失われた「未突き合わせ予測」用の部分インデックスを復旧
CREATE INDEX IF NOT EXISTS idx_balancer_predictions_unmatched
  ON public.balancer_predictions (created_at DESC) WHERE match_id IS NULL;

-- 3. 試合から予測を引けるようにする（/api/match/history の .in('match_id', ...) 用）
CREATE INDEX IF NOT EXISTS idx_balancer_predictions_match
  ON public.balancer_predictions (match_id) WHERE match_id IS NOT NULL;
