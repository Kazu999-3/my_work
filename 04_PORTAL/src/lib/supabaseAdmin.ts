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

export const supabaseAdmin = (supabaseUrl && serviceKey)
  ? createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    })
  : (null as any);
