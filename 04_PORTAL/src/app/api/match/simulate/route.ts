import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { blue, red } = body;
    
    if (!blue || !red || Object.keys(blue).length !== 5 || Object.keys(red).length !== 5) {
      return NextResponse.json({ success: false, error: '味方チーム5名、敵チーム5名のチャンピオンをすべて選択してください。' }, { status: 400 });
    }

    // edge_tasks に 5v5 シミュレーションキューを追加
    const { data: inserted, error: insertErr } = await supabase
      .from('edge_tasks')
      .insert({
        task_type: 'matchup_simulation_5v5',
        payload: {
          blue,
          red
        },
        status: 'pending'
      })
      .select('id')
      .single();

    if (insertErr) {
      return NextResponse.json({ success: false, error: `シミュレーションタスクの登録に失敗しました: ${insertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'AI 5v5構成シミュレーションを開始しました。',
      task_id: inserted.id
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
