---
description: エッジワーカーデモンを起動する
---

`wscript.exe "D:\my_work\03_SYSTEMS\start_edge_worker.vbs"` を実行し、エッジワーカーデモンを窓なしでバックグラウンド起動してください（二重起動はロックで防止されるので、既に起動中でも安全です）。

起動後は、ログ `03_SYSTEMS/logs/edge_worker.log` の末尾と、Supabase の `edge_tasks` の id `00000000-0000-0000-0000-000000000005`（ローカル専用ハートビート）の `updated_at` が数秒以内であることを確認して報告してください。停止は `03_SYSTEMS/stop_edge_worker.bat` です。
