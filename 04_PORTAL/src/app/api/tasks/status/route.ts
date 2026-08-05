import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// edge_tasks の状態を1件だけ返す汎用ポーリングAPI。
// champions/tabs/DictionaryTab.tsx, coach/FiveVFiveSimTab.tsx が
// ブラウザから直接 edge_tasks をポーリングしていたのをここに集約する。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // 呼び出し元は全て管理者ログイン必須のページ配下(admin/youtube, coach, champions)だが、
  // このAPI自体には認証チェックが無く、idさえ分かれば内部処理結果・エラーメッセージを
  // 誰でも読めていた(2026-08-05発覚)。
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
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
