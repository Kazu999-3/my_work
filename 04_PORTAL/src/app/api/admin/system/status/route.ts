import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const heartbeatId = '00000000-0000-0000-0000-000000000000';
    
    const { data, error } = await supabase
      .from('edge_tasks')
      .select('*')
      .eq('id', heartbeatId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({
        active: false,
        status: 'unknown',
        last_active: null,
        message: 'No heartbeat record found in DB.'
      });
    }

    const updatedAt = new Date(data.updated_at);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - updatedAt.getTime()) / 1000);

    // 最終アクティブが30秒以内なら稼働中とみなす
    const isActive = diffSec <= 30;

    const payload = data.payload || {};

    return NextResponse.json({
      active: isActive,
      status: payload.status || 'idle',
      current_task_id: payload.current_task_id || null,
      last_active: data.updated_at,
      diff_seconds: diffSec
    });

  } catch (err: any) {
    console.error('❌ [System Status API] GET Error:', err);
    return NextResponse.json({ error: `ステータスの取得に失敗しました: ${err.message}` }, { status: 500 });
  }
}
