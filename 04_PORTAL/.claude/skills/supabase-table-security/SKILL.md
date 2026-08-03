---
name: supabase-table-security
description: Checklist for securing a new Supabase table and its Next.js API routes in 04_PORTAL. Use before or right after writing a new Supabase migration, or when adding/reviewing an API route under 04_PORTAL/src/app/api/** that reads or writes Supabase data.
---

# Supabase テーブル & APIルート セキュリティチェックリスト

このポータルは Supabase Auth を使わず、全ての `/api/**` ルートは `supabaseAdmin`（service_role キー、RLSを素通りする）経由でDBにアクセスする設計。つまり **RLSはService Roleに対しては何の防御にもならず、実際の防御線はAPIルート側の認証チェックだけ**。この前提を忘れて「テーブルを作ってRLSをtrueにしただけ」で終えると、認証なしで誰でも読み書きできる状態になる。

過去に同じ抜け漏れが複数回発生している(migrations 38, 39, 43 参照 — `ktm_players`/`ktm_matches`、`agent_prompts`、`soloq_reflections` の順で同じ問題が見つかって都度締め直した)。

## 新しいテーブルを作るとき

1. マイグレーションでRLSを有効化した上で、原則 **`REVOKE ALL ON <table> FROM anon, authenticated;`** にする（39番のパターン）。
   - 例外: リーダーボードや辞典のように、本当に匿名で読める必要があるデータだけ `FOR SELECT USING (true)` を残す。書き込みポリシー(`INSERT`/`UPDATE`/`ALL`)を `USING (true)` / `WITH CHECK (true)` のまま残さない。
2. `04_PORTAL/supabase/migrations/` に採番したファイルを追加する（`README.md`のルール通り、既存ファイルの中身は変更しない・リネームしない）。
3. Supabase MCPで実際にプロジェクトへ適用し、`pg_policies` を見て意図通りポリシーが消えている/絞られていることを確認する。

## 新しいAPIルートを作るとき

1. 管理者専用の操作（書き込み、個人データの閲覧、外部APIキーを消費する処理）には、他の `/api/admin/**` と同じように `verifyAdminSession(request)` を呼ぶ（`lib/adminAuth.ts` → `lib/adminSession.ts`）。
2. 「ページ側だけログイン必須にして、裏のAPIルートは無認証」という状態にしない。ページのUIガードとAPIの認証は別物 — ページがログイン画面を出していても、URLを直接叩けば素通りする。
3. 本当に公開でよいエンドポイント（検索、公開統計など）は、その旨をコメントで明記して意図的な公開だと分かるようにする。

## レビュー時のクイックチェック

- 新しい `/api/**/route.ts` に `verifyAdminSession` の呼び出しがあるか？ 無いなら、それは意図的に公開なのか確認する。
- 対応するテーブルの `pg_policies` を見て、`qual`/`with_check` が `true` のまま残っていないか確認する。
- サーバー側のAPIキー（Riot API、Gemini等）を消費するルートは、無認証だと第三者のクォータ浪費経路になる。
