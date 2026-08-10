---
name: supabase-migration-lint
description: 04_PORTAL/supabase/migrations配下の新規/変更SQLマイグレーションを、このプロジェクトで実際に踏んだPostgres/PostgRESTの罠(部分ユニークインデックス+ON CONFLICTの不一致、Identity列への値指定insert、RLS未設定)に照らして機械的にスキャンするスキル。新しいmigrationファイルを書いた直後、または「upsertがON CONFLICTのエラーで失敗する」「Identity列にinsertできないというエラーが出た」といった報告を受けた時に使うこと。エラーメッセージ自体は原因が分かりにくいため、原因調査に入る前にまずこのスキャンで既知パターンに該当しないか確認する。
---

# Supabase Migration Lint

## 背景

- migration 53(`soloq_reflections_match_id_unique`)は`WHERE match_id IS NOT NULL`の部分ユニークインデックスを作ったが、supabase-jsの`.upsert({onConflict: 'match_id'})`は部分インデックスのWHERE述語まで指定できず、「no unique or exclusion constraint matching the ON CONFLICT specification」で失敗した。migration 54で部分条件なしの通常UNIQUEインデックスに直して解消(NULL同士はPostgreSQLの標準セマンティクスで元々「等しくない」扱いなので、部分条件は不要だった)。
- `ktm_players`等のIdentity列(`GENERATED ALWAYS AS IDENTITY`)にIDを明示してinsert/upsertすると`cannot insert a non-DEFAULT value into column "id"`で失敗する(CLAUDE.md §3④に既存ルールあり)。

## 使い方

```bash
# 新しいmigrationファイルを書いた直後(推奨)
python .claude/skills/supabase-migration-lint/scripts/check_migration_safety.py 04_PORTAL/supabase/migrations/56_xxx.sql

# 引数無し: 既存の全マイグレーションを一括監査
python .claude/skills/supabase-migration-lint/scripts/check_migration_safety.py
```

## 結果の読み方(誤検知に注意)

- **⚠️ 部分ユニークインデックス**: `ON CONFLICT`のターゲットとして使う予定が無い(単なる整合性制約としてのインデックス)なら無視してよい。`.upsert()`/`INSERT ... ON CONFLICT`と組み合わせる予定がある場合のみ要対応。
- **⚠️ Identity列**: 単純な検出のため、そのテーブルへのinsert/upsertコード側で実際にIDを明示しているかまでは追わない。既存の大半のテーブルはこのパターンに該当してもアプリ側が正しくID省略しているため無害。**新しいinsert/upsertコードを書く時にだけ**、そのテーブルがこのリストに出ていないか確認する使い方が実用的。
- **ℹ️ RLS未設定**: 別のmigrationファイルで後から有効化しているだけの場合が多く、単体では偽陽性になりやすい。新規テーブルを公開する時は`supabase-table-security`スキルの方を正として使うこと(このチェックは「見落としていないか」の一次スクリーニングに過ぎない)。
- 引数無しの全件監査は特に「Identity列」がほぼ全テーブルでヒットしノイズが多い。日常的には**変更したファイルだけを指定して**実行するのが実用的な使い方。
