import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { performFullMmrRebuild } from '../../../../../lib/mmr';


export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
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
    // 以前は10人分をforループで1件ずつ逐次UPDATE(N+1)していたが、
    // update_match_participants_batch(RPC)でmatch_id×role×teamを突き合わせた
    // 単一のUPDATE文にまとめる(migration 49)。値の計算自体はここで行い、
    // 計算済みの配列をそのままDB側へ渡す。
    const participantRows = participants.map((p: any) => ({
      role: p.role,
      team: p.team,
      player_name: p.player_name,
      kills: Number(p.kills) || 0,
      deaths: Number(p.deaths) || 0,
      assists: Number(p.assists) || 0,
      champion_name: p.champion_name || null,
      kda_score: Number(p.deaths) === 0 ? (Number(p.kills) + Number(p.assists)) * 1.2 : Number(((Number(p.kills) + Number(p.assists)) / Number(p.deaths)).toFixed(2)),
      cs: p.cs !== undefined ? Number(p.cs) : null,
      damage_dealt: p.damage_dealt !== undefined ? Number(p.damage_dealt) : null,
      vision_score: p.vision_score !== undefined ? Number(p.vision_score) : null,
      mmr_delta: p.mmr_delta !== undefined ? Number(p.mmr_delta) : 0,
    }));

    const { error: partError } = await supabase.rpc('update_match_participants_batch', {
      p_match_id: matchId,
      p_participants: participantRows,
    });
    if (partError) {
      throw new Error(`参加者データの更新に失敗: ${partError.message}`);
    }

    // 名前を差し替えた行の discord_id も新しい名前の人に合わせる。
    // 2026-10-17: 上の一括更新は player_name しか書かず discord_id が元の人のまま残っていた。リビルドは
    // discord_id を優先して人を引くため、名前を「エマ*fam」に直しても MMR・試合数は「ﾀﾛｽ」に付いたままだった。
    // 名簿に無い名前（ゲスト）は discord_id を外す（元の人に紐づけたままにしない）。
    const names = Array.from(new Set(participants.map((p: any) => p.player_name).filter(Boolean)));
    const { data: rosterRows, error: rosterErr } = await supabase
      .from('ktm_players')
      .select('name, discord_id')
      .in('name', names);
    if (rosterErr) {
      throw new Error(`名簿の取得に失敗: ${rosterErr.message}`);
    }
    const discordByName = new Map((rosterRows || []).map((r: any) => [r.name, r.discord_id || null]));
    for (const p of participants) {
      const { error: idErr } = await supabase
        .from('ktm_match_participants')
        .update({ discord_id: discordByName.get(p.player_name) ?? null })
        .eq('match_id', matchId)
        .eq('role', p.role)
        .eq('team', p.team);
      if (idErr) {
        throw new Error(`参加者の紐付け更新に失敗: ${idErr.message}`);
      }
    }

    // #28: 試合内容の編集でMMRがズレるため、編集後に自動Rebuild（保存値＝導出値を維持）
    await performFullMmrRebuild(supabase);

    return NextResponse.json({ success: true, message: '試合結果を更新し、MMRを再計算しました。' });
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
  // ===== 管理者セッション確認（PUTにはあったがDELETEに無かったため追加） =====
  const authResult = await verifyAdminSession(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
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

    // #28: 試合削除でMMRがズレるため、削除後に自動Rebuild
    await performFullMmrRebuild(supabase);

    return NextResponse.json({ success: true, message: '試合レコードを削除し、MMRを再計算しました。' });
  } catch (error: any) {
    console.error('Delete Match Error:', error);
    return NextResponse.json({ error: error.message || '試合の削除中にエラーが発生しました。' }, { status: 500 });
  }
}
