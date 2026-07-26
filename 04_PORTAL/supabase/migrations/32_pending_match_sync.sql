-- ktm_bot (Cloudflare Workers) の handleAutoMatchEnd は、試合終了後3分待ってから
-- /api/riot/match-sync を叩きリザルトを自動取得する。従来は ctx.waitUntil 内で
-- setTimeout(fn, 180000) するだけだったが、外側の async IIFE は setTimeout を
-- 待たずに即resolveしてしまうため、waitUntilに渡したPromiseはほぼ即座に完了したと
-- みなされる。Cloudflare Workersはそこでインスタンスを回収してよいため、3分後の
-- match-sync呼び出しは実行が保証されない（構造的に運任せだった）。
-- 既存の10分おきcron(sendRecruitmentReminders等と同じ仕組み)で拾える永続キューに変更する。
CREATE TABLE IF NOT EXISTS pending_match_sync (
  id bigserial PRIMARY KEY,
  match_id uuid NOT NULL,
  run_after timestamptz NOT NULL,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_match_sync_due ON pending_match_sync (run_after) WHERE NOT done;

-- ktm_bot はサービスロールキーで直接操作するため anon/authenticated からのアクセスは不要
ALTER TABLE pending_match_sync ENABLE ROW LEVEL SECURITY;
