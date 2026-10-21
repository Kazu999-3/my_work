import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../lib/adminAuth';
import { supabaseAdmin as supabase } from '../../../lib/supabaseAdmin';

// リプレイ道筋の閲覧API（独立ページ /replay-paths および管理画面共用）
// 管理者セッション、または合言葉（?key=...）を持つユーザーのみ閲覧可能。
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || request.headers.get('x-view-key');
  const expected = process.env.REPLAY_PATHS_VIEW_KEY || 'ktm-scout-secret';
  return !!key && key === expected;
}

export async function GET(request: Request) {
  const adminAuth = await verifyAdminSession(request);
  const isAdmin = adminAuth.ok;

  if (!isAuthorized(request, isAdmin)) {
    return NextResponse.json({ error: '合言葉が正しくありません、または権限がありません' }, { status: 401 });
  }

  const url = new URL(request.url);
  const matchId = url.searchParams.get('matchId');

  // 単一試合の座標データ取得
  if (matchId) {
    if (!/^[A-Z0-9]+_\d+$/.test(matchId)) {
      return NextResponse.json({ error: '試合IDの形式が違います' }, { status: 400 });
    }
    const { data, error } = await supabase.from('replay_paths').select('data').eq('match_id', matchId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'この試合の経路はまだありません' }, { status: 404 });
    return NextResponse.json(data.data);
  }

  // 試合一覧取得
  const { data, error } = await supabase
    .from('replay_paths')
    .select('match_id, game_version, duration_sec, covered_sec, quality, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const viewKey = process.env.REPLAY_PATHS_VIEW_KEY || 'ktm-scout-secret';

  return NextResponse.json({
    matches: data || [],
    isAdmin,
    viewKey: isAdmin ? viewKey : undefined,
  });
}
