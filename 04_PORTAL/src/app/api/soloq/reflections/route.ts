import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// 「前回の次回テーマ」「保存済みマッチ判定」等の軽量呼び出しは既定の10件で十分だが、
// 「過去ログ」ダッシュボード(MySoloQDashboard)が全件集計・全文検索に使うため、
// ?limit=クエリで取得件数を指定できるようにする(既定は互換のため10のまま)。
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 500;

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminSession(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
    }

    const limitParam = Number(request.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_LIMIT)
      : DEFAULT_LIMIT;

    const { data, error } = await supabaseAdmin
      .from('soloq_reflections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching reflections:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const reflections = data || [];
    const latestReflection = reflections.length > 0 ? reflections[0] : null;

    return NextResponse.json({
      reflection: latestReflection,
      reflections: reflections,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await verifyAdminSession(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
    }

    const body = await request.json();
    const {
      matchId,
      champion,
      enemyChampion,
      win,
      kda,
      cs,
      gameDuration,
      mentalRating,
      winLoseReasonTags,
      reflectionNote,
      matchupMemo,
      nextFocusPoint
    } = body;

    if (!champion) {
      return NextResponse.json({ error: '使用チャンピオンは必須です。' }, { status: 400 });
    }

    // クライアント側はsavedMatchIdsによるボタン無効化のみで重複を防いでおり、複数タブや
    // 素早い二重送信をすり抜けると同一試合が重複挿入される(2026-08-05発覚)。一意制約が
    // 無いため、insert前にサーバー側で同一match_idの既存レコードを確認する。
    if (matchId) {
      const { data: dup } = await supabaseAdmin
        .from('soloq_reflections')
        .select('id')
        .eq('match_id', matchId)
        .maybeSingle();
      if (dup) {
        return NextResponse.json({ error: 'この試合は既に振り返り記録済みです。' }, { status: 409 });
      }
    }

    // 1. Insert into soloq_reflections
    const { data: reflectionData, error: insertError } = await supabaseAdmin
      .from('soloq_reflections')
      .insert({
        match_id: matchId || null,
        champion,
        enemy_champion: enemyChampion || null,
        win: !!win,
        kda: kda || null,
        cs: typeof cs === 'number' ? cs : null,
        game_duration: typeof gameDuration === 'number' ? gameDuration : null,
        mental_rating: typeof mentalRating === 'number' ? mentalRating : null,
        win_lose_reason_tags: Array.isArray(winLoseReasonTags) ? winLoseReasonTags : [],
        reflection_note: reflectionNote || null,
        matchup_memo: matchupMemo || null,
        next_focus_point: nextFocusPoint || null
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting reflection:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 2. If matchupMemo exists, sync to matchup_sentinel
    if (matchupMemo && enemyChampion && enemyChampion !== 'Unknown') {
      const matchupId = `${champion}_vs_${enemyChampion}`;
      
      const { data: existingMatchup } = await supabaseAdmin
        .from('matchup_sentinel')
        .select('*')
        .eq('matchup_id', matchupId)
        .maybeSingle();

      const timestampHeader = `\n\n【ソロQ振り返りメモ (${new Date().toLocaleDateString('ja-JP')})】\n`;
      const memoToAppend = timestampHeader + matchupMemo;

      if (existingMatchup) {
        const updatedStrategy = (existingMatchup.strategy || '') + memoToAppend;
        await supabaseAdmin
          .from('matchup_sentinel')
          .update({
            strategy: updatedStrategy,
          })
          .eq('matchup_id', matchupId);
      } else {
        await supabaseAdmin
          .from('matchup_sentinel')
          .insert({
            matchup_id: matchupId,
            champion: champion,
            enemy: enemyChampion,
            title: `${champion} vs ${enemyChampion} 対策`,
            strategy: matchupMemo,
            raw_data: { source: 'soloq_reflection', created_at: new Date().toISOString() }
          });
      }
    }

    return NextResponse.json({ success: true, reflection: reflectionData });
  } catch (err: any) {
    console.error('Error in soloq reflections POST:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
