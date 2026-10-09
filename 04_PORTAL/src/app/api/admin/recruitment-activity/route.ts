import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const action = searchParams.get('action');
    const type = searchParams.get('type');

    let query = supabase
      .from('recruitment_activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (action) {
      query = query.eq('action', action);
    }
    if (type) {
      query = query.eq('recruitment_type', type);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[admin/recruitment-activity] DB error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      activities: data || [],
      count: data?.length || 0,
      generatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[admin/recruitment-activity] Unexpected error:', err);
    return NextResponse.json({ error: err.message || '内部エラー' }, { status: 500 });
  }
}
