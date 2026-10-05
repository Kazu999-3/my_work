import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { appendMatchupMemo } from '@/lib/matchupMemo';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;

export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 });
    }

    // 試合後タブ: その試合の振り返り1件だけを返す
    const matchIdParam = request.nextUrl.searchParams.get('matchId');
    if (matchIdParam) {
      const { data, error } = await supabase
        .from('soloq_reflections').select('*').eq('match_id', matchIdParam).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ reflection: data || null });
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

    // 対面メモは「前回保存時から変わった時だけ」対面メモ帳へ追記する（再保存で同じ文が重複しないように）
    let previousMatchupMemo: string | null = null;
    if (matchId) {
      const { data: prev } = await supabase
        .from('soloq_reflections').select('matchup_memo').eq('match_id', matchId).maybeSingle();
      previousMatchupMemo = prev?.matchup_memo ?? null;
    }

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

    // 対面メモ帳への追記。失敗しても振り返り自体は保存済みなので、結果を返して画面に出す
    let matchupSync: { ok: boolean; message: string } | null = null;
    const memo = String(matchupMemo || '').trim();
    if (memo && enemyChampion && memo !== (previousMatchupMemo || '').trim()) {
      const r = await appendMatchupMemo({
        myChampion: champion, enemyChampion, text: memo,
        label: '試合後の振り返り', source: 'soloq_reflection',
      });
      matchupSync = r.ok
        ? { ok: true, message: `「${r.champion} vs ${r.enemy}」の対面メモに追記しました` }
        : { ok: false, message: `対面メモへの追記に失敗しました: ${r.error}` };
      if (!r.ok) console.warn('[soloq/reflections] matchup memo sync failed:', r.error);
    }

    return NextResponse.json({ success: true, reflection: data, matchupSync });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
