// ============================================================
// Supabase マイグレーション自動適用スクリプト
//
// 04_PORTAL/supabase/migrations/*.sql を番号順に適用する。適用済みは _migrations
// テーブルに記録し、次回はスキップする。既に存在する(=適用済み)オブジェクトによる
// 「already exists」系エラーは「適用済み」とみなして記録し、処理を続行する。
// これにより、手動で先に適用済みのマイグレーションが混ざっていても安全に動く。
//
// 使い方: DATABASE_URL 環境変数(Supabaseの接続文字列)を設定して実行。
//   node scripts/migrate.mjs
// ============================================================
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = join(process.cwd(), '04_PORTAL', 'supabase', 'migrations');
const url = process.env.DATABASE_URL;
if (!url) { console.error('❌ DATABASE_URL が未設定です。'); process.exit(1); }

// 「既に存在する」系のエラーコード（適用済みとみなす）
const ALREADY_EXISTS = new Set([
  '42P07', // duplicate_table
  '42710', // duplicate_object (policy等)
  '42701', // duplicate_column
  '42P06', // duplicate_schema
  '42P16', // invalid_table_definition (稀)
  '23505', // unique_violation (シード再投入等)
  '42723', // duplicate_function
]);

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  await client.query('CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())');
  const done = new Set((await client.query('SELECT name FROM _migrations')).rows.map(r => r.name));

  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  let applied = 0, skipped = 0, marked = 0;

  for (const file of files) {
    if (done.has(file)) { skipped++; continue; }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations(name) VALUES($1) ON CONFLICT DO NOTHING', [file]);
      await client.query('COMMIT');
      console.log(`✅ 適用: ${file}`);
      applied++;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      if (ALREADY_EXISTS.has(e.code)) {
        // 既に適用済みとみなして記録し、続行
        await client.query('INSERT INTO _migrations(name) VALUES($1) ON CONFLICT DO NOTHING', [file]);
        console.log(`↷ 適用済みとして記録: ${file} (${e.code})`);
        marked++;
      } else {
        console.error(`❌ 失敗: ${file}\n   ${e.code || ''} ${e.message}`);
        await client.end().catch(() => {});
        process.exit(1);
      }
    }
  }

  console.log(`\n完了: 新規適用 ${applied} / 適用済み記録 ${marked} / スキップ ${skipped}`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
