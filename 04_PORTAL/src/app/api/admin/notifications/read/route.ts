import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

// 通知を既読にする。{id: number} で1件、{all: true} で全件。
export async function POST(req: NextRequest) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const { id, all } = await req.json().catch(() => ({}));
    let query = supabase.from('admin_notifications').update({ read: true });
    if (all) {
      query = query.eq('read', false);
    } else if (id) {
      query = query.eq('id', id);
    } else {
      return NextResponse.json({ error: 'id または all を指定してください。' }, { status: 400 });
    }
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[admin/notifications/read] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
