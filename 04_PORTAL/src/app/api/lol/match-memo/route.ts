import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');
    if (!matchId) {
      return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
    }

    // coach_analyses からメモ (notes / focus / advice) を取得
    const { data, error } = await supabase
      .from('coach_analyses')
      .select('match_id, notes, focus, advice, updated_at')
      .eq('match_id', matchId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('[match-memo GET] Error:', error);
    }

    return NextResponse.json({
      success: true,
      matchId,
      memo: data?.notes || '',
    });
  } catch (error: any) {
    console.error('[match-memo GET] Error:', error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, memo, champion, enemyChampion, isWin } = body;

    if (!matchId) {
      return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
    }

    let puuid = body.puuid || process.env.KAZURIN_PUUID || '';
    if (!puuid) {
      const { data: player } = await supabase
        .from('ktm_players')
        .select('puuid')
        .eq('name', 'かずき')
        .maybeSingle();
      if (player?.puuid) puuid = player.puuid;
    }

    // coach_analyses にメモを upsert / update
    const updatePayload: any = {
      notes: memo || '',
      updated_at: new Date().toISOString(),
    };
    if (champion) updatePayload.champion = champion;
    if (enemyChampion) updatePayload.enemy_champion = enemyChampion;
    if (isWin !== undefined) updatePayload.win = isWin;
    if (puuid) updatePayload.puuid = puuid;
    updatePayload.match_id = matchId;

    const { data, error } = await supabase
      .from('coach_analyses')
      .upsert(updatePayload, { onConflict: 'puuid,match_id' })
      .select()
      .maybeSingle();

    if (error) {
      // notes カラムが存在しない場合のフォールバック: advice または focus に付与
      console.warn('[match-memo POST] upsert with notes failed, attempting fallback:', error);
      const fallbackPayload: any = {
        puuid: puuid || 'unknown',
        match_id: matchId,
        focus: memo ? `【メモ】${memo}` : null,
      };
      await supabase.from('coach_analyses').upsert(fallbackPayload, { onConflict: 'puuid,match_id' });
    }

    return NextResponse.json({
      success: true,
      matchId,
      memo: memo || '',
    });
  } catch (error: any) {
    console.error('[match-memo POST] Error:', error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
