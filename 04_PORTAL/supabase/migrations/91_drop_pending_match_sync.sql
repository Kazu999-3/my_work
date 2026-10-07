-- 試合結果の Riot 取り込み予約キューの削除（2026-10-07）
--
-- Discord の勝敗ボタン → Bot handleAutoMatchEnd が予約し、Bot の10分おき cron (processPendingMatchSyncs) が
-- /api/riot/match-sync を呼ぶ仕組みだったが、勝敗ボタンを作る処理が Bot の書き直しで無くなっており、
-- 予約は一度も書かれていなかった（0行）。処理側・API とも 2026-10-07 にユーザー判断で削除済み。
-- ジャックポットのペンタキル総取りは 04 の記録画面（penta_kills 入力）→ /api/match/record に移設した。
DROP TABLE IF EXISTS public.pending_match_sync;
