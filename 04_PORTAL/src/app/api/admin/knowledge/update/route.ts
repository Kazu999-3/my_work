import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

// personal_knowledge の汎用更新（保存/アーカイブ/復元 共通）。
// ブラウザ(anon)から直接updateしていた箇所をservice role経由に統一するためのルート。
// 更新可能フィールドをallowlistし、想定外のカラムが書き換わらないようにする。
export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = ['title', 'champion', 'tags', 'content', 'raw_content', 'created_at'] as const;

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { id, updateData } = await req.json();
    if (id === undefined || id === null || id === '' || !updateData || typeof updateData !== 'object') {
      return NextResponse.json({ error: 'id と updateData が必要です' }, { status: 400 });
    }

    const payload: Record<string, any> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in updateData) payload[key] = updateData[key];
    }
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: '更新可能なフィールドがありません' }, { status: 400 });
    }

    const { error } = await supabase.from('personal_knowledge').update(payload).eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
