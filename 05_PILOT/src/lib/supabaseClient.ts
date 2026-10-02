import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseServiceKey = serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 管理者キーが無いと公開キーへ切り替わるが、youtube_queue / edge_tasks / matchup_sentinel 等は
// 公開キーでは読み書きできない。2026-10-02、Vercel(ktm-pilot)に管理者キーが無いまま運用されており、
// 本番だけ「permission denied」で辞典統合・YouTube管理が動かなかった。黙って切り替えず必ずログに出す。
if (!serviceRoleKey && process.env.NODE_ENV === 'production') {
  console.error('[supabaseClient] SUPABASE_SERVICE_ROLE_KEY が未設定のため公開キーで接続しています。書き込みや非公開テーブルの読み取りは失敗します。');
}

export const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;
