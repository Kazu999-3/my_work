import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { resolveToRosterChampion, getNoChampionMarker } from '../../../../../lib/dictFactCheck';

export const dynamic = 'force-dynamic';

// atomic insight(AIによる知見分解)は分割そのものを人間が確認するまで
// review_status='pending'で保存される(2026-08-15、knowledge/add/route.ts参照)。
// このAPIは/admin/knowledgeの「未承認の分割知見」パネルから、pending中の知見を
// 一覧・承認・却下するために使う。

export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from('personal_knowledge')
      .select('id, title, content, champion, tags, parent_id, created_at')
      .eq('is_atomic', true)
      .eq('review_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    // 親記事のタイトルも一緒に返し、レビュー画面で「どの記事から分割されたか」を分かるようにする
    const parentIds = Array.from(new Set((data || []).map((r: any) => r.parent_id).filter(Boolean)));
    let parentTitles: Record<number, string> = {};
    if (parentIds.length > 0) {
      const { data: parents } = await supabase
        .from('personal_knowledge')
        .select('id, title')
        .in('id', parentIds);
      parentTitles = Object.fromEntries((parents || []).map((p: any) => [p.id, p.title]));
    }

    const items = (data || []).map((r: any) => ({
      ...r,
      parentTitle: r.parent_id ? parentTitles[r.parent_id] || null : null,
      isLaneGeneral: r.champion === getNoChampionMarker('personal_knowledge'),
    }));

    return NextResponse.json({ success: true, items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { id, action, champion } = await req.json();
    if (!id || !action) return NextResponse.json({ error: 'idとactionが必要です' }, { status: 400 });

    if (action === 'reject') {
      const { error } = await supabase.from('personal_knowledge').delete().eq('id', id).eq('is_atomic', true);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'approve') {
      const update: Record<string, any> = { review_status: 'approved' };
      // レビュー時にチャンピオン/レーン一般の判定を人間が修正できるようにする。
      // 空文字を渡された場合は「レーン一般(チャンピオン無し)」として扱う。
      if (typeof champion === 'string') {
        if (champion.trim() === '') {
          update.champion = getNoChampionMarker('personal_knowledge');
        } else {
          const resolved = await resolveToRosterChampion(champion);
          update.champion = resolved || champion;
        }
      }
      const { error } = await supabase.from('personal_knowledge').update(update).eq('id', id).eq('is_atomic', true);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '無効なactionです' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
