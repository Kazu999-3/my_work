-- edge_tasks のインデックス追加（2026-11-09）
--
-- 背景:
--   edge_tasks（約8,000行）に status / created_at / task_type の複合インデックスが存在せず、
--   毎分の常駐ワーカーによるポーリング（status = 'pending'）や週次パージ等で毎回テーブル全体が
--   Seq Scan（全件走査）され、24時間で数千万〜1億行の内部読み出し（tup_returned）が発生していた。
--
-- 対策:
--   頻出クエリパターン（status別のポーリング・パージ・集計）に対応するインデックスを追加し、
--   フルスキャンを根絶してDB負荷を最小化する。

CREATE INDEX IF NOT EXISTS idx_edge_tasks_status_created_at
  ON public.edge_tasks (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_tasks_task_type_status
  ON public.edge_tasks (task_type, status);
