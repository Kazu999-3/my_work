-- edge_tasks の実行元(ローカルEdge Worker Daemon / クラウドGitHub Actions)を区別するための列。
-- 両者は同じ worker_heartbeat 行を奪い合って上書きするため、パイプラインダッシュボードから
-- どちらが処理したのか判別できなかった。タスク完了/失敗時に各ワーカー自身が設定する。
ALTER TABLE edge_tasks ADD COLUMN IF NOT EXISTS executor text;
