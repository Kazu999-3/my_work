import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';

// 管理画面からリプレイ取り込みキュー（Supabase）に依頼を登録するAPI
// 手元PCで待機しているワーカー（replay_worker.py）がこれを検知して自動実行する。
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await verifyAdminSession(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const matchId = (body.matchId || '').trim();
  const minutes = Number(body.minutes) || 0;

  if (!/^[A-Z0-9]+_\d+$/.test(matchId)) {
    return NextResponse.json({ error: '試合IDの形式が正しくありません（例: JP1_608213185）' }, { status: 400 });
  }

  // 既に完了しているか、実行中かをチェック
  const { data: existing } = await supabase
    .from('replay_paths')
    .select('match_id, quality, data')
    .eq('match_id', matchId)
    .maybeSingle();

  const currentStatus = existing?.quality?.status;
  if (currentStatus === 'capturing' || currentStatus === 'tracking' || currentStatus === 'uploading') {
    return NextResponse.json({ error: `現在この試合は処理中です（状態: ${currentStatus}）` }, { status: 409 });
  }

  const payload = {
    match_id: matchId,
    duration_sec: null,
    covered_sec: null,
    quality: {
      status: 'pending',
      minutes,
      message: '取り込み依頼を受付ました。PCの待機ワーカーが自動で撮影を開始します...',
      requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    data: {
      status: 'pending',
      matchId,
    },
  };

  const { error } = await supabase.from('replay_paths').upsert(payload, { onConflict: 'match_id' });
  if (error) {
    return NextResponse.json({ error: `依頼の登録に失敗しました: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: '取り込み依頼を登録しました！手元のPCで自動撮影が始まります。',
    matchId,
  });
}

export async function DELETE(request: Request) {
  const auth = await verifyAdminSession(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const matchId = url.searchParams.get('matchId');
  if (!matchId) return NextResponse.json({ error: 'matchId が必要です' }, { status: 400 });

  const { error } = await supabase.from('replay_paths').delete().eq('match_id', matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, message: '削除しました' });
}
