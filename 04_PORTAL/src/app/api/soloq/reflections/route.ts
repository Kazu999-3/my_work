import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { normalizeChampionName } from '../../../../lib/championNames';

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
      nextFocusPoint,
      laneResult
    } = body;

    if (!champion) {
      return NextResponse.json({ error: '使用チャンピオンは必須です。' }, { status: 400 });
    }

    // 試合全体の勝敗(win)とは別に、対面(レーン)単位の勝ち負けを記録する(migration 55)。
    // 集団戦で拾われた/味方の乱入等でチームは勝っても対面には負けている、というケースを
    // 区別するため、未指定なら'even'扱いにはせずnullのまま(「対面成績は記録なし」として
    // 集計から除外する)。
    const validLaneResults = new Set(['win', 'even', 'loss']);
    const normalizedLaneResult = validLaneResults.has(laneResult) ? laneResult : null;

    // クライアント側はsavedMatchIdsによるボタン無効化のみで重複を防いでおり、複数タブや
    // 素早い二重送信をすり抜けると同一試合が重複挿入されうる(2026-08-05発覚)。
    // 以前はinsert前にselectで確認していたが、select→insertの間にレースが残っていたため、
    // match_idへのユニークインデックス(migration 53)を前提にupsert+ignoreDuplicatesへ
    // 置き換えてアトミックに重複を防ぐ。
    const reflectionPayload = {
      champion,
      enemy_champion: enemyChampion || null,
      win: !!win,
      lane_result: normalizedLaneResult,
      kda: kda || null,
      cs: typeof cs === 'number' ? cs : null,
      game_duration: typeof gameDuration === 'number' ? gameDuration : null,
      mental_rating: typeof mentalRating === 'number' ? mentalRating : null,
      win_lose_reason_tags: Array.isArray(winLoseReasonTags) ? winLoseReasonTags : [],
      reflection_note: reflectionNote || null,
      matchup_memo: matchupMemo || null,
      next_focus_point: nextFocusPoint || null,
    };

    const { data: reflectionData, error: insertError } = matchId
      ? await supabaseAdmin
          .from('soloq_reflections')
          .upsert({ match_id: matchId, ...reflectionPayload }, { onConflict: 'match_id', ignoreDuplicates: true })
          .select()
          .maybeSingle()
      : await supabaseAdmin
          .from('soloq_reflections')
          .insert({ match_id: null, ...reflectionPayload })
          .select()
          .single();

    if (insertError) {
      console.error('Error inserting reflection:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    if (matchId && !reflectionData) {
      return NextResponse.json({ error: 'この試合は既に振り返り記録済みです。' }, { status: 409 });
    }

    // 2. If matchupMemo exists, sync to matchup_sentinel
    if (matchupMemo && enemyChampion && enemyChampion !== 'Unknown') {
      // matchup-warning/route.tsと同じ正規化(表記ゆれ・大文字小文字・アポストロフィ差異の吸収)を
      // 通さないと、同一対面が別のmatchup_idとして重複レコード化する(Talonで実際に発生したバグと同型)。
      const normalizedChampion = normalizeChampionName(champion);
      const normalizedEnemy = normalizeChampionName(enemyChampion);
      const matchupId = `${normalizedChampion}_vs_${normalizedEnemy}`;

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
            champion: normalizedChampion,
            enemy: normalizedEnemy,
            title: `${normalizedChampion} vs ${normalizedEnemy} 対策`,
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
