import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from('soloq_reflections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

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
