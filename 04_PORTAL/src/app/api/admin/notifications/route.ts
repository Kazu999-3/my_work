import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// 通知ベル用: 履歴一覧と未読件数を返す。ブラウザ通知は見逃すと消えるため、
// ポータル内でも後から一覧を見返せるようにする。
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;

    const { count: unreadCount } = await supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('read', false);

    return NextResponse.json({ notifications: data || [], unreadCount: unreadCount || 0 });
  } catch (err: any) {
    console.error('[admin/notifications] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
