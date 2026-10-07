# Supabase Edge Functions（現在は無し）

2026-10-07 時点で、このリポジトリが管理する Edge Function はありません。

- 2026-06 に作った4本（`pulse-patches` / `match-importer` / `stats-collector` / `memory-encoder`）はすべて削除した。
  - `pulse-patches`・`match-importer` は pg_cron から呼ばれていたが、毎回「パッチが見つからない」「取り込み0件」を返していた（migration 94 で定期実行を停止）。
  - `stats-collector`・`memory-encoder` はどこからも呼ばれていなかった。
- DB から外部を定期的に呼ぶ処理は pg_cron ＋ pg_net で行っている（`04_PORTAL/supabase/migrations/93_pg_cron_pollers.sql`）。鍵は Vault に置く。
- 稼働の確認は毎朝の健康診断（`scripts/production_health_report.py` の `check_pg_cron`）が行う。

マイグレーションは `04_PORTAL/supabase/migrations/` にあり、push 時に `.github/workflows/migrate.yml` が自動適用する。
