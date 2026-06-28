import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { champion, enemy, role } = body;
    
    if (!champion || !enemy) {
      return NextResponse.json({ success: false, error: 'Missing champion or enemy name' }, { status: 400 });
    }

    // edge_tasks にシミュレーションキューを追加
    const { data: inserted, error: insertErr } = await supabase
      .from('edge_tasks')
      .insert({
        task_type: 'matchup_simulation',
        payload: {
          champion,
          enemy,
          role: role || 'Jungle'
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
      message: 'AI対戦シミュレーターの計算を開始しました。',
      task_id: inserted.id
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
