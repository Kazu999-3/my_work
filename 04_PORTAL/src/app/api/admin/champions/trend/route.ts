import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { champion, role } = body;
    
    if (!champion) {
      return NextResponse.json({ success: false, error: 'Missing champion name' }, { status: 400 });
    }

    // edge_tasks にキューを追加
    try {
      const { enqueueEdgeTask } = await import('../../../../../lib/edgeTask');
      const inserted = await enqueueEdgeTask('champion_trend', {
        champion,
        role: role || 'Jungle'
      });
      return NextResponse.json({ 
        success: true, 
        message: '最新トレンド取得タスクをキューに追加しました。処理開始をお待ちください。',
        task_id: inserted.id
      });
    } catch (insertErr: any) {
      return NextResponse.json({ success: false, error: `キューの追加に失敗しました: ${insertErr.message}` }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
