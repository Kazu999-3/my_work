import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const matchId = resolvedParams.id;
    if (!matchId) {
      return NextResponse.json({ error: '無効なマッチIDです。' }, { status: 400 });
    }

    const { winningTeam, participants } = await request.json();

    if (!winningTeam || !participants || participants.length !== 10) {
      return NextResponse.json({ error: '入力データが不正です。10人の参加者と勝利チームが必要です。' }, { status: 400 });
    }

    // 1. ktm_matches の更新
    const { error: matchError } = await supabase
      .from('ktm_matches')
      .update({ winning_team: winningTeam })
      .eq('id', matchId);

    if (matchError) {
      throw new Error(`試合レコードの更新に失敗: ${matchError.message}`);
    }

    // 2. ktm_match_participants の更新
    for (const p of participants) {
      const { error: partError } = await supabase
        .from('ktm_match_participants')
        .update({
          player_name: p.player_name,
          kills: Number(p.kills) || 0,
          deaths: Number(p.deaths) || 0,
          assists: Number(p.assists) || 0,
          champion_name: p.champion_name || null,
          kda_score: Number(p.deaths) === 0 ? (Number(p.kills) + Number(p.assists)) * 1.2 : Number(((Number(p.kills) + Number(p.assists)) / Number(p.deaths)).toFixed(2)),
          cs: p.cs !== undefined ? Number(p.cs) : null,
          damage_dealt: p.damage_dealt !== undefined ? Number(p.damage_dealt) : null,
          vision_score: p.vision_score !== undefined ? Number(p.vision_score) : null,
          mmr_delta: p.mmr_delta !== undefined ? Number(p.mmr_delta) : 0
        })
        .eq('match_id', matchId)
        .eq('role', p.role)
        .eq('team', p.team);

      if (partError) {
        throw new Error(`参加者 ${p.player_name} (${p.role}) の更新に失敗: ${partError.message}`);
      }
    }

    return NextResponse.json({ success: true, message: '試合結果を更新しました。' });
  } catch (error: any) {
    console.error('Update Match Error:', error);
    return NextResponse.json({ error: error.message || '試合の更新中にエラーが発生しました。' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const matchId = resolvedParams.id;
    if (!matchId) {
      return NextResponse.json({ error: '無効なマッチIDです。' }, { status: 400 });
    }

    // CASCADE制約がない場合に備えて、まず参加者レコードから削除
    const { error: partError } = await supabase
      .from('ktm_match_participants')
      .delete()
      .eq('match_id', matchId);

    if (partError) {
      throw new Error(`参加者データの削除に失敗: ${partError.message}`);
    }

    // 試合本体レコードを削除
    const { error: matchError } = await supabase
      .from('ktm_matches')
      .delete()
      .eq('id', matchId);

    if (matchError) {
      throw new Error(`試合レコードの削除に失敗: ${matchError.message}`);
    }

    return NextResponse.json({ success: true, message: '試合レコードを削除しました。' });
  } catch (error: any) {
    console.error('Delete Match Error:', error);
    return NextResponse.json({ error: error.message || '試合の削除中にエラーが発生しました。' }, { status: 500 });
  }
}
