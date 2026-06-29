import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const heartbeatId = '00000000-0000-0000-0000-000000000000';
    
    // 1. ハートビートレコードの取得
    const { data: heartbeat, error: hbError } = await supabase
      .from('edge_tasks')
      .select('*')
      .eq('id', heartbeatId)
      .maybeSingle();

    if (hbError) throw hbError;

    // 2. 現在実行中(running)および待機中(pending)のタスクを取得 (heartbeatを除く)
    const { data: queueTasks, error: qError } = await supabase
      .from('edge_tasks')
      .select('*')
      .neq('id', heartbeatId)
      .in('status', ['running', 'pending'])
      .order('created_at', { ascending: true });

    if (qError) throw qError;

    // 3. 直近で完了・失敗したタスク履歴を取得 (heartbeatを除く)
    const { data: historyTasks, error: hError } = await supabase
      .from('edge_tasks')
      .select('*')
      .neq('id', heartbeatId)
      .in('status', ['completed', 'failed'])
      .order('updated_at', { ascending: false })
      .limit(5);

    if (hError) throw hError;

    let isActive = false;
    let payload: any = {};
    let diffSec = 9999;

    if (heartbeat) {
      const updatedAt = new Date(heartbeat.updated_at);
      const now = new Date();
      diffSec = Math.floor((now.getTime() - updatedAt.getTime()) / 1000);
      isActive = diffSec <= 30; // 30秒以内なら稼働中
      payload = heartbeat.payload || {};
    }

    return NextResponse.json({
      worker: {
        active: isActive,
        status: payload.status || 'idle',
        last_active: heartbeat ? heartbeat.updated_at : null,
        diff_seconds: diffSec
      },
      queue: queueTasks || [],
      history: historyTasks || []
    });

  } catch (err: any) {
    console.error('❌ [System Status API] GET Error:', err);
    return NextResponse.json({ error: `ステータスの取得に失敗しました: ${err.message}` }, { status: 500 });
  }
}
