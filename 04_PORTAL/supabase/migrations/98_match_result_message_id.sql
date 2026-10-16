-- 2026-10-17: 試合結果の Discord メッセージ ID を試合そのものに持たせる。
-- それまでは balancer_predictions.result_message_id にだけ保存しており、予測行の無い試合
-- （10/17 00:28 の試合など）は結果メッセージを特定できず、試合の編集で名前を直しても
-- Discord の結果メッセージは古いまま（ﾀﾛｽ のまま）残っていた。試合の編集時にここを使って書き換える。
ALTER TABLE public.ktm_matches ADD COLUMN IF NOT EXISTS result_message_id text;

-- 既存分は予測行に残っている ID で埋める
UPDATE public.ktm_matches m
SET result_message_id = bp.result_message_id
FROM public.balancer_predictions bp
WHERE bp.match_id = m.id
  AND bp.result_message_id IS NOT NULL
  AND m.result_message_id IS NULL;

-- 予測行が無かった 10/17 00:28 の試合（チャンネルから特定済み）
UPDATE public.ktm_matches
SET result_message_id = '1560675977808318540'
WHERE id = 'e36436e1-9332-47d2-b8b6-129f07fc2252' AND result_message_id IS NULL;
