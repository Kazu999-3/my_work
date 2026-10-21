import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// 管理画面「道筋（試作）」タブ（2026-10-21）。リプレイのミニマップから読み取った10人の秒単位の移動経路。
// 書き込みは PC の読み取りスクリプト（service role）だけで、ここは読むだけ。
//  - GET                 → 読み取り済みの試合の一覧（中身の経路は含めない）
//  - GET ?matchId=JP1_…  → その試合の経路（replay_paths.data）
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await verifyAdminSession(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

  const matchId = new URL(request.url).searchParams.get('matchId');
  if (matchId) {
    if (!/^[A-Z0-9]+_\d+$/.test(matchId)) return NextResponse.json({ error: '試合IDの形式が違います' }, { status: 400 });
    const { data, error } = await supabase.from('replay_paths').select('data').eq('match_id', matchId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'この試合の経路はまだありません' }, { status: 404 });
    return NextResponse.json(data.data);
  }

  const { data, error } = await supabase
    .from('replay_paths')
    .select('match_id, game_version, duration_sec, covered_sec, quality, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ matches: data || [] });
}
