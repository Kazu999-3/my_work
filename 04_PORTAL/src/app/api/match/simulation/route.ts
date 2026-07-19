import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// 5v5シミュレータ結果の保存(POST)・読み込み(GET ?id=)。共有リンク用。
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { blue, red, result } = await req.json();
    if (!blue || !red || !result) {
      return NextResponse.json({ error: 'blue / red / result が必要です。' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('saved_simulations')
      .insert({ blue, red, result })
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, id: data.id });
  } catch (e: any) {
    console.error('[simulation/save] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) {
      // B-04: id無しは保存済み一覧（直近15件・構成のみ＝エグレス配慮でresultは含めない）
      const { data, error } = await supabase
        .from('saved_simulations')
        .select('id, blue, red, created_at')
        .order('created_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      return NextResponse.json({ success: true, list: data || [] });
    }
    const { data, error } = await supabase
      .from('saved_simulations')
      .select('blue, red, result, created_at')
      .eq('id', id)
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, ...data });
  } catch (e: any) {
    console.error('[simulation/load] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
