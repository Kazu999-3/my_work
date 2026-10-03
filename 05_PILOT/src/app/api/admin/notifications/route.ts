import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 });
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

    return NextResponse.json({
      notifications: data || [],
      unreadCount: unreadCount || 0,
    });
  } catch (err: any) {
    console.error('[/api/admin/notifications] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { id, markAllRead } = body;

    if (markAllRead) {
      const { error } = await supabase
        .from('admin_notifications')
        .update({ read: true })
        .eq('read', false);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (id != null) {
      const { error } = await supabase
        .from('admin_notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
  } catch (err: any) {
    console.error('[/api/admin/notifications] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { id, deleteAll } = body;

    if (deleteAll) {
      const { error } = await supabase
        .from('admin_notifications')
        .delete()
        .neq('id', -1);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'All notifications deleted' });
    }

    if (id != null) {
      const { error } = await supabase
        .from('admin_notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
  } catch (err: any) {
    console.error('[/api/admin/notifications] DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
