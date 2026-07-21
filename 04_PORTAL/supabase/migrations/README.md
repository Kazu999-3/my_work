# マイグレーションの取り扱い

`scripts/migrate.mjs` が、このフォルダの `*.sql` を**ファイル名の昇順**で適用する。
適用済みかどうかは `_migrations` テーブルに記録した**ファイル名**で判定している。

## 絶対にやってはいけないこと

### 適用済みファイルのリネーム

ファイル名がキーなので、リネームすると**未適用と判定されて再実行される**。

たとえば `24_add_participant_mmr.sql` は先頭で

```sql
ALTER TABLE public.balancer_predictions DROP COLUMN IF EXISTS match_id;
```

を実行するため、再実行すると**列ごとデータが消える**。

### 適用済みファイルの中身の変更

同じく再実行されないので、変更しても反映されない。
修正が必要なら**新しい番号のファイルを追加**すること。

## 既知の状態（2026-07-21）

- **番号24が重複している**（`24_add_participant_mmr.sql` と `24_initial_prefs.sql`）。
  ファイル名で管理しているため実害はない。**上記の理由からリネームせず、このまま残す。**
- **28番は欠番**。「上達の原則」をレーンガイドへ統合した際に削除した跡。

## 新しいマイグレーションを書くとき

再実行されても壊れないように書いておくと、途中で失敗したときに復旧しやすい。

```sql
CREATE TABLE IF NOT EXISTS ...
ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
CREATE INDEX IF NOT EXISTS ...

-- ポリシーは CREATE POLICY IF NOT EXISTS が使えないので、DROPしてから作る
DROP POLICY IF EXISTS "xxx select" ON xxx;
CREATE POLICY "xxx select" ON xxx FOR SELECT USING (true);
```

`migrate.mjs` は「既に存在する」系のエラー（`42P07` / `42710` / `42701`）だけは
適用済みとみなして続行するが、それ以外のエラーが出ると**そこで停止する**。
