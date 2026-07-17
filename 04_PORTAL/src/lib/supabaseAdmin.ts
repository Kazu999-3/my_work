import { createClient } from '@supabase/supabase-js';

// ============================================================
// サーバー専用 Supabase クライアント（サービスロールキー使用）
//
// ktm_players 等に RLS を導入したため(migration 12)、サーバーのAPIルートが
// MMR・ランク等の「管理者専用カラム」を書き込むには RLS をバイパスできる
// サービスロールキーが必要。ブラウザ向けの lib/supabaseClient（anonキー）とは
// 用途を分ける。※ このファイルは絶対にクライアントコンポーネントから import しないこと
// （SERVICE_ROLE_KEY が漏れるため）。API Route / Server 専用。
// ============================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

// 安全策: サービスロールキーが未設定のままだと anon キーにフォールバックし、
// ktm_players のRLS導入後に「原因不明で全書き込みが失敗」する事故になる。
// 起動時（モジュール読み込み時）にサーバーログへ明確な警告を出して気付けるようにする。
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
  console.error(
    '[supabaseAdmin] ⚠️ SUPABASE_SERVICE_ROLE_KEY が未設定です。anonキーにフォールバックするため、' +
    'ktm_players のRLS適用後はサーバー側のMMR/ランク/名簿の書き込みがすべて失敗します。' +
    'Vercelの環境変数(Production)に SUPABASE_SERVICE_ROLE_KEY を設定してください。'
  );
}

export const supabaseAdmin = (supabaseUrl && serviceKey)
  ? createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    })
  : (null as any);
