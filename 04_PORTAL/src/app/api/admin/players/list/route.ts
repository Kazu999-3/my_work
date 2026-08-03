import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

// ktm-admin/page.tsx（名簿管理画面）専用: ktm_players の全カラムを返す管理者専用読み取りAPI。
// 従来はブラウザから直接anonキーでselect('*')していた（RLSでSELECT自体は公開だが、
// weight/puuid等の管理項目まで含む全カラム取得はUI上のisAdminチェックのみに依存していた）。
// /api/admin/players/save と対になる読み取り版として、認証をサーバー側でも確認する。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from('ktm_players')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ players: data || [] });
  } catch (err: any) {
    console.error('[admin/players/list] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
