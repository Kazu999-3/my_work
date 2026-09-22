#!/usr/bin/env node
/**
 * DATABASE_URL の疎通確認 ＆ パスワード解釈の切り分け
 *
 *   実行: node scripts/check_db_connection.mjs
 *        （事前に DATABASE_URL を設定しておくこと）
 *
 * migrate.mjs が `password authentication failed for user "postgres"` (28P01) で
 * 失敗したときに、原因が「パスワードそのものが違う」のか
 * 「percent-encode の有無が食い違っている」のかを切り分けるために作った（2026-09-22）。
 *
 * Supabaseの接続文字列は「パスワードに記号が含まれるなら percent-encode せよ」と案内するが、
 * migrate.mjs のパーサは記号をそのまま扱う（URL標準パーサを使わず最後の@で分割している）。
 * そのため **percent-encode して貼るとエンコード後の文字列がそのまま送られて失敗する**。
 * ここでは「生のまま」と「percent-decodeしたもの」の両方を試し、どちらが通るかを報告する。
 *
 * ⚠️ パスワードは一切表示しない。長さと文字種だけを出す。
 */
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('❌ DATABASE_URL が未設定です。');
  console.error('   PowerShell: $env:DATABASE_URL = \'postgresql://...\'   ← 必ずシングルクォート');
  process.exit(1);
}

/** migrate.mjs と同じ分解ロジック（記号入りパスワードに耐える） */
function parsePgUrl(raw) {
  const s = raw.trim().replace(/^postgres(?:ql)?:\/\//, '');
  const at = s.lastIndexOf('@');
  if (at < 0) throw new Error('接続文字列に @ が見つかりません。');
  const creds = s.slice(0, at);
  const hostPart = s.slice(at + 1);
  const ci = creds.indexOf(':');
  const user = ci >= 0 ? creds.slice(0, ci) : creds;
  const password = ci >= 0 ? creds.slice(ci + 1) : '';
  const slash = hostPart.indexOf('/');
  const hostPort = slash >= 0 ? hostPart.slice(0, slash) : hostPart;
  let database = slash >= 0 ? hostPart.slice(slash + 1) : 'postgres';
  const q = database.indexOf('?');
  if (q >= 0) database = database.slice(0, q);
  const colon = hostPort.lastIndexOf(':');
  const host = colon >= 0 ? hostPort.slice(0, colon) : hostPort;
  const port = colon >= 0 ? parseInt(hostPort.slice(colon + 1), 10) : 5432;
  return { user, password, host, port, database };
}

const cfg = parsePgUrl(url);

console.log('接続先');
console.log(`  host     : ${cfg.host}`);
console.log(`  port     : ${cfg.port}${cfg.port === 6543 ? ' (Transaction pooler)' : ''}`);
console.log(`  database : ${cfg.database}`);
console.log(`  user     : ${cfg.user}`);
if (!cfg.user.includes('.')) {
  console.log('  ⚠️ poolerを使う場合、userは "postgres.<プロジェクトref>" の形である必要があります。');
}

const looksEncoded = /%[0-9A-Fa-f]{2}/.test(cfg.password);
console.log('\nパスワード（値は表示しません）');
console.log(`  長さ            : ${cfg.password.length}`);
console.log(`  記号を含む      : ${/[^A-Za-z0-9]/.test(cfg.password)}`);
console.log(`  %XX 形式を含む  : ${looksEncoded}${looksEncoded ? '  ← percent-encode済みの可能性' : ''}`);

/** 与えられたパスワードで1回だけ接続を試す */
async function tryConnect(label, password) {
  const client = new pg.Client({ ...cfg, password, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const r = await client.query('select current_user, current_database()');
    await client.end();
    console.log(`  ✅ ${label}: 成功 (current_user=${r.rows[0].current_user})`);
    return true;
  } catch (e) {
    await client.end().catch(() => {});
    console.log(`  ❌ ${label}: ${e.code || ''} ${e.message}`);
    return false;
  }
}

console.log('\n接続テスト');
const rawOk = await tryConnect('そのまま送信', cfg.password);

let decodedOk = false;
if (!rawOk && looksEncoded) {
  let decoded = null;
  try {
    decoded = decodeURIComponent(cfg.password);
  } catch {
    console.log('  ⚠️ percent-decode に失敗しました（不正なエスケープ）。');
  }
  if (decoded && decoded !== cfg.password) {
    decodedOk = await tryConnect('percent-decodeして送信', decoded);
  }
}

console.log('');
if (rawOk) {
  console.log('✅ そのままで通ります。node scripts/migrate.mjs を実行してください。');
} else if (decodedOk) {
  console.log('✅ percent-decode した値なら通りました。');
  console.log('   → 接続文字列のパスワード部分を「エンコードしていない生の値」に差し替えてください。');
  console.log('     migrate.mjs のパーサは記号をそのまま扱うため、エンコードは不要です。');
} else {
  console.log('❌ どちらでも通りませんでした。パスワード自体が違う可能性が高いです。');
  console.log('   Supabase の Database 設定 → 「Reset database password」で');
  console.log('   英数字のみのパスワードへ再発行するのが最も確実です。');
  console.log('   （他のキー: SUPABASE_SERVICE_ROLE_KEY 等には影響しません）');
  process.exitCode = 1;
}
