import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

// 通知を削除する。{id: number} で1件、{allRead: true} で既読全件を削除。
export async function POST(req: NextRequest) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const { id, allRead } = await req.json().catch(() => ({}));
    let query = supabase.from('admin_notifications').delete();

    if (allRead) {
      query = query.eq('read', true);
    } else if (id) {
      query = query.eq('id', id);
    } else {
      return NextResponse.json({ error: 'id または allRead を指定してください。' }, { status: 400 });
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[admin/notifications/delete] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
