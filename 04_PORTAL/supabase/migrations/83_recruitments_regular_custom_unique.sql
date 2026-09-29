-- Migration 83: 定期カスタムの二重投稿・TOCTOU防止のための部分ユニークインデックス
--
-- 【背景・理由】
-- Cloudflare Workers の cron（水曜12:00 JST）および GitHub Actions バックアップにおいて、
-- 同時に発火した場合やリトライ時に、同一日時の「定期カスタム」募集が DB（recruitments）に
-- 2重で INSERT されてしまうリスク（TOCTOU: Check-then-Act）を DB レベルで遮断する。
--
-- 【安全性・非破壊性】
-- 一般メンバーの突発募集（mode: 'ノーマル', 'ARAM', 'カスタム' 等）は、同一日時に別人が
-- 立てる可能性があるため、一律の (mode, start_at) 制約ではなく、
-- mode = '定期カスタム' かつ status != 'deleted' に絞った「部分ユニークインデックス」とする。
-- これにより、通常募集の運用には 100% 影響を与えず、定期カスタムの多重作成のみを確実に防止する。

CREATE UNIQUE INDEX IF NOT EXISTS idx_recruitments_unique_regular_custom
ON recruitments (mode, start_at)
WHERE mode = '定期カスタム' AND status != 'deleted';
