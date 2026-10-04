import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { fetchPuuidByRiotId } from '@/lib/riot';

export const dynamic = 'force-dynamic';

// 試合メモ（旧ポータル /api/lol/match-memo の移植）。2026-10-04
//
// 旧版は存在しない coach_analyses.notes 列を読み書きしており、読み込みは常に空、保存は失敗して
// 予備処理で AI 分析結果の focus 欄を「【メモ】…」で上書きする作りだった（機能として一度も動いていない）。
// migration 85 で notes 列を追加した。focus は上書きしない。
// また旧版は持ち主が分からない時に KAZURIN_PUUID / name='かずき' へ切り替えていた。05では Riot ID を必須にする。

export async function GET(request: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const matchId = new URL(request.url).searchParams.get('matchId');
    if (!matchId) return NextResponse.json({ error: 'matchId が必要です' }, { status: 400 });

    const { data, error } = await supabase
      .from('coach_analyses')
      .select('notes, notes_updated_at')
      .eq('match_id', matchId)
      .order('notes_updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({ success: true, matchId, memo: data?.notes || '', updatedAt: data?.notes_updated_at || null });
  } catch (e: any) {
    console.error('[match-memo GET] Error:', e);
    return NextResponse.json({ error: e.message || 'メモの取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const body = await request.json().catch(() => ({}));
    const matchId = String(body.matchId || '').trim();
    if (!matchId) return NextResponse.json({ error: 'matchId が必要です' }, { status: 400 });
    const memo = String(body.memo || '');
    const now = new Date().toISOString();

    // 自動振り返り(cron)が既にその試合の行を作っていれば、そこへメモを足す
    const { data: updated, error: updErr } = await supabase
      .from('coach_analyses')
      .update({ notes: memo, notes_updated_at: now })
      .eq('match_id', matchId)
      .select('id');
    if (updErr) throw updErr;

    if (!updated || updated.length === 0) {
      // まだ行が無い試合: 持ち主の puuid が必要（unique(puuid, match_id)）
      let puuid = String(body.puuid || '').trim();
      const summoner = String(body.summoner || '').trim();
      if (!puuid && summoner.includes('#')) {
        const apiKey = process.env.RIOT_API_KEY;
        if (!apiKey) return NextResponse.json({ error: 'RIOT_API_KEY が未設定です' }, { status: 500 });
        const [gameName, tagLine] = summoner.split('#');
        puuid = await fetchPuuidByRiotId(gameName.trim(), tagLine.trim(), apiKey);
      }
      if (!puuid) {
        return NextResponse.json({ error: 'メモの保存先を特定できません。Riot ID（名前#タグ）を入力してください。' }, { status: 400 });
      }
      const { error: insErr } = await supabase.from('coach_analyses').insert({
        puuid,
        match_id: matchId,
        champion: body.champion || null,
        enemy_champion: body.enemyChampion || null,
        win: typeof body.isWin === 'boolean' ? body.isWin : null,
        notes: memo,
        notes_updated_at: now,
      });
      if (insErr) throw insErr;
    }

    return NextResponse.json({ success: true, matchId, memo, updatedAt: now });
  } catch (e: any) {
    console.error('[match-memo POST] Error:', e);
    return NextResponse.json({ error: e.message || 'メモの保存に失敗しました' }, { status: 500 });
  }
}
