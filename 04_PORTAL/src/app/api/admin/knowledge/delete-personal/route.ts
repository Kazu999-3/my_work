import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

export async function DELETE(req: Request) {
  // 他のadmin/knowledge/*ルートと異なり認証チェックが無く、idさえ分かれば誰でも
  // personal_knowledgeの任意レコードを削除できる状態だった(2026-08-13の監査#28で発覚)。
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id が指定されていません。' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('personal_knowledge')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '内部エラー' }, { status: 500 });
  }
}
