# Supabase Edge Functions デプロイマニュアル

このディレクトリ（`supabase/functions`）には、Antigravity Sovereign OS の「完全サーバーレス化（Phase 1）」のためのエッジ関数群が格納されています。
ローカルPCに依存せず、24時間無料でシステムを稼働させるための中核となります。

## 🚀 デプロイ手順

### 1. Supabase CLI のインストールとログイン
まだインストールしていない場合は、公式の案内に従ってインストールしてください（NPM経由など）。
```bash
npx supabase login
```

### 2. 環境変数の設定 (Secrets)
エッジ関数がデータベースやDiscordへアクセスできるように、クラウド上に環境変数を設定します。
```bash
npx supabase secrets set SUPABASE_URL="https://[YOUR_PROJECT_REF].supabase.co"
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY="[YOUR_SERVICE_ROLE_KEY]"
npx supabase secrets set DISCORD_WEBHOOK="[YOUR_DISCORD_WEBHOOK_URL]"
```

### 3. 関数のデプロイ
作成したエッジ関数（例：`pulse-patches`）をデプロイします。
```bash
npx supabase functions deploy pulse-patches --no-verify-jwt
```
※ `--no-verify-jwt` は、Cronトリガーから直接呼び出せるようにするための設定です。

### 4. Cronトリガー（スケジュール）の設定
デプロイ後、Supabaseのダッシュボード（Edge Functions設定画面）または `pg_cron` (Database) を使用して、関数を定期的に呼び出すように設定してください。
- **推奨**: 30分に1回 ( `*/30 * * * *` )
- HTTP GET ではなく **POST** メソッドで呼び出すようにしてください。

---
*Antigravity V4 Architecture - Event-Driven Empire*
