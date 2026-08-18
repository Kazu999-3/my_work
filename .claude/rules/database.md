# データベース (Supabase) 操作ルール

- `ktm_players` などの PostgreSQL Identity 列（`GENERATED ALWAYS AS IDENTITY`）に主キー ID を指定して insert/upsert しないでください（`cannot insert a non-DEFAULT value into column "id"` エラー防止）。更新時は ID を指定した個別 `update` を使用してください。
- 新しいテーブルをAPIルート経由で公開する際は、RLSを`USING (true)`のまま放置しない（`04_PORTAL/CLAUDE.md`のセキュリティチェックリスト参照）。
