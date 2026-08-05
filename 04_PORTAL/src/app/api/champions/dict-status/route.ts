import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// champions/tabs/AiUpdateTab.tsx 用: チャンピオン辞典(matchup_sentinel, enemy=GLOBAL)の
// 構築済み日時と、本文が未着手(pending)かどうかを返す読み取り専用API。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // 辞典は閲覧含め管理者専用(champions/page.tsx)。ページ側は/api/auth/verifyで
  // ガードしているが、このAPI自体には認証チェックが無く直叩きで閲覧できていた
  // (2026-08-05発覚)。
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const [{ data, error }, { data: contentRows, error: contentError }] = await Promise.all([
      supabase.from('matchup_sentinel').select('champion, created_at').eq('enemy', 'GLOBAL'),
      supabase.from('matchup_sentinel').select('champion').eq('enemy', 'GLOBAL').not('strategy', 'is', null).neq('strategy', ''),
    ]);
    if (error) throw error;
    if (contentError) throw contentError;

    const hasContent = new Set((contentRows || []).map((r: any) => r.champion));
    const dates: Record<string, string> = {};
    const pending: Record<string, boolean> = {};
    (data || []).forEach((row: any) => {
      dates[row.champion] = row.created_at;
      pending[row.champion] = !hasContent.has(row.champion);
    });

    return NextResponse.json({ dates, pending });
  } catch (err: any) {
    console.error('[champions/dict-status] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
