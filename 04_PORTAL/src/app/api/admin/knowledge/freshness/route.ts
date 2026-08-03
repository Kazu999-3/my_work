import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { checkKnowledgeFreshness } from '../../../../../lib/knowledgeFreshness';

export const dynamic = 'force-dynamic';

// ナレッジ関連テーブルの鮮度監視（管理画面のプル型パネル用）。
// 計算ロジックは lib/knowledgeFreshness.ts に共通化し、
// /api/cron/freshness-check (プッシュ型アラート) と共有する。
export async function GET(req: Request) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: 401 });

  try {
    const sources = await checkKnowledgeFreshness(supabase);
    return NextResponse.json({ sources, checkedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('[knowledge/freshness] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
