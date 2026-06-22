import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '../../../../../lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { champion, role } = body;
    
    if (!champion) {
      return NextResponse.json({ success: false, error: 'Missing champion name' }, { status: 400 });
    }

    // edge_tasks にキューを追加
    const { data: inserted, error: insertErr } = await supabase
      .from('edge_tasks')
      .insert({
        task_type: 'champion_trend',
        payload: {
          champion,
          role: role || 'Jungle'
        },
        status: 'pending'
      })
      .select('id')
      .single();

    if (insertErr) {
      return NextResponse.json({ success: false, error: `キューの追加に失敗しました: ${insertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: '最新トレンド取得タスクをキューに追加しました。処理開始をお待ちください。',
      task_id: inserted.id
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
