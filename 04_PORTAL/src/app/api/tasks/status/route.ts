import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// edge_tasks の状態を1件だけ返す汎用ポーリングAPI。
// champions/tabs/DictionaryTab.tsx, coach/FiveVFiveSimTab.tsx が
// ブラウザから直接 edge_tasks をポーリングしていたのをここに集約する。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 });

    const { data, error } = await supabase
      .from('edge_tasks')
      .select('status, result, error_message, updated_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({ task: data });
  } catch (err: any) {
    console.error('[tasks/status] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
