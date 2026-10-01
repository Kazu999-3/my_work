import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { normalizeChampionName } from '@/lib/championNames';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;

export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 });
    }

    const limitParam = Number(request.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_LIMIT)
      : DEFAULT_LIMIT;

    const { data, error } = await supabase
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
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 });
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
      nextFocusPoint,
      laneResult
    } = body;

    if (!champion) {
      return NextResponse.json({ error: '使用チャンピオンは必須です。' }, { status: 400 });
    }

    const validLaneResults = new Set(['win', 'even', 'loss']);
    const normalizedLaneResult = validLaneResults.has(laneResult) ? laneResult : null;

    const reflectionPayload = {
      champion,
      enemy_champion: enemyChampion || null,
      win: !!win,
      lane_result: normalizedLaneResult,
      kda: kda || null,
      cs: cs ? Number(cs) : null,
      game_duration: gameDuration ? Number(gameDuration) : null,
      mental_rating: mentalRating ? Number(mentalRating) : null,
      win_lose_reason_tags: Array.isArray(winLoseReasonTags) ? winLoseReasonTags : [],
      reflection_note: reflectionNote || null,
      matchup_memo: matchupMemo || null,
      next_focus_point: nextFocusPoint || null,
      match_id: matchId || null,
    };

    const { data, error } = await supabase
      .from('soloq_reflections')
      .upsert(reflectionPayload, {
        onConflict: 'match_id',
        ignoreDuplicates: false,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error saving reflection:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 対面メモが入力されていれば matchup_sentinel にも同期
    if (matchupMemo && champion && enemyChampion) {
      const normalizedMy = normalizeChampionName(champion);
      const normalizedEnemy = normalizeChampionName(enemyChampion);

      if (normalizedMy && normalizedEnemy) {
        try {
          await supabase
            .from('matchup_sentinel')
            .upsert({
              champion: normalizedMy,
              enemy: normalizedEnemy,
              strategy: matchupMemo,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'champion,enemy' });
        } catch (e: any) {
          console.warn('matchup_sentinel sync warning:', e);
        }
      }
    }

    return NextResponse.json({ success: true, reflection: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
