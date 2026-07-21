import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

// 記事の完全削除（移動済み一覧からのみ実行される想定）。
// anon キーでは RLS の DELETE ポリシーが無く弾かれる可能性があるため、
// 管理者セッションを確認したうえでサービスロールで消す。
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { id } = await req.json();
    if (id === undefined || id === null || id === '') {
      return NextResponse.json({ error: 'idが指定されていません' }, { status: 400 });
    }

    const { error } = await supabase.from('personal_knowledge').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
